/**
 * The Session Graph tab body: a scope-bound lineage forest of Canvas Sessions
 * (Branch edges within clusters, Merge provenance across clusters, and
 * Subagent Derivations folded into Subagent Summary badges). Derives from the sessions/workspaces
 * standard feeds; selection stays in the graph while double-click and the
 * details panel navigate through the sessions verbs.
 */
import { useMemo, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionDigestResult } from '../session-digest.ts'
import type { SessionHistoryRequest, SessionHistoryResult } from '../session-history.ts'
import type { DiscussionSearchRequest, DiscussionSearchResult } from '../session-search.ts'
import { SESSION_GRAPH_BUILD_LABEL, SESSION_GRAPH_BUILD_TITLE } from './build-info.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { DiscussionSearch } from './DiscussionSearch.tsx'
import { deriveSessionGraph, resolveGraphScope } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import styles from './GraphView.module.css'

/** Business face the browser entry injects into the view (navigation verbs). */
export interface GraphViewInjected {
  searchDiscussion: (request: DiscussionSearchRequest, signal: AbortSignal) => Promise<DiscussionSearchResult>
  /** Read addressed discussion text without activating an Agent. */
  readSessionHistory: (request: SessionHistoryRequest, signal: AbortSignal) => Promise<SessionHistoryResult>
  /** Open one session on its own last view (double-click and panel verb). */
  openSession: (id: SessionId) => void
  /** Create a Branch from one session (the panel's New-branch verb). */
  branchSession: (id: SessionId) => Promise<void>
  /** Explicitly generate or refresh one read-only Session Digest. */
  generateSessionDigest: (
    id: SessionId,
    options: { readonly refresh: boolean },
    signal: AbortSignal,
  ) => Promise<SessionDigestResult>
  /** Create, capture, and open one independent Merge Session. */
  mergeSessions: (
    sourceIds: readonly SessionId[],
    instruction: string,
    signal: AbortSignal,
  ) => Promise<SessionId>
  /** Retry a failed Merge using its already-created target Session. */
  retrySessionMerge: (
    targetSessionId: SessionId,
    sourceIds: readonly SessionId[],
    instruction: string,
    signal: AbortSignal,
  ) => Promise<SessionId>
}

/** The graph view tab's composed props: runtime share + inject face + locale. */
export type GraphViewProps =
  ConvViewProps
  & InjectFace<GraphViewInjected>
  & PropsLocale<'sessionGraph'>

/**
 * Render the session graph tab body.
 * @param props - the composed view props (standard kit, inject face, locale seat).
 * @returns the tab body element.
 */
export function GraphView({
  sessionId, useSessions, useSessionPendingInteraction, useWorkspaces,
  openSession, branchSession, generateSessionDigest, readSessionHistory, searchDiscussion, mergeSessions, retrySessionMerge, t,
}: GraphViewProps): ReactElement {
  const sessions = useSessions(state => state)
  const pendingInteractions = useSessionPendingInteraction(state => state)
  const workspaces = useWorkspaces(state => state)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)

  const scope = useMemo(
    () => resolveGraphScope(sessionId, sessions, workspaces),
    [sessionId, sessions, workspaces],
  )
  const graph = useMemo(
    () => deriveSessionGraph(sessions, scope, sessionId, pendingInteractions),
    [sessions, scope, sessionId, pendingInteractions],
  )
  const laid = useMemo(() => layoutSessionGraph(graph), [graph])

  const now = Date.now()

  return (
    // The free canvas owns its viewport. Extend the view behind the floating
    // composer so GraphCanvas's live clearance reserves the seat exactly once.
    <div className={styles.root} data-conversation-composer-overlay="">
      <div className={styles.graphBody} aria-hidden={searchOpen || undefined} ref={element => { if (element !== null) element.inert = searchOpen }}>
        <div className={styles.header}>
          <button className={styles.searchEntry} type="button" ref={searchButton} onClick={() => { setSearchOpen(true) }}>{t('search.open')}</button>
          <span className={styles.count}>
            {scope === undefined ? null : scope.kind === 'workspace'
              ? t('scope.workspaceCount', { name: scope.label, count: graph.sessionCount })
              : t('scope.directoryCount', { count: graph.sessionCount })}
          </span>
          <span className={styles.legend} aria-hidden="true">
            <span className={styles.legendLineDerivation} />
            {t('legend.derivation')}
            <span className={styles.legendLineBranch} />
            {t('legend.branch')}
            <span className={styles.legendLineMerge} />
            {t('legend.merge')}
          </span>
          <span className={styles.buildInfo} title={SESSION_GRAPH_BUILD_TITLE}>
            {SESSION_GRAPH_BUILD_LABEL}
          </span>
        </div>
        {scope === undefined ? <div className={styles.empty}>{t('empty.outside')}</div>
          : graph.nodes.size === 0 ? <div className={styles.empty}>{t('empty.none')}</div> : <GraphCanvas
          laid={laid}
          clusters={graph.clusters}
          arrangement={scope.arrangement}
          now={now}
          t={t}
          onOpen={openSession}
          onBranch={branchSession}
          onGenerateDigest={generateSessionDigest}
          onReadHistory={readSessionHistory}
          onMerge={mergeSessions}
          onRetryMerge={retrySessionMerge}
        />}
      </div>
      {searchOpen ? <DiscussionSearch key={sessionId}
        initialScope={scope === undefined ? { kind: 'all' } : scope.kind === 'workspace' ? { kind: 'workspace', workspaceId: scope.workspaceId } : { kind: 'directory', cwd: scope.path }}
        workspaces={workspaces.items} search={searchDiscussion} read={readSessionHistory} open={openSession} t={t}
        onClose={() => { setSearchOpen(false); queueMicrotask(() => { searchButton.current?.focus() }) }} /> : null}
    </div>
  )
}
