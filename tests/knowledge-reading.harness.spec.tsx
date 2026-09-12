// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { ExtractionPreparation } from '../src/knowledge-extraction.ts'
import type { ResearchRelation } from '../src/research-relations.ts'
import type { ResearchReuseApi } from '../src/client/research-reuse-remote.ts'
import { KnowledgeProvider, useKnowledge } from '../src/client/Knowledge.tsx'
import { KnowledgeSearch } from '../src/client/KnowledgeSearch.tsx'
import { KnowledgeReader } from '../src/client/KnowledgeReader.tsx'
import { ResearchReuseProvider } from '../src/client/ResearchReuse.tsx'
import styles from '../src/client/GraphView.module.css'
import { knowledgeClient, knowledgeContent, knowledgeSource, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

function fixture() {
  const client = knowledgeClient()
  const card: KnowledgeCard = { cardId: randomUUID(), topicIds: [], revisions: [1, 2].map(number => ({
    revisionId: randomUUID(), number, requestHash: 'a'.repeat(64), savedAt: number * 1000,
    content: knowledgeContent(number === 1 ? '旧版结论' : '新版结论'), sources: [knowledgeSource(number)],
  })) }
  const relations: ResearchRelation[] = card.revisions.map(revision => ({
    operationId: randomUUID(), targetSessionId: `follow-up-${revision.number}`, question: `核对第 ${revision.number} 版`,
    acceptedAt: 2000, workspace: { id: 'workspace', title: '研究空间', cwd: '/research' },
    materials: [{ kind: 'card', cardId: card.cardId, revisionId: revision.revisionId, revisionNumber: revision.number, title: revision.content.title }],
  }))
  const reuse: ResearchReuseApi = { relations: vi.fn(async () => relations), forSession: vi.fn(),
    prepare: vi.fn(), read: vi.fn(), submit: vi.fn() }
  client.api.read.mockResolvedValue(card)
  client.api.search.mockResolvedValue([card])
  const wrap = (children: React.ReactNode) => <ResearchReuseProvider api={reuse} workspaces={[]} viewedId={'viewed' as never}
    openSession={vi.fn()} t={t}><KnowledgeProvider {...client} t={t}>{children}</KnowledgeProvider></ResearchReuseProvider>
  return { client, card, relations, reuse, wrap }
}

it('reads a search hit with all revision follow-ups, retries relation failure and exports the latest title from an old revision', async () => {
  const { client, card, relations, reuse, wrap } = fixture()
  vi.mocked(reuse.relations).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(relations)
  render(wrap(<KnowledgeSearch t={t} />))
  fireEvent.click(await screen.findByRole('button', { name: /新版结论/ }))
  const dialog = await screen.findByRole('dialog', { name: '知识卡片' })
  await within(dialog).findByRole('heading', { name: '新版结论' })
  const failure = await within(dialog).findByRole('alert')
  expect(failure.textContent).toContain(t('workbench.relationsError'))
  expect(within(dialog).queryByText(t('workbench.nextEmpty'))).toBeNull()
  fireEvent.click(within(failure).getByRole('button', { name: '重试' }))
  await within(dialog).findByRole('button', { name: /核对第 1 版/ })
  fireEvent.change(within(dialog).getByRole('combobox', { name: '修订版本' }), { target: { value: card.revisions[0]!.revisionId } })
  expect(within(dialog).getByRole('button', { name: /核对第 2 版/ })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: /查看来源原文/ }))
  await waitFor(() => { expect(client.read).toHaveBeenCalledWith({ sessionId: 'session-a', source: card.revisions[0]!.sources[0]!.source }, expect.any(AbortSignal)) })
  fireEvent.click(within(dialog).getByRole('button', { name: t('workbench.exportLatest') }))
  const exporting = screen.getByRole('dialog', { name: t('export.title') })
  expect(within(exporting).getByRole('checkbox', { name: '新版结论' })).toBeTruthy()
  expect(client.api.save).not.toHaveBeenCalled()
})

