import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  SessionDiscussionSource, SessionHistoryRequest, SessionHistoryResult, SessionHistoryTurn,
} from '../session-history.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'

/** The Selected Session's explicitly opened discussion reader. */
export function SessionHistory({ sessionId, anchorSeq, highlightSeq, source, read, t }: {
  readonly sessionId: string
  readonly anchorSeq?: number
  readonly highlightSeq?: number
  readonly source?: SessionDiscussionSource
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()
  const [result, setResult] = useState<SessionHistoryResult>()
  const [request, setRequest] = useState<SessionHistoryRequest>({ sessionId,
    ...(source !== undefined ? { source } : anchorSeq === undefined ? {} : { anchorSeq }) })
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<SessionDiscussionSource>()
  const [failed, setFailed] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [incompleteRange, setIncompleteRange] = useState(false)
  const activeRead = useRef<AbortController>()
  const loadedTurns = useRef(new Map<number, SessionHistoryTurn>())
  useEffect(() => {
    const controller = new AbortController()
    activeRead.current = controller
    setLoading(true)
    setFailed(false)
    setCanceled(false)
    void read(request, controller.signal).then(value => {
      if (controller.signal.aborted) return
      if (value.kind === 'original') {
        for (const turn of value.turns) loadedTurns.current.set(turn.startSeq, turn)
      }
      setResult(value)
      setLoading(false)
    }).catch(() => {
      if (controller.signal.aborted) return
      setFailed(true)
      setLoading(false)
    })
    return () => { controller.abort() }
  }, [request, read])

  const select = (turn: SessionHistoryTurn): void => {
    if (turn.endSeq === null || loading || result?.kind !== 'original') return
    setIncompleteRange(false)
    if (selection !== undefined && turn.startSeq >= selection.startSeq && turn.endSeq <= selection.endSeq) {
      setSelection(undefined)
      return
    }
    const startSeq = Math.min(selection?.startSeq ?? turn.startSeq, turn.startSeq)
    const endSeq = Math.max(selection?.endSeq ?? turn.endSeq, turn.endSeq)
    const turns = [...loadedTurns.current.values()]
      .filter(item => item.startSeq >= startSeq && item.startSeq <= endSeq)
      .sort((a, b) => a.startSeq - b.startSeq)
    if (turns.some((item, index) => {
      const previous = turns[index - 1]
      return item.endSeq === null || (previous !== undefined && item.turn !== previous.turn + 1)
    })) {
      setIncompleteRange(true)
      return
    }
    setSelection({ startSeq, endSeq, turns })
  }

  return (
    <section aria-label={t('history.title')} className={styles.history}>
      <div className={styles.historyIdentity}>{sessionId}</div>
      <p className={styles.historyHint}>{t('history.scope')}</p>
      {loading ? <div role="status">
        <p>{t('history.loading')}</p>
        <button type="button" onClick={() => {
          activeRead.current?.abort()
          setLoading(false)
          setCanceled(true)
        }}>{t('history.cancel')}</button>
      </div> : null}
      {canceled ? <p role="status">{t('history.canceled')}</p> : null}
      {failed ? <p role="alert">{t('history.error')}</p> : null}
      {!loading && !failed && result?.kind === 'unavailable' ? <p role="alert">{t('history.unavailable')}</p> : null}
      {result?.kind === 'excerpt' ? (
        <div role="status"><strong>{t('history.excerpt')}</strong><p>{t('history.excerptHint')}</p></div>
      ) : null}
      {!loading && !failed && result?.kind === 'original' && result.turns.length === 0 ? <p>{t('history.empty')}</p> : null}
      {!loading && (failed || canceled || result?.kind === 'unavailable' || result?.kind === 'excerpt') ? (
        <button type="button" onClick={() => { setRequest({ ...request }) }}>{t('history.retry')}</button>
      ) : null}
      <div className={styles.historyPager}>
        <button type="button" disabled={loading} onClick={() => { setRequest({ ...request }) }}>{t('history.refresh')}</button>
        <button type="button" disabled={loading || !result?.hasEarlier} onClick={() => {
          const beforeSeq = result?.turns[0]?.startSeq
          if (beforeSeq !== undefined) setRequest({ sessionId, beforeSeq })
        }}>{t('history.earlier')}</button>
        <button type="button" disabled={loading || !result?.hasLater} onClick={() => {
          const afterSeq = result?.turns.at(-1)?.startSeq
          if (afterSeq !== undefined) setRequest({ sessionId, afterSeq })
        }}>{t('history.later')}</button>
      </div>
      {selection === undefined ? <p className={styles.historyHint}>{t('history.selectHint')}</p> : (
        <div className={styles.historySelection}>
          <strong>{t('history.selected', { first: selection.turns[0]?.turn, last: selection.turns.at(-1)?.turn })}</strong>
          <div className={styles.historyIdentity}>{t('history.boundary', { start: selection.startSeq, end: selection.endSeq })}</div>
          <button type="button" disabled={loading} onClick={() => { setRequest({ sessionId, source: selection }) }}>{t('history.review')}</button>
          {knowledge === undefined ? null : <button type="button" disabled={loading || result?.kind !== 'original'} onClick={() => {
            knowledge.create({ kind: 'discussion', sessionId, startSeq: selection.startSeq, endSeq: selection.endSeq })
          }}>{t('knowledge.create')}</button>}
          {knowledge === undefined ? null : <button type="button" disabled={loading || result?.kind !== 'original'} onClick={() => {
            knowledge.extract({ kind: 'discussion', sessionId, startSeq: selection.startSeq, endSeq: selection.endSeq })
          }}>{t('extract.title')}</button>}
          <button type="button" onClick={() => {
            setSelection(undefined)
            setIncompleteRange(false)
          }}>{t('history.clear')}</button>
        </div>
      )}
      {incompleteRange ? <p role="status">{t('history.incompleteRange')}</p> : null}
      {result?.turns.map(turn => (
        <article key={turn.startSeq}>
          <h3>{t('history.turn', { turn: turn.turn })}</h3>
          <label>
            <input type="checkbox" disabled={loading || turn.endSeq === null || result.kind !== 'original'}
              checked={selection !== undefined && turn.startSeq >= selection.startSeq && turn.startSeq <= selection.endSeq}
              onChange={() => { select(turn) }} />
            {t('history.selectTurn', { turn: turn.turn })}
          </label>
          {turn.endSeq === null ? <p>{t('history.unfinished')}</p> : null}
          {turn.messages.map(message => (
            <div key={message.seq} className={message.seq === highlightSeq ? styles.historyMatch : undefined}>
              <strong>{t(message.role === 'user' ? 'history.user' : 'history.assistant')}</strong>
              <p className={styles.historyText}>{message.text}</p>
            </div>
          ))}
        </article>
      ))}
    </section>
  )
}
