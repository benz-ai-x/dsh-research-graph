import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic, ResearchTopicSnapshot } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphNode } from './graph-model.ts'
import type { KnowledgeCard } from '../knowledge.ts'
import type { LayoutState } from './layout-store.ts'
import type { SessionGraphKey } from './locales.ts'
import { deriveTopicGraph } from './graph-model.ts'
import { layoutResearchGraph } from './research-layout.ts'
import { GraphCanvas } from './GraphCanvas.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'
import { KnowledgeReader } from './KnowledgeReader.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { useResearchRelations } from './research-relations.ts'
import { withResearchRelations } from './research-graph.ts'
import { withKnowledgeCards } from './knowledge-graph.ts'
import { loadWorkingPosition, saveWorkingPosition, workingPositionKey } from './working-position.ts'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

export interface TopicGraphContext {
  readonly workingKey: string
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
  const knowledge = useKnowledge()!
  const workingKey = workingPositionKey(context.actions.hostId, context.workingKey, topic.topicId)
  const [cards, setCards] = useState<readonly KnowledgeCard[]>([])
  const [snapshot, setSnapshot] = useState<ResearchTopicSnapshot>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'canceled'>('loading')
  const [revision, setRevision] = useState(0)
  const active = useRef<AbortController>()
  const reuse = useResearchReuse()
  const relations = useResearchRelations(context.actions.reuse, { cardIds: cards.map(card => card.cardId), sessionIds: topic.references.map(item => item.sessionId) }, revision + (reuse?.refresh ?? 0))
  const membership = JSON.stringify(topic.references.map(reference => reference.sessionId))
  const read = context.actions.topics.read
  const searchCards = knowledge.api.search
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    setPhase('loading')
    setSnapshot(undefined)
    void Promise.all([read({ topicId: topic.topicId }, controller.signal),
      searchCards({ query: '', topicId: topic.topicId }, controller.signal)]).then(([value, found]) => {
      if (controller.signal.aborted) return
      setSnapshot(value)
      setCards(found)
      setPhase('ready')
    }, () => { if (!controller.signal.aborted) setPhase('error') })
    return () => { controller.abort() }
  }, [topic.topicId, membership, read, searchCards, revision, knowledge.refresh])
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
    return withResearchRelations(withKnowledgeCards(deriveTopicGraph({ sources, topic }, context.sessions, context.viewedId, context.pendingInteractions), cards, context.sessions, archived), relations.relations, context.sessions, context.workspaces)
  }, [snapshot, topic, context.sessions, context.workspaces, context.viewedId, context.pendingInteractions, cards, relations.relations])
  const laid = useMemo(() => graph === undefined ? undefined : layoutResearchGraph(graph), [graph])
  const open = (id: SessionId): void => {
    const node = graph?.nodes.get(id)
    const source = node?.kind === 'knowledge' ? undefined : node?.topicSource
    if (source?.status === 'listed' && !source.archived) context.actions.openSession(id)
  }
  return <div className={styles.topicGraph}>
    <div className={styles.topicControls}><button type="button" disabled={phase === 'loading'}
      onClick={() => { setRevision(value => value + 1) }}>{t('topic.refresh')}</button>
      <button type="button" disabled={phase !== 'ready' || cards.length === 0} onClick={() => {
        knowledge.exportCards(cards.map(card => ({ cardId: card.cardId, title: card.revisions.at(-1)!.content.title })))
      }}>{t('export.title')}</button>
      <span className={styles.researchLegend}><i className={styles.legendLineMerge} />{t('legend.merge')}<i className={styles.legendSource} />{t('knowledge.sourceRelation')}<i className={styles.legendReuse} />{t('workbench.reuseEdge')}</span></div>
    {relations.failed ? <p role="alert">{t('workbench.relationsError')} <button type="button" onClick={relations.retry}>{t('topic.retry')}</button></p> : null}
    {phase === 'ready' && relations.loading ? <p role="status">{t('workbench.relationsLoading')}</p> : null}
    {phase === 'loading' ? <div className={styles.topicControls} role="status">{t('topic.loading')} <button type="button" onClick={() => {
      active.current?.abort()
      setPhase('canceled')
    }}>{t('topic.cancel')}</button></div> : null}
    {phase === 'error' || phase === 'canceled' ? <div className={styles.topicControls} role={phase === 'error' ? 'alert' : 'status'}>
      {t(phase === 'error' ? 'topic.readError' : 'topic.canceled')}
      <button type="button" onClick={() => { setRevision(value => value + 1) }}>{t('topic.retry')}</button>
    </div> : null}
    {phase !== 'ready' || relations.loading || relations.failed || graph === undefined || laid === undefined ? null : <>
      {graph.nodes.size === 0 ? <p>{t('topic.noReferences')}</p> : null}
      <GraphCanvas key={`${workingKey}:${membership}`} workingKey={workingKey} laid={laid} clusters={graph.clusters}
        arrangement={{ key: `topic:${topic.topicId}`, legacyKey: undefined }} now={Date.now()} t={t}
        onOpen={open} onBranch={context.actions.branchSession} onGenerateDigest={context.actions.generateSessionDigest}
        onReadHistory={context.actions.readSessionHistory} onMerge={context.actions.mergeSessions} onRetryMerge={context.actions.retrySessionMerge}
        topic={{ arrangement, onArrange, openCard: knowledge.open, renderInspector: (node, onClose, onUnavailable) => node === undefined ? null
          : node.kind === 'knowledge' ? <aside className={`${styles.panel} ${styles.topicSourcePanel}`} data-working-scroll="" data-canvas-overlay="" aria-label={t('knowledge.title')}>
            <div className={styles.panelHeader}><strong>{t('knowledge.title')}</strong>
              <button type="button" onClick={onClose} aria-label={t('panel.close')}>×</button></div>
            <KnowledgeReader key={node.card.cardId} workingKey={workingKey} card={node.card} relations={relations.relations} read={context.actions.readSessionHistory} t={t} />
          </aside> : <TopicSourcePanel key={node.id} workingKey={workingKey} node={node} read={context.actions.readSessionHistory} open={open}
            remove={topic.references.some(reference => reference.sessionId === node.id) ? () => { remove(node.id) } : undefined}
            sessions={context.sessions} workspaces={context.workspaces} busy={busy} onClose={onClose} onUnavailable={onUnavailable} t={t} /> }} /></>}
  </div>
}

