// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { KnowledgeEditor, KnowledgeProvider, KnowledgeSavedNotice, useKnowledge } from '../src/client/Knowledge.tsx'
import type { ExtractionPreparation } from '../src/knowledge-extraction.ts'
import type { KnowledgeCard, KnowledgeRevision } from '../src/knowledge.ts'
import { knowledgeClient, knowledgeContent, knowledgeSource, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(cleanup)

const address = { kind: 'discussion' as const, sessionId: 'session-a', startSeq: 10, endSeq: 14 }
function Entry() {
  const knowledge = useKnowledge()!
  return <><button onClick={() => { knowledge.create(address) }}>开始建卡</button>
    <button onClick={() => { knowledge.extract(address) }}>开始提炼</button><KnowledgeSavedNotice t={t} /></>
}

it('preserves saved citations when adding another turn and only removes the explicitly unchecked turn', async () => {
  const client = knowledgeClient()
  const preparationId = randomUUID()
  const included = knowledgeSource(1, 3)
  const preparation: ExtractionPreparation = { preparationId, selected: included, included, omitted: [], budgetChars: 20_000, materialText: '三轮材料' }
  let revisions: readonly KnowledgeRevision[] = []
  client.api.save.mockImplementation(async request => {
    const sources = request.sources.map(address => {
      if (address.kind === 'revision') return revisions.find(revision => revision.revisionId === address.revisionId)!.sources[address.sourceIndex]!
      return knowledgeSource(address.startSeq / 10, (address.endSeq - 4) / 10)
    })
    revisions = [...revisions, { revisionId: request.revisionId, requestHash: 'a'.repeat(64), number: revisions.length + 1,
      savedAt: 1000, content: request.content, sources }]
    return { cardId: request.cardId, topicIds: [], revisions }
  })
  render(<KnowledgeEditor cardId={undefined} source={undefined} topicId={undefined} {...client} t={t} close={vi.fn()} changed={vi.fn()}
    preparation={preparation} draft={{ cardId: randomUUID(), revisionId: randomUUID(), content: knowledgeContent(), invalidCitations: 0,
      needsVerification: false, sources: [{ kind: 'extraction', preparationId, startSeq: 10, endSeq: 24 }] }} />)
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  fireEvent.click(await screen.findByRole('button', { name: '编辑卡片' }))
  expect((screen.getByRole('checkbox', { name: '引用第 1 轮' }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('checkbox', { name: '引用第 2 轮' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: '引用第 3 轮' }))
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  await waitFor(() => { expect(revisions).toHaveLength(2) })
  expect(revisions[1]!.sources.flatMap(source => source.source.turns.map(turn => turn.turn))).toEqual([1, 2, 3])
  expect(revisions[0]!.sources.flatMap(source => source.source.turns.map(turn => turn.turn))).toEqual([1, 2])
  fireEvent.click(await screen.findByRole('button', { name: '编辑卡片' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '引用第 2 轮' }))
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  await waitFor(() => { expect(revisions).toHaveLength(3) })
  expect(revisions[2]!.sources.flatMap(source => source.source.turns.map(turn => turn.turn))).toEqual([1, 3])
  expect(client.read).not.toHaveBeenCalled()
})

it('saves a distinct card from a saved source and returns to the first reader with confirmation', async () => {
  const client = knowledgeClient()
  const cards = new Map<string, KnowledgeCard>()
  client.api.read.mockImplementation(async request => cards.get(request.cardId) ?? null)
  client.api.save.mockImplementation(async request => { const card = { cardId: request.cardId, topicIds: [], revisions: [{
    revisionId: request.revisionId, requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
    content: request.content, sources: [knowledgeSource(request.sources[0]!.kind === 'discussion' ? request.sources[0]!.startSeq / 10 : 1)],
  }] }; cards.set(request.cardId, card); return card })
  render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
  fireEvent.click(screen.getByRole('button', { name: '开始建卡' }))
  fireEvent.change(screen.getByRole('textbox', { name: '卡片标题' }), { target: { value: '第一张卡片' } })
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  fireEvent.click(await screen.findByRole('button', { name: '查看知识' }))
  fireEvent.click(await screen.findByRole('button', { name: '查看来源原文' }))
  await waitFor(() => { expect(client.read).toHaveBeenCalled() })
  fireEvent.click(screen.getByRole('button', { name: '加载更晚的讨论' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 2 轮' }))
  fireEvent.click(screen.getByRole('button', { name: '保存为知识卡片' }))
  fireEvent.change(screen.getByRole('textbox', { name: '卡片标题' }), { target: { value: '第二张卡片' } })
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  await screen.findByRole('heading', { name: '第一张卡片' })
  expect(screen.getByRole('status').textContent).toContain('已保存「第二张卡片」')
  const requests = client.api.save.mock.calls.map(([request]) => request)
  expect(requests[1]!.cardId).not.toBe(requests[0]!.cardId)
  expect(requests[1]!.sources).toEqual([{ ...address, startSeq: 20, endSeq: 24 }])
  expect(screen.getAllByRole('dialog', { name: '知识卡片' })).toHaveLength(1)
  expect(screen.getByRole('heading', { name: '第一张卡片' })).toBeTruthy()
})

it('previews a new extraction range independently while preserving the earlier edited draft', async () => {
  const client = knowledgeClient()
  const preparations = [1, 2].map(turn => ({ preparationId: randomUUID(), selected: knowledgeSource(turn), included: knowledgeSource(turn),
    omitted: [], budgetChars: 20_000, materialText: `第 ${turn} 轮固定材料`, route: { provider: 'fixture', model: 'fixed' } }))
  client.api.prepareExtraction.mockImplementation(async request => preparations[request.source.startSeq / 10 - 1]!)
  client.api.extract.mockImplementation(async request => ({ provider: 'fixture', model: 'fixed', drafts: [{
    cardId: randomUUID(), revisionId: randomUUID(), invalidCitations: 0, needsVerification: false, content: knowledgeContent('提炼草稿'),
    sources: [{ kind: 'extraction', preparationId: request.preparationId, startSeq: 10, endSeq: 14 }],
  }] }))
  render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
  fireEvent.click(screen.getByRole('button', { name: '开始提炼' }))
  fireEvent.click(screen.getByRole('button', { name: '预览纳入材料' }))
  await screen.findByText('第 1 轮固定材料')
  fireEvent.click(screen.getByRole('button', { name: '生成知识草稿' }))
  const conclusion = await screen.findByRole('textbox', { name: '结论' })
  fireEvent.change(conclusion, { target: { value: '人工编辑的第一轮草稿' } })
  fireEvent.click(screen.getByRole('button', { name: '核对这一轮原文' }))
  await waitFor(() => { expect(client.read).toHaveBeenCalled() })
  fireEvent.click(screen.getByRole('button', { name: '加载更晚的讨论' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '选择第 2 轮' }))
  fireEvent.click(screen.getByRole('button', { name: '提炼知识' }))
  expect(screen.queryByRole('button', { name: '追加一组草稿' })).toBeNull()
  const second = screen.getByRole('dialog', { name: '提炼知识' })
  expect(within(second).getByText('session-a · 事件 20–24')).toBeTruthy()
  fireEvent.click(within(second).getByRole('button', { name: '预览纳入材料' }))
  await within(second).findByText('第 2 轮固定材料')
  fireEvent.click(within(second).getByRole('button', { name: '生成知识草稿' }))
  await waitFor(() => { expect(client.api.extract).toHaveBeenCalledTimes(2) })
  expect(client.api.extract.mock.lastCall![0].preparationId).toBe(preparations[1]!.preparationId)
  fireEvent.click(screen.getByRole('button', { name: '关闭卡片' }))
  fireEvent.click(screen.getByRole('button', { name: '放弃未保存内容' }))
  expect((screen.getByRole('textbox', { name: '结论' }) as HTMLTextAreaElement).value).toBe('人工编辑的第一轮草稿')
})

it('protects a new draft on Escape and close, returns focus on keep, and discards only explicitly', async () => {
  const client = knowledgeClient()
  render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
  const entry = screen.getByRole('button', { name: '开始建卡' })
  entry.focus()
  fireEvent.click(entry)
  const title = screen.getByRole('textbox', { name: '卡片标题' }) as HTMLInputElement
  fireEvent.change(title, { target: { value: '应当保留的草稿' } })
  title.focus()
  fireEvent.keyDown(title, { key: 'Escape' })
  const confirm = screen.getByRole('alertdialog', { name: '有未保存的内容' })
  expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '继续编辑' }))
  expect(screen.queryByRole('textbox', { name: '卡片标题' })).toBeNull()
  fireEvent.keyDown(confirm, { key: 'Escape' })
  await waitFor(() => { expect(document.activeElement).toBe(title) })
  expect(title.value).toBe('应当保留的草稿')
  expect(client.api.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '关闭卡片' }))
  fireEvent.click(screen.getByRole('button', { name: '放弃未保存内容' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => { expect(document.activeElement).toBe(entry) })
  fireEvent.click(entry)
  expect((screen.getByRole('textbox', { name: '卡片标题' }) as HTMLInputElement).value).toBe('')
})

it('keeps an in-flight save mounted and closes the saved revision without a discard prompt', async () => {
  const client = knowledgeClient()
  let finish!: () => void
  client.api.save.mockImplementation(request => new Promise(resolve => { finish = () => { resolve({ cardId: request.cardId, topicIds: [], revisions: [{
    revisionId: request.revisionId, requestHash: 'a'.repeat(64), number: 1, savedAt: 1000, content: request.content, sources: [],
  }] }) } }))
  render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
  fireEvent.click(screen.getByRole('button', { name: '开始建卡' }))
  fireEvent.change(screen.getByRole('textbox', { name: '卡片标题' }), { target: { value: '保存中的草稿' } })
  await waitFor(() => { expect((screen.getByRole('button', { name: '保存知识' }) as HTMLButtonElement).disabled).toBe(false) })
  fireEvent.click(screen.getByRole('button', { name: '保存知识' }))
  fireEvent.click(screen.getByRole('button', { name: '关闭卡片' }))
  expect(screen.getByText('正在处理，请等待完成后再关闭。')).toBeTruthy()
  expect(client.api.save.mock.lastCall![1].aborted).toBe(false)
  finish()
  await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
  expect(screen.getByRole('status').textContent).toContain('已保存「保存中的草稿」')
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps the required title and conclusion visible while optional fields retain their values', async () => {
  const client = knowledgeClient()
  render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
  fireEvent.click(screen.getByRole('button', { name: '开始建卡' }))
  expect((screen.getByRole('textbox', { name: '卡片标题' }) as HTMLInputElement).required).toBe(true)
  expect(screen.getByRole('textbox', { name: '结论' })).toBeTruthy()
  const details = screen.getByText('补充问题、理由、类型与状态（选填）').parentElement as HTMLDetailsElement
  expect(details.open).toBe(false)
  fireEvent.click(details.querySelector('summary')!)
  const question = screen.getByLabelText('核心问题') as HTMLTextAreaElement
  fireEvent.change(question, { target: { value: '保留补充信息' } })
  fireEvent.click(details.querySelector('summary')!)
  fireEvent.click(screen.getByRole('button', { name: '关闭卡片' }))
  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }))
  expect(question.value).toBe('保留补充信息')
})
