// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { SynthesisDraft, SynthesisPreparation } from '../src/knowledge-synthesis.ts'
import type { HistoryBranchRecord } from '../src/history-branch.ts'
import type { KnowledgeApi } from '../src/client/knowledge-remote.ts'
import { KnowledgeProvider, useKnowledge } from '../src/client/Knowledge.tsx'
import { HistoryBranchProvider, useHistoryBranch } from '../src/client/HistoryBranch.tsx'
import { knowledgeClient, knowledgeContent, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })
const sessions = { byId: {}, ids: [], phase: 'ready', current: undefined } as SessionListState

it('keeps manually edited synthesis batches, confirms closing, and retries the same save identity while retaining exact source revisions', async () => {
  const client = knowledgeClient()
  const topicId = randomUUID()
  const cards: KnowledgeCard[] = [1, 2].map(number => ({ cardId: randomUUID(), topicIds: [topicId], revisions: [{
    revisionId: randomUUID(), number: 1, savedAt: 1000, requestHash: 'a'.repeat(64), content: knowledgeContent(`来源 ${number}`), sources: [],
  }] }))
  client.topics.list.mockResolvedValue([{ topicId, title: '测试主题', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }])
  client.api.search.mockResolvedValue(cards)
  client.api.read.mockImplementation(async ({ cardId }) => cards.find(card => card.cardId === cardId) ?? null)
  const preparation: SynthesisPreparation = { preparationId: randomUUID(), topicId, question: '比较条件', materials: cards.map(card => ({
    kind: 'card', cardId: card.cardId, revisionId: card.revisions[0]!.revisionId, revisionNumber: 1, savedAt: 1000, content: card.revisions[0]!.content, sources: [],
  })), claims: [], materialText: '明确冻结材料', budgetChars: 32000, route: { provider: 'fixture', model: 'fixed' } }
  const generated = (): SynthesisDraft => ({ cardId: randomUUID(), revisionId: randomUUID(), content: knowledgeContent('待审核综合'), invalidCitations: 1,
    synthesis: { source: { kind: 'preparation', preparationId: preparation.preparationId }, claims: [
      { category: 'condition', text: '保留条件', citations: [{ materialIndex: 0, quote: '需要保留的结论' }] },
      { category: 'question', text: '未获引用的观点', citations: [] },
    ] } })
  const api = { ...client.api, prepareSynthesis: vi.fn<NonNullable<KnowledgeApi['prepareSynthesis']>>(async () => preparation),
    synthesize: vi.fn<NonNullable<KnowledgeApi['synthesize']>>(async () => generated()) }
  function Entry() { const knowledge = useKnowledge()!; return <button onClick={() => { knowledge.synthesize!(topicId) }}>开始综合</button> }
  render(<KnowledgeProvider {...client} api={api} useSessions={selector => selector(sessions)} t={t}><Entry /></KnowledgeProvider>)
  fireEvent.click(screen.getByRole('button', { name: '开始综合' }))
  await screen.findAllByRole('button', { name: '将此修订加入材料' })
  fireEvent.click(screen.getAllByRole('button', { name: '将此修订加入材料' })[0]!)
  fireEvent.click(screen.getByRole('button', { name: '将此修订加入材料' }))
  fireEvent.change(screen.getByRole('textbox', { name: t('synthesis.question') }), { target: { value: '比较条件' } })
  expect(api.prepareSynthesis).not.toHaveBeenCalled()
  expect(api.synthesize).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: t('synthesis.preview') }))
  fireEvent.click(await screen.findByRole('button', { name: t('synthesis.generate') }))
  const texts = await screen.findAllByRole('textbox', { name: t('synthesis.text') })
  fireEvent.change(texts[0]!, { target: { value: '人工保留的相反观点与条件' } })
  fireEvent.click(screen.getByRole('button', { name: t('synthesis.append') }))
  await waitFor(() => { expect(screen.getAllByRole('textbox', { name: t('synthesis.text') })).toHaveLength(4) })
  expect((screen.getAllByRole('textbox', { name: t('synthesis.text') })[0] as HTMLTextAreaElement).value).toBe('人工保留的相反观点与条件')
  expect(client.api.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: t('knowledge.close') }))
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: t('knowledge.keepEditing') }))
  const quote = screen.getAllByRole('textbox', { name: t('synthesis.quote') })[0]!
  fireEvent.change(quote, { target: { value: '材料中不存在的人工引用' } })
  expect(screen.getByText(t('synthesis.invalidQuote'))).toBeTruthy()
  expect((screen.getAllByRole('button', { name: t('knowledge.save') })[0] as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getAllByRole('button', { name: t('knowledge.save') })[0]!)
  expect(client.api.save).not.toHaveBeenCalled()
  fireEvent.change(quote, { target: { value: '需要保留的结论' } })
  client.api.save.mockRejectedValueOnce(new Error('Lost response')).mockImplementation(async request => ({ cardId: request.cardId, topicIds: [topicId], revisions: [{
    revisionId: request.revisionId, number: 1, savedAt: 1000, requestHash: 'b'.repeat(64), content: request.content, sources: [],
    synthesis: { materials: preparation.materials, claims: request.synthesis!.claims },
  }] }))
  fireEvent.click(screen.getAllByRole('button', { name: t('knowledge.save') })[0]!)
  await screen.findByText(t('knowledge.error'))
  fireEvent.click(screen.getAllByRole('button', { name: t('knowledge.save') })[0]!)
  await waitFor(() => { expect(screen.getAllByRole('button', { name: t('knowledge.save') })).toHaveLength(1) })
  expect(client.api.save.mock.calls[0]![0]).toEqual(client.api.save.mock.calls[1]![0])
  expect(client.api.save.mock.calls[1]![0].content.status).toBe('draft')
  fireEvent.click(screen.getAllByRole('button', { name: t('synthesis.citation', { number: 1 }) })[0]!)
  fireEvent.click(screen.getAllByRole('button', { name: t('synthesis.readRevision', { number: 1 }) })[0]!)
  const reader = screen.getByRole('dialog', { name: t('knowledge.title') })
  await within(reader).findByRole('heading', { name: '来源 1' })
  expect((within(reader).getByRole('combobox', { name: t('knowledge.version') }) as HTMLSelectElement).value).toBe('')
  fireEvent.click(within(reader).getByRole('button', { name: t('knowledge.close') }))
  expect(screen.getByRole('dialog', { name: t('synthesis.title') })).toBeTruthy()
  expect(screen.getAllByRole('textbox', { name: t('synthesis.text') })).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: t('knowledge.save') }))
  await waitFor(() => { expect(screen.queryByRole('button', { name: t('knowledge.save') })).toBeNull() })
  fireEvent.click(screen.getByRole('button', { name: t('knowledge.close') }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.queryByRole('dialog', { name: t('synthesis.title') })).toBeNull()
})

