import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import type {
  SessionDiscussionSource, SessionHistoryRequest, SessionHistoryResult, SessionHistoryTurn,
} from '../session-history.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

/** The Selected Session's explicitly opened discussion reader. */
export function SessionHistory({ sourceTitle, sessionId, anchorSeq, highlightSeq, source, retainedSource, workingKey, onUnavailable, read, t }: {
  readonly sourceTitle?: string | undefined
  readonly sessionId: string
  readonly anchorSeq?: number
  readonly highlightSeq?: number
  readonly source?: SessionDiscussionSource
  /** Topic provenance is a fallback; an explicitly opened source still wins. */
  readonly retainedSource?: SessionDiscussionSource
  readonly workingKey?: string | undefined
  readonly onUnavailable?: (() => void) | undefined
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()
  const reuse = useResearchReuse()
  const [result, setResult] = useState<SessionHistoryResult | undefined>(() => {
    const excerpt = source ?? retainedSource
    return excerpt === undefined ? undefined : {
      kind: 'excerpt', sessionId, turns: excerpt.turns, hasEarlier: false, hasLater: false,
    }
  })
  const element = useRef<HTMLElement>(null)
  const initialScroll = useRef(anchorSeq === undefined && source === undefined ? loadWorkingPosition(workingKey).historyScroll?.[sessionId] : undefined)
  const unavailable = useRef(onUnavailable)
  unavailable.current = onUnavailable
  const [request, setRequest] = useState<SessionHistoryRequest>(() => {
    if (source !== undefined) return { sessionId, source }
    if (anchorSeq !== undefined) return { sessionId, anchorSeq }
    const position = loadWorkingPosition(workingKey)
    const range = position.historyRange?.[sessionId]
    const anchor = position.history?.[sessionId]
    if (range !== undefined && range.startSeq === anchor) return { sessionId, range }
    if (anchor !== undefined) return { sessionId, anchorSeq: anchor }
    return { sessionId, ...(retainedSource === undefined ? {} : { source: retainedSource }) }
  })
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
        const anchor = value.turns[0]?.startSeq
        const position = loadWorkingPosition(workingKey)
        const history = { ...position.history }
        const historyRange = { ...position.historyRange }
        const endSeq = value.turns.at(-1)?.endSeq
        if (anchor === undefined) delete history[sessionId]
        else history[sessionId] = anchor
        if ((request.source !== undefined || request.range !== undefined) && anchor !== undefined && endSeq != null) {
          historyRange[sessionId] = { startSeq: anchor, endSeq }
        } else delete historyRange[sessionId]
        saveWorkingPosition(workingKey, { history, historyRange })
      } else if (value.kind === 'unavailable' && (request.anchorSeq !== undefined || request.range !== undefined) && workingKey !== undefined) {
        const history = { ...loadWorkingPosition(workingKey).history }
        const historyRange = { ...loadWorkingPosition(workingKey).historyRange }
        const historyScroll = { ...loadWorkingPosition(workingKey).historyScroll }
        delete history[sessionId]
        delete historyRange[sessionId]
        delete historyScroll[sessionId]
        saveWorkingPosition(workingKey, { history, historyRange, historyScroll })
        unavailable.current?.()
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
  useLayoutEffect(() => {
    if (loading || result?.kind !== 'original') return
    const panel = element.current?.closest<HTMLElement>('[data-working-scroll]')
    if (panel == null) return
    if (initialScroll.current !== undefined) {
      panel.scrollTop = initialScroll.current
      initialScroll.current = undefined
    }
    const remember = (): void => {
      saveWorkingPosition(workingKey, { historyScroll: { ...loadWorkingPosition(workingKey).historyScroll, [sessionId]: panel.scrollTop } })
    }
    panel.addEventListener('scroll', remember, { passive: true })
    return () => { panel.removeEventListener('scroll', remember) }
  }, [workingKey, sessionId, result, loading])

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
    <section ref={element} aria-label={t('history.title')} className={styles.history}>
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
        <div role="status"><strong>{t('history.excerpt')}</strong>{loading ? null : <p>{t('history.excerptHint')}</p>}</div>
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
          {reuse === undefined ? null : <><button type="button" disabled={loading || result?.kind !== 'original' || selection.turns.length !== 1} onClick={() => {
            reuse.add({ kind: 'turn', sessionId, startSeq: selection.startSeq, endSeq: selection.endSeq },
              `${sourceTitle || sessionId} · ${t('history.turn', { turn: selection.turns[0]!.turn })}`)
          }}>{t('reuse.addTurn')}</button>{selection.turns.length !== 1 ? <p>{t('reuse.singleTurn')}</p> : null}</>}
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
