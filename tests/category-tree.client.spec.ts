import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic } from '../src/research-topic.ts'
import {
  currentAncestryKeys, deriveCategoryTree, UNGROUPED_KEY, searchCategoryTree,
} from '../src/client/category-tree.ts'

const id = (value: string): SessionId => value as SessionId

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    ...over,
  }
}

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    projectionsBySession: {},
  }
}

function workspace(value: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: value,
    path: `/host/${value}`,
    title: `Workspace ${value}`,
    sessionIds: sessionIds.map(id),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function topic(topicId: string, title: string, sessionIds: string[], workspaceId?: string): ResearchTopic {
  return {
    topicId,
    title,
    workspaceId,
    references: sessionIds.map(sessionId => ({ sessionId, title: `Stored ${sessionId}` })),
    arrangement: { positions: {}, collapsed: [], offsets: {} },
  }
}

describe('deriveCategoryTree', () => {
  it('groups categories under their workspace with an uncategorized bucket', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '综述', ['s1'], 'ws-a'), topic('t2', '实验', ['s2'], 'ws-a')],
      [workspace('ws-a', ['s1', 's2', 's3'])],
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3') }),
      { archivedSessionIds: [] },
    )
    expect(tree.sections).toHaveLength(1)
    const section = tree.sections[0]
    expect(section.key).toBe('ws-a')
    expect(section.categories.map(category => category.title)).toEqual(['综述', '实验'])
    expect(section.uncategorized.map(row => row.sessionId)).toEqual(['s3'])
  })

  it('never categorizes a Session through another Workspace\'s category', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '工作区A的分类', ['s2'], 'ws-a')],
      [workspace('ws-a', ['s1']), workspace('ws-b', ['s2'])],
      listState({ s1: session('s1'), s2: session('s2') }),
      { archivedSessionIds: [] },
    )
    const sectionA = tree.sections.find(section => section.key === 'ws-a')
    const sectionB = tree.sections.find(section => section.key === 'ws-b')
    // The cross-Workspace reference is invisible to the partition: ws-b's
    // Session stays uncategorized at home, and ws-a's category holds nothing.
    expect(sectionA?.categories).toHaveLength(0)
    expect(sectionA?.uncategorized.map(row => row.sessionId)).toEqual(['s1'])
    expect(sectionB?.uncategorized.map(row => row.sessionId)).toEqual(['s2'])
  })

  it('partitions every Workspace: categories plus uncategorized always sum to the account', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '分类一', ['s1'], 'ws-a'), topic('t2', '分类二', ['s3'], 'ws-a')],
      [workspace('ws-a', ['s1', 's2', 's3', 's4'])],
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3'), s4: session('s4') }),
      { archivedSessionIds: [] },
    )
    const section = tree.sections[0]
    expect(section.sessionCount).toBe(4)
    const categorized = section.categories.reduce((count, category) => count + category.sessions.length, 0)
    expect(categorized + section.uncategorized.length).toBe(section.sessionCount)
    expect(section.uncategorized.map(row => row.sessionId)).toEqual(['s2', 's4'])
  })

  it('hides subagent and unselected blank sessions from accounts', () => {
    const tree = deriveCategoryTree(
      [],
      [workspace('ws-a', ['s1', 's2'])],
      listState({ s1: session('s1', { origin: 'subagent' }), s2: session('s2', { blank: true }) }),
      { archivedSessionIds: [], current: id('current') },
    )
    expect(tree.sections).toHaveLength(0)
  })

  it('folds all-archived categories away by default but keeps them on request', () => {
    const topics = [topic('t1', '含归档', ['s1'], 'ws-a')]
    const workspacesList = [workspace('ws-a', ['s1', 's2'])]
    const list = listState({ s1: session('s1'), s2: session('s2') })
    const hidden = deriveCategoryTree(topics, workspacesList, list, { archivedSessionIds: [id('s1'), id('s2')] })
    expect(hidden.sections).toHaveLength(0)
    const shown = deriveCategoryTree(topics, workspacesList, list, {
      archivedSessionIds: [id('s1'), id('s2')], showArchived: true,
    })
    expect(shown.sections[0].sessionCount).toBe(2)
    expect(shown.sections[0].categories[0].sessions[0]).toMatchObject({ sessionId: 's1', archived: true })
  })

  it('hides topics without a Workspace attribution and reports stale ones', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '无归属', []), topic('t2', '失效归属', ['s1'], 'ws-gone')],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1') }),
      { archivedSessionIds: [] },
    )
    expect(tree.staleWorkspaceIds).toEqual(['ws-gone'])
    expect(tree.sections).toHaveLength(1)
    expect(tree.sections[0].key).toBe('ws-a')
    expect(tree.sections[0].uncategorized.map(row => row.sessionId)).toEqual(['s1'])
  })

  it('lists loose sessions in the trailing ungrouped section', () => {
    const tree = deriveCategoryTree(
      [],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1'), loose: session('loose') }),
      { archivedSessionIds: [] },
    )
    const loose = tree.sections.find(section => section.key === UNGROUPED_KEY)
    expect(loose?.uncategorized.map(row => row.sessionId)).toEqual(['loose'])
  })

  it('drops empty workspace sections entirely', () => {
    const tree = deriveCategoryTree(
      [],
      [workspace('ws-a', [])],
      listState({}),
      { archivedSessionIds: [] },
    )
    expect(tree.sections).toHaveLength(0)
  })

  it('hides archived category members and folds all-archived categories by default', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '全部归档', ['s1'], 'ws-a'), topic('t2', '部分归档', ['s2', 's3'], 'ws-a')],
      [workspace('ws-a', ['s1', 's2', 's3'])],
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3') }),
      { archivedSessionIds: [id('s1'), id('s2')] },
    )
    const titles = tree.sections[0].categories.map(category => category.title)
    expect(titles).toEqual(['部分归档'])
    const mixed = tree.sections[0].categories[0]
    expect(mixed.sessions.map(row => row.sessionId)).toEqual(['s3'])
  })

  it('keeps archived members inspectable when the view opts in', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '含归档', ['s1'], 'ws-a')],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1') }),
      { archivedSessionIds: [id('s1')], showArchived: true },
    )
    expect(tree.sections[0].categories[0].sessions[0]).toMatchObject({ sessionId: 's1', archived: true })
  })

  it('searches live titles across categories and buckets, newest first', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '缓存', ['s1'], 'ws-a')],
      [workspace('ws-a', ['s1', 's2'])],
      listState({
        s1: session('s1', { displayTitle: '缓存策略', updatedAt: 5 }),
        s2: session('s2', { displayTitle: '缓存复盘', updatedAt: 9 }),
        s3: session('s3', { displayTitle: '权限', updatedAt: 7 }),
      }),
      { archivedSessionIds: [] },
    )
    const hits = searchCategoryTree(tree, '缓存')
    expect(hits.map(hit => hit.row.sessionId)).toEqual(['s2', 's1'])
    expect(hits[0].category).toBeUndefined()
    expect(hits[1].category).toBe('缓存')
    expect(searchCategoryTree(tree, '  ')).toEqual([])
  })

  it('reports the sections and categories containing the current session', () => {
    const tree = deriveCategoryTree(
      [topic('t1', '当前所在', ['s2'], 'ws-a'), topic('t2', '别处', ['s3'], 'ws-a')],
      [workspace('ws-a', ['s1', 's2', 's3'])],
      listState({
        s1: session('s1'),
        s2: session('s2', { retainedBy: { mainView: 1 } }),
        s3: session('s3'),
      }),
      { archivedSessionIds: [] },
    )
    expect([...currentAncestryKeys(tree)].sort()).toEqual(['t1', 'ws-a'])
  })

  it('labels blank rows empty and counts them exactly like the native browser', () => {
    const tree = deriveCategoryTree(
      [],
      [workspace('ws-a', ['blank-current', 'blank-other', 'untitled', 'named'])],
      listState({
        'blank-current': session('blank-current', { blank: true, retainedBy: { mainView: 1 }, displayTitle: 'ws-a' }),
        'blank-other': session('blank-other', { blank: true, displayTitle: 'ws-a' }),
        untitled: session('untitled', { displayTitle: '' }),
        named: session('named'),
      }),
      { archivedSessionIds: [] },
    )
    const section = tree.sections[0]
    expect(section.sessionCount).toBe(3)
    const rows = section.uncategorized
    expect(rows.find(row => row.sessionId === 'blank-current')).toMatchObject({ title: '', blank: true, current: true })
    expect(rows.find(row => row.sessionId === 'untitled')).toMatchObject({ title: '', blank: false })
    expect(rows.find(row => row.sessionId === 'named')?.title).toBe('Session named')
    expect(rows.some(row => row.sessionId === 'blank-other')).toBe(false)
  })

  it('counts archived sessions only while the view shows them, like the native filter', () => {
    const topics: readonly ResearchTopic[] = []
    const workspacesList = [workspace('ws-a', ['live', 'archived-one'])]
    const list = listState({ live: session('live'), 'archived-one': session('archived-one') })
    const archived = [id('archived-one')]
    const hidden = deriveCategoryTree(topics, workspacesList, list, { archivedSessionIds: archived })
    expect(hidden.sections[0].sessionCount).toBe(1)
    expect(hidden.sections[0].uncategorized.map(row => row.sessionId)).toEqual(['live'])
    const shown = deriveCategoryTree(topics, workspacesList, list, { archivedSessionIds: archived, showArchived: true })
    expect(shown.sections[0].sessionCount).toBe(2)
    expect(shown.sections[0].uncategorized).toHaveLength(2)
  })
})
