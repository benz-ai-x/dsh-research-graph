import { Context } from '@deepseek-ai/cordis'
import SessionStore, { type Session } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { createAssistantMessage, createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { createSessionTestController } from 'harness-session-controller-test-support'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/index.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function historyHost(): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'session-graph-history-'))
  const ctx = new Context()
  cleanups.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  ctx.provide('llm', { stream: vi.fn(() => { throw new Error('Reading must not call a model') }) })
  await ctx.plugin({
    inject: ['sessions', 'sessionPersistence', 'llm'],
    apply(controllerCtx) {
      createSessionTestController(controllerCtx, {
        cwd: '/test', defaultModelSelection: () => ({ provider: 'test', model: 'test' }),
      })
    },
  })
  await ctx.plugin({ apply, inject })
  return ctx
}

function addTurn(session: Session, turn: number, prompt: string, answer: string): void {
  session.append('turn/start', { turn })
  session.append('step/start', { turn, step: 1 })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text: prompt }],
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn, step: 1,
    message: createAssistantMessage({
      source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: answer }],
    }),
    stream: [
      { type: 'text-chunks', time0: Date.now(), index: 0, dt: [], texts: [answer] },
      { type: 'chunk', time: Date.now(), chunk: { type: 'finish', reason: { kind: 'stop' } } },
    ],
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn, step: 1 })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

