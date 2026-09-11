import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphViewProps } from './GraphView.tsx'
import { useKnowledge } from './Knowledge.tsx'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'

interface MergePreview {
  readonly sources: readonly { readonly id: SessionId; readonly title: string; readonly workspace: string }[]
  readonly instruction: string
  readonly workspaceId: string
  readonly workspaceTitle: string
  readonly cwd: string
  readonly topicId?: string
  readonly topicTitle?: string
}

/** Selection, native capture, and topic association retain one target through retries. */
export function ResearchMerge({ props, visible, close, completed }: {
  readonly props: GraphViewProps
  readonly visible: boolean
  readonly close: () => void
  readonly completed: (target: SessionId, topicId?: string) => void
}): ReactElement | null {
  const { t } = props
  const knowledge = useKnowledge()
  const sessions = props.useSessions(value => value)
  const workspaces = props.useWorkspaces(value => value)
  const [sourceIds, setSourceIds] = useState<readonly SessionId[]>([])
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [instruction, setInstruction] = useState(() => t('workbench.mergeDefault'))
  const [preview, setPreview] = useState<MergePreview>()
  const [targetId, setTargetId] = useState<SessionId>()
  const [captured, setCaptured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController>()
  const submitting = useRef(false)
  useEffect(() => () => { active.current?.abort() }, [])
  const choices = sessions.ids.flatMap(id => {
    const row = sessions.byId[id]
    if (!row || row.blank || !row.cwd?.trim() || row.origin === 'subagent' || workspaces.archivedSessionIds.includes(id)) return []
    const workspace = workspaces.items.find(item => item.sessionIds.includes(id)) ?? workspaces.items.find(item => item.path === row.cwd)
    return [{ id, title: row.displayTitle, workspaceId: workspace?.workspaceId ?? '', workspace: workspace?.title || row.cwd }]
  })
  const selected = sourceIds.flatMap(id => choices.filter(source => source.id === id))
  const destination = workspaces.items.find(item => item.workspaceId === workspaceId)
  const filtered = choices.filter(source => (!filter || source.workspaceId === filter)
    && `${source.title} ${source.workspace}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function choose(id: SessionId): void {
    if (!sourceIds.includes(id) && sourceIds.length >= 3) { setError(t('workbench.mergeLimit')); return }
    setError('')
    setSourceIds(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }
  async function perform(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (submitting.current) return
    submitting.current = true
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    try { await task(controller.signal) } catch (reason) {
      if (reason && typeof reason === 'object' && 'targetSessionId' in reason && typeof reason.targetSessionId === 'string') setTargetId(reason.targetSessionId as SessionId)
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      submitting.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function confirm(): void {
    if (!preview || !props.mergeResearchSessions) return
    const merge = props.mergeResearchSessions
    void perform(async signal => {
      const target = captured && targetId ? targetId : await merge({ sourceIds: preview.sources.map(source => source.id),
        instruction: preview.instruction, workspaceId: preview.workspaceId, ...(targetId ? { targetSessionId: targetId } : {}) }, signal)
      signal.throwIfAborted()
      setTargetId(target)
      setCaptured(true)
      if (preview.topicId) await props.topics.write({ kind: 'add', topicId: preview.topicId, sessionIds: [...preview.sources.map(source => source.id), target] }, signal)
      signal.throwIfAborted()
      completed(target, preview.topicId)
      setPreview(undefined)
      setTargetId(undefined)
      setCaptured(false)
      setSourceIds([])
      close()
    })
  }
  if (!visible) return null
  return <section className={`${styles.knowledgeDialog} ${styles.researchMerge}`} role="dialog" aria-modal="true" aria-label={t('workbench.merge')}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy) close() }
      retainDialogFocus(event)
    }}>
    <header className={styles.searchHeader}><div><span className={styles.workbenchEyebrow}>{t('workbench.topics')}</span>
      <h2>{t(preview ? 'workbench.mergeConfirmTitle' : 'workbench.mergeTitle')}</h2><p>{t('workbench.mergeHint')}</p></div>
      <button type="button" autoFocus disabled={busy} onClick={close} aria-label={t('workbench.mergeClose')}>×</button></header>
    <div className={styles.knowledgeBody}>
      {error ? <div role="alert"><p>{t('workbench.mergeFailure')}</p><p>{error}</p></div> : null}
      {preview ? <>
        <h3>{t('workbench.mergeSources')}</h3>{preview.sources.map(source => <div key={source.id} className={styles.mergeSourceChoice}>
          <strong>{source.title}</strong><small>{source.workspace}</small></div>)}
        <section><h3>{t('workbench.mergeQuestion')}</h3><p className={styles.historyText}>{preview.instruction}</p></section>
        <section><h3>{t('workbench.mergeTarget')}</h3><strong>{preview.workspaceTitle}</strong><p className={styles.searchMeta}>{preview.cwd}</p>
          {preview.topicTitle ? <p>{t('workbench.mergeTopic', { title: preview.topicTitle })}</p> : null}</section>
        <p>{t('workbench.mergeBoundary')}</p>
        <details><summary>{t('workbench.mergeSnapshot')}</summary><p>{t('workbench.mergeSnapshotHint')}</p></details>
      </> : <>
        <div className={styles.readingHeading}><h3>{t('workbench.mergeSources')}</h3><span role="status">{t('workbench.mergeCount', { count: sourceIds.length })}</span></div>
        <div className={styles.mergeFilters}><label>{t('workbench.mergeWorkspaceFilter')}<select value={filter} disabled={busy} onChange={event => { setFilter(event.target.value) }}>
          <option value="">{t('workbench.allWorkspaces')}</option>{workspaces.items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title || item.path}</option>)}</select></label>
          <label>{t('workbench.mergeSearch')}<input value={query} maxLength={200} disabled={busy} onChange={event => { setQuery(event.target.value) }} /></label></div>
        {selected.length ? <div className={styles.mergeSelections}>{selected.map(source => <button type="button" key={source.id} disabled={busy}
          onClick={() => { choose(source.id) }} aria-label={t('workbench.mergeRemove', { title: source.title })}>{source.workspace} · {source.title} ×</button>)}</div> : null}
        <div className={styles.mergeChoices}>{filtered.map(source => <label key={source.id} className={styles.mergeSourceChoice}>
          <input type="checkbox" checked={sourceIds.includes(source.id)} disabled={busy} onChange={() => { choose(source.id) }} />
          <span><strong>{source.title}</strong><small>{source.workspace}</small></span>
        </label>)}{filtered.length ? null : <p>{t('workbench.mergeEmpty')}</p>}</div>
        <label>{t('workbench.mergeQuestion')}<textarea value={instruction} rows={3} maxLength={4000} disabled={busy} onChange={event => { setInstruction(event.target.value) }} /></label>
        <label>{t('workbench.mergeTarget')}<select value={workspaceId} disabled={busy} onChange={event => { setWorkspaceId(event.target.value) }}>
          <option value="">{t('workbench.chooseWorkspace')}</option>{workspaces.items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title || item.path}</option>)}</select></label>
        <p>{t('workbench.mergeLocation')}</p>
      </>}
      <footer className={styles.editorActions}>{preview ? <>
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={confirm}>{t(busy ? 'workbench.mergeBusy' : captured ? 'workbench.mergeAssociate' : targetId ? 'workbench.mergeRetry' : 'workbench.mergeConfirm')}</button>
        {targetId ? null : <button type="button" disabled={busy} onClick={() => { setPreview(undefined) }}>{t('workbench.mergeModify')}</button>}
      </> : <button className={styles.primaryButton} type="button" disabled={busy || !props.mergeResearchSessions || selected.length < 2 || selected.length !== sourceIds.length || !destination || !instruction.trim()}
        onClick={() => { if (destination) void perform(async signal => {
          const topicId = knowledge?.topicId
          const topic = topicId ? (await props.topics.list(signal)).find(item => item.topicId === topicId) : undefined
          signal.throwIfAborted()
          if (topicId && !topic) throw new Error(t('position.topicUnavailable'))
          setPreview({ sources: selected, instruction: instruction.trim(), workspaceId: destination.workspaceId, workspaceTitle: destination.title || destination.path, cwd: destination.path,
            ...(topic ? { topicId: topic.topicId, topicTitle: topic.title } : {}) })
        }) }}>{t('workbench.mergePreview')}</button>}</footer>
    </div>
  </section>
}
