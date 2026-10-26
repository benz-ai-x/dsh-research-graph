/**
 * Derive the sidebar category tree: Workspace sections hold category Topics
 * (by stored workspace attribution) and every unreferenced Session of the
 * account; topics without a live Workspace attribution trail in the
 * unassigned section. Visibility follows the native browser's defaults:
 * Subagent Sessions never list, blank Sessions list only while selected, and
 * archived Sessions stay hidden from accounts (a category keeps its archived
 * members as unopenable rows so membership stays inspectable).
 */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic, ResearchTopicReference } from '../research-topic.ts'

/** Section key for Topics without a live Workspace attribution. */
export const UNASSIGNED_KEY = '__category_unassigned__'
/** Section key for Sessions no registered Workspace accounts. */
export const NO_WORKSPACE_KEY = '__category_no_workspace__'

/** One Session row inside a category or an uncategorized bucket. */
export interface CategorySessionRow {
  readonly sessionId: string
  readonly title: string
  /** Live list membership; false rows are stale references kept for identity. */
  readonly listed: boolean
  readonly running: boolean
  readonly current: boolean
  readonly archived: boolean
  readonly updatedAt: number
}

/** One category (Research Topic) with its projected Session rows. */
export interface CategoryNode {
  readonly topicId: string
  readonly title: string
  readonly sessions: readonly CategorySessionRow[]
}

/** One tree section: a Workspace account, or a synthetic trailing account. */
export interface CategorySection {
  /** Workspace id, or a synthetic {@link UNASSIGNED_KEY}/{@link NO_WORKSPACE_KEY} key. */
  readonly key: string
  readonly workspaceId: string | undefined
  readonly label: string
  /** Workspace display title, or the raw directory basename fallback. */
  readonly cwd: string | undefined
  readonly categories: readonly CategoryNode[]
  /** Account Sessions no category references, in Workspace account order. */
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
    title: session.displayTitle,
    listed: true,
    running: session.running,
    current: session.id === current,
    archived: archived.has(session.id),
    updatedAt: session.updatedAt,
  }
}

function ghostRow(reference: ResearchTopicReference): CategorySessionRow {
  return {
    sessionId: reference.sessionId,
    title: reference.title,
    listed: false,
    running: false,
    current: false,
    archived: false,
    updatedAt: 0,
  }
}

function categoryNode(
  topic: ResearchTopic,
  list: SessionListState,
  current: SessionId | undefined,
  archived: ReadonlySet<string>,
): CategoryNode {
  return {
    topicId: topic.topicId,
    title: topic.title,
    sessions: topic.references.map(reference => {
      const session = list.byId[reference.sessionId as SessionId]
      if (session === undefined || session.origin === 'subagent' || (session.blank && session.id !== current)) {
        return ghostRow(reference)
      }
      return liveRow(session, current, archived)
    }),
  }
}

/**
 * Derive the full category tree from authoritative facts.
 * @param topics - stored Research Topics in stored order.
 * @param workspaces - registered Workspaces in Host order.
 * @param list - Session list snapshot.
 * @param view - archived set plus the selected Session.
 * @returns sections in render order (Workspaces, then unassigned topics, then
 * loose Sessions) and the stale attribution report.
 */
export function deriveCategoryTree(
  topics: readonly ResearchTopic[],
  workspaces: readonly WorkspaceView[],
  list: SessionListState,
  view: CategoryTreeView,
): CategoryTree {
  const archived = new Set<string>(view.archivedSessionIds)
  const current = view.current ?? mainSessionId(list)
  const referenced = new Set<string>()
  for (const topic of topics) {
    for (const reference of topic.references) referenced.add(reference.sessionId)
  }

  const stale = new Set<string>()
  const assignedByWorkspace = new Map<string, ResearchTopic[]>()
  const unassigned: ResearchTopic[] = []
  for (const topic of topics) {
    if (topic.workspaceId === undefined) {
      unassigned.push(topic)
      continue
    }
    if (!workspaces.some(workspace => workspace.workspaceId === topic.workspaceId)) {
      stale.add(topic.workspaceId)
      unassigned.push(topic)
      continue
    }
    const bucket = assignedByWorkspace.get(topic.workspaceId)
    if (bucket === undefined) assignedByWorkspace.set(topic.workspaceId, [topic])
    else bucket.push(topic)
  }

  const accountRows = (members: readonly SessionId[]): CategorySessionRow[] => members.flatMap(id => {
    const session = list.byId[id]
    return session !== undefined && accountVisible(session, current) ? [liveRow(session, current, archived)] : []
  })

  const sections: CategorySection[] = workspaces.flatMap(workspace => {
    const rows = accountRows(workspace.sessionIds)
    const categories = (assignedByWorkspace.get(workspace.workspaceId) ?? [])
      .map(topic => categoryNode(topic, list, current, archived))
    if (categories.length === 0 && rows.length === 0) return []
    return [{
      key: workspace.workspaceId,
      workspaceId: workspace.workspaceId,
      label: workspace.title,
      cwd: workspace.path,
      categories,
      uncategorized: rows.filter(row => !referenced.has(row.sessionId) && !row.archived),
    }]
  })

  if (unassigned.length > 0) {
    sections.push({
      key: UNASSIGNED_KEY,
      workspaceId: undefined,
      label: '',
      cwd: undefined,
      categories: unassigned.map(topic => categoryNode(topic, list, current, archived)),
      uncategorized: [],
    })
  }

  const accounted = new Set<string>(workspaces.flatMap(workspace => workspace.sessionIds as readonly string[]))
  const loose = list.ids
    .map(id => list.byId[id])
    .filter((session): session is SessionSummary =>
      session !== undefined && !accounted.has(session.id) && accountVisible(session, current)
      && !archived.has(session.id))
    .map(session => liveRow(session, current, archived))
  if (loose.length > 0) {
    sections.push({
      key: NO_WORKSPACE_KEY,
      workspaceId: undefined,
      label: '',
      cwd: undefined,
      categories: [],
      uncategorized: loose,
    })
  }

  return { sections, staleWorkspaceIds: [...stale] }
}
