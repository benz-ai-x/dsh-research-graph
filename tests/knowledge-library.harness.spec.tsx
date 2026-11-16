// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { KnowledgeCard, KnowledgeContent } from '../src/knowledge.ts'
import type { ResearchReuseApi } from '../src/client/research-reuse-remote.ts'
import type { GraphViewInjected } from '../src/client/GraphView.tsx'
import { KnowledgeProvider } from '../src/client/Knowledge.tsx'
import { KnowledgeLibrary } from '../src/client/KnowledgeLibrary.tsx'
import { KnowledgeReader } from '../src/client/KnowledgeReader.tsx'
import { ResearchReuseProvider } from '../src/client/ResearchReuse.tsx'
import styles from '../src/client/GraphView.module.css'
import { knowledgeClient, knowledgeContent, knowledgeSource, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

function card(title: string, status: KnowledgeContent['status'], kind: KnowledgeContent['kind'], savedAt: number): KnowledgeCard {
  return { cardId: randomUUID(), topicIds: [], revisions: [{
    revisionId: randomUUID(), number: 1, requestHash: 'a'.repeat(64), savedAt,
    content: { ...knowledgeContent(title), status, kind }, sources: [],
  }] }
}

function fixture() {
  const client = knowledgeClient()
  const reuse: ResearchReuseApi = { relations: vi.fn(async () => []), forSession: vi.fn(), prepare: vi.fn(), read: vi.fn(), submit: vi.fn() }
  const wrap = (children: React.ReactNode) => <ResearchReuseProvider api={reuse} workspaces={[]} viewedId={'viewed' as never}
    openSession={vi.fn()} t={t}><KnowledgeProvider {...client} t={t}>{children}</KnowledgeProvider></ResearchReuseProvider>
  const actions = { readSessionHistory: client.read, reuse } as never as GraphViewInjected
  return { client, reuse, wrap, actions }
}

describe('Knowledge Library presentation and filtering', () => {
  it('filters by status and kind, sorts by title, and exposes search guidance and SVG badges', async () => {
    const { client, wrap, actions } = fixture()
    const cards = [card('Beta', 'draft', 'method', 2000), card('Alpha', 'confirmed', 'conclusion', 3000), card('Question', 'draft', 'question', 1000)]
    client.api.search.mockResolvedValue(cards)
    const { container } = render(wrap(<KnowledgeLibrary workingKey="workspace:test" actions={actions} t={t} />))
    await screen.findByRole('button', { name: /Beta/ })
    expect(screen.getByPlaceholderText('搜索标题、问题或结论')).toBeTruthy()
    expect(container.querySelectorAll('svg[data-icon]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-status="draft"]').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole('combobox', { name: '核实状态' }), { target: { value: 'draft' } })
    expect(screen.queryByRole('button', { name: /Alpha/ })).toBeNull()
    expect(screen.getByText('2 / 3')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: '卡片类型' }), { target: { value: 'question' } })
    expect(screen.queryByRole('button', { name: /Beta/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Question/ })).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox', { name: '卡片类型' }), { target: { value: 'all' } })
    fireEvent.change(screen.getByRole('combobox', { name: '排序方式' }), { target: { value: 'title' } })
    const titles = [...container.querySelectorAll(`.${styles.readingCatalogItem} strong`)].map(element => element.textContent)
    expect(titles).toEqual(['Beta', 'Question'])
    fireEvent.change(screen.getByRole('combobox', { name: '核实状态' }), { target: { value: 'all' } })
    expect(screen.queryByRole('button', { name: /Alpha/ })).toBeTruthy()
  })

  it('groups source ranges under one discussion, shows excerpts, hides empty follow-ups, and reads the selected range', async () => {
    const { client, wrap } = fixture()
    const current = card('证据卡', 'draft', 'method', 2000)
    const revision = current.revisions[0]!
    const enriched: KnowledgeCard = { ...current, revisions: [{ ...revision,
      content: { ...revision.content, openQuestions: '仍需核对原始证据' },
      sources: [knowledgeSource(1), knowledgeSource(2)],
    }] }
    const relations = { relations: [], loading: false, failed: false, retry: vi.fn() }
    const { container } = render(wrap(<KnowledgeReader card={enriched} relations={relations} read={client.read} t={t} />))

    expect(screen.getAllByText('讨论 A')).toHaveLength(1)
    expect(screen.getByText('原文 1')).toBeTruthy()
    expect(screen.getByText('原文 2')).toBeTruthy()
    expect(screen.queryByText('后续研究')).toBeNull()
    expect(container.querySelector('[data-field="openQuestions"]')).not.toBeNull()
    expect(container.querySelector('[data-icon="dsw-icon-paper-plane-outline-regular"]')).not.toBeNull()
    const sources = screen.getAllByRole('button', { name: /查看来源原文/ })
    expect(sources).toHaveLength(2)
    fireEvent.click(sources[1]!)
    await waitFor(() => {
      expect(client.read).toHaveBeenCalledWith({ sessionId: 'session-a', source: enriched.revisions[0]!.sources[1]!.source }, expect.any(AbortSignal))
    })
  })
})
