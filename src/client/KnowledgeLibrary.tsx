import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  IconLayersOutlineRegular, IconPlusOutlineRegular, IconSearchOutlineRegular, IconSlidersTwoOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { KnowledgeCard, KnowledgeContent } from '../knowledge.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { KnowledgeReader } from './KnowledgeReader.tsx'
import { KnowledgeKindBadge, KnowledgeStatusBadge } from './KnowledgeBadges.tsx'
import { useResearchRelations } from './research-relations.ts'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'
import styles from './GraphView.module.css'

type StatusFilter = 'all' | KnowledgeContent['status']
type KindFilter = 'all' | KnowledgeContent['kind']
type SortOrder = 'recent' | 'title'

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
  const [status, setStatus] = useState<StatusFilter>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [sort, setSort] = useState<SortOrder>('recent')
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
  const visibleCards = useMemo(() => cards.filter(card => {
    const content = card.revisions.at(-1)!.content
    return (status === 'all' || content.status === status) && (kind === 'all' || content.kind === kind)
  }).sort((left, right) => {
    if (sort === 'title') return left.revisions.at(-1)!.content.title.localeCompare(right.revisions.at(-1)!.content.title)
    return right.revisions.at(-1)!.savedAt - left.revisions.at(-1)!.savedAt
  }), [cards, status, kind, sort])
  const current = cards.find(card => `card:${card.cardId}` === selected)
  function select(card: KnowledgeCard): void {
    const id = `card:${card.cardId}`
    setSelected(id)
    setDetailOpen(true)
    saveWorkingPosition(workingKey, { selected: id })
  }
  return <div className={styles.readingWorkbench} data-reading-detail={detailOpen}>
    <section className={styles.readingCatalog} aria-label={t('knowledge.title')}>
      <div className={styles.readingHeading}>
        <span className={styles.readingHeadingTitle}><IconLayersOutlineRegular size={16} /><strong>{t('knowledge.title')}</strong></span>
        <span title={`${visibleCards.length} / ${cards.length}`}>{visibleCards.length === cards.length ? cards.length : `${visibleCards.length} / ${cards.length}`}</span>
      </div>
      <label className={styles.readingQuery}>{t('knowledge.filter')}
        <span className={styles.readingQueryField}>
          <IconSearchOutlineRegular size={15} />
          <input value={query} maxLength={200} placeholder={t('knowledge.filterHint')} onChange={event => { setQuery(event.target.value) }} />
        </span>
      </label>
      <div className={styles.readingFilters}>
        <IconSlidersTwoOutlineRegular size={15} />
        <select aria-label={t('knowledge.statusFilter')} value={status} onChange={event => { setStatus(event.target.value as StatusFilter) }}>
          <option value="all">{t('knowledge.statusFilterAll')}</option>
          <option value="draft">{t('workbench.verify')}</option>
          <option value="confirmed">{t('workbench.confirmed')}</option>
        </select>
        <select aria-label={t('knowledge.kind')} value={kind} onChange={event => { setKind(event.target.value as KindFilter) }}>
          <option value="all">{t('knowledge.kindFilterAll')}</option>
          {(['conclusion', 'method', 'hypothesis', 'question'] as const).map(value => <option key={value} value={value}>{t(`knowledge.kind.${value}`)}</option>)}
        </select>
        <select aria-label={t('knowledge.sort')} value={sort} onChange={event => { setSort(event.target.value as SortOrder) }}>
          <option value="recent">{t('knowledge.sortRecent')}</option>
          <option value="title">{t('knowledge.sortTitle')}</option>
        </select>
      </div>
      {loading ? <p role="status">{t('topic.loading')}</p> : failed ? <p role="alert">{t('knowledge.error')} <button type="button" onClick={() => { setRetry(value => value + 1) }}>{t('topic.retry')}</button></p> : null}
      {!loading && !failed && !visibleCards.length ? <p>{t('knowledge.empty')}</p> : null}
      {visibleCards.map(card => {
        const revision = card.revisions.at(-1)!
        const savedAt = new Date(revision.savedAt)
        return <button className={styles.readingCatalogItem} type="button" key={card.cardId} aria-pressed={current?.cardId === card.cardId} onClick={() => { select(card) }}>
          <strong>{revision.content.title}</strong><p>{revision.content.conclusion.slice(0, 180)}</p>
          <span className={styles.readingCardMeta}>
            <KnowledgeStatusBadge status={revision.content.status} t={t} />
            <KnowledgeKindBadge kind={revision.content.kind} t={t} />
            <time dateTime={savedAt.toISOString()} title={savedAt.toLocaleString()}>{savedAt.toLocaleDateString()}</time>
          </span>
        </button>
      })}
      <button className={styles.readingNew} type="button" onClick={() => { knowledge.create() }}><IconPlusOutlineRegular size={15} />{t('knowledge.new')}</button>
    </section>
    <article className={styles.readingPaper} data-working-scroll="" aria-label={t('workbench.reading')}>
      <button className={styles.readingBack} type="button" onClick={() => { setDetailOpen(false) }}>← {t('workbench.back')}</button>
      {current ? <KnowledgeReader key={current.cardId} workingKey={workingKey} card={current} relations={relations} read={actions.readSessionHistory} t={t} />
        : <div className={styles.readingEmpty}><h2>{t('workbench.chooseCard')}</h2><p>{t('workbench.libraryHint')}</p></div>}
    </article>
  </div>
}
