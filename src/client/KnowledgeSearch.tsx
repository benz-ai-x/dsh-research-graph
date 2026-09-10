import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { KnowledgeCard } from '../knowledge.ts'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import styles from './GraphView.module.css'

/** Shares the search entry while keeping card scope independent of Session directories. */
export function KnowledgeSearch({ t }: {
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()!
  const [query, setQuery] = useState('')
  const [inTopic, setInTopic] = useState(false)
  const [cards, setCards] = useState<readonly KnowledgeCard[]>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const active = useRef<AbortController>()
  useEffect(() => () => { active.current?.abort() }, [])
  const invalidate = (): void => {
    active.current?.abort()
    setCards(undefined)
    setBusy(false)
    setFailed(false)
    setCanceled(false)
  }
  const run = async (): Promise<void> => {
    invalidate()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      const result = await knowledge.api.search({ query,
        ...(inTopic && knowledge.topicId !== undefined ? { topicId: knowledge.topicId } : {}) }, controller.signal)
      if (!controller.signal.aborted) setCards(result)
    } catch { if (!controller.signal.aborted) setFailed(true) } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return <div className={styles.knowledgeBody}>
    <form className={styles.searchForm} onSubmit={event => { event.preventDefault(); void run() }}>
      <label>{t('knowledge.query')}<input autoFocus maxLength={200} value={query}
        onChange={event => { invalidate(); setQuery(event.target.value) }} /></label>
      <label>{t('search.scope')}<select value={inTopic ? 'topic' : 'all'} onChange={event => { invalidate(); setInTopic(event.target.value === 'topic') }}>
        <option value="all">{t('knowledge.all')}</option>
        {knowledge.topicId === undefined ? null : <option value="topic">{t('knowledge.currentTopic')}</option>}
      </select></label>
      <button type="submit" disabled={busy}>{t('knowledge.search')}</button>
      <button type="button" onClick={() => { knowledge.create() }}>{t('knowledge.new')}</button>
      {busy ? <button type="button" onClick={() => { invalidate(); setCanceled(true) }}>{t('search.cancel')}</button> : null}
    </form>
    {busy || canceled ? <p role="status">{t(busy ? 'search.loading' : 'search.canceled')}</p> : null}
    {failed ? <p role="alert">{t('knowledge.error')} <button type="button" onClick={() => { void run() }}>{t('search.retry')}</button></p> : null}
    {cards?.length === 0 ? <p role="status">{t('knowledge.empty')}</p> : null}
    <div className={styles.knowledgeResults}>{cards?.map(card => {
      const revision = card.revisions.at(-1)!
      return <button className={styles.searchHit} key={card.cardId} type="button" onClick={() => { knowledge.open(card.cardId) }}>
        <strong>{revision.content.title}</strong><span>{t('knowledge.title')} · {t(`knowledge.status.${revision.content.status}`)} · {t('knowledge.versionNumber', { number: revision.number })}</span>
        <span>{revision.content.conclusion.slice(0, 240)}</span>
      </button>
    })}</div>
  </div>
}
