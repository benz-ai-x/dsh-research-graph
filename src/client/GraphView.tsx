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
import type { ResearchTopic, ResearchTopicSnapshot, ResearchTopicWrite } from '../research-topic.ts'
import { SESSION_GRAPH_BUILD_LABEL, SESSION_GRAPH_BUILD_TITLE } from './build-info.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { DiscussionSearch } from './DiscussionSearch.tsx'
import { ResearchTopics } from './ResearchTopics.tsx'
import { KnowledgeProvider } from './Knowledge.tsx'
import type { KnowledgeApi } from './knowledge-remote.ts'
import { ResearchReuseEntry, ResearchReuseProvider } from './ResearchReuse.tsx'
import type { ResearchReuseApi } from './research-reuse-remote.ts'
import { deriveSessionGraph, resolveGraphScope } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'

/** Business face the browser entry injects into the view (navigation verbs). */
export interface GraphViewInjected {
  readonly reuse: ResearchReuseApi
  readonly knowledge: KnowledgeApi
  topics: {
    readonly list: (signal: AbortSignal) => Promise<readonly ResearchTopic[]>
    readonly read: (request: { readonly topicId: string }, signal: AbortSignal) => Promise<ResearchTopicSnapshot>
    readonly write: (request: ResearchTopicWrite, signal: AbortSignal) => Promise<ResearchTopic>
  }
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
export function GraphView(props: GraphViewProps): ReactElement {
  const workspaces = props.useWorkspaces(state => state)
  return <div className={styles.knowledgeBoundary}><ResearchReuseProvider key={props.sessionId} api={props.reuse}
    workspaces={workspaces.items} viewedId={props.sessionId} openSession={props.openSession} t={props.t}>
    <KnowledgeProvider api={props.knowledge}
    topics={props.topics} read={props.readSessionHistory} t={props.t}>
    <GraphViewBody {...props} />
  </KnowledgeProvider></ResearchReuseProvider></div>
}

function GraphViewBody({
  sessionId, useSessions, useSessionPendingInteraction, useWorkspaces,
  openSession, branchSession, generateSessionDigest, readSessionHistory, searchDiscussion, mergeSessions, retrySessionMerge, topics, knowledge, reuse, t,
}: GraphViewProps): ReactElement {
  const sessions = useSessions(state => state)
  const pendingInteractions = useSessionPendingInteraction(state => state)
  const workspaces = useWorkspaces(state => state)
  const [searchOpen, setSearchOpen] = useState(false)
  const [topicMode, setTopicMode] = useState(false)
  const [adding, setAdding] = useState<SessionId>()
  const [topicRevision, setTopicRevision] = useState(0)
  const addTrigger = useRef<HTMLElement>()
  const addToTopic = (id: SessionId): void => {
    if (document.activeElement instanceof HTMLElement) addTrigger.current = document.activeElement
    setAdding(id)
  }
  const closePicker = (): void => {
    setAdding(undefined)
    queueMicrotask(() => { addTrigger.current?.focus() })
  }
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
      <div className={styles.graphBody} aria-hidden={searchOpen || adding !== undefined || undefined}
        ref={element => { if (element !== null) element.inert = searchOpen || adding !== undefined }}>
        <div className={styles.header}>
          <button className={styles.searchEntry} type="button" ref={searchButton} onClick={() => { setSearchOpen(true) }}>{t('search.open')}</button>
          <ResearchReuseEntry t={t} />
          <button className={styles.searchEntry} type="button" aria-pressed={topicMode}
            onClick={() => { setTopicMode(value => !value) }}>{t(topicMode ? 'topic.back' : 'topic.title')}</button>
          <span className={styles.count}>
            {topicMode ? t('topic.title') : scope === undefined ? null : scope.kind === 'workspace'
              ? t('scope.workspaceCount', { name: scope.label, count: graph.sessionCount })
              : t('scope.directoryCount', { count: graph.sessionCount })}
          </span>
          <span className={styles.legend} aria-hidden="true">
            {topicMode ? null : <><span className={styles.legendLineDerivation} />{t('legend.derivation')}</>}
            <span className={styles.legendLineBranch} />
            {t('legend.branch')}
            <span className={styles.legendLineMerge} />
            {t('legend.merge')}
          </span>
          <span className={styles.buildInfo} title={SESSION_GRAPH_BUILD_TITLE}>
            {SESSION_GRAPH_BUILD_LABEL}
          </span>
        </div>
        {topicMode ? <ResearchTopics api={topics} refresh={topicRevision} context={{ sessions, workspaces, pendingInteractions, viewedId: sessionId,
          actions: { topics, knowledge, reuse, openSession, branchSession, generateSessionDigest, readSessionHistory, searchDiscussion, mergeSessions, retrySessionMerge },
        }} t={t} /> : scope === undefined ? <div className={styles.empty}>{t('empty.outside')}</div>
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
          onAddToTopic={addToTopic}
        />}
      </div>
      {searchOpen ? <div className={styles.searchLayer} aria-hidden={adding !== undefined || undefined}
        ref={element => { if (element !== null) element.inert = adding !== undefined }}><DiscussionSearch key={sessionId}
        initialScope={scope === undefined ? { kind: 'all' } : scope.kind === 'workspace' ? { kind: 'workspace', workspaceId: scope.workspaceId } : { kind: 'directory', cwd: scope.path }}
        workspaces={workspaces.items} search={searchDiscussion} read={readSessionHistory} open={openSession} t={t}
        onAddToTopic={addToTopic}
        onClose={() => { setSearchOpen(false); queueMicrotask(() => { searchButton.current?.focus() }) }} /></div> : null}
      {adding === undefined ? null : <section className={styles.searchOverlay} role="dialog" aria-modal="true" aria-label={t('topic.add')}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); closePicker() }
          retainDialogFocus(event)
        }}>
        <div className={styles.searchHeader}><div><h2>{t('topic.add')}</h2><p className={styles.topicSourceId}>{adding}</p></div>
          <button type="button" autoFocus onClick={closePicker}>{t('topic.close')}</button></div>
        <ResearchTopics api={topics} add={{ sessionId: adding, done: () => { setTopicRevision(value => value + 1); closePicker() } }} t={t} />
      </section>}
    </div>
  )
}
