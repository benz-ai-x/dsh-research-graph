import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const dispose of cleanups.splice(0).reverse()) await dispose() })

describe('Knowledge export through the public Host Gateway', () => {
  it('freezes only selected revisions and readable source excerpts, including after the original disappears', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-export-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    source.append('turn/start', { turn: 1 })
    source.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '原文：\n```ts\nconst 答案 = 42\n```\n第二行' }] }), { surfaceOp: 'append' })
    source.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    let detach = (): void => {}
    host.ctx.effect(() => { detach = host.ctx.sessions.enter(source); return detach })
    const events = (await host.ctx.sessionController.inspect(source.id)).events
    const invoke = (method: string, request: unknown) => host.ctx.typertGateway.invoke({
      namespace: 'sessionGraphKnowledge', method, args: { request }, signal: new AbortController().signal,
    })
    const first = { cardId: '1bb797e8-16ad-4d78-8f41-c0a5efaf8451', revisionId: '2bb797e8-16ad-4d78-8f41-c0a5efaf8451',
      content: { title: '中文成果 / 方法', question: '问题一\n问题二', conclusion: '第一版结论', rationale: '', openQuestions: '仍待验证', kind: 'method', status: 'draft' },
      sources: [{ kind: 'discussion', sessionId: source.id, startSeq: events.find(event => event.type === 'turn/start')!.seq, endSeq: events.find(event => event.type === 'turn/end')!.seq }] }
    const saved = await invoke('save', first)
    await invoke('save', { ...first, cardId: '3bb797e8-16ad-4d78-8f41-c0a5efaf8451', revisionId: '4bb797e8-16ad-4d78-8f41-c0a5efaf8451', content: { ...first.content, title: '未选资料', conclusion: '不应导出' }, sources: [] })
    const preview = await invoke('prepareExport', { cardIds: [first.cardId] })
    expect(preview.filename).toBe('中文成果-方法.md')
    expect(preview.markdown).toContain('第一版结论')
    expect(preview.markdown).toContain('问题一\n问题二')
    expect(preview.markdown).toContain('````text\n原文：\n```ts\nconst 答案 = 42\n```\n第二行\n````')
    expect(preview.markdown).toContain('Draft / 草稿')
    expect(preview.markdown).toContain(new Date(saved.revisions[0].savedAt).toISOString())
    expect(preview.markdown).toContain(source.id)
    expect(preview.markdown).toContain('Source relations / 来源关系')
    expect(preview.markdown).toContain('Original verified / 原文范围已核对')
    expect(preview.markdown).not.toContain('不应导出')
    expect(preview.markdown).not.toContain('未选资料')
    const beforeUpdate = preview.markdown
    await invoke('save', { ...first, revisionId: '5bb797e8-16ad-4d78-8f41-c0a5efaf8451', content: { ...first.content, conclusion: '第二版结论' } })
    expect(preview.markdown).toBe(beforeUpdate)
    const updated = await invoke('prepareExport', { cardIds: [first.cardId] })
    expect(updated.markdown).toContain('第二版结论')
    expect(updated.markdown).not.toContain('第一版结论')
    expect(await invoke('prepareExport', { cardIds: [first.cardId] })).toEqual(updated)
    const multiple = await invoke('prepareExport', { cardIds: [first.cardId, '3bb797e8-16ad-4d78-8f41-c0a5efaf8451'] })
    expect(multiple.cards).toHaveLength(2)
    expect(multiple.markdown).toContain('## C2 · 未选资料')
    expect(multiple.markdown).toContain('不应导出')
    await expect(invoke('prepareExport', { cardIds: [] })).rejects.toThrow()
    await expect(invoke('prepareExport', { cardIds: ['6bb797e8-16ad-4d78-8f41-c0a5efaf8451'] })).rejects.toThrow()
    expect(host.ctx.llm.stream).not.toHaveBeenCalled()
    expect((await host.ctx.sessionController.inspect(source.id)).events).toEqual(events)
    // Present a valid but incomplete history prefix through the real Session store.
    detach()
    const partial = host.ctx.sessions.prepare(source.id, { seed: events.slice(0, -1), meta: { cwd: '/a' } })
    host.ctx.effect(() => host.ctx.sessions.enter(partial))
    const incomplete = await invoke('prepareExport', { cardIds: [first.cardId] })
    expect(incomplete.markdown).toContain('Original range incomplete / 原文范围不完整')
    expect(incomplete.markdown).toContain('const 答案 = 42')
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    const retained = await restarted.ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method: 'prepareExport',
      args: { request: { cardIds: [first.cardId] } }, signal: new AbortController().signal })
    expect(retained.markdown).toContain('Original unavailable / 原文缺失或无法读取')
    expect(retained.markdown).toContain('Retained excerpt / 保存的来源摘录')
    expect(retained.markdown).toContain('const 答案 = 42')
    expect(source.snapshotEvents()).toEqual(events)
  })
})
