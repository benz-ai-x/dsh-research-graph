/**
 * The Session Graph tab body: a scope-bound lineage forest of Canvas Sessions
 * (Branch edges within clusters, Merge provenance across clusters, and
 * Subagent Derivations folded into Subagent Summary badges). Derives from the sessions/workspaces
 * standard feeds; selection stays in the graph while double-click and the
 * details panel navigate through the sessions verbs.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
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
import { KnowledgeLibrary } from './KnowledgeLibrary.tsx'
import { ResearchMerge } from './ResearchMerge.tsx'
import { ResearchTopics } from './ResearchTopics.tsx'
import { KnowledgeProvider, KnowledgeSavedNotice, useKnowledge } from './Knowledge.tsx'
import type { KnowledgeApi } from './knowledge-remote.ts'
import { ResearchMaterialPicker } from './ResearchMaterialPicker.tsx'
import { ResearchReuseEntry, ResearchReuseProvider } from './ResearchReuse.tsx'
import type { ResearchReuseApi } from './research-reuse-remote.ts'
import { deriveSessionGraph, resolveGraphScope } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'
import { loadWorkingPosition, saveWorkingPosition, workingPositionKey } from './working-position.ts'

/** Business face the browser entry injects into the view (navigation verbs). */
export interface GraphViewInjected {
  readonly mergeResearchSessions?: (request: {
    readonly sourceIds: readonly SessionId[]
    readonly instruction: string
    readonly workspaceId: string
    readonly targetSessionId?: SessionId
  }, signal: AbortSignal) => Promise<SessionId>
  readonly hostId: string
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
  return <div className={styles.knowledgeBoundary}><ResearchReuseProvider key={props.hostId} stayInResearch api={props.reuse}
    picker={<ResearchMaterialPicker api={props.knowledge} useSessions={props.useSessions} read={props.readSessionHistory} t={props.t} />}
    workspaces={workspaces.items} viewedId={props.sessionId} openSession={props.openSession} t={props.t}>
    <KnowledgeProvider api={props.knowledge}
    topics={props.topics} read={props.readSessionHistory} t={props.t}>
    <GraphViewBody {...props} />
  </KnowledgeProvider></ResearchReuseProvider></div>
}

