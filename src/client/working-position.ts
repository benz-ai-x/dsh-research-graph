import type { DiscussionSearchScope } from '../session-search.ts'
import type { SessionDiscussionRange } from '../session-history.ts'
import type { Viewport } from './viewport.ts'
import { SCALE_MAX, SCALE_MIN } from './viewport.ts'

/** Browser presentation only: identities and cursors, never source text or saved knowledge. */
export interface WorkingPosition {
  readonly workbenchView?: 'graph' | 'reading'
  readonly knowledgeReading?: { readonly cardId: string; readonly revisionId: string; readonly sourceIndex?: number | undefined; readonly scrollTop: number }
  readonly viewport?: Viewport
  readonly selected?: string | null
  readonly query?: string
  readonly tab?: 'digest' | 'history'
  readonly history?: Readonly<Record<string, number>>
  readonly historyRange?: Readonly<Record<string, SessionDiscussionRange>>
  readonly historyScroll?: Readonly<Record<string, number>>
  readonly topicId?: string
  readonly searchType?: 'discussion' | 'knowledge'
  readonly discussion?: { readonly query: string; readonly scope: DiscussionSearchScope; readonly includeArchived: boolean }
  readonly knowledge?: { readonly query: string; readonly inTopic: boolean }
}

export function workingPositionKey(hostId: string, scope: string, topicId?: string): string {
  return JSON.stringify([hostId, scope, topicId ?? null])
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown, max = 1000): value is string => typeof value === 'string' && value.length <= max && !value.includes('\0')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function loadWorkingPosition(key: string | undefined): WorkingPosition {
  if (key === undefined) return {}
  try {
    const value: unknown = JSON.parse(globalThis.localStorage.getItem(`dsh.session-graph.position.${key}`) ?? 'null')
    if (!object(value) || value.v !== 1) return {}
    const viewport = value.viewport
    const reading = value.knowledgeReading
    const discussion = value.discussion
    const scope = object(discussion) ? discussion.scope : undefined
    const validScope = object(scope) && (scope.kind === 'all'
      || (scope.kind === 'workspace' && string(scope.workspaceId)) || (scope.kind === 'directory' && string(scope.cwd)))
    const history = object(value.history) ? Object.fromEntries(Object.entries(value.history)
      .filter(([id, seq]) => string(id) && Number.isSafeInteger(seq) && (seq as number) >= 0)) as Record<string, number> : undefined
    const historyScroll = object(value.historyScroll) ? Object.fromEntries(Object.entries(value.historyScroll)
      .filter(([id, top]) => string(id) && finite(top) && top >= 0)) as Record<string, number> : undefined
    const historyRange = object(value.historyRange) ? Object.fromEntries(Object.entries(value.historyRange)
      .filter(([id, range]) => string(id) && object(range) && Number.isSafeInteger(range.startSeq)
        && Number.isSafeInteger(range.endSeq) && (range.startSeq as number) >= 0 && (range.endSeq as number) > (range.startSeq as number))
      .map(([id, range]) => [id, { startSeq: (range as SessionDiscussionRange).startSeq, endSeq: (range as SessionDiscussionRange).endSeq }])) : undefined
    return {
      ...(value.workbenchView === 'graph' || value.workbenchView === 'reading' ? { workbenchView: value.workbenchView } : {}),
      ...(object(reading) && string(reading.cardId) && string(reading.revisionId) && finite(reading.scrollTop) && reading.scrollTop >= 0
        ? { knowledgeReading: { cardId: reading.cardId, revisionId: reading.revisionId, scrollTop: reading.scrollTop,
          ...(Number.isInteger(reading.sourceIndex) && (reading.sourceIndex as number) >= 0 && (reading.sourceIndex as number) < 32 ? { sourceIndex: reading.sourceIndex as number } : {}) } } : {}),
      ...(object(viewport) && finite(viewport.scale) && viewport.scale >= SCALE_MIN && viewport.scale <= SCALE_MAX
        && finite(viewport.panX) && finite(viewport.panY) ? { viewport: viewport as unknown as Viewport } : {}),
      ...(value.selected === null || string(value.selected) ? { selected: value.selected } : {}),
      ...(string(value.query, 256) ? { query: value.query } : {}),
      ...(value.tab === 'digest' || value.tab === 'history' ? { tab: value.tab } : {}),
      ...(history === undefined ? {} : { history }),
      ...(historyRange === undefined ? {} : { historyRange }),
      ...(historyScroll === undefined ? {} : { historyScroll }),
      ...(string(value.topicId) ? { topicId: value.topicId } : {}),
      ...(value.searchType === 'discussion' || value.searchType === 'knowledge' ? { searchType: value.searchType } : {}),
      ...(object(discussion) && string(discussion.query, 256) && validScope && typeof discussion.includeArchived === 'boolean'
        ? { discussion: { query: discussion.query, scope: scope as unknown as DiscussionSearchScope, includeArchived: discussion.includeArchived } } : {}),
      ...(object(value.knowledge) && string(value.knowledge.query, 200) && typeof value.knowledge.inTopic === 'boolean'
        ? { knowledge: { query: value.knowledge.query, inTopic: value.knowledge.inTopic } } : {}),
    }
  } catch { return {} }
}

export function saveWorkingPosition(key: string | undefined, patch: WorkingPosition): void {
  if (key === undefined) return
  try { globalThis.localStorage.setItem(`dsh.session-graph.position.${key}`, JSON.stringify({ ...loadWorkingPosition(key), ...patch, v: 1 })) } catch {
    // Storage denial/quota only disables restoration; the live view remains usable.
  }
}
