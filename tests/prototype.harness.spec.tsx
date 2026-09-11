// @vitest-environment jsdom
/** Prototype acceptance across rendered layouts and the actual Host wire/storage boundary. */
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createUserMessage, createAssistantMessage } from '@deepseek-ai/dsh-llm'
import { ResearchPrototype } from '../src/client/prototype/ResearchPrototype.tsx'
import type { GraphViewProps } from '../src/client/GraphView.tsx'
import { sessionHistoryRequestSchema } from '../src/session-history-codec.ts'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const dispose of cleanups.splice(0).reverse()) await dispose()
})

async function bench() {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  window.history.replaceState(null, '', '/?variant=A')
  const root = await mkdtemp(join(tmpdir(), 'research-prototype-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const host = await topicHost(root, cleanups)
  const signal = new AbortController().signal
  const session = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a', title: '原始讨论' } })
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '如何同时观察性能和风险？' }] }), { surfaceOp: 'append' })
  session.append('request/context', { turn: 1, step: 1, provider: 'fixture', model: 'fixture' })
  session.append('assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({ source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: '把延迟与权限失效分别测量。' }] }) }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  const handle = await host.ctx.sessionPersistence.create(session.header)
  await handle.append(session.snapshotEvents())
  await handle.flush()
  await handle.close()
  const history = await host.ctx.sessionGraphHistory.read({ sessionId: session.id }, signal)
  const turn = history.turns[0]!
  const topicId = randomUUID()
  await host.ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: '原型验收研究' }, signal)
  await host.ctx.sessionGraphTopics.write({ kind: 'add', topicId, sessionIds: [session.id] }, signal)
  const card = await host.ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(), topicId,
    content: { title: '有来源的知识', conclusion: '两个维度分别验证。', question: '', rationale: '根据原始讨论。', openQuestions: '', kind: 'method', status: 'draft' },
    sources: [{ kind: 'discussion', sessionId: session.id, startSeq: turn.startSeq, endSeq: turn.endSeq! }],
  }, signal)
  const call = (namespace: string, method: string, request: unknown, signal: AbortSignal) => host.ctx.typertGateway.invoke({ namespace, method, args: request === undefined ? {} : { request }, signal })
  const api = (namespace: string, methods: readonly string[]) => Object.fromEntries(methods.map(method => [method, (request: unknown, signal: AbortSignal) => call(namespace, method, request, signal)]))
  const read = vi.fn<GraphViewProps['readSessionHistory']>(async (request, signal) => {
    sessionHistoryRequestSchema.parse(request)
    return await call('sessionGraphHistory', 'read', request, signal)
  })
  const props = {
    hostId: 'prototype-test', sessionId: session.id,
    useSessions: (selector: (state: unknown) => unknown) => selector({ ids: [session.id], byId: { [session.id]: { id: session.id, displayTitle: '原始讨论', updatedAt: 1000 } } }),
    useWorkspaces: (selector: (state: unknown) => unknown) => selector({ items: [{ workspaceId: 'a', title: '研究空间', path: '/a' }] }),
    knowledge: api('sessionGraphKnowledge', ['save', 'read', 'search', 'membership', 'prepareExtraction', 'extract', 'prepareExport']),
    reuse: api('sessionGraphReuse', ['prepare', 'submit', 'read', 'forSession']),
    topics: { ...api('sessionGraphTopics', ['read', 'write']), list: (signal: AbortSignal) => call('sessionGraphTopics', 'list', undefined, signal) },
    readSessionHistory: read, openSession: vi.fn(),
  } as unknown as GraphViewProps
  render(<StrictMode><ResearchPrototype {...props} /></StrictMode>)
  await screen.findByRole('heading', { name: '有来源的知识' })
  await waitFor(() => { expect((screen.getByRole('button', { name: '刷新' }) as HTMLButtonElement).disabled).toBe(false) })
  return { ...host, signal, card, topicId, session, history, read }
}

