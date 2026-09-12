import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResearchMaterialSelection, ResearchReuseRecord } from '../research-reuse.ts'
import type { ResearchReuseApi } from './research-reuse-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import { SourcePreview } from './SourcePreview.tsx'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
type ReuseMode = 'compose' | 'history'
interface MaterialEntry { readonly selection: ResearchMaterialSelection; readonly label: string }
interface ReuseContextValue {
  readonly relationApi: Pick<ResearchReuseApi, 'relations'>
  readonly refresh: number
  readonly inspect: (operationId: string) => void
  readonly continueWith: (selection: ResearchMaterialSelection, label: string) => void
  readonly add: (selection: ResearchMaterialSelection, label: string) => void
  readonly contains: (selection: ResearchMaterialSelection) => boolean
  readonly count: number
  readonly open: () => void
  readonly history: () => void
}
const ReuseContext = createContext<ReuseContextValue | undefined>(undefined)
export function useResearchReuse(): ReuseContextValue | undefined { return useContext(ReuseContext) }

export function ResearchReuseEntry({ t, compact = false }: { readonly t: Translate; readonly compact?: boolean }): ReactElement | null {
  const reuse = useResearchReuse()
  return reuse === undefined ? null : <>
    <button type="button" className={styles.searchEntry} onClick={reuse.open}>{t('reuse.materials', { count: reuse.count })}</button>
    {compact ? null : <button type="button" className={styles.searchEntry} onClick={reuse.history}>{t('reuse.history')}</button>}
  </>
}

