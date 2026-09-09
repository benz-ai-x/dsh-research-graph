import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic, ResearchTopicSnapshot } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { GraphNode } from './graph-model.ts'
import type { LayoutState } from './layout-store.ts'
import type { SessionGraphKey } from './locales.ts'
import { deriveTopicGraph } from './graph-model.ts'
import { layoutSessionGraph } from './layout.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

export interface TopicGraphContext {
  readonly sessions: SessionListState
  readonly workspaces: WorkspaceSnapshot
  readonly pendingInteractions: ReadonlyMap<SessionId, unknown>
  readonly viewedId: SessionId
  readonly actions: GraphViewInjected
}

/** Each mounted topic owns its cancellable metadata read and source inspector. */
export function TopicGraph({ topic, context, arrangement, onArrange, remove, busy, t }: {
  readonly topic: ResearchTopic
  readonly context: TopicGraphContext
  readonly arrangement: LayoutState
  readonly onArrange: (state: LayoutState) => void
  readonly remove: (sessionId: string) => void
  readonly busy: boolean
  readonly t: Translate
}): ReactElement {
  const [snapshot, setSnapshot] = useState<ResearchTopicSnapshot>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'canceled'>('loading')
  const [revision, setRevision] = useState(0)
  const active = useRef<AbortController>()
  const membership = JSON.stringify(topic.references.map(reference => reference.sessionId))
  const read = context.actions.topics.read
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    setPhase('loading')
    setSnapshot(undefined)
    void read({ topicId: topic.topicId }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      setSnapshot(value)
      setPhase('ready')
    }, () => { if (!controller.signal.aborted) setPhase('error') })
    return () => { controller.abort() }
  }, [topic.topicId, membership, read, revision])
  const graph = useMemo(() => {
    if (snapshot === undefined) return undefined
    const archived = new Set<string>(context.workspaces.archivedSessionIds)
    const workspaceTitles = new Map(context.workspaces.items.map(workspace => [String(workspace.workspaceId), workspace.title]))
    const sources = snapshot.sources.map(source => ({
      ...source,
      archived: context.workspaces.phase === 'ready' ? archived.has(source.sessionId) : source.archived,
      ...(source.workspace === undefined ? {} : { workspace: {
        ...source.workspace, title: workspaceTitles.get(source.workspace.id) || source.workspace.title,
      } }),
    }))
    return deriveTopicGraph({ sources, topic }, context.sessions, context.viewedId, context.pendingInteractions)
  }, [snapshot, topic, context.sessions, context.workspaces, context.viewedId, context.pendingInteractions])
  const laid = useMemo(() => graph === undefined ? undefined : layoutSessionGraph(graph), [graph])
  const open = (id: SessionId): void => {
    if (graph?.nodes.get(id)?.topicSource?.status === 'listed') context.actions.openSession(id)
  }
  return <div className={styles.topicGraph}>
    <div className={styles.topicControls}><button type="button" disabled={phase === 'loading'}
      onClick={() => { setRevision(value => value + 1) }}>{t('topic.refresh')}</button></div>
    {phase === 'loading' ? <div className={styles.topicControls} role="status">{t('topic.loading')} <button type="button" onClick={() => {
      active.current?.abort()
      setPhase('canceled')
    }}>{t('search.cancel')}</button></div> : null}
    {phase === 'error' || phase === 'canceled' ? <div className={styles.topicControls} role={phase === 'error' ? 'alert' : 'status'}>
      {t(phase === 'error' ? 'topic.readError' : 'search.canceled')}
      <button type="button" onClick={() => { setRevision(value => value + 1) }}>{t('topic.retry')}</button>
    </div> : null}
    {phase !== 'ready' || graph === undefined || laid === undefined ? null : graph.nodes.size === 0
      ? <p>{t('topic.noReferences')}</p>
      : <GraphCanvas key={`${topic.topicId}:${membership}`} laid={laid} clusters={graph.clusters}
        arrangement={{ key: `topic:${topic.topicId}`, legacyKey: undefined }} now={Date.now()} t={t}
        onOpen={open} onBranch={context.actions.branchSession} onGenerateDigest={context.actions.generateSessionDigest}
        onReadHistory={context.actions.readSessionHistory} onMerge={context.actions.mergeSessions} onRetryMerge={context.actions.retrySessionMerge}
        topic={{ arrangement, onArrange, renderInspector: (node, onClose) => node === undefined ? null
          : <TopicSourcePanel key={node.id} node={node} read={context.actions.readSessionHistory} open={open}
            remove={() => { remove(node.id) }} busy={busy} onClose={onClose} t={t} /> }} />}
  </div>
}

function TopicSourcePanel({ node, read, open, remove, busy, onClose, t }: {
  readonly node: GraphNode
  readonly read: GraphViewInjected['readSessionHistory']
  readonly open: GraphViewInjected['openSession']
  readonly remove: () => void
  readonly busy: boolean
  readonly onClose: () => void
  readonly t: Translate
}): ReactElement {
  const [reading, setReading] = useState(false)
  const source = node.topicSource
  return <aside className={`${styles.panel} ${styles.topicSourcePanel}`} data-canvas-overlay="" data-testid="topic-source-panel" aria-label={t('topic.source')}>
    <div className={styles.panelHeader}><span className={styles.panelHeading}>{t('topic.source')}</span>
      <button type="button" className={styles.panelClose} aria-label={t('panel.close')} onClick={onClose}>×</button></div>
    <h3 className={styles.panelTitle}>{node.title}</h3>
    <div className={styles.panelMeta}><span>{source?.workspace?.title || source?.cwd || t('topic.noWorkspace')}</span>
      {source?.archived ? <span>{t('search.archived')}</span> : null}</div>
    <div className={styles.topicSourceId}>{node.id}</div>
    {source?.status === 'unavailable' ? <div role="status">{t('topic.unavailable')}</div> : null}
    <div className={styles.panelActions}>
      <button type="button" className={styles.panelPrimaryAction} onClick={() => { open(node.id) }} disabled={source?.status !== 'listed'}>{t('panel.open')}</button>
      <button type="button" className={styles.panelSecondaryAction} onClick={() => { setReading(value => !value) }}>{t(reading ? 'topic.closeOriginal' : 'topic.readOriginal')}</button>
      <button type="button" className={styles.panelSecondaryAction} disabled={busy} onClick={remove}>{t('topic.remove')}</button>
    </div>
    {reading ? <SessionHistory sessionId={node.id} read={read} t={t} /> : null}
  </aside>
}
