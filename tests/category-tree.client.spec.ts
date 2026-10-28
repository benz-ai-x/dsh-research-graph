import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SidebarCategoryWorkspace } from '../src/sidebar-category.ts'
import {
  currentAncestryKeys, deriveCategoryTree, UNGROUPED_KEY, searchCategoryNodes, searchCategoryTree,
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

function categories(
  workspaceId: string,
  rows: readonly [categoryId: string, title: string, sessionIds: string[]][],
): SidebarCategoryWorkspace {
  return {
    workspaceId,
    categories: rows.map(([categoryId, title, sessionIds]) => ({ categoryId, title, sessionIds })),
  }
}

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'

describe('deriveCategoryTree', () => {
  it('groups categories under their workspace with an uncategorized bucket', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '综述', ['s1']], [B, '实验', ['s2']]])],
      [workspace('ws-a', ['s1', 's2', 's3'])],
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3') }),
      { archivedSessionIds: [] },
    )
    expect(tree.sections).toHaveLength(1)
    const section = tree.sections[0]
    expect(section.categories.map(category => category.title)).toEqual(['综述', '实验'])
    expect(section.uncategorized.map(row => row.sessionId)).toEqual(['s3'])
  })

  it('never categorizes a Session through another Workspace category', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '工作区A的分类', ['s2']]])],
      [workspace('ws-a', ['s1']), workspace('ws-b', ['s2'])],
      listState({ s1: session('s1'), s2: session('s2') }),
      { archivedSessionIds: [] },
    )
    const sectionA = tree.sections.find(section => section.key === 'ws-a')
    const sectionB = tree.sections.find(section => section.key === 'ws-b')
    expect(sectionA?.categories).toHaveLength(0)
    expect(sectionA?.uncategorized.map(row => row.sessionId)).toEqual(['s1'])
    expect(sectionB?.uncategorized.map(row => row.sessionId)).toEqual(['s2'])
  })

  it('partitions every Workspace with unique category membership', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '分类一', ['s1']], [B, '分类二', ['s3']]])],
      [workspace('ws-a', ['s1', 's2', 's3', 's4'])],
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3'), s4: session('s4') }),
      { archivedSessionIds: [] },
    )
    const section = tree.sections[0]
    expect(section.sessionCount).toBe(4)
    const members = section.categories.flatMap(category => category.sessions)
    expect(new Set(members.map(row => row.sessionId)).size).toBe(members.length)
    expect(members.length + section.uncategorized.length).toBe(section.sessionCount)
    expect(section.uncategorized.map(row => row.sessionId)).toEqual(['s2', 's4'])
  })

  it('orders pinned and recently active Sessions consistently in categories and Uncategorized', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '分类', ['old', 'pinned', 'recent']]])],
      [workspace('ws-a', ['old', 'pinned', 'recent', 'loose'])],
      listState({
        old: session('old', { updatedAt: 1 }),
        pinned: session('pinned', { updatedAt: 2 }),
        recent: session('recent', { updatedAt: 3 }),
        loose: session('loose', { updatedAt: 4 }),
      }),
      { archivedSessionIds: [], pinnedSessionIds: [id('pinned')] },
    )
    expect(tree.sections[0].categories[0].sessions.map(row => row.sessionId)).toEqual(['pinned', 'recent', 'old'])
    expect(tree.sections[0].uncategorized.map(row => row.sessionId)).toEqual(['loose'])
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
    const records = [categories('ws-a', [[A, '含归档', ['s1']]])]
    const workspacesList = [workspace('ws-a', ['s1', 's2'])]
    const list = listState({ s1: session('s1'), s2: session('s2') })
    const hidden = deriveCategoryTree(records, workspacesList, list, { archivedSessionIds: [id('s1'), id('s2')] })
    expect(hidden.sections).toHaveLength(0)
    const shown = deriveCategoryTree(records, workspacesList, list, {
      archivedSessionIds: [id('s1'), id('s2')], showArchived: true,
    })
    expect(shown.sections[0].sessionCount).toBe(2)
    expect(shown.sections[0].categories[0].sessions[0]).toMatchObject({ sessionId: 's1', archived: true })
  })

  it('keeps the currently viewed archived Session visible for its current marker', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '含归档', ['s1']]])],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1', { retainedBy: { mainView: 1 } }) }),
      { archivedSessionIds: [id('s1')], showArchived: false },
    )
    expect(tree.sections[0].categories[0].sessions[0]).toMatchObject({
      sessionId: 's1', current: true, archived: true,
    })
    expect([...currentAncestryKeys(tree)].sort()).toEqual([A, 'ws-a'])
  })

  it('reports stale Workspace attribution', () => {
    const tree = deriveCategoryTree(
      [categories('ws-gone', [[A, '失效归属', ['s1']]])],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1') }),
      { archivedSessionIds: [] },
    )
    expect(tree.staleWorkspaceIds).toEqual(['ws-gone'])
    expect(tree.sections).toHaveLength(1)
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
    const tree = deriveCategoryTree([], [workspace('ws-a', [])], listState({}), { archivedSessionIds: [] })
    expect(tree.sections).toHaveLength(0)
  })

  it('keeps archived members inspectable when the view opts in', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '含归档', ['s1']]])],
      [workspace('ws-a', ['s1'])],
      listState({ s1: session('s1') }),
      { archivedSessionIds: [id('s1')], showArchived: true },
    )
    expect(tree.sections[0].categories[0].sessions[0]).toMatchObject({ sessionId: 's1', archived: true })
  })

  it('searches live titles across categories and buckets, newest first', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '缓存', ['s1']]])],
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

  it('finds categories by title independently of their Session titles', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '缓存策略', ['s1']], [B, '权限实验', ['s2']]])],
      [workspace('ws-a', ['s1', 's2'])],
      listState({ s1: session('s1'), s2: session('s2') }),
      { archivedSessionIds: [] },
    )
    expect(searchCategoryNodes(tree, '缓存').map(hit => hit.category.categoryId)).toEqual([A])
    expect(searchCategoryNodes(tree, '权限').map(hit => hit.category.categoryId)).toEqual([B])
    expect(searchCategoryNodes(tree, '  ')).toEqual([])
  })

  it('reports the sections and categories containing the current session', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '当前所在', ['s2']], [B, '别处', ['s3']]])],
      [workspace('ws-a', ['s1', 's2', 's3'])],
      listState({
        s1: session('s1'),
        s2: session('s2', { retainedBy: { mainView: 1 } }),
        s3: session('s3'),
      }),
      { archivedSessionIds: [] },
    )
    expect([...currentAncestryKeys(tree)].sort()).toEqual([A, 'ws-a'])
  })

  it('includes the Uncategorized bucket in the current Session reveal path', () => {
    const tree = deriveCategoryTree(
      [categories('ws-a', [[A, '别处', ['s1']]])],
      [workspace('ws-a', ['s1', 's2'])],
      listState({ s1: session('s1'), s2: session('s2', { retainedBy: { mainView: 1 } }) }),
      { archivedSessionIds: [] },
    )
    expect([...currentAncestryKeys(tree)].sort()).toEqual(['ws-a', 'ws-a:uncategorized'])
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
    const records: readonly SidebarCategoryWorkspace[] = []
    const workspacesList = [workspace('ws-a', ['live', 'archived-one'])]
    const list = listState({ live: session('live'), 'archived-one': session('archived-one') })
    const archived = [id('archived-one')]
    const hidden = deriveCategoryTree(records, workspacesList, list, { archivedSessionIds: archived })
    expect(hidden.sections[0].sessionCount).toBe(1)
    expect(hidden.sections[0].uncategorized.map(row => row.sessionId)).toEqual(['live'])
    const shown = deriveCategoryTree(records, workspacesList, list, { archivedSessionIds: archived, showArchived: true })
    expect(shown.sections[0].sessionCount).toBe(2)
    expect(shown.sections[0].uncategorized).toHaveLength(2)
  })
})