/** Keeps the draft and uncertain attempt alive while its dialogs are closed. */
export function ResearchReuseProvider({ api, workspaces, viewedId, openSession, children, picker, stayInResearch = false, t }: {
  readonly stayInResearch?: boolean
  readonly api: ResearchReuseApi
  readonly workspaces: readonly WorkspaceView[]
  readonly viewedId: SessionId
  readonly openSession: (id: SessionId) => void
  readonly picker?: ReactNode
  readonly children: ReactNode
  readonly t: Translate
}): ReactElement {
  const [refresh, setRefresh] = useState(0)
  const [picking, setPicking] = useState(false)
  const [materials, setMaterials] = useState<readonly MaterialEntry[]>([])
  const [mode, setMode] = useState<ReuseMode>()
  const [question, setQuestion] = useState('')
  const [promptChoice, setPromptChoice] = useState<string>()
  const [workspaceId, setWorkspaceId] = useState('')
  const [preview, setPreview] = useState<ResearchReuseRecord>()
  const [uncertain, setUncertain] = useState(false)
  const [records, setRecords] = useState<readonly ResearchReuseRecord[]>()
  const [notice, setNotice] = useState<SessionGraphKey>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string>()
  const attempt = useRef<{ readonly payload: string; readonly operationId: string }>()
  const active = useRef<AbortController>()
  const trigger = useRef<HTMLElement>()
  useEffect(() => () => { active.current?.abort() }, [])
  const show = (next: ReuseMode): void => {
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement
    setFailed(undefined)
    setNotice(undefined)
    setMode(next)
    setPicking(false)
    if (next === 'compose' && uncertain && preview !== undefined) {
      void perform(signal => recover(preview, signal, 'compose', false))
    }
  }
  const close = (): void => {
    active.current?.abort()
    setBusy(false)
    setMode(undefined)
    setNotice(undefined)
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
  const receive = (saved: ResearchReuseRecord, destination: ReuseMode, navigate: boolean): void => {
    if (destination === 'history') setRecords(value => value?.map(item => item.operationId === saved.operationId ? saved : item))
    else { setPreview(saved); setUncertain(false) }
    if (saved.stage !== 'accepted') setFailed(saved.error ?? t('reuse.error'))
    else {
      setFailed(undefined)
      if (destination === 'compose') setNotice('reuse.sent')
      setRefresh(value => value + 1)
      if (navigate && !stayInResearch) openSession(saved.targetSessionId as SessionId)
    }
  }
  const recover = async (record: ResearchReuseRecord, signal: AbortSignal, destination: ReuseMode, navigate: boolean): Promise<void> => {
    const saved = await api.read({ operationId: record.operationId }, signal)
    if (signal.aborted) return
    if (saved === null) throw new Error(t('reuse.recoveryUnavailable'))
    receive(saved, destination, navigate)
  }
  const submit = (record: ResearchReuseRecord): void => {
    const destination = mode ?? 'compose'
    if (destination === 'compose') setUncertain(true)
    void perform(async signal => {
      let saved: ResearchReuseRecord
      try { saved = await api.submit({ operationId: record.operationId }, signal) } catch {
        signal.throwIfAborted()
        await recover(record, signal, destination, destination === 'compose')
        return
      }
      if (!signal.aborted) receive(saved, destination, destination === 'compose')
    })
  }
  const locked = busy || uncertain || preview?.targetCreated === true
  const add = (selection: ResearchMaterialSelection, label: string): void => {
    if (uncertain) { setNotice('reuse.uncertain'); return }
    if (busy) return
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
  const inspect = (operationId: string): void => {
    show('history')
    setRecords(undefined)
    void perform(async signal => {
      const record = await api.read({ operationId }, signal)
      if (!signal.aborted) {
        if (record === null) throw new Error(t('reuse.recoveryUnavailable'))
        setRecords([record])
      }
    })
  }
  return <ReuseContext.Provider value={{ relationApi: api, add, refresh, inspect, continueWith: (selection, label) => { show('compose'); add(selection, label) }, contains: selection => materials.some(item => JSON.stringify(item.selection) === JSON.stringify(selection)), count: materials.length, open: () => { show('compose') }, history }}>
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
          {picker === undefined ? null : <div className={styles.topicControls}><button type="button" className={styles.primaryButton} disabled={locked || !picking && materials.length >= 3}
            onClick={() => { setPicking(value => !value) }}>{t(picking ? 'reuse.donePicking' : 'reuse.pick')}</button>
            <span role="status">{t('reuse.materials', { count: materials.length })}</span></div>}
          {picking ? picker : null}
          {materials.length === 0 ? <p role="status">{t('reuse.empty')}</p> : <ol className={styles.materialList}>{materials.map((item, index) => <li key={JSON.stringify(item.selection)}>
            <strong>{item.label}</strong>
            <button type="button" disabled={locked || index === 0} onClick={() => { move(index, -1) }}>{t('reuse.up')}</button>
            <button type="button" disabled={locked || index === materials.length - 1} onClick={() => { move(index, 1) }}>{t('reuse.down')}</button>
            <button type="button" disabled={locked} onClick={() => { change(); setMaterials(value => value.filter((_, i) => i !== index)) }}>{t('reuse.remove')}</button>
          </li>)}</ol>}
          <fieldset className={styles.promptChoices} disabled={locked}>
            <legend>{t('prompt.label')}</legend>
            {(['counterexample', 'alternative', 'assumption', 'followup'] as const).map(kind => <button type="button" key={kind} onClick={() => {
              const text = t(`prompt.text.${kind}`)
              if (question.trim() !== '') setPromptChoice(text)
              else { change(); setQuestion(text); setPromptChoice(undefined) }
            }}>{t(`prompt.${kind}`)}</button>)}
          </fieldset>
          {promptChoice === undefined ? null : <section className={styles.promptPreview} aria-label={t('prompt.replace')}>
            <p>{t('prompt.replace')}</p><p>{promptChoice}</p>
            <button type="button" disabled={locked} onClick={() => { change(); setQuestion(promptChoice); setPromptChoice(undefined) }}>{t('prompt.apply')}</button>
            <button type="button" disabled={locked || question.length + promptChoice.length + 2 > 4000} onClick={() => {
              change(); setQuestion(value => `${value}\n\n${promptChoice}`); setPromptChoice(undefined)
            }}>{t('prompt.append')}</button>
            <button type="button" onClick={() => { setPromptChoice(undefined) }}>{t('prompt.keep')}</button>
          </section>}
          <label>{t('reuse.question')}<textarea value={question} disabled={locked} maxLength={4000} rows={3}
            onChange={event => { change(); setQuestion(event.target.value) }} /></label>
          <label>{t('reuse.workspace')}<select value={workspaceId} disabled={locked} onChange={event => { change(); setWorkspaceId(event.target.value) }}>
            <option value="">{t('reuse.chooseWorkspace')}</option>{workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title || item.path}</option>)}
          </select></label>
          <button className={styles.primaryButton} type="button" disabled={locked || materials.length < 1 || materials.length > 3 || question.trim() === '' || !workspaces.some(item => item.workspaceId === workspaceId)}
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
            {uncertain ? <div role="status"><p>{t('reuse.uncertain')}</p><p>{preview.targetSessionId}</p>
              <button type="button" disabled={busy} onClick={() => {
                void perform(signal => recover(preview, signal, 'compose', false))
              }}>{t('reuse.recover')}</button></div> : null}
            {preview.stage === 'accepted' ? null : <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => { submit(preview) }}>
              {t(!uncertain && preview.error === undefined ? 'reuse.confirm' : 'reuse.retry')}</button>}
            {preview.stage === 'accepted' ? <button type="button" onClick={() => {
              setMaterials([]); setQuestion(''); setPromptChoice(undefined); setPreview(undefined); setUncertain(false); setNotice(undefined); setPicking(true); attempt.current = undefined
            }}>{t('workbench.newResearch')}</button> : null}
            {preview.targetCreated ? <button type="button" onClick={() => { openSession(preview.targetSessionId as SessionId) }}>{t('reuse.open')}</button> : null}
          </>}
        </> : <>
          {records?.length === 0 ? <p>{t('reuse.noHistory')}</p> : records?.map(record => <section key={record.operationId}>
            <ResearchReuseSnapshot record={record} t={t} />
            {record.targetCreated ? <button type="button" onClick={() => { openSession(record.targetSessionId as SessionId) }}>{t('reuse.open')}</button> : null}
            {record.stage === 'accepted' ? null : <button type="button" disabled={busy} onClick={() => { submit(record) }}>{t('reuse.retry')}</button>}
          </section>)}
          {failed === undefined ? null : <button type="button" disabled={busy} onClick={history}>{t('reuse.retryHistory')}</button>}
        </>}
        {notice === undefined ? null : <p role="status">{t(notice)}</p>}
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
        : `${material.source.title} · ${t('workbench.sourceTurns', { first: material.source.source.turns[0]?.turn, last: material.source.source.turns.at(-1)?.turn })}`} → {t('workbench.next')}
    </li>)}</ul><p>{t('reuse.answer')}</p></> : <p>{t('reuse.pending')}</p>}
    <h4>{t('reuse.question')}</h4><p className={styles.historyText}>{record.question}</p>
    {record.materials.map((material, index) => <section key={index} className={styles.materialCard}>
      <p>{index + 1}. {t(material.kind === 'card' ? 'knowledge.title' : 'knowledge.discussions')}</p>
      {material.kind === 'turn' ? <SourcePreview source={material.source} t={t} /> : <>
        <h4>{material.content.title}</h4><p>{t('knowledge.versionNumber', { number: material.revisionNumber })} · {t(`knowledge.status.${material.content.status}`)} · {t(`knowledge.kind.${material.content.kind}`)}</p>
        {(['question', 'conclusion', 'rationale', 'openQuestions'] as const).map(field => material.content[field] === '' ? null : <section key={field}>
          <h5>{t(`knowledge.field.${field}`)}</h5><p className={styles.historyText}>{material.content[field]}</p>
        </section>)}
        <p>{t('reuse.sourceLabels')}</p><ul>{material.sources.map((source, i) => <li key={i}>{source.title}</li>)}</ul>
      </>}
    </section>)}
    <details><summary>{t('knowledge.exactPayload')}</summary><pre className={styles.historyText}>{record.promptText}</pre></details>
  </section>
}