it('recovers a failed branch using the retained operation after closing and restores its source focus', async () => {
  let retained: HistoryBranchRecord | undefined
  const api = { prepare: vi.fn(async request => retained ?? { ...request, targetSessionId: 'retained-child', title: '讨论 · 2', sourceTitle: '讨论',
    firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'prepared' as const }),
    submit: vi.fn(async ({ operationId }) => {
      const request = api.prepare.mock.calls[0]![0]
      retained = { ...request, operationId, targetSessionId: 'retained-child', title: '讨论 · 2', sourceTitle: '讨论', firstTurn: 1, lastTurn: 2,
        inheritedEventCount: 25, stage: retained === undefined ? 'created' : 'ready', ...(retained === undefined ? { error: '关联暂时失败' } : {}) }
      return retained
    }), read: vi.fn() }
  const open = vi.fn()
  function Entry() { const branch = useHistoryBranch()!; return <button onClick={() => { branch({ sessionId: 'source', startSeq: 20, endSeq: 24 }) }}>从第二轮分支</button> }
  render(<HistoryBranchProvider api={api} hostId="host" openSession={open} t={t}><Entry /></HistoryBranchProvider>)
  const trigger = screen.getByRole('button', { name: '从第二轮分支' })
  trigger.focus()
  fireEvent.click(trigger)
  expect(api.submit).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: t('branch.confirm') }))
  await screen.findByText('关联暂时失败', { exact: false })
  fireEvent.click(screen.getByRole('button', { name: t('branch.return') }))
  await waitFor(() => { expect(document.activeElement).toBe(trigger) })
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('button', { name: t('branch.retry') }))
  fireEvent.click(await screen.findByRole('button', { name: t('branch.open') }))
  expect(api.submit.mock.calls[0]![0]).toEqual(api.submit.mock.calls[1]![0])
  expect(api.prepare.mock.calls[0]![0]).toEqual(api.prepare.mock.calls[1]![0])
  expect(open).toHaveBeenCalledExactlyOnceWith('retained-child')
})

it('returns keyboard focus to the selected turn after saved topic membership refreshes its source reader', async () => {
  const client = knowledgeClient()
  let record: HistoryBranchRecord
  const api = { prepare: vi.fn(async request => (record = { ...request, targetSessionId: 'child', title: '分支', sourceTitle: '来源',
    firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'prepared' as const })),
    submit: vi.fn(async () => ({ ...record, stage: 'ready' as const })), read: vi.fn() }
  function Entry() {
    const branch = useHistoryBranch()!
    const knowledge = useKnowledge()!
    return <button key={knowledge.refresh} data-history-branch-session="source" data-history-branch-start="20"
      onClick={() => { branch({ sessionId: 'source', startSeq: 20, endSeq: 24 }) }}>从第二轮分支</button>
  }
  render(<KnowledgeProvider {...client} t={t}><HistoryBranchProvider api={api} hostId="host" openSession={vi.fn()} t={t}><Entry /></HistoryBranchProvider></KnowledgeProvider>)
  const original = screen.getByRole('button', { name: '从第二轮分支' })
  original.focus()
  fireEvent.click(original)
  fireEvent.click(await screen.findByRole('button', { name: t('branch.confirm') }))
  await screen.findByRole('button', { name: t('branch.open') })
  expect(original.isConnected).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: t('branch.return') }))
  await waitFor(() => { expect(document.activeElement).toBe(screen.getByRole('button', { name: '从第二轮分支' })) })
})