it('returns from inline editing to the same selected revision, source and scroll without stacking another card dialog', async () => {
  // jsdom accepts focus inside inert ancestors; Chrome rejects it until the
  // discard guard has committed its removal of inert.
  const nativeFocus = HTMLElement.prototype.focus
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options) {
    for (let parent: HTMLElement | null = this; parent; parent = parent.parentElement) if (parent.inert) return
    nativeFocus.call(this, options)
  })
  const { card, wrap } = fixture()
  function Entry() { const knowledge = useKnowledge()!; return <button onClick={() => knowledge.open(card.cardId)}>打开卡片</button> }
  render(wrap(<Entry />))
  fireEvent.click(screen.getByRole('button', { name: '打开卡片' }))
  const dialog = await screen.findByRole('dialog', { name: '知识卡片' })
  const version = await within(dialog).findByRole('combobox', { name: '修订版本' })
  fireEvent.change(version, { target: { value: card.revisions[0]!.revisionId } })
  fireEvent.click(within(dialog).getByRole('button', { name: /查看来源原文/ }))
  const original = await within(dialog).findByRole('region', { name: '讨论原文' })
  const scroller = dialog.querySelector<HTMLElement>('[data-working-scroll]')!
  scroller.scrollTop = 330
  const edit = within(dialog).getByRole('button', { name: '编辑卡片' })
  edit.focus()
  fireEvent.click(edit)
  fireEvent.change(within(dialog).getByRole('textbox', { name: '结论' }), { target: { value: '尚未保存的改动' } })
  expect(screen.getAllByRole('dialog', { name: '知识卡片' })).toHaveLength(1)
  fireEvent.click(within(dialog).getByRole('button', { name: t('knowledge.cancel') }))
  fireEvent.click(screen.getByRole('button', { name: '放弃未保存内容' }))
  expect((within(dialog).getByRole('combobox', { name: '修订版本' }) as HTMLSelectElement).value).toBe(card.revisions[0]!.revisionId)
  expect(within(dialog).getByRole('region', { name: '讨论原文' })).toBe(original)
  expect(scroller.scrollTop).toBe(330)
  await waitFor(() => { expect(document.activeElement).toBe(edit) })
})

it('retries a missing explicit edit revision without substituting the latest saved content', async () => {
  const { client, card, wrap } = fixture()
  client.api.read.mockResolvedValueOnce({ ...card, revisions: card.revisions.slice(1) }).mockResolvedValue(card)
  function Entry() { const knowledge = useKnowledge()!; return <button onClick={() => knowledge.edit(card.cardId, card.revisions[0]!.revisionId)}>编辑旧版</button> }
  render(wrap(<Entry />))
  fireEvent.click(screen.getByRole('button', { name: '编辑旧版' }))
  const failure = await screen.findByRole('alert')
  expect(screen.queryByRole('textbox', { name: '卡片标题' })).toBeNull()
  fireEvent.click(within(failure).getByRole('button', { name: '重试' }))
  expect((await screen.findByRole('textbox', { name: '卡片标题' }) as HTMLInputElement).value).toBe('旧版结论')
  expect(client.api.save).not.toHaveBeenCalled()
})