describe('Session History public Host interface', () => {
  it('preserves discussion text and roles while excluding injected context, attachments, reasoning, and tool output', async () => {
    const ctx = await historyHost()
    const session = ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })
    const image = {
      attachmentId: AttachmentId('fixture-image'), mediaType: 'image/png' as const,
      bytes: 1, width: 1, height: 1, name: 'private-image.png',
    }
    const callId = ToolCallId('fixture-call')
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('user/message', createUserMessage({
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'First question.' },
        { type: 'image', attachment: image },
        { type: 'file', attachment: { attachmentId: AttachmentId('fixture-file'), name: 'private-notes.txt', bytes: 4 } },
        { type: 'text', text: 'More context.' },
      ],
    }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      source: { kind: 'user' }, content: [{ type: 'image', attachment: image }],
    }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      source: { kind: 'plugin', plugin: 'fixture' },
      content: [{ type: 'text', text: 'Injected context must stay out.' }],
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1, step: 1, stream: [],
      message: createAssistantMessage({
        source: { provider: 'fixture', model: 'fixture' },
        content: [
          { type: 'reasoning', text: 'Private reasoning must stay out.' },
          { type: 'text', text: 'Visible analysis.' },
          { type: 'tool-call', id: callId, name: 'echo', arguments: '{"private":"argument"}' },
          { type: 'text', text: 'Visible continuation.' },
        ],
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId, name: 'echo', arguments: '{"private":"argument"}' })
    session.append('tool/result', {
      turn: 1, step: 1,
      message: createToolResultMessage({
        callId, content: [{ type: 'text', text: 'Tool output must stay out.' }], isError: false,
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('step/start', { turn: 1, step: 2 })
    session.append('assistant/message', {
      turn: 1, step: 2, stream: [],
      message: createAssistantMessage({
        source: { provider: 'fixture', model: 'fixture' },
        content: [{ type: 'text', text: 'Recorded conclusion.' }],
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 2 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    ctx.effect(() => ctx.sessions.enter(session))
    const before = await ctx.sessionController.inspect(session.id)

    const result = await ctx.get('sessionGraphHistory').read({ sessionId: session.id }, new AbortController().signal)

    expect(result.kind).toBe('original')
    expect(result.turns).toHaveLength(1)
    expect(result.turns[0]?.messages).toEqual([
      { role: 'user', seq: 2, text: 'First question.\nMore context.' },
      { role: 'assistant', seq: 5, text: 'Visible analysis.\nVisible continuation.' },
      { role: 'assistant', seq: 10, text: 'Recorded conclusion.' },
    ])
    expect(await ctx.sessionController.inspect(session.id)).toEqual(before)
    expect(ctx.llm.stream).not.toHaveBeenCalled()
  })

  it('exposes unfinished turn status without presenting its changing text as completed discussion', async () => {
    const ctx = await historyHost()
    const session = ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })
    addTurn(session, 1, 'Complete question', 'Complete answer')
    session.append('turn/start', { turn: 2 })
    session.append('step/start', { turn: 2, step: 1 })
    session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Pending question' }] }), { surfaceOp: 'append' })
    ctx.effect(() => ctx.sessions.enter(session))
    const service = ctx.get('sessionGraphHistory')
    const signal = new AbortController().signal
    const pending = await service.read({ sessionId: session.id }, signal)
    expect(pending.turns[1]).toMatchObject({ turn: 2, startSeq: 6, endSeq: null, messages: [] })
    session.append('step/end', { turn: 2, step: 1 })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    const complete = await service.read({ sessionId: session.id }, signal)
    expect(complete.turns[1]).toMatchObject({ turn: 2, startSeq: 6, endSeq: 10, messages: [{ role: 'user', seq: 8, text: 'Pending question' }] })
    expect(pending.turns[1]?.endSeq).toBeNull()
  })

  it.each(['before reading', 'during reading', 'Host disposal'] as const)('rejects canceled history on %s even when the source replies late', async action => {
    const ctx = new Context()
    cleanups.push(async () => { await ctx.fiber.dispose() })
    let release: (value: { meta: { id: string }; events: [] }) => void = () => {}
    const pending = new Promise<{ meta: { id: string }; events: [] }>(resolve => { release = resolve })
    ctx.provide('sessionController', { inspect: () => pending })
    ctx.provide('llm', { async *stream() { throw new Error('No model calls') } })
    await apply(ctx)
    const caller = new AbortController()
    if (action === 'before reading') caller.abort(new Error('Caller canceled'))
    const read = ctx.get('sessionGraphHistory').read({ sessionId: 'source' }, caller.signal)
    const assertion = expect(read).rejects.toThrow(action === 'Host disposal' ? 'Session History service is disposed' : 'Caller canceled')
    if (action === 'during reading') caller.abort(new Error('Caller canceled'))
    const disposal = action === 'Host disposal' ? ctx.fiber.dispose() : undefined
    await new Promise(resolve => setImmediate(resolve))
    release({ meta: { id: 'source' }, events: [] })
    await assertion
    await disposal
  })

  it.each([
    { limit: 0 }, { limit: 21 }, { anchorSeq: -1 }, { beforeSeq: 0, afterSeq: 6 },
    { source: { startSeq: 0, endSeq: 5, turns: [] } },
    { source: { startSeq: 0, endSeq: 5, turns: [{ turn: 1, startSeq: 0, endSeq: null, startedAt: 1000, messages: [] }] } },
  ])('rejects invalid paging or an unfinished saved source: %j', async options => {
    const ctx = await historyHost()
    await expect(ctx.get('sessionGraphHistory').read({ sessionId: 'missing-source', ...options }, new AbortController().signal))
      .rejects.toThrow('Invalid Session History request')
  })

  it('reopens exactly a selected completed range from the original even after newer turns arrive', async () => {
    const ctx = await historyHost()
    const session = ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })
    addTurn(session, 1, 'Earlier question', 'Earlier answer')
    addTurn(session, 2, 'Selected question', 'Selected answer')
    addTurn(session, 3, 'Later question', 'Later answer')
    ctx.effect(() => ctx.sessions.enter(session))
    const service = ctx.get('sessionGraphHistory')
    const source = { startSeq: 6, endSeq: 11, turns: [{
      turn: 2, startSeq: 6, endSeq: 11, startedAt: 1000,
      messages: [{ role: 'user' as const, seq: 8, text: 'An old excerpt must not replace available original text.' }],
    }] }
    addTurn(session, 4, 'Newest question', 'Newest answer')
    const result = await service.read({ sessionId: session.id, source }, new AbortController().signal)
    expect(result).toMatchObject({
      kind: 'original', hasEarlier: true, hasLater: true, turns: [{
        turn: 2, startSeq: 6, endSeq: 11,
        messages: [{ role: 'user', text: 'Selected question' }, { role: 'assistant', text: 'Selected answer' }],
      }],
    })
    expect(result.turns).toHaveLength(1)
  })

  it('distinguishes an unavailable original from a previously captured excerpt without inventing source text', async () => {
    const ctx = await historyHost()
    const source = { startSeq: 0, endSeq: 5, turns: [{
      turn: 1, startSeq: 0, endSeq: 5, startedAt: 1000,
      messages: [{ role: 'user' as const, seq: 2, text: 'Previously captured discussion.' }],
    }] }
    const service = ctx.get('sessionGraphHistory')
    const signal = new AbortController().signal
    expect(await service.read({ sessionId: 'missing-source' }, signal)).toMatchObject({
      kind: 'unavailable', sessionId: 'missing-source', turns: [], hasEarlier: false, hasLater: false,
    })
    expect(await service.read({ sessionId: 'missing-source', source }, signal)).toMatchObject({
      kind: 'excerpt', sessionId: 'missing-source', turns: source.turns, hasEarlier: false, hasLater: false,
    })
  })

  it('locates and pages repeated discussion text by Session and event boundary', async () => {
    const ctx = await historyHost()
    const sources = [ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } }), ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })]
    for (const session of sources) {
      for (const turn of [1, 2, 3]) addTurn(session, turn, 'Repeated question', 'Repeated answer')
      session.append('session/title', { title: 'Same title' })
      ctx.effect(() => ctx.sessions.enter(session))
    }
    const sessionId = sources[1]!.id
    const service = ctx.get('sessionGraphHistory')
    const signal = new AbortController().signal
    const middle = await service.read({ sessionId, anchorSeq: 6, limit: 1 }, signal)
    const earlier = await service.read({ sessionId, beforeSeq: 6, limit: 1 }, signal)
    const later = await service.read({ sessionId, afterSeq: 6, limit: 1 }, signal)
    expect([earlier, middle, later]).toMatchObject([
      { sessionId, hasEarlier: false, hasLater: true, turns: [{ turn: 1, startSeq: 0, endSeq: 5 }] },
      { sessionId, hasEarlier: true, hasLater: true, turns: [{ turn: 2, startSeq: 6, endSeq: 11 }] },
      { sessionId, hasEarlier: true, hasLater: false, turns: [{ turn: 3, startSeq: 12, endSeq: 17 }] },
    ])
    expect([earlier, middle, later].map(page => page.turns.length)).toEqual([1, 1, 1])
  })

  it('reads a complete cold discussion without activating an Agent, generating text, or changing the source', async () => {
    const ctx = await historyHost()
    const session = ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })
    addTurn(session, 1, 'Why keep the discussion?', 'To preserve its reasoning.\nAnd its original context.')
    const writer = await ctx.sessionPersistence.create(session.header)
    try {
      await writer.append(session.snapshotEvents())
      await writer.flush()
    } finally { await writer.close() }
    const before = await ctx.sessionController.inspect(session.id)

    const result = await ctx.get('sessionGraphHistory').read({ sessionId: session.id }, new AbortController().signal)

    expect(result).toMatchObject({ kind: 'original', sessionId: session.id, turns: [{
      turn: 1, startSeq: 0, endSeq: 5,
      messages: [
        { role: 'user', seq: 2, text: 'Why keep the discussion?' },
        { role: 'assistant', seq: 3, text: 'To preserve its reasoning.\nAnd its original context.' },
      ],
    }] })
    expect(await ctx.sessionController.inspect(session.id)).toEqual(before)
    expect(ctx.sessions.get(session.id)).toBeUndefined()
    expect(ctx.llm.stream).not.toHaveBeenCalled()
  })
})
