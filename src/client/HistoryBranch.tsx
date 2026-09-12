import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { HistoryBranchApi, HistoryBranchRecord, HistoryBranchRequest } from '../history-branch.ts'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'

type Selection = Omit<HistoryBranchRequest, 'operationId' | 'topicId'>
const BranchContext = createContext<((selection: Selection) => void) | undefined>(undefined)
export function useHistoryBranch(): ((selection: Selection) => void) | undefined { return useContext(BranchContext) }

export function HistoryBranchProvider({ api, hostId, openSession, children, t }: {
  readonly api: HistoryBranchApi | undefined
  readonly hostId: string
  readonly openSession: (id: SessionId) => void
  readonly children: ReactNode
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()
  const [shown, setShown] = useState(false)
  const [request, setRequest] = useState<HistoryBranchRequest>()
  const [record, setRecord] = useState<HistoryBranchRecord>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const active = useRef<AbortController>()
  const trigger = useRef<HTMLElement>()
  const contentRoot = useRef<HTMLDivElement | null>(null)
  const memory = useRef(new Map<string, string>())
  useLayoutEffect(() => {
    if (shown) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      // Saving topic membership can remount the source reader while the dialog is open.
      const target = trigger.current?.isConnected ? trigger.current : [...(contentRoot.current?.querySelectorAll<HTMLElement>('[data-history-branch-session]') ?? [])]
        .find(element => element.dataset.historyBranchSession === request?.sessionId && element.dataset.historyBranchStart === String(request?.startSeq))
      target?.focus({ preventScroll: true })
    })
    return () => { cancelled = true }
  }, [shown])
  useEffect(() => () => { active.current?.abort() }, [])
  const operation = async (run: (signal: AbortSignal) => Promise<HistoryBranchRecord | null>): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true); setError(undefined)
    try {
      const value = await run(controller.signal)
      if (!controller.signal.aborted) {
        if (value === null) throw new Error('Branch preview unavailable')
        setRecord(value); setError(value.error)
        if (value.stage === 'ready') knowledge?.changed()
      }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  const prepare = (selection: Selection, fresh = false): void => {
    if (api === undefined) return
    const base = { sessionId: selection.sessionId, startSeq: selection.startSeq, endSeq: selection.endSeq, ...(knowledge?.topicId === undefined ? {} : { topicId: knowledge.topicId }) }
    const key = `research-branch:${hostId}:${JSON.stringify(base)}`
    let previous = memory.current.get(key)
    try { previous ??= localStorage.getItem(key) ?? undefined } catch { /* Memory retains the current attempt. */ }
    const operationId = !fresh && previous !== undefined ? previous : crypto.randomUUID()
    memory.current.set(key, operationId)
    try { localStorage.setItem(key, operationId) } catch { /* Storage denial does not prevent branching. */ }
    const next = { ...base, operationId }
    setRequest(next); setRecord(undefined); setShown(true)
    void operation(signal => api.prepare(next, signal))
  }
  const close = (): void => {
    active.current?.abort(); setBusy(false); setShown(false)
  }
  return <BranchContext.Provider value={api === undefined ? undefined : selection => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    prepare(selection)
  }}>
    <div className={styles.knowledgeRoot} aria-hidden={shown || undefined} ref={element => { contentRoot.current = element; if (element !== null) element.inert = shown }}>{children}</div>
    {!shown ? null : <section className={`${styles.knowledgeDialog} ${styles.branchDialog}`} role="dialog" aria-modal="true" aria-label={t('branch.title')}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() }; retainDialogFocus(event) }}>
      <div className={styles.searchHeader}><h2>{t('branch.title')}</h2><button type="button" autoFocus onClick={close}>{t('branch.return')}</button></div>
      <div className={styles.knowledgeBody}>
        {record === undefined ? null : <>
          <p>{record.sourceTitle}</p><p>{t('branch.inherits', { first: record.firstTurn, last: record.lastTurn })}</p>
          <h3>{t('branch.newTitle')}</h3><p>{record.title}</p>
          {record.stage === 'prepared' ? null : <p role="status">{t(record.stage === 'ready' ? 'branch.ready' : 'branch.saved')}</p>}
          {record.stage === 'ready' ? null : <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => {
            void operation(signal => api!.submit({ operationId: record.operationId }, signal))
          }}>{t(error === undefined && record.stage === 'prepared' ? 'branch.confirm' : 'branch.retry')}</button>}
          {record.stage === 'prepared' ? null : <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => { close(); openSession(record.targetSessionId as SessionId) }}>{t('branch.open')}</button>}
        </>}
        {busy ? <p role="status">{t('branch.busy')}</p> : null}
        {error === undefined ? null : <div role="alert"><p>{t('branch.error')} {error}</p>
          {request === undefined || record !== undefined ? null : <button type="button" disabled={busy} onClick={() => { void operation(signal => api!.prepare(request, signal)) }}>{t('branch.retry')}</button>}</div>}
        {request === undefined || record === undefined || record.stage === 'prepared' && error === undefined ? null : <div className={styles.topicControls}>
          <button type="button" disabled={busy} onClick={() => { prepare(request, true) }}>{t('branch.fresh')}</button></div>}
      </div>
    </section>}
  </BranchContext.Provider>
}