function TopicSourcePanel({ node, read, open, remove, busy, onClose, onUnavailable, workingKey, sessions, workspaces, t }: {
  readonly onUnavailable: () => void
  readonly workingKey: string
  readonly sessions: SessionListState
  readonly workspaces: WorkspaceSnapshot
  readonly node: SessionGraphNode
  readonly read: GraphViewInjected['readSessionHistory']
  readonly open: GraphViewInjected['openSession']
  readonly remove: (() => void) | undefined
  readonly busy: boolean
  readonly onClose: () => void
  readonly t: Translate
}): ReactElement {
  const reuse = useResearchReuse()
  const [mergeSource, setMergeSource] = useState<string>()
  const [reading, setReading] = useState(() => loadWorkingPosition(workingKey).selected === node.id && loadWorkingPosition(workingKey).tab === 'history')
  useEffect(() => { saveWorkingPosition(workingKey, { tab: reading ? 'history' : 'digest' }) }, [workingKey, reading])
  const source = node.topicSource
  return <aside className={`${styles.panel} ${styles.topicSourcePanel}`} data-working-scroll="" data-canvas-overlay="" data-testid="topic-source-panel" aria-label={t('topic.source')}>
    <div className={styles.panelHeader}><span className={styles.panelHeading}>{t('topic.source')}</span>
      <button type="button" className={styles.panelClose} aria-label={t('panel.close')} onClick={onClose}>×</button></div>
    <h3 className={styles.panelTitle}>{node.title}</h3>
    <div className={styles.panelMeta}><span>{source?.workspace?.title || source?.cwd || t('topic.noWorkspace')}</span>
      {source?.archived ? <span>{t('search.archived')}</span> : null}</div>

    {source?.status === 'unavailable' ? <div role="status">{t('topic.unavailable')}</div> : null}
    {source?.archived ? <div role="status">{t('topic.archivedReading')}</div> : null}
    <div className={styles.panelActions}>
      <button type="button" className={styles.panelPrimaryAction} onClick={() => { open(node.id) }} disabled={source?.status !== 'listed' || source.archived}>{t('panel.open')}</button>
      <button type="button" className={styles.panelSecondaryAction} onClick={() => { setReading(value => !value) }}>{t(reading ? 'topic.closeOriginal' : 'topic.readOriginal')}</button>
      {remove === undefined ? null : <button type="button" className={styles.panelSecondaryAction} disabled={busy} onClick={remove}>{t('topic.remove')}</button>}
    </div>
    {node.mergeSources.length ? <section className={styles.readingSources}><h3>{t('workbench.mergeFrom')}</h3><p>{t('workbench.mergeCaptured')}</p>{node.mergeSources.map(item => {
      const session = sessions.byId[item.sessionId as SessionId]
      const workspace = workspaces.items.find(workspace => workspace.sessionIds.includes(item.sessionId as SessionId))
        ?? workspaces.items.find(workspace => workspace.path === session?.cwd)
      const title = session?.displayTitle || t('history.title')
      return <section key={item.sessionId}>
        <button type="button" className={styles.readingSourceLink} aria-expanded={mergeSource === item.sessionId}
          onClick={() => { setMergeSource(value => value === item.sessionId ? undefined : item.sessionId) }}>
          <strong>{title}</strong><small>{workspace?.title || session?.cwd || t('topic.noWorkspace')} · {t('topic.readOriginal')}</small>
        </button>
        {mergeSource === item.sessionId ? <SessionHistory sourceTitle={title} sessionId={item.sessionId} read={read} t={t} /> : null}
      </section>
    })}</section> : null}
    {node.reuseRelations?.map(item => <button className={styles.readingSourceLink} type="button" key={item.operationId} onClick={() => { reuse?.inspect(item.operationId) }}><strong>{t('workbench.frozen')}</strong><small>{item.question}</small></button>)}
    {reading ? <SessionHistory workingKey={workingKey} onUnavailable={onUnavailable} sourceTitle={node.title} sessionId={node.id} {...(node.retainedSource === undefined ? {} : { retainedSource: node.retainedSource })} read={read} t={t} /> : null}
  </aside>
}
