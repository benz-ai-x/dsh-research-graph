import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResearchMaterialSelection, ResearchReuseRecord } from '../research-reuse.ts'
import type { ResearchReuseApi } from './research-reuse-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
interface MaterialEntry { readonly selection: ResearchMaterialSelection; readonly label: string }
interface ReuseContextValue {
  readonly add: (selection: ResearchMaterialSelection, label: string) => void
  readonly count: number
  readonly open: () => void
  readonly history: () => void
}
const ReuseContext = createContext<ReuseContextValue | undefined>(undefined)
export function useResearchReuse(): ReuseContextValue | undefined { return useContext(ReuseContext) }

export function ResearchReuseEntry({ t }: { readonly t: Translate }): ReactElement | null {
  const reuse = useResearchReuse()
  return reuse === undefined ? null : <>
    <button type="button" className={styles.searchEntry} onClick={reuse.open}>{t('reuse.materials', { count: reuse.count })}</button>
    <button type="button" className={styles.searchEntry} onClick={reuse.history}>{t('reuse.history')}</button>
  </>
}

/** Keeps the draft and uncertain attempt alive while its dialogs are closed. */
export function ResearchReuseProvider({ api, workspaces, viewedId, openSession, children, t }: {
  readonly api: ResearchReuseApi
  readonly workspaces: readonly WorkspaceView[]
  readonly viewedId: SessionId
  readonly openSession: (id: SessionId) => void
  readonly children: ReactNode
  readonly t: Translate
}): ReactElement {
  const [materials, setMaterials] = useState<readonly MaterialEntry[]>([])
  const [mode, setMode] = useState<'compose' | 'history'>()
  const [question, setQuestion] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [preview, setPreview] = useState<ResearchReuseRecord>()
  const [records, setRecords] = useState<readonly ResearchReuseRecord[]>()
  const [notice, setNotice] = useState<SessionGraphKey>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string>()
  const attempt = useRef<{ readonly payload: string; readonly operationId: string }>()
  const active = useRef<AbortController>()
  const trigger = useRef<HTMLElement>()
  useEffect(() => () => { active.current?.abort() }, [])
  const show = (next: 'compose' | 'history'): void => {
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement
    setFailed(undefined)
    setNotice(undefined)
    setMode(next)
  }
  const close = (): void => {
    active.current?.abort()
    setBusy(false)
    setMode(undefined)
    queueMicrotask(() => { trigger.current?.focus() })
  }
  const change = (): void => {
    active.current?.abort()
    setBusy(false)
    setFailed(undefined)
    setPreview(undefined)
  }
  const perform = async (operation: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setFailed(undefined)
    try { await operation(controller.signal) } catch (error) {
      if (!controller.signal.aborted) setFailed(error instanceof Error ? error.message : String(error))
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  const history = (): void => {
    show('history')
    setRecords(undefined)
    void perform(async signal => {
      const found = await api.forSession({ sessionId: viewedId }, signal)
      if (!signal.aborted) setRecords(found)
    })
  }
  const submit = (record: ResearchReuseRecord): void => {
    void perform(async signal => {
      const saved = await api.submit({ operationId: record.operationId }, signal)
      if (signal.aborted) return
      if (mode === 'history') setRecords(value => value?.map(item => item.operationId === saved.operationId ? saved : item))
      else setPreview(saved)
      if (saved.stage !== 'accepted') setFailed(saved.error ?? t('reuse.error'))
      else if (mode === 'compose') {
        setNotice('reuse.sent')
        openSession(saved.targetSessionId as SessionId)
      }
    })
  }
  const locked = busy || preview?.targetCreated === true
  const add = (selection: ResearchMaterialSelection, label: string): void => {
    if (preview?.targetCreated) { setNotice('reuse.created'); return }
    if (materials.some(item => JSON.stringify(item.selection) === JSON.stringify(selection))) { setNotice('reuse.duplicate'); return }
    if (materials.length >= 3) { setNotice('reuse.limit'); return }
    change()
    setMaterials(value => [...value, { selection, label }])
    setNotice('reuse.added')
  }
  const move = (index: number, direction: number): void => {
    change()
    setMaterials(value => {
      const next = [...value]
      const other = index + direction
      if (next[index] === undefined || next[other] === undefined) return value
      const item = next[index]!
      next[index] = next[other]!
      next[other] = item
      return next
    })
  }
  return <ReuseContext.Provider value={{ add, count: materials.length, open: () => { show('compose') }, history }}>
    <div className={styles.knowledgeRoot} aria-hidden={mode !== undefined || undefined}
      ref={element => { if (element !== null) element.inert = mode !== undefined }}>{children}
      {notice === undefined ? null : <span className={styles.reuseNotice} role="status">{t(notice)}</span>}
    </div>
    {mode === undefined ? null : <section className={styles.knowledgeDialog} role="dialog" aria-modal="true"
      aria-label={t(mode === 'compose' ? 'reuse.title' : 'reuse.history')} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); close() }
        retainDialogFocus(event)
      }}>
      <div className={styles.searchHeader}><h2>{t(mode === 'compose' ? 'reuse.title' : 'reuse.history')}</h2>
        <button type="button" autoFocus onClick={close}>{t('reuse.close')}</button></div>
      <div className={styles.knowledgeBody}>
        {mode === 'compose' ? <>
          <p>{t('reuse.boundary')}</p>
          {materials.length === 0 ? <p role="status">{t('reuse.empty')}</p> : <ol>{materials.map((item, index) => <li key={JSON.stringify(item.selection)}>
            <strong>{item.label}</strong>
            <button type="button" disabled={locked || index === 0} onClick={() => { move(index, -1) }}>{t('reuse.up')}</button>
            <button type="button" disabled={locked || index === materials.length - 1} onClick={() => { move(index, 1) }}>{t('reuse.down')}</button>
            <button type="button" disabled={locked} onClick={() => { change(); setMaterials(value => value.filter((_, i) => i !== index)) }}>{t('reuse.remove')}</button>
          </li>)}</ol>}
          <label>{t('reuse.question')}<textarea value={question} disabled={locked} maxLength={4000} rows={3}
            onChange={event => { change(); setQuestion(event.target.value) }} /></label>
          <label>{t('reuse.workspace')}<select value={workspaceId} disabled={locked} onChange={event => { change(); setWorkspaceId(event.target.value) }}>
            <option value="">{t('reuse.chooseWorkspace')}</option>{workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title || item.path}</option>)}
          </select></label>
          <button type="button" disabled={locked || materials.length < 1 || materials.length > 3 || question.trim() === '' || !workspaces.some(item => item.workspaceId === workspaceId)}
            onClick={() => {
              const base = { materials: materials.map(item => item.selection), question: question.trim(), workspaceId }
              const payload = JSON.stringify(base)
              if (attempt.current?.payload !== payload) attempt.current = { payload, operationId: crypto.randomUUID() }
              const operationId = attempt.current.operationId
              void perform(async signal => {
                const value = await api.prepare({ ...base, operationId }, signal)
                if (!signal.aborted) setPreview(value)
              })
            }}>{t('reuse.preview')}</button>
          {preview === undefined ? null : <>
            <ResearchReuseSnapshot record={preview} t={t} />
            {preview.stage === 'accepted' ? null : <button type="button" disabled={busy} onClick={() => { submit(preview) }}>
              {t(preview.error === undefined ? 'reuse.confirm' : 'reuse.retry')}</button>}
            {preview.targetCreated ? <button type="button" onClick={() => { openSession(preview.targetSessionId as SessionId) }}>{t('reuse.open')}</button> : null}
          </>}
        </> : <>
          {records?.length === 0 ? <p>{t('reuse.noHistory')}</p> : records?.map(record => <section key={record.operationId}>
            <ResearchReuseSnapshot record={record} t={t} />
            {record.stage === 'accepted' ? null : <button type="button" disabled={busy} onClick={() => { submit(record) }}>{t('reuse.retry')}</button>}
          </section>)}
          {failed === undefined ? null : <button type="button" disabled={busy} onClick={history}>{t('reuse.retryHistory')}</button>}
        </>}
        {busy ? <p role="status">{t('reuse.busy')}</p> : null}
        {failed === undefined ? null : <p role="alert">{t('reuse.error')} {failed}</p>}
      </div>
    </section>}
  </ReuseContext.Provider>
}

function ResearchReuseSnapshot({ record, t }: { readonly record: ResearchReuseRecord; readonly t: Translate }): ReactElement {
  return <section>
    <h3>{t(record.stage === 'accepted' ? 'reuse.sent' : record.targetCreated ? 'reuse.created' : 'reuse.frozen')}</h3>
    <p>{record.workspace.title} · {record.workspace.cwd}</p>
    <p>{t('reuse.budget', { size: record.promptText.length, budget: record.budgetChars })}</p>
    {record.stage === 'accepted' ? <><h4>{t('reuse.relation')}</h4><ul>{record.materials.map((material, index) => <li key={index}>
      {material.kind === 'card' ? `${material.content.title} · ${t('knowledge.versionNumber', { number: material.revisionNumber })}`
        : `${material.source.title} · ${t('knowledge.sourceRange', { start: material.source.source.startSeq, end: material.source.source.endSeq })}`} → {record.targetSessionId}
    </li>)}</ul><p>{t('reuse.answer')}</p></> : <p>{t('reuse.pending')}</p>}
    <pre className={styles.historyText}>{record.promptText}</pre>
  </section>
}
