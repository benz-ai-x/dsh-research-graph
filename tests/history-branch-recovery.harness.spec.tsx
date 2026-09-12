// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HistoryBranchProvider, useHistoryBranch } from '../src/client/HistoryBranch.tsx'
import { KnowledgeProvider } from '../src/client/Knowledge.tsx'
import { ResearchTopics } from '../src/client/ResearchTopics.tsx'
import type { TopicGraphContext } from '../src/client/TopicGraph.tsx'
import type { HistoryBranchApi, HistoryBranchRecord, HistoryBranchRequest } from '../src/history-branch.ts'
import { knowledgeClient, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(() => { cleanup(); localStorage.clear() })

// Keep the real ResearchTopics refresh lifecycle; replace only its canvas leaf.
vi.mock('../src/client/TopicGraph.tsx', () => ({ TopicGraph: () => <Entry /> }))

const initial = (request: HistoryBranchRequest): HistoryBranchRecord => ({ ...request,
  targetSessionId: 'retained-child', title: '讨论 · 2', sourceTitle: '讨论',
  firstTurn: 1, lastTurn: 2, inheritedEventCount: 25, stage: 'prepared',
})

function Entry() {
  const branch = useHistoryBranch()!
  return <button data-history-branch-session="source" data-history-branch-start="20"
    onClick={() => { branch({ sessionId: 'source', startSeq: 20, endSeq: 24 }) }}>从第二轮分支</button>
}

it('opens the retained child while topic membership is still recoverable', async () => {
  let record: HistoryBranchRecord
  const open = vi.fn()
  const api = {
    prepare: vi.fn<HistoryBranchApi['prepare']>(async request => (record = initial(request))),
    submit: vi.fn(async () => ({ ...record, stage: 'created' as const, error: 'Topic storage offline' })),
    read: vi.fn(),
  }
  render(<HistoryBranchProvider api={api} hostId="host" openSession={open} t={t}><Entry /></HistoryBranchProvider>)
  fireEvent.click(screen.getByRole('button', { name: '从第二轮分支' }))
  fireEvent.click(await screen.findByRole('button', { name: t('branch.confirm') }))
  await screen.findByText('Topic storage offline', { exact: false })
  expect(screen.queryByRole('button', { name: t('branch.open') })).not.toBeNull()
  expect(screen.getByRole('button', { name: t('branch.retry') })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: t('branch.open') }))
  expect(open).toHaveBeenCalledExactlyOnceWith('retained-child')
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('restores branch focus after closing while the actual topic refresh is still pending', async () => {
  const client = knowledgeClient()
  let finishRefresh!: () => void
  const refreshed = new Promise<void>(resolve => { finishRefresh = resolve })
  let record: HistoryBranchRecord
  const api = {
    prepare: vi.fn<HistoryBranchApi['prepare']>(async request => (record = initial(request))),
    submit: vi.fn(async () => ({ ...record, stage: 'ready' as const })),
    read: vi.fn(),
  }
  const topic = { topicId: 'topic', title: '研究主题', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }
  client.topics.list.mockResolvedValueOnce([topic]).mockImplementation(async () => { await refreshed; return [topic] })
  const context = { workingKey: 'topic-context', actions: { hostId: 'host' } } as TopicGraphContext
  render(<KnowledgeProvider {...client} t={t}><HistoryBranchProvider api={api} hostId="host" openSession={vi.fn()} t={t}><ResearchTopics api={client.topics} context={context} t={t} /></HistoryBranchProvider></KnowledgeProvider>)
  const trigger = await screen.findByRole('button', { name: '从第二轮分支' })
  trigger.focus()
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('button', { name: t('branch.confirm') }))
  await screen.findByRole('button', { name: t('branch.open') })
  fireEvent.click(screen.getByRole('button', { name: t('branch.return') }))
  await waitFor(() => { expect(document.activeElement).toBe(trigger) })
  finishRefresh()
  const restored = await screen.findByRole('button', { name: '从第二轮分支' })
  await waitFor(() => { expect(document.activeElement).toBe(restored) })
})
