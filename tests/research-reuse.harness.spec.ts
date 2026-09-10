import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setImmediate } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const dispose of cleanups.splice(0).reverse()) await dispose() })

describe('Research material reuse public Host workflow', () => {
  it.each(['active', 'canceled'])('waits for %s target creation to finish journaling before returning recovery state', async state => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-reuse-recovery-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { ctx } = await topicHost(root, cleanups)
    const card = await ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(),
      content: { title: '固定材料', question: '', conclusion: '已知条件', rationale: '', openQuestions: '', kind: 'method', status: 'draft' },
      sources: [] }, new AbortController().signal)
    const record = await ctx.sessionGraphReuse.prepare({ operationId: randomUUID(), workspaceId: 'b', question: '如何继续？',
      materials: [{ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0]!.revisionId }] }, new AbortController().signal)
    const creation = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    vi.spyOn(ctx.sessionController, 'create').mockImplementation(async () => {
      entered.resolve()
      await creation.promise
      return { sessionId: record.targetSessionId as never }
    })
    const prompt = vi.spyOn(ctx.sessionController, 'prompt').mockResolvedValue({ accepted: true })
    const controller = new AbortController()
    const submission = ctx.sessionGraphReuse.submit({ operationId: record.operationId }, controller.signal).catch(() => undefined)
    await entered.promise
    if (state === 'canceled') controller.abort()
    let settled = false
    const recovery = ctx.sessionGraphReuse.read({ operationId: record.operationId }, new AbortController().signal).then(value => { settled = true; return value })
    await setImmediate()
    const waitingForCreation = !settled
    creation.resolve()
    const [, saved] = await Promise.all([submission, recovery])
    expect(waitingForCreation).toBe(true)
    expect(saved).toMatchObject({ targetSessionId: record.targetSessionId, targetCreated: true, stage: state === 'active' ? 'accepted' : 'created' })
    expect(prompt).toHaveBeenCalledTimes(state === 'active' ? 1 : 0)
  })

  it('freezes exact material and recovers a lost admission response with the same target and request identities', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-reuse-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    let host = await topicHost(root, cleanups)
    const invoke = (method: string, request: unknown) => host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphReuse', method, args: { request }, signal: new AbortController().signal,
    })
    const knowledge = (request: unknown) => host.ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method: 'save',
      args: { request }, signal: new AbortController().signal })
    const card = { cardId: randomUUID(), revisionId: randomUUID(), content: { title: '方法 V1', question: '', conclusion: '原版本条件',
      rationale: '', openQuestions: '', kind: 'method', status: 'confirmed' }, sources: [] }
    await knowledge(card)
    const session = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '只选这个完整轮次' }] }), { surfaceOp: 'append' })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    host.ctx.effect(() => host.ctx.sessions.enter(session))
    const before = await host.ctx.sessionController.inspect(session.id)
    const material = { kind: 'turn', sessionId: session.id, startSeq: before.events[0]!.seq, endSeq: before.events.at(-1)!.seq }
    const sourcedCard = { ...card, cardId: randomUUID(), revisionId: randomUUID(), sources: [{ ...material, kind: 'discussion' }] }
    await knowledge(sourcedCard)
    const cardOnly = await invoke('prepare', { operationId: randomUUID(), question: '只使用卡片', workspaceId: 'b',
      materials: [{ kind: 'card', cardId: sourcedCard.cardId, revisionId: sourcedCard.revisionId }] })
    expect(cardOnly.promptText).not.toContain('只选这个完整轮次')
    expect(cardOnly.materials[0].sources[0]).toMatchObject({ sessionId: session.id, startSeq: material.startSeq, endSeq: material.endSeq })
    const large = { ...card, cardId: randomUUID(), revisionId: randomUUID(),
      content: { ...card.content, conclusion: 'x'.repeat(24_000), rationale: 'y'.repeat(24_000) } }
    await knowledge(large)
    await expect(invoke('prepare', { operationId: randomUUID(), question: '超出预算', workspaceId: 'b',
      materials: [{ kind: 'card', cardId: large.cardId, revisionId: large.revisionId }] })).rejects.toThrow('budget')
    const selection = [{ kind: 'card', cardId: card.cardId, revisionId: card.revisionId }, material]
    const request = { operationId: randomUUID(), materials: selection, question: '在这些条件下如何继续？', workspaceId: 'b' }
    await expect(invoke('prepare', { ...request, materials: [] })).rejects.toThrow()
    await expect(invoke('prepare', { ...request, materials: [...selection, ...selection] })).rejects.toThrow()
    expect((await invoke('prepare', { ...request, operationId: randomUUID(), materials: [...selection,
      { kind: 'card', cardId: sourcedCard.cardId, revisionId: sourcedCard.revisionId }] })).materials).toHaveLength(3)
    const preview = await invoke('prepare', request)
    expect(preview).toMatchObject({ stage: 'prepared', targetCreated: false, workspace: { id: 'b', cwd: '/b' } })
    expect(preview.materials).toHaveLength(2)
    expect(preview.promptText).toContain('原版本条件')
    expect(preview.promptText).toContain('只选这个完整轮次')
    expect(await invoke('forSession', { sessionId: preview.targetSessionId })).toEqual([])
    await knowledge({ ...card, revisionId: randomUUID(), content: { ...card.content, conclusion: '后来修改的条件' } })
    expect(await invoke('prepare', request)).toEqual(preview)

    // Session create/prompt are the external admission boundary. Packed-profile
    // acceptance separately exercises these methods with the real Agent driver.
    const create = vi.spyOn(host.ctx.sessionController, 'create').mockResolvedValue({ sessionId: preview.targetSessionId })
      .mockRejectedValueOnce(new Error('Create failed before a target exists'))
    const accepted = new Set<string>()
    const prompts: string[] = []
    const nativePrompt = vi.spyOn(host.ctx.sessionController, 'prompt').mockImplementation(async request => {
      if (!accepted.has(request.requestId)) {
        accepted.add(request.requestId)
        prompts.push(request.content.map(part => part.type === 'text' ? part.text : '').join(''))
        throw new Error('Response lost after admission')
      }
      return { accepted: true }
    })
    const createFailed = await invoke('submit', { operationId: request.operationId })
    expect(createFailed).toMatchObject({ stage: 'prepared', targetCreated: false, materials: preview.materials, error: expect.any(String) })
    expect(nativePrompt).not.toHaveBeenCalled()
    const failed = await invoke('submit', { operationId: request.operationId })
    expect(failed).toMatchObject({ stage: 'created', targetCreated: true, targetSessionId: preview.targetSessionId, error: expect.any(String) })
    expect(await invoke('forSession', { sessionId: preview.targetSessionId })).toEqual([failed])
    expect(failed.acceptedAt).toBeUndefined()
    const saved = await invoke('submit', { operationId: request.operationId })
    expect(saved).toMatchObject({ stage: 'accepted', acceptedAt: expect.any(Number), targetSessionId: preview.targetSessionId })
    expect(saved.error).toBeUndefined()
    expect(prompts).toEqual([preview.promptText])
    expect(prompts[0]).not.toContain('后来修改的条件')
    expect(nativePrompt.mock.calls[0]![0]).toEqual(nativePrompt.mock.calls[1]![0])
    expect(create).toHaveBeenCalledTimes(2)
    expect(await invoke('submit', { operationId: request.operationId })).toEqual(saved)
    expect(nativePrompt).toHaveBeenCalledTimes(2)
    expect(await host.ctx.sessionController.inspect(session.id)).toEqual(before)
    await host.ctx.fiber.dispose()
    host = await topicHost(root, cleanups)
    expect(await invoke('read', { operationId: request.operationId })).toEqual(saved)
    expect(await invoke('forSession', { sessionId: preview.targetSessionId })).toEqual([saved])
  })
})
