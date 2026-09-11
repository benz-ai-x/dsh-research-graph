import { useEffect, useState, type ReactElement } from 'react'
import type { KnowledgeCard } from '../knowledge.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { KnowledgeReader } from './KnowledgeReader.tsx'
import { useResearchRelations } from './research-relations.ts'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'
import styles from './GraphView.module.css'

/** Topic-independent reading space, sharing selection identities with the graph. */
export function KnowledgeLibrary({ workingKey, actions, t }: {
  readonly workingKey: string
  readonly actions: GraphViewInjected
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()!
  const reuse = useResearchReuse()
  const [query, setQuery] = useState(() => loadWorkingPosition(workingKey).knowledge?.query ?? '')
  const [selected, setSelected] = useState(() => loadWorkingPosition(workingKey).selected ?? '')
  const [cards, setCards] = useState<readonly KnowledgeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const relations = useResearchRelations(actions.reuse, { cardIds: cards.map(card => card.cardId), sessionIds: [] }, knowledge.refresh + (reuse?.refresh ?? 0))
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    const timer = window.setTimeout(() => {
      void knowledge.api.search({ query, ...(knowledge.topicId ? { topicId: knowledge.topicId } : {}) }, controller.signal).then(found => {
        if (!controller.signal.aborted) { setCards(found); setLoading(false) }
      }, () => { if (!controller.signal.aborted) { setFailed(true); setLoading(false); setCards([]) } })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [knowledge.api, knowledge.topicId, knowledge.refresh, query, retry])
  useEffect(() => { saveWorkingPosition(workingKey, { knowledge: { query, inTopic: !!knowledge.topicId } }) }, [workingKey, query, knowledge.topicId])
  const current = cards.find(card => `card:${card.cardId}` === selected)
  function select(card: KnowledgeCard): void {
    const id = `card:${card.cardId}`
    setSelected(id)
    setDetailOpen(true)
    saveWorkingPosition(workingKey, { selected: id })
  }
  return <div className={styles.readingWorkbench} data-reading-detail={detailOpen}>
    <section className={styles.readingCatalog} aria-label={t('knowledge.title')}>
      <div className={styles.readingHeading}><strong>{t('knowledge.title')}</strong><span>{cards.length}</span></div>
      <label className={styles.readingQuery}>{t('knowledge.query')}<input value={query} maxLength={200} onChange={event => { setQuery(event.target.value) }} /></label>
      {loading ? <p role="status">{t('topic.loading')}</p> : failed ? <p role="alert">{t('knowledge.error')} <button type="button" onClick={() => { setRetry(value => value + 1) }}>{t('topic.retry')}</button></p> : null}
      {!loading && !failed && !cards.length ? <p>{t('knowledge.empty')}</p> : null}
      {cards.map(card => <button className={styles.readingCatalogItem} type="button" key={card.cardId} aria-pressed={current?.cardId === card.cardId} onClick={() => { select(card) }}>
        <strong>{card.revisions.at(-1)!.content.title}</strong><p>{card.revisions.at(-1)!.content.conclusion.slice(0, 180)}</p>
        <small>{t(card.revisions.at(-1)!.content.status === 'confirmed' ? 'workbench.confirmed' : 'workbench.verify')}</small>
      </button>)}
      <button className={styles.readingNew} type="button" onClick={() => { knowledge.create() }}>+ {t('knowledge.new')}</button>
    </section>
    <article className={styles.readingPaper} data-working-scroll="" aria-label={t('workbench.reading')}>
      <button className={styles.readingBack} type="button" onClick={() => { setDetailOpen(false) }}>← {t('workbench.back')}</button>
      {relations.failed ? <p role="alert">{t('workbench.relationsError')} <button type="button" onClick={relations.retry}>{t('topic.retry')}</button></p> : null}
      {current ? <KnowledgeReader key={current.cardId} workingKey={workingKey} card={current} relations={relations.relations} read={actions.readSessionHistory} t={t} />
        : <div className={styles.readingEmpty}><h2>{t('workbench.chooseCard')}</h2><p>{t('workbench.libraryHint')}</p></div>}
    </article>
  </div>
}