it.each([false, true])('restores the extraction batch scroll after canceling a saved card edit (changed: %s)', async changed => {
  const { client, wrap } = fixture()
  const included = knowledgeSource()
  const preparation: ExtractionPreparation = { preparationId: randomUUID(), selected: included, included, omitted: [],
    budgetChars: 20_000, materialText: '固定提炼材料', route: { provider: 'fixture', model: 'fixed' } }
  client.api.prepareExtraction.mockResolvedValue(preparation)
  client.api.extract.mockResolvedValue({ provider: 'fixture', model: 'fixed', drafts: ['长提炼结果', '待保存草稿'].map(title => ({
    cardId: randomUUID(), revisionId: randomUUID(), content: knowledgeContent(title), invalidCitations: 0, needsVerification: false,
    sources: [{ kind: 'extraction', preparationId: preparation.preparationId, startSeq: 10, endSeq: 14 }],
  })) })
  const revisions: KnowledgeCard['revisions'][number][] = []
  client.api.save.mockImplementation(async request => {
    revisions.push({ revisionId: request.revisionId, number: revisions.length + 1, requestHash: 'a'.repeat(64),
      savedAt: 1000, content: request.content, sources: [included] })
    return { cardId: request.cardId, topicIds: [], revisions: [...revisions] }
  })
  function Entry() { const knowledge = useKnowledge()!; return <button onClick={() => knowledge.extract({
    kind: 'discussion', sessionId: 'session-a', startSeq: 10, endSeq: 14,
  })}>开始提炼</button> }
  render(wrap(<Entry />))
  fireEvent.click(screen.getByRole('button', { name: '开始提炼' }))
  const dialog = screen.getByRole('dialog', { name: '提炼知识' })
  fireEvent.click(within(dialog).getByRole('button', { name: '预览纳入材料' }))
  fireEvent.click(await within(dialog).findByRole('button', { name: '生成知识草稿' }))
  const title = await within(dialog).findByDisplayValue('长提炼结果')
  const sibling = within(within(dialog).getByDisplayValue('待保存草稿').closest('form')!).getByRole('textbox', { name: '结论' }) as HTMLTextAreaElement
  fireEvent.change(sibling, { target: { value: '另一张草稿的人工输入' } })
  fireEvent.click(within(title.closest('form')!).getByRole('button', { name: '保存知识' }))
  const reader = (await within(dialog).findByRole('heading', { name: '长提炼结果' })).parentElement!
  fireEvent.click(within(reader).getByRole('button', { name: /查看来源原文/ }))
  const original = await within(reader).findByRole('region', { name: '讨论原文' })
  const scroller = dialog.querySelector<HTMLElement>(`.${styles.knowledgeBody}`)!
  scroller.scrollTop = 4058.5
  const edit = within(reader).getByRole('button', { name: '编辑卡片' })
  edit.focus()
  fireEvent.click(edit)
  const form = within(dialog).getByDisplayValue('长提炼结果').closest('form')!
  expect((within(form).getByRole('checkbox', { name: '引用第 1 轮' }) as HTMLInputElement).checked).toBe(true)
  // jsdom has no layout. Reproduce Chrome clamping the outer scrollport when
  // the long saved reader is replaced by the shorter editing form.
  scroller.scrollTop = 913
  if (changed) fireEvent.change(within(form).getByRole('textbox', { name: '结论' }), { target: { value: '放弃这次修改' } })
  fireEvent.click(within(form).getByRole('button', { name: t('knowledge.cancel') }))
  if (changed) fireEvent.click(screen.getByRole('button', { name: '放弃未保存内容' }))
  await waitFor(() => { expect(scroller.scrollTop).toBe(4058.5) })
  expect(document.activeElement).toBe(edit)
  expect(within(reader).getByRole('region', { name: '讨论原文' })).toBe(original)
  expect(sibling.value).toBe('另一张草稿的人工输入')
  expect(client.api.save).toHaveBeenCalledTimes(1)

  if (!changed) {
    fireEvent.click(edit)
    scroller.scrollTop = 913
    fireEvent.click(within(within(dialog).getByDisplayValue('长提炼结果').closest('form')!).getByRole('button', { name: '保存知识' }))
    await within(dialog).findByRole('option', { name: '第 2 版' })
    // A new saved revision starts its own reader without resetting the whole batch.
    expect(scroller.scrollTop).toBe(913)
    expect(sibling.value).toBe('另一张草稿的人工输入')
  }
})

it('uses the supplied batch relations without starting another request and abandons a closed card read', async () => {
  const { client, card, relations, reuse, wrap } = fixture()
  const batch = { relations, failed: false, loading: false, retry: vi.fn() }
  const pending = Promise.withResolvers<KnowledgeCard | null>()
  client.api.read.mockReturnValue(pending.promise)
  function Entry() { const knowledge = useKnowledge()!; return <button onClick={() => knowledge.open(card.cardId)}>打开卡片</button> }
  render(wrap(<><Entry /><KnowledgeReader card={card} relations={batch} read={client.read} t={t} /></>))
  expect(screen.getByRole('button', { name: /核对第 2 版/ })).toBeTruthy()
  expect(reuse.relations).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '打开卡片' }))
  await waitFor(() => { expect(client.api.read).toHaveBeenCalledTimes(1) })
  fireEvent.click(screen.getByRole('button', { name: '关闭卡片' }))
  expect(client.api.read.mock.calls[0]![1].aborted).toBe(true)
  pending.resolve(card)
  await waitFor(() => { expect(screen.queryByRole('dialog', { name: '知识卡片' })).toBeNull() })
  expect(reuse.relations).not.toHaveBeenCalled()
})
