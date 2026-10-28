import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SidebarCategoryWorkspace } from '../sidebar-category.ts'

export const UNGROUPED_KEY = '__category_ungrouped__'

export interface CategorySessionRow {
  readonly sessionId: string
  readonly title: string
  readonly blank: boolean
  readonly running: boolean
  readonly current: boolean
  readonly archived: boolean
  readonly pinned: boolean
  readonly updatedAt: number
}

export interface CategoryNode {
  readonly categoryId: string
  readonly title: string
  readonly sessions: readonly CategorySessionRow[]
}

export interface CategorySection {
  readonly key: string
  readonly workspaceId: string | undefined
  readonly label: string
  readonly cwd: string | undefined
  readonly sessionCount: number
  readonly categories: readonly CategoryNode[]
  readonly uncategorized: readonly CategorySessionRow[]
}

export interface CategoryTree {
  readonly sections: readonly CategorySection[]
  readonly staleWorkspaceIds: readonly string[]
}

export interface CategoryTreeView {
  readonly archivedSessionIds: readonly string[]
  readonly pinnedSessionIds?: readonly string[]
  readonly current?: SessionId
  readonly showArchived?: boolean
}

function mainSessionId(list: SessionListState): SessionId | undefined {
  return Object.values(list.byId)
    .find(session => (session.retainedBy?.mainView ?? 0) > 0)?.id
}

function accountVisible(session: SessionSummary, current: SessionId | undefined): boolean {
  if (session.origin === 'subagent') return false
  if (session.blank && session.id !== current) return false
  return true
}

function liveRow(
  session: SessionSummary,
  current: SessionId | undefined,
  archived: ReadonlySet<string>,
  pinned: ReadonlySet<string>,
): CategorySessionRow {
  return {
    sessionId: session.id,
    title: session.blank ? '' : (session.displayTitle ?? ''),
    blank: session.blank,
    running: session.running,
    current: session.id === current,
    archived: archived.has(session.id),
    pinned: pinned.has(session.id),
    updatedAt: session.updatedAt,
  }
}

function ordered(
  rows: readonly CategorySessionRow[],
  accountOrder: readonly string[],
): readonly CategorySessionRow[] {
  const positions = new Map(accountOrder.map((id, index) => [id, index]))
  return [...rows].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned)
    || b.updatedAt - a.updatedAt
    || (positions.get(a.sessionId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.sessionId) ?? Number.MAX_SAFE_INTEGER))
}

export function deriveCategoryTree(
  records: readonly SidebarCategoryWorkspace[],
  workspaces: readonly WorkspaceView[],
  list: SessionListState,
  view: CategoryTreeView,
): CategoryTree {
  const archived = new Set<string>(view.archivedSessionIds)
  const pinned = new Set<string>(view.pinnedSessionIds ?? [])
  const current = view.current ?? mainSessionId(list)
  const showArchived = view.showArchived === true

  const stale = new Set<string>()
  const workspaceIds = new Set<string>(workspaces.map(workspace => workspace.workspaceId as string))
  const categoriesByWorkspace = new Map<string, SidebarCategoryWorkspace['categories']>()
  for (const record of records) {
    if (!workspaceIds.has(record.workspaceId)) {
      stale.add(record.workspaceId)
      continue
    }
    categoriesByWorkspace.set(record.workspaceId, record.categories)
  }

  const accountRows = (members: readonly SessionId[]): CategorySessionRow[] => members.flatMap(id => {
    const session = list.byId[id]
    if (session === undefined || !accountVisible(session, current)) return []
    if (archived.has(session.id) && session.id !== current && !showArchived) return []
    return [liveRow(session, current, archived, pinned)]
  })

  const sections: CategorySection[] = workspaces.flatMap(workspace => {
    const accountOrder = workspace.sessionIds.map(String)
    const rows = ordered(accountRows(workspace.sessionIds), accountOrder)
    const rowsById = new Map(rows.map(row => [row.sessionId, row]))
    const categories = (categoriesByWorkspace.get(workspace.workspaceId) ?? [])
      .map(category => ({
        category,
        node: {
          categoryId: category.categoryId,
          title: category.title,
          sessions: ordered(category.sessionIds.flatMap(sessionId => {
            const row = rowsById.get(sessionId)
            return row === undefined ? [] : [row]
          }), accountOrder),
        },
      }))
      .filter(({ category, node }) => node.sessions.length > 0 || category.sessionIds.length === 0)
      .map(({ node }) => node)
    if (categories.length === 0 && rows.length === 0) return []
    const categorized = new Set(categories.flatMap(category => category.sessions.map(row => row.sessionId)))
    return [{
      key: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      label: workspace.title,
      cwd: workspace.path,
      sessionCount: rows.length,
      categories,
      uncategorized: rows.filter(row => !categorized.has(row.sessionId)),
    }]
  })

  const accounted = new Set<string>(workspaces.flatMap(workspace => workspace.sessionIds as readonly string[]))
  const loose = ordered(list.ids
    .map(id => list.byId[id])
    .filter((session): session is SessionSummary =>
      session !== undefined && !accounted.has(session.id) && accountVisible(session, current)
      && (showArchived || session.id === current || !archived.has(session.id)))
    .map(session => liveRow(session, current, archived, pinned)), list.ids)
  if (loose.length > 0) {
    sections.push({
      key: UNGROUPED_KEY,
      workspaceId: undefined,
      label: '',
      cwd: undefined,
      sessionCount: loose.length,
      categories: [],
      uncategorized: loose,
    })
  }

  return { sections, staleWorkspaceIds: [...stale] }
}

export interface CategorySearchHit {
  readonly row: CategorySessionRow
  readonly section: CategorySection
  readonly category: string | undefined
}

export function searchCategoryTree(tree: CategoryTree, query: string): readonly CategorySearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  const bySession = new Map<string, CategorySearchHit>()
  for (const section of tree.sections) {
    for (const category of section.categories) {
      for (const row of category.sessions) {
        if (row.title !== '' && row.title.toLowerCase().includes(needle) && !bySession.has(row.sessionId)) {
          bySession.set(row.sessionId, { row, section, category: category.title })
        }
      }
    }
    for (const row of section.uncategorized) {
      if (row.title !== '' && row.title.toLowerCase().includes(needle)) {
        if (!bySession.has(row.sessionId)) bySession.set(row.sessionId, { row, section, category: undefined })
      }
    }
  }
  return [...bySession.values()].sort((a, b) => b.row.updatedAt - a.row.updatedAt)
}

export interface CategoryNodeSearchHit {
  readonly section: CategorySection
  readonly category: CategoryNode
}

export function searchCategoryNodes(tree: CategoryTree, query: string): readonly CategoryNodeSearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  return tree.sections.flatMap(section => section.categories
    .filter(category => category.title.toLowerCase().includes(needle))
    .map(category => ({ section, category })))
}

export function currentAncestryKeys(tree: CategoryTree): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const section of tree.sections) {
    const categoryHits = section.categories
      .filter(category => category.sessions.some(row => row.current))
      .map(category => category.categoryId)
    const uncategorizedHit = section.uncategorized.some(row => row.current)
    if (categoryHits.length > 0 || uncategorizedHit) {
      keys.add(section.key)
      for (const categoryId of categoryHits) keys.add(categoryId)
      if (uncategorizedHit) keys.add(`${section.key}:uncategorized`)
    }
  }
  return keys
}
