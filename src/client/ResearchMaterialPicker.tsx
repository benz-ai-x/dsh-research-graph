import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { KnowledgeCard } from '../knowledge.ts'
import type { GraphViewProps } from './GraphView.tsx'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import { useResearchReuse } from './ResearchReuse.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import styles from './GraphView.module.css'

/** Pick explicit saved revisions or completed turns without losing the composition. */
export function ResearchMaterialPicker({ api, useSessions, read, t }: {
  readonly api: KnowledgeApi
  readonly useSessions: GraphViewProps['useSessions']
  readonly read: GraphViewProps['readSessionHistory']
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const reuse = useResearchReuse()!
  const sessions = useSessions(state => state)
  const [type, setType] = useState<'card' | 'turn'>('card')
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<readonly KnowledgeCard[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const active = useRef<AbortController>()
  const search = async (): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setFailed(false)
    try {
      const result = await api.search({ query }, controller.signal)
      if (!controller.signal.aborted) setCards(result)
    } catch { if (!controller.signal.aborted) setFailed(true) } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  useEffect(() => { void search(); return () => { active.current?.abort() } }, [])
  return <section className={styles.materialPicker} aria-label={t('reuse.pick')}>
    <div className={styles.searchTypes} role="group" aria-label={t('knowledge.searchType')}>
      <button type="button" aria-pressed={type === 'card'} onClick={() => { setType('card') }}>{t('knowledge.title')}</button>
      <button type="button" aria-pressed={type === 'turn'} onClick={() => { setType('turn') }}>{t('knowledge.discussions')}</button>
    </div>
    {type === 'card' ? <>
      <form className={styles.topicControls} onSubmit={event => { event.preventDefault(); void search() }}>
        <label>{t('knowledge.query')}<input maxLength={200} value={query} onChange={event => { setQuery(event.target.value) }} /></label>
        <button type="submit" disabled={busy}>{t('knowledge.search')}</button>
      </form>
      {busy ? <p role="status">{t('search.loading')}</p> : failed ? <p role="alert">{t('knowledge.error')}</p>
        : cards.length === 0 ? <p>{t('reuse.noCards')}</p> : null}
      <div className={styles.knowledgeResults}>{cards.map(card => {
        const revision = card.revisions.at(-1)!
        const selection = { kind: 'card' as const, cardId: card.cardId, revisionId: revision.revisionId }
        const included = reuse.contains(selection)
        return <article key={card.cardId} className={styles.materialCard}>
          <h4>{revision.content.title}</h4>
          <p>{t('knowledge.versionNumber', { number: revision.number })} · {t(`knowledge.status.${revision.content.status}`)}</p>
          <p className={styles.historyText}>{revision.content.conclusion}</p>
          <button type="button" disabled={included || reuse.count >= 3} onClick={() => {
            reuse.add(selection, `${revision.content.title} · ${t('knowledge.versionNumber', { number: revision.number })}`)
          }}>{t(included ? 'reuse.added' : 'reuse.addCard')}</button>
        </article>
      })}</div>
    </> : <>
      <label>{t('reuse.chooseDiscussion')}<select value={selected} onChange={event => { setSelected(event.target.value) }}>
        <option value="">{t('reuse.chooseDiscussion')}</option>
        {Object.values(sessions.byId).map(session => <option key={session.id} value={session.id}>
          {session.displayTitle || t('node.newSession')}
        </option>)}
      </select></label>
      <p>{t('reuse.turnHint')}</p>
      {selected === '' ? null : <SessionHistory key={selected} sessionId={selected}
        sourceTitle={Object.values(sessions.byId).find(session => session.id === selected)?.displayTitle} read={read} t={t} />}
    </>}
  </section>
}
