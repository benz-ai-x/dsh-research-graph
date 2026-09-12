// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { ResearchRelation } from '../src/research-relations.ts'
import type { ResearchReuseApi } from '../src/client/research-reuse-remote.ts'
import { KnowledgeProvider, useKnowledge } from '../src/client/Knowledge.tsx'
import { KnowledgeSearch } from '../src/client/KnowledgeSearch.tsx'
import { KnowledgeReader } from '../src/client/KnowledgeReader.tsx'
import { ResearchReuseProvider } from '../src/client/ResearchReuse.tsx'
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