function GraphViewBody(props: GraphViewProps): ReactElement {
  const {
    sessionId, useSessions, useSessionPendingInteraction, useWorkspaces,
    hostId, openSession, branchSession, generateSessionDigest, readSessionHistory, searchDiscussion, mergeSessions, retrySessionMerge, topics, knowledge, reuse, t,
  } = props
  const knowledgeContext = useKnowledge()
  const sessions = useSessions(state => state)
  const pendingInteractions = useSessionPendingInteraction(state => state)
  const workspaces = useWorkspaces(state => state)
  const [searchOpen, setSearchOpen] = useState(false)
  const [knowledgeEntryKey, setKnowledgeEntryKey] = useState<string>()
  const workbenchKey = workingPositionKey(hostId, 'workbench')
  const [topicMode, setTopicMode] = useState(false)
  const [view, setView] = useState<'graph' | 'reading'>(() => loadWorkingPosition(workbenchKey).workbenchView ?? 'graph')
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergedTarget, setMergedTarget] = useState<SessionId>()
  const mergeTrigger = useRef<HTMLButtonElement>()
  useEffect(() => { saveWorkingPosition(workbenchKey, { workbenchView: view }) }, [workbenchKey, view])
  const closeMerge = (): void => { setMergeOpen(false); queueMicrotask(() => { mergeTrigger.current?.focus() }) }
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
  const searchTrigger = useRef<HTMLButtonElement>()

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
  const workingKey = workingPositionKey(hostId, scope?.arrangement.key ?? `viewed:${sessionId}`)
  const searchKey = topicMode ? workingPositionKey(hostId, workingKey, knowledgeContext?.topicId ?? 'topic-list') : workingKey
  // The library entry applies only to its opening scope. Clear it before a keyed
  // remount so returning to that scope also restores the user's saved choice.
  if (knowledgeEntryKey !== undefined && knowledgeEntryKey !== searchKey) {
    setKnowledgeEntryKey(undefined)
  }

  return (
    // The free canvas owns its viewport. Extend the view behind the floating
    // composer so GraphCanvas's live clearance reserves the seat exactly once.
    <div className={styles.root} data-conversation-composer-overlay="">
      <div className={styles.graphBody} aria-hidden={searchOpen || mergeOpen || adding !== undefined || undefined}
        ref={element => { if (element !== null) element.inert = searchOpen || mergeOpen || adding !== undefined }}>
        <header className={styles.workbenchHeader}>
          <div className={styles.workbenchBrand}><span aria-hidden="true">◈</span><strong>{t('workbench.title')}</strong></div>
          <nav className={styles.workbenchViews} aria-label={t('workbench.views')}>
            <button type="button" aria-pressed={view === 'graph'} onClick={() => { setView('graph') }}>{t('workbench.graph')}</button>
            <button type="button" aria-pressed={view === 'reading'} onClick={() => { setView('reading') }}>{t('reading.library')}</button>
          </nav>
          <div className={styles.workbenchActions}>
            <button className={styles.searchEntry} type="button" ref={searchButton} aria-label={t('search.open')} onClick={event => { searchTrigger.current = event.currentTarget; setKnowledgeEntryKey(undefined); setSearchOpen(true) }}>
              <span className={styles.wideSearchLabel}>{t('search.open')}</span><span className={styles.compactSearchLabel}>{t('reading.search')}</span>
            </button>
            {props.mergeResearchSessions ? <button className={`${styles.searchEntry} ${styles.workbenchDesktopAction}`} type="button" onClick={event => { mergeTrigger.current = event.currentTarget; setMergeOpen(true) }}>{t('workbench.merge')}</button> : null}
            <button className={`${styles.primaryButton} ${styles.workbenchDesktopAction}`} type="button" onClick={() => { knowledgeContext?.create() }}><span aria-hidden="true">+ </span>{t('knowledge.new')}</button>
            <details className={styles.workbenchMore}><summary>{t('workbench.more')}</summary><div>
              <div className={styles.workbenchCompactActions}>
                {props.mergeResearchSessions ? <button className={styles.searchEntry} type="button" onClick={event => { mergeTrigger.current = event.currentTarget; setMergeOpen(true) }}>{t('workbench.merge')}</button> : null}
                <button className={styles.searchEntry} type="button" onClick={() => { knowledgeContext?.create() }}>{t('knowledge.new')}</button>
              </div>
              <button className={styles.searchEntry} type="button" onClick={event => { searchTrigger.current = event.currentTarget; setKnowledgeEntryKey(searchKey); setSearchOpen(true) }}>{t('knowledge.title')}</button>
              <ResearchReuseEntry t={t} />
              <div className={styles.legend} aria-label={t('reading.legend')}>
                <span><i className={styles.legendLineDerivation} />{t('legend.derivation')}</span>
                <span><i className={styles.legendLineBranch} />{t('legend.branch')}</span>
                <span><i className={styles.legendLineMerge} />{t('legend.merge')}</span>
              </div>
              <span className={styles.buildInfo} title={SESSION_GRAPH_BUILD_TITLE}>{SESSION_GRAPH_BUILD_LABEL}</span>
              <p>{t('knowledge.localLayout')}</p>
            </div></details>
          </div>
        </header>
        <div className={styles.workbenchIntro}>
          <div className={styles.scopeIdentity}><span>{t('workbench.scope')}</span><h1>{topicMode ? t('workbench.topics') : view === 'reading' ? t('knowledge.all') : scope?.label || t('reading.directory')}</h1></div>
          <div className={styles.workbenchScope}><label><select aria-label={t('workbench.scope')} value={topicMode ? 'topics' : 'workspace'} onChange={event => { setTopicMode(event.target.value === 'topics') }}>
            <option value="workspace">{view === 'reading' ? t('knowledge.all') : t(scope?.kind === 'directory' ? 'reading.directory' : 'workbench.workspace')}</option>
            <option value="topics">{t('workbench.topics')}</option>
          </select></label>
          {topicMode ? null : <span className={styles.count}>{view === 'reading' ? t('knowledge.title') : scope === undefined ? '' : t('reading.discussionCount', { count: graph.sessionCount })}</span>}
          </div>
        </div>
        <KnowledgeSavedNotice t={t} />
        {mergedTarget ? <div className={styles.workbenchNotice} role="status">{t('workbench.mergeSaved')} <button type="button" onClick={() => { openSession(mergedTarget) }}>{t('panel.open')}</button><button type="button" onClick={() => { setMergedTarget(undefined) }} aria-label={t('panel.close')}>×</button></div> : null}
        {topicMode ? <ResearchTopics key={workingKey} api={topics} refresh={topicRevision} view={view} context={{ sessions, workspaces, pendingInteractions, viewedId: sessionId,
          workingKey, actions: { ...props, hostId, topics, knowledge, reuse, openSession, branchSession, generateSessionDigest, readSessionHistory, searchDiscussion, mergeSessions, retrySessionMerge },
        }} t={t} /> : view === 'reading' ? <KnowledgeLibrary key={workingKey} workingKey={workingKey} actions={props} t={t} /> : scope === undefined ? <div className={styles.empty}>{t('empty.outside')}</div>
          : graph.nodes.size === 0 ? <div className={styles.empty}>{t('empty.none')}</div> : <GraphCanvas
          key={workingKey} workingKey={workingKey} laid={laid}
          clusters={graph.clusters}
          arrangement={{ key: workingKey, legacyKey: undefined }}
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
        <p className={styles.workbenchComposerHint} title={t('reading.chatHint')}>
          <span aria-hidden="true">↳</span> {t('reading.chatTarget', { title: sessions.byId[sessionId]?.displayTitle || t('node.newSession') })}
        </p>
      </div>
      <ResearchMerge props={props} visible={mergeOpen} close={closeMerge} completed={(target, topicId) => {
        setMergedTarget(target)
        setTopicRevision(value => value + 1)
        if (topicId) {
          saveWorkingPosition(workingKey, { topicId })
          saveWorkingPosition(workingPositionKey(hostId, workingKey, topicId), { selected: target })
          setTopicMode(true)
          setView('graph')
        }
      }} />
      {searchOpen ? <div className={styles.searchLayer} aria-hidden={adding !== undefined || undefined}
        ref={element => { if (element !== null) element.inert = adding !== undefined }}><DiscussionSearch key={searchKey}
        workingKey={searchKey} initialType={knowledgeEntryKey === searchKey ? 'knowledge' : undefined} initialScope={scope === undefined ? { kind: 'all' } : scope.kind === 'workspace' ? { kind: 'workspace', workspaceId: scope.workspaceId } : { kind: 'directory', cwd: scope.path }}
        workspaces={workspaces.items} search={searchDiscussion} read={readSessionHistory} open={openSession} t={t}
        onAddToTopic={addToTopic}
        onClose={() => { setSearchOpen(false); queueMicrotask(() => { (searchTrigger.current ?? searchButton.current)?.focus() }) }} /></div> : null}
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
