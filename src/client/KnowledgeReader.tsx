import { useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import type { KnowledgeCard, KnowledgeRevision } from '../knowledge.ts'
import { useResearchRelations, type ResearchRelationsState } from './research-relations.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import { InspectorFrame } from './InspectorFrame.tsx'
import { ResearchMarkdown } from './ResearchMarkdown.tsx'
import styles from './GraphView.module.css'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

/** One reader for graph inspection and the knowledge desk, including saved editor results, with revision-specific actions. */
export function KnowledgeReader({ card, relations, read, workingKey, inspector, initialRevisionId, onEdit, onRetry, t }: {
  readonly workingKey?: string | undefined
  readonly inspector?: { readonly onClose: () => void }
  readonly card: KnowledgeCard
  readonly relations?: ResearchRelationsState
  readonly initialRevisionId?: string
  readonly onEdit?: (revision: KnowledgeRevision) => void
  readonly onRetry?: () => void
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: Translate
}): ReactElement {
  const knowledge = useKnowledge()
  const reuse = useResearchReuse()
  const [restored] = useState(() => {
    if (initialRevisionId !== undefined) return undefined
    const saved = loadWorkingPosition(workingKey).knowledgeReading
    return saved?.cardId === card.cardId && (!saved.revisionId || card.revisions.some(item => item.revisionId === saved.revisionId)) ? saved : undefined
  })
  const [version, setVersion] = useState(initialRevisionId ?? restored?.revisionId ?? '')
  const [source, setSource] = useState<number | undefined>(restored?.sourceIndex)
  const fetched = useResearchRelations(relations === undefined ? reuse?.relationApi : undefined,
    { cardIds: [card.cardId], sessionIds: [] }, (knowledge?.refresh ?? 0) + (reuse?.refresh ?? 0))
  const related = relations ?? fetched
  const element = useRef<HTMLDivElement>(null)
  const initialScroll = useRef<number | undefined>(restored?.scrollTop ?? 0)
  useLayoutEffect(() => {
    const panel = element.current?.closest<HTMLElement>('[data-working-scroll]')
    if (initialScroll.current !== undefined && panel) { panel.scrollTop = initialScroll.current; initialScroll.current = undefined }
    const remember = (): void => { saveWorkingPosition(workingKey, { knowledgeReading: {
      cardId: card.cardId, revisionId: version, sourceIndex: source, scrollTop: panel?.scrollTop ?? 0,
    } }) }
    remember()
    panel?.addEventListener('scroll', remember, { passive: true })
    return () => { panel?.removeEventListener('scroll', remember) }
  }, [workingKey, card.cardId, version, source])
  const latest = card.revisions.at(-1)!
  const revision = version === '' ? latest : card.revisions.find(item => item.revisionId === version)
  if (revision === undefined) return <div role="alert">{t('knowledge.error')}
    {onRetry ? <button type="button" onClick={onRetry}>{t('topic.retry')}</button> : null}</div>
  const next = related.relations.filter(item => item.materials.some(material => material.kind === 'card' && material.cardId === card.cardId))
  const meta = <div className={styles.readingMeta}><span>{t('workbench.saved')}</span><span>{t(revision.content.status === 'confirmed' ? 'workbench.confirmed' : 'workbench.verify')}</span>
      <span>{t(`knowledge.kind.${revision.content.kind}`)}</span>
      <label>{t('knowledge.version')}<select value={revision.revisionId === latest.revisionId ? '' : version} onChange={event => { setVersion(event.target.value); setSource(undefined) }}>
        <option value="">{t('knowledge.versionNumber', { number: card.revisions.at(-1)!.number })}</option>
        {card.revisions.slice(0, -1).map(item => <option key={item.revisionId} value={item.revisionId}>{t('knowledge.versionNumber', { number: item.number })}</option>)}
      </select></label><span>{t('knowledge.savedAt', { time: new Date(revision.savedAt).toLocaleString() })}</span></div>
  const actions = <div className={styles.readingActions}>
      {reuse ? <button className={styles.primaryButton} type="button" onClick={() => {
        reuse.continueWith({ kind: 'card', cardId: card.cardId, revisionId: revision.revisionId },
          `${revision.content.title} · ${t('knowledge.versionNumber', { number: revision.number })}`)
      }}>{t('workbench.continue')}</button> : null}
      <button type="button" onClick={() => { if (onEdit) onEdit(revision); else knowledge?.edit(card.cardId, revision.revisionId) }}>{t('knowledge.edit')}</button>
      <button type="button" onClick={() => { knowledge?.exportCards([{ cardId: card.cardId, title: card.revisions.at(-1)!.content.title }]) }}>{t(revision.revisionId !== latest.revisionId ? 'workbench.exportLatest' : 'export.title')}</button>
    </div>
  const content = <div ref={element} className={styles.knowledgeReading}>
    {inspector === undefined ? <><span className={styles.workbenchEyebrow}>{t('knowledge.title')}</span>
    <h2>{revision.content.title}</h2></> : null}
    {inspector === undefined ? meta : null}
    {(['question', 'conclusion', 'rationale', 'openQuestions'] as const).map(field => revision.content[field] ? <section key={field}>
      {field === 'conclusion' ? null : <h3>{t(`knowledge.field.${field}`)}</h3>}<ResearchMarkdown text={revision.content[field]} t={t} /></section> : null)}
    {inspector === undefined ? actions : null}
    <section className={styles.readingSources}><h3>{t('workbench.original')}</h3>
      {revision.sources.length ? revision.sources.map((item, index) => <section key={index}>
        <button className={styles.readingSourceLink} type="button" aria-expanded={source === index} onClick={() => { setSource(source === index ? undefined : index) }}>
          <strong>{item.title}</strong><small>{t('workbench.sourceTurns', { first: item.source.turns[0]?.turn, last: item.source.turns.at(-1)?.turn })} · {t('knowledge.readSource')}</small>
        </button>
        <details><summary>{t('knowledge.sourceDetails')}</summary>
          <div className={styles.historyIdentity}>{item.sessionId} · {item.cwd}</div>
          <p>{t('knowledge.sourceRange', { start: item.source.startSeq, end: item.source.endSeq })}</p>
        </details>
        {source === index ? <SessionHistory key={`${revision.revisionId}:${index}`} sourceTitle={item.title} sessionId={item.sessionId} source={item.source} read={read} t={t} /> : null}
      </section>) : <p className={styles.searchMeta}>{t('knowledge.noSources')}</p>}
    </section>
    <section className={styles.readingSources}><h3>{t('workbench.next')}</h3>
      {related.loading ? <p role="status">{t('topic.loading')}</p> : related.failed
        ? <p role="alert">{t('workbench.relationsError')} <button type="button" onClick={related.retry}>{t('topic.retry')}</button></p>
        : next.length ? next.map(item => {
        const versions = item.materials.flatMap(material => material.kind === 'card' && material.cardId === card.cardId
          ? [t('knowledge.versionNumber', { number: material.revisionNumber })] : [])
        return <button className={styles.readingSourceLink} type="button" key={item.operationId} onClick={() => { reuse?.inspect(item.operationId) }}>
          <strong>{item.question}</strong><small>{item.workspace.title} · {versions.join(' / ')}</small>
          <small>{t('workbench.frozen')}</small></button>
      }) : <p className={styles.searchMeta}>{t('workbench.nextEmpty')}</p>}
    </section>
  </div>
  return inspector === undefined ? content : <InspectorFrame label={t('knowledge.title')} title={revision.content.title}
    meta={meta} actions={actions} workingKey={workingKey} onClose={inspector.onClose} closeLabel={t('reading.close')} t={t}>{content}</InspectorFrame>
}
