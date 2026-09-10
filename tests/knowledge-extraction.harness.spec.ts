import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const dispose of cleanups.splice(0).reverse()) await dispose() })

describe('Knowledge extraction public Host workflow', () => {
  it('previews the included range, validates model citations and saves only explicit reviewed drafts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-extraction-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    let host = await topicHost(root, cleanups)
    const session = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    for (let turn = 1; turn <= 3; turn += 1) {
      session.append('turn/start', { turn })
      session.append('user/message', createUserMessage({ source: { kind: 'user' },
        content: [{ type: 'text', text: `证据 ${turn}：${'长文本'.repeat(200)}` }] }), { surfaceOp: 'append' })
      session.append('turn/end', { turn, reason: { kind: 'completed' } })
    }
    host.ctx.effect(() => host.ctx.sessions.enter(session))
    const before = await host.ctx.sessionController.inspect(session.id)
    const starts = before.events.filter(event => event.type === 'turn/start').map(event => event.seq)
    const ends = before.events.filter(event => event.type === 'turn/end').map(event => event.seq)
    const invoke = (method: string, request: unknown, signal = new AbortController().signal) => host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method, args: { request }, signal,
    })
    const preview = await invoke('prepareExtraction', {
      source: { kind: 'discussion', sessionId: session.id, startSeq: starts[0], endSeq: ends[2] }, budgetChars: 1200,
    })
    expect(preview.selected.source.turns).toHaveLength(3)
    expect(preview.included.source.turns).toHaveLength(1)
    expect(preview.omitted).toEqual([{ startSeq: starts[1], endSeq: ends[1] }, { startSeq: starts[2], endSeq: ends[2] }])
    expect(host.ctx.llm.stream).not.toHaveBeenCalled()
    await host.ctx.fiber.dispose()
    host = await topicHost(root, cleanups)
    const base = { title: '提炼方法', question: '如何处理证据', conclusion: '先检查条件', rationale: '', openQuestions: '', kind: 'method', status: 'confirmed' }
    vi.mocked(host.ctx.llm.stream).mockImplementation(async function* (options) {
      expect(options.provider).toBe('fixture')
      expect(options.model).toBe('fixed-v1')
      const input = JSON.stringify(options.messages)
      expect(input).toContain('证据 1')
      expect(input).not.toContain('证据 2')
      yield { type: 'text-delta', index: 0, text: JSON.stringify({ cards: [
        { ...base, citations: [{ startSeq: starts[0], endSeq: ends[0] }] },
        { ...base, title: '越界引用', citations: [{ startSeq: starts[1], endSeq: ends[1] }] },
        { ...base, title: '无引用', citations: [] },
      ] }) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    const generated = await invoke('extract', { preparationId: preview.preparationId, provider: 'fixture', model: 'fixed-v1' })
    expect(generated.drafts).toHaveLength(3)
    expect(generated.drafts[0]).toMatchObject({ content: { status: 'draft' }, needsVerification: false, invalidCitations: 0,
      sources: [{ kind: 'extraction', preparationId: preview.preparationId, startSeq: starts[0], endSeq: ends[0] }] })
    expect(generated.drafts[1]).toMatchObject({ sources: [], needsVerification: true, invalidCitations: 1 })
    expect(generated.drafts[2]).toMatchObject({ sources: [], needsVerification: true, invalidCitations: 0 })
    expect(await invoke('search', { query: '' })).toEqual([])
    const draft = generated.drafts[0]
    const saved = await invoke('save', { cardId: draft.cardId, revisionId: draft.revisionId,
      content: { ...draft.content, conclusion: '人工修订后的方法' }, sources: draft.sources })
    expect(saved.revisions[0].content.conclusion).toBe('人工修订后的方法')
    expect(saved.revisions[0].sources[0]).toEqual(preview.included)
    await expect(invoke('save', { cardId: generated.drafts[1].cardId, revisionId: generated.drafts[1].revisionId,
      content: generated.drafts[1].content, sources: [{ kind: 'extraction', preparationId: preview.preparationId,
        startSeq: starts[1], endSeq: ends[1] }] })).rejects.toThrow('outside')

    let release!: () => void
    let started!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    const entered = new Promise<void>(resolve => { started = resolve })
    let modelSignal: AbortSignal | undefined
    vi.mocked(host.ctx.llm.stream).mockImplementationOnce(async function* (options) {
      modelSignal = options.signal
      started()
      await waiting
      yield { type: 'text-delta', index: 0, text: '{}' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    const controller = new AbortController()
    const canceled = expect(invoke('extract', { preparationId: preview.preparationId, provider: 'fixture', model: 'fixed-v1' }, controller.signal)).rejects.toThrow()
    await entered
    controller.abort(new Error('User canceled'))
    expect(modelSignal?.aborted).toBe(true)
    release()
    await canceled
    expect(await invoke('search', { query: '' })).toEqual([saved])
    // The attached-only original disappeared with the first Host; its retained
    // extraction snapshot still supports generation and the explicit save.
    await expect(host.ctx.sessionController.inspect(session.id)).rejects.toThrow('not found')
    expect(session.snapshotEvents()).toEqual(before.events)
  })
})
