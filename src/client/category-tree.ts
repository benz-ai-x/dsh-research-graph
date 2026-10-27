/**
 * Derive the sidebar category tree: one section per Workspace, whose Sessions
 * partition into that Workspace's categories (stored Research Topics scoped
 * to it) plus one Uncategorized bucket. Categorizing is strictly
 * Workspace-internal — a category lists only members from its own
 * Workspace's account, so the per-Workspace count always equals the native
 * browser's group and the parts always sum to it. Visibility follows the
 * native browser's defaults: Subagent Sessions never list, blank Sessions
 * list only while selected, and archived Sessions stay hidden unless the view
 * opts in (an all-archived account then hides entirely, like the native
 * filter). Topics without a live Workspace attribution never render here.
 */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic } from '../research-topic.ts'

/** Section key for Sessions no registered Workspace accounts (native 未分组). */
export const UNGROUPED_KEY = '__category_ungrouped__'

/** One Session row inside a category or an uncategorized bucket. */
export interface CategorySessionRow {
  readonly sessionId: string
  /** Live display title; '' for blank and unnamed Sessions (the renderer localizes). */
  readonly title: string
  /** The provisional blank Session; the renderer shows the localized New Session title. */
  readonly blank: boolean
  readonly running: boolean
  readonly current: boolean
  readonly archived: boolean
  readonly updatedAt: number
}

/** One category (Research Topic) with its Workspace-account member rows. */
export interface CategoryNode {
  readonly topicId: string
  readonly title: string
  readonly sessions: readonly CategorySessionRow[]
}

/** One tree section: a Workspace account, or the trailing ungrouped account. */
export interface CategorySection {
  /** Workspace id, or {@link UNGROUPED_KEY}. */
  readonly key: string
  readonly workspaceId: string | undefined
  readonly label: string
  /** Workspace display title, or the raw directory basename fallback. */
  readonly cwd: string | undefined
  /** Visible Sessions in the account (hidden archives excluded), categorized or not. */
  readonly sessionCount: number
  readonly categories: readonly CategoryNode[]
  /** Account Sessions no category of this Workspace references. */
  readonly uncategorized: readonly CategorySessionRow[]
}

/** Complete derived tree plus stale-attribution diagnostics. */
export interface CategoryTree {
  readonly sections: readonly CategorySection[]
  /** Workspace ids Topics still name but no registered Workspace provides. */
  readonly staleWorkspaceIds: readonly string[]
}

/** Viewing inputs beyond the authoritative lists. */
export interface CategoryTreeView {
  readonly archivedSessionIds: readonly string[]
  readonly current?: SessionId
  /** Archived visibility choice; hidden by default like the native browser. */
  readonly showArchived?: boolean
}

function mainSessionId(list: SessionListState): SessionId | undefined {
  return Object.values(list.byId)
    .find(session => (session.retainedBy?.mainView ?? 0) > 0)?.id
}

/** Native row visibility: subagents never list, blanks only the current one. */
function accountVisible(session: SessionSummary, current: SessionId | undefined): boolean {
  if (session.origin === 'subagent') return false
  if (session.blank && session.id !== current) return false
  return true
}

function liveRow(
  session: SessionSummary,
  current: SessionId | undefined,
  archived: ReadonlySet<string>,
): CategorySessionRow {
  return {
    sessionId: session.id,
    title: session.blank ? '' : (session.displayTitle ?? ''),
    blank: session.blank,
    running: session.running,
    current: session.id === current,
    archived: archived.has(session.id),
    updatedAt: session.updatedAt,
  }
}

/**
 * Derive the full category tree from authoritative facts.
 * @param topics - stored Research Topics in stored order.
 * @param workspaces - registered Workspaces in Host order.
 * @param list - Session list snapshot.
 * @param view - archived set plus the selected Session.
 * @returns Workspace sections in Host order (a trailing section collects
 * Sessions no Workspace accounts, mirroring the native ungrouped bucket) and
 * the stale attribution report.
 */
