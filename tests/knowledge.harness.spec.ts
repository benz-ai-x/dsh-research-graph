import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanups.splice(0).reverse()) await dispose()
})

describe('Knowledge Cards public Host workflow', () => {
  it('keeps the presentation Host identity across restart and separates another storage Host', async () => {
    const roots = await Promise.all([mkdtemp(join(tmpdir(), 'session-graph-identity-')), mkdtemp(join(tmpdir(), 'session-graph-identity-'))])
    for (const root of roots) cleanups.push(() => rm(root, { recursive: true, force: true }))
    const first = await topicHost(roots[0]!, cleanups)
    const identity = (host: typeof first) => host.ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method: 'hostIdentity',
      args: {}, signal: new AbortController().signal })
    const saved = await identity(first)
    await first.ctx.fiber.dispose()
    expect(await identity(await topicHost(roots[0]!, cleanups))).toEqual(saved)
    expect(await identity(await topicHost(roots[1]!, cleanups))).not.toEqual(saved)
  })
  it('finds detached cards independently of source workspace and preserves revisions when reattaching', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-knowledge-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const invoke = (method: string, request: unknown) => host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method, args: { request }, signal: new AbortController().signal,
    })
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    await host.invoke('write', { kind: 'create', topicId, title: '主题' })
    const card = await invoke('save', {
      cardId: '2bb797e8-16ad-4d78-8f41-c0a5efaf8451', revisionId: '3bb797e8-16ad-4d78-8f41-c0a5efaf8451', topicId,
      content: { title: '证据卡片', question: '', conclusion: '精确范围', rationale: '', openQuestions: '', kind: 'method', status: 'draft' }, sources: [],
    })
    expect(await invoke('search', { query: '精确', topicId })).toEqual([card])
    const detached = await invoke('membership', { cardId: card.cardId, topicId, attached: false })
    expect(detached.revisions).toEqual(card.revisions)
    expect(await invoke('search', { query: '证据', topicId })).toEqual([])
    expect(await invoke('search', { query: '精确' })).toEqual([detached])
    expect(await invoke('membership', { cardId: card.cardId, topicId, attached: true })).toEqual(card)
    expect(await invoke('membership', { cardId: card.cardId, topicId, attached: true })).toEqual(card)
  })

  it('keeps old revisions immutable and makes repeated saves idempotent across restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-knowledge-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const invoke = (method: string, request: unknown) => host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method, args: { request }, signal: new AbortController().signal,
    })
    const first = {
      cardId: '2bb797e8-16ad-4d78-8f41-c0a5efaf8451', revisionId: '3bb797e8-16ad-4d78-8f41-c0a5efaf8451',
      content: { title: '第一版', question: '', conclusion: '条件 A', rationale: '', openQuestions: '', kind: 'hypothesis', status: 'draft' }, sources: [],
    }
    const initial = await invoke('save', first)
    const second = { ...first, revisionId: '4bb797e8-16ad-4d78-8f41-c0a5efaf8451', content: { ...first.content, title: '第二版', conclusion: '条件 A 和 B' } }
    const updated = await invoke('save', second)
    expect(updated.revisions).toHaveLength(2)
    expect(updated.revisions[0]).toEqual(initial.revisions[0])
    expect(updated.revisions[1]).toMatchObject({ number: 2, content: second.content })
    expect(await invoke('save', first)).toEqual(updated)
    expect(await invoke('save', second)).toEqual(updated)
    await expect(invoke('save', { ...second, content: first.content })).rejects.toThrow()
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect(await restarted.ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method: 'read',
      args: { request: { cardId: first.cardId } }, signal: new AbortController().signal })).toEqual(updated)
  })

  it('saves selected discussion as a durable card with its exact source and topic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-knowledge-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const session = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      source: { kind: 'user' }, content: [{ type: 'text', text: '如何保留证据？' }],
    }), { surfaceOp: 'append' })
    session.append('assistant/message', {
      turn: 1, step: 1, stream: [], message: createAssistantMessage({
        source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: '按准确轮次保存来源摘录。' }],
      }),
    }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    host.ctx.effect(() => host.ctx.sessions.enter(session))
    const before = await host.ctx.sessionController.inspect(session.id)
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    await host.invoke('write', { kind: 'create', topicId, title: '证据研究' })
    const events = before.events
    const request = {
      cardId: '2bb797e8-16ad-4d78-8f41-c0a5efaf8451', revisionId: '3bb797e8-16ad-4d78-8f41-c0a5efaf8451', topicId,
      content: { title: '保留来源', question: '如何保留证据？', conclusion: '保存准确的讨论范围', rationale: '可回溯', openQuestions: '', kind: 'method', status: 'draft' },
      sources: [{ kind: 'discussion', sessionId: session.id,
        startSeq: events.find(event => event.type === 'turn/start')!.seq,
        endSeq: events.find(event => event.type === 'turn/end')!.seq }],
    }
    const saved = await host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method: 'save', args: { request }, signal: new AbortController().signal,
    })
    expect(saved).toMatchObject({ cardId: request.cardId, topicIds: [topicId], revisions: [{
      revisionId: request.revisionId, number: 1, content: request.content,
      sources: [{ sessionId: session.id, source: { startSeq: request.sources[0]!.startSeq, endSeq: request.sources[0]!.endSeq,
        turns: [{ messages: [{ text: '如何保留证据？' }, { text: '按准确轮次保存来源摘录。' }] }] } }],
    }] })
    expect(await host.ctx.sessionController.inspect(session.id)).toEqual(before)
    expect(host.ctx.llm.stream).not.toHaveBeenCalled()
    const unavailable = vi.spyOn(host.ctx.sessionController, 'inspect').mockRejectedValue(new Error('Source is unavailable'))
    const edited = await host.ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method: 'save',
      args: { request: { ...request, revisionId: '4bb797e8-16ad-4d78-8f41-c0a5efaf8451',
        content: { ...request.content, title: '保留来源的新修订' },
        sources: [{ kind: 'revision', cardId: saved.cardId, revisionId: saved.revisions[0].revisionId, sourceIndex: 0 }],
      } }, signal: new AbortController().signal })
    expect(edited.revisions[1].sources).toEqual(saved.revisions[0].sources)
    expect(edited.revisions[0]).toEqual(saved.revisions[0])
    unavailable.mockRestore()
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect(await restarted.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method: 'read', args: { request: { cardId: request.cardId } }, signal: new AbortController().signal,
    })).toEqual(edited)
  })
})