describe('DSH research prototype', () => {
  it('previews frozen extraction material and only saves the generated draft after human review', async () => {
    const b = await bench()
    const turn = b.history.turns[0]!
    const model = vi.spyOn(b.ctx.llm, 'stream').mockImplementation(async function* () {
      yield { type: 'text-delta', index: 0, text: JSON.stringify({ cards: [{ title: 'AI 整理的实验方法', question: '如何验证？', conclusion: '分别测量性能与风险。', rationale: '基于所选原文。', openQuestions: '补充失效实验。', kind: 'method', citations: [{ startSeq: turn.startSeq, endSeq: turn.endSeq }] }] }) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    fireEvent.click(screen.getByRole('button', { name: /1 轮原文 · 点击回到对应内容/ }))
    await screen.findByText('把延迟与权限失效分别测量。')
    fireEvent.click(screen.getByRole('button', { name: 'AI 整理' }))
    const generate = await screen.findByRole('button', { name: '生成可编辑草稿' })
    expect(model).not.toHaveBeenCalled()
    fireEvent.click(generate)
    await screen.findByDisplayValue('AI 整理的实验方法')
    expect(model).toHaveBeenCalledTimes(1)
    expect(await b.ctx.sessionGraphKnowledge.search({ query: 'AI 整理' }, b.signal)).toEqual([])
    fireEvent.change(screen.getByRole('textbox', { name: '标题' }), { target: { value: '经我核对的实验方法' } })
    fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
    await screen.findByRole('heading', { name: '经我核对的实验方法' })
    const [saved] = await b.ctx.sessionGraphKnowledge.search({ query: '经我核对' }, b.signal)
    expect(saved!.revisions[0]!.sources).toEqual(b.card.revisions[0]!.sources)
    expect(saved!.revisions[0]!.content.status).toBe('draft')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reads exact original turns, retains a draft across all layouts, saves sources, and finds the saved content', async () => {
    const b = await bench()
    fireEvent.click(screen.getByRole('button', { name: /1 轮原文 · 点击回到对应内容/ }))
    await screen.findByText('把延迟与权限失效分别测量。')
    expect(b.read.mock.calls[0]![0]).toEqual({ sessionId: b.session.id, limit: 10, source: b.card.revisions[0]!.sources[0]!.source })
    fireEvent.click(screen.getByRole('button', { name: '存为知识' }))
    const title = screen.getByRole('textbox', { name: '标题' })
    fireEvent.change(title, { target: { value: '双维度实验卡片' } })
    fireEvent.keyDown(title, { key: 'ArrowRight' })
    expect(new URL(location.href).searchParams.get('variant')).toBe('A')
    for (const name of ['B · 知识书桌', 'C · 研究路径', 'A · 图谱工作台']) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect((screen.getByRole('textbox', { name: '标题' }) as HTMLInputElement).value).toBe('双维度实验卡片')
      expect((screen.getByRole('textbox', { name: '值得留下的内容' }) as HTMLTextAreaElement).value).toBe('把延迟与权限失效分别测量。')
    }
    fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
    await screen.findByRole('heading', { name: '双维度实验卡片' })
    const saved = await b.ctx.sessionGraphKnowledge.search({ query: '双维度实验', topicId: b.topicId }, b.signal)
    expect(saved).toHaveLength(1)
    expect(saved[0]!.revisions[0]!.sources).toEqual(b.card.revisions[0]!.sources)
    fireEvent.change(screen.getByRole('textbox', { name: '查找知识和讨论' }), { target: { value: '双维度实验' } })
    expect(screen.getByText('找到 1 项相关内容')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /知识.*有来源的知识/ })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: '查找知识和讨论' }), { target: { value: 'method' } })
    expect(screen.getByText('找到 0 项相关内容')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('requires preview and confirmation, recovers a lost submit reply, and retains the old material after editing', async () => {
    const b = await bench()
    // The test Host has no Agent runtime. Keep real persistence at that boundary;
    // the packed-profile fixture separately exercises native create and admission.
    const create = vi.spyOn(b.ctx.sessionController, 'create').mockImplementation(async request => {
      const target = b.ctx.sessions.prepare(request.sessionId, { meta: { cwd: '/a' } })
      const handle = await b.ctx.sessionPersistence.create(target.header)
      await handle.flush()
      await handle.close()
      return { sessionId: target.id }
    })
    const prompt = vi.spyOn(b.ctx.sessionController, 'prompt').mockResolvedValue({ accepted: true })
    const submit = b.ctx.sessionGraphReuse.submit.bind(b.ctx.sessionGraphReuse)
    vi.spyOn(b.ctx.sessionGraphReuse, 'submit').mockImplementationOnce(async (request, signal) => {
      const result = await submit(request, signal)
      if (result.stage !== 'accepted') throw new Error(result.error ?? result.stage)
      throw new Error('Response lost after admission')
    })
    fireEvent.click(screen.getByRole('button', { name: '继续讨论' }))
    fireEvent.click(screen.getByRole('button', { name: '找反例' }))
    fireEvent.click(screen.getByRole('button', { name: '预览本次讨论' }))
    await screen.findByRole('button', { name: '确认并开始讨论' })
    expect(create).not.toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent ?? '').toBe('')
      expect(screen.getByText('新讨论已创建，沿用关系已回到研究图谱。回答完成后可刷新原文。')).toBeTruthy()
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledTimes(1)
    const targetId = prompt.mock.calls[0]![0].sessionId
    const [record] = await b.ctx.sessionGraphReuse.forSession({ sessionId: targetId }, b.signal)
    expect(record).toMatchObject({ stage: 'accepted', materials: [{ kind: 'card', revisionNumber: 1, content: { conclusion: '两个维度分别验证。' } }] })
    expect((await b.ctx.sessionGraphTopics.read({ topicId: b.topicId }, b.signal)).topic.references.some(ref => ref.sessionId === targetId)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /知识.*有来源的知识/ }))
    fireEvent.click(screen.getByRole('button', { name: '编辑', exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: '值得留下的内容' }), { target: { value: '新修订：增加适用条件。' } })
    fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
    await screen.findByRole('heading', { name: '有来源的知识' })
    const updated = await b.ctx.sessionGraphKnowledge.read({ cardId: b.card.cardId }, b.signal)
    expect(updated!.revisions).toHaveLength(2)
    expect(updated!.revisions[0]).toEqual(b.card.revisions[0])
    expect((await b.ctx.sessionGraphReuse.forSession({ sessionId: targetId }, b.signal))[0]).toEqual(record)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