export function deriveCategoryTree(
  topics: readonly ResearchTopic[],
  workspaces: readonly WorkspaceView[],
  list: SessionListState,
  view: CategoryTreeView,
): CategoryTree {
  const archived = new Set<string>(view.archivedSessionIds)
  const current = view.current ?? mainSessionId(list)
  const showArchived = view.showArchived === true

  const stale = new Set<string>()
  const workspaceIds = new Set<string>(workspaces.map(workspace => workspace.workspaceId as string))
  const categoriesByWorkspace = new Map<string, ResearchTopic[]>()
  for (const topic of topics) {
    if (topic.workspaceId === undefined) continue
    if (!workspaceIds.has(topic.workspaceId)) {
      stale.add(topic.workspaceId)
      continue
    }
    const bucket = categoriesByWorkspace.get(topic.workspaceId)
    if (bucket === undefined) categoriesByWorkspace.set(topic.workspaceId, [topic])
    else bucket.push(topic)
  }

  const accountRows = (members: readonly SessionId[]): CategorySessionRow[] => members.flatMap(id => {
    const session = list.byId[id]
    if (session === undefined || !accountVisible(session, current)) return []
    if (archived.has(session.id) && !showArchived) return []
    return [liveRow(session, current, archived)]
  })

  const sections: CategorySection[] = workspaces.flatMap(workspace => {
    const rows = accountRows(workspace.sessionIds)
    const rowsById = new Map(rows.map(row => [row.sessionId, row]))
    const categories = (categoriesByWorkspace.get(workspace.workspaceId) ?? [])
      .map(topic => ({
        topic,
        node: {
          topicId: topic.topicId,
          title: topic.title,
          sessions: topic.references.flatMap(reference => {
            const row = rowsById.get(reference.sessionId)
            return row === undefined ? [] : [row]
          }),
        },
      }))
      // A category shows while it holds this Workspace's Sessions or holds
      // nothing at all (freshly created); one drained by hidden archives or
      // foreign-only membership folds away.
      .filter(({ topic, node }) => node.sessions.length > 0 || topic.references.length === 0)
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
  const loose = list.ids
    .map(id => list.byId[id])
    .filter((session): session is SessionSummary =>
      session !== undefined && !accounted.has(session.id) && accountVisible(session, current)
      && (showArchived || !archived.has(session.id)))
    .map(session => liveRow(session, current, archived))
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

/** One flattened search hit with its breadcrumb for result rows. */
export interface CategorySearchHit {
  readonly row: CategorySessionRow
  /** Owning section label, localized by the caller. */
  readonly section: CategorySection
  /** Owning category title; absent for uncategorized hits. */
  readonly category: string | undefined
}

/**
 * Flat title-substring search across the whole tree, newest first: live rows
 * only (ghosts and, per the tree's own filter, hidden archives never match).
 * @param tree - derived tree respecting the archived-visibility choice.
 * @param query - caller text; surrounding whitespace is ignored.
 * @returns bounded flat hits with their breadcrumb.
 */
/**
 * Flat title-substring search across the whole tree, newest first. Blank and
 * unnamed rows never match (their localized labels are not stored titles).
 * @param tree - derived tree respecting the archived-visibility choice.
 * @param query - caller text; surrounding whitespace is ignored.
 * @returns bounded flat hits with their breadcrumb.
 */
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
        // A categorized hit carries more context; keep it over the bucket one.
        if (!bySession.has(row.sessionId)) bySession.set(row.sessionId, { row, section, category: undefined })
      }
    }
  }
  return [...bySession.values()].sort((a, b) => b.row.updatedAt - a.row.updatedAt)
}

/**
 * Keys of the sections and categories whose display contains the current
 * Session row, for the containing-current tint and first-load auto expansion.
 */
export function currentAncestryKeys(tree: CategoryTree): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const section of tree.sections) {
    const categoryHits = section.categories
      .filter(category => category.sessions.some(row => row.current))
      .map(category => category.topicId)
    if (categoryHits.length > 0 || section.uncategorized.some(row => row.current)) {
      keys.add(section.key)
      for (const topicId of categoryHits) keys.add(topicId)
    }
  }
  return keys
}
