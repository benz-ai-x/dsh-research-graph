/** Cross-workspace selection and confirmation, retained above the three throwaway layouts. */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphViewProps } from '../GraphView.tsx'
import { Glyph } from './PrototypeViews.tsx'
import styles from './Prototype.module.css'

interface SourceChoice {
  readonly id: SessionId
  readonly title: string
  readonly workspaceId: string
  readonly workspaceTitle: string
}

export interface ResearchMergePreview {
  readonly sources: readonly SourceChoice[]
  readonly instruction: string
  readonly workspaceId: string
  readonly workspaceTitle: string
  readonly workspacePath: string
  readonly topicId?: string
  readonly topicTitle?: string
}

export function useResearchMerge(props: GraphViewProps, topic: { readonly topicId: string; readonly title: string } | undefined,
  complete: (target: SessionId, preview: ResearchMergePreview) => Promise<void>): {
    readonly panel: ReactElement
    readonly open: (sourceId?: string) => void
    readonly state: unknown
  } {
  const sessions = props.useSessions(value => value)
  const workspaces = props.useWorkspaces(value => value)
  const [sourceIds, setSourceIds] = useState<readonly SessionId[]>([])
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [instruction, setInstruction] = useState('对照这些讨论的结论、依据和适用条件，保留分歧，提出下一步研究方向。')
  const [preview, setPreview] = useState<ResearchMergePreview>()
  const [targetId, setTargetId] = useState<SessionId>()
  const [captured, setCaptured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(new AbortController())
  const submitting = useRef(false)
  useEffect(() => {
    active.current = new AbortController()
    return () => { active.current.abort() }
  }, [])
  const sources: SourceChoice[] = sessions.ids.flatMap(id => {
    const row = sessions.byId[id]
    if (!row || row.blank || !row.cwd || row.origin === 'subagent' || workspaces.archivedSessionIds?.includes(id)) return []
    const workspace = workspaces.items.find(item => item.sessionIds?.includes(id)) ?? workspaces.items.find(item => item.path === row.cwd)
    return [{ id, title: row.displayTitle, workspaceId: workspace?.workspaceId ?? '', workspaceTitle: workspace?.title || row.cwd }]
  })
  const selected = sourceIds.flatMap(id => sources.filter(source => source.id === id))
  const destination = workspaces.items.find(item => item.workspaceId === workspaceId)
  const visible = sources.filter(source => (!filter || source.workspaceId === filter)
    && `${source.title} ${source.workspaceTitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  function choose(id: SessionId): void {
    setError('')
    if (!sourceIds.includes(id) && sourceIds.length >= 3) { setError('一次最多汇聚 3 个会话。'); return }
    setSourceIds(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])
  }
  async function submit(): Promise<void> {
    if (!preview || !props.mergeResearchSessions || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const target = captured && targetId ? targetId : await props.mergeResearchSessions({ sourceIds: preview.sources.map(source => source.id),
        instruction: preview.instruction, workspaceId: preview.workspaceId, ...(targetId ? { targetSessionId: targetId } : {}) }, active.current.signal)
      setTargetId(target)
      setCaptured(true)
      await complete(target, preview)
      setPreview(undefined)
      setTargetId(undefined)
      setCaptured(false)
      setSourceIds([])
    } catch (reason) {
      if (reason && typeof reason === 'object' && 'targetSessionId' in reason && typeof reason.targetSessionId === 'string') setTargetId(reason.targetSessionId as SessionId)
      if (!active.current.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally { submitting.current = false; setBusy(false) }
  }
  const panel = <div className={styles.mergeBody}>
    <span className={styles.eyebrow}>跨工作区研究</span><h2>{preview ? '确认这次会话汇聚' : '让不同工作区的思考相遇'}</h2>
    <p className={styles.formHint}>选择 2–3 个会话，带着各自的讨论继续研究。</p>
    {error ? <p role="alert" className={styles.mergeError}>{error}</p> : null}
    {preview ? <>
      <section className={styles.detailSection}><h3>这些讨论将进入新会话</h3>{preview.sources.map(source => <div className={styles.mergeSource} key={source.id}>
        <Glyph name="session" size={16} /><div><strong>{source.title}</strong><small>{source.workspaceTitle}</small></div>
      </div>)}</section>
      <section className={styles.detailSection}><h3>这次希望解决的问题</h3><p>{preview.instruction}</p></section>
      <section className={styles.detailSection}><h3>新会话的位置</h3><strong>{preview.workspaceTitle}</strong><p className={styles.formHint}>{preview.workspacePath}</p>
        <p className={styles.formHint}>{preview.topicTitle ? `来源和新会话会一起显示在「${preview.topicTitle}」。` : '新会话和汇聚关系可在全部研究中查看。'}</p></section>
      <p className={styles.formHint}>确认时读取各来源的会话快照，后续更新不会改写本次汇聚。项目文件与执行环境使用「{preview.workspaceTitle}」。</p>
      <details><summary>会话快照包含什么</summary><p className={styles.formHint}>由 DSH 提供讨论文字与已有压缩摘要，长会话按上下文预算处理；来源工作区的文件、工具结果和运行环境不会合并。</p></details>
    </> : <>
      <section className={styles.detailSection}><h3>1 · 选择来源会话 <small>已选 {sourceIds.length} / 3</small></h3>
        <div className={styles.mergeFilters}><label className={styles.field}>来源工作区<select value={filter} onChange={event => { setFilter(event.target.value) }}>
          <option value="">全部工作区</option>{workspaces.items.map(workspace => <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title}</option>)}</select></label>
          <label className={styles.field}>查找来源会话<input value={query} onChange={event => { setQuery(event.target.value) }} placeholder="会话标题或工作区" /></label></div>
        {selected.length ? <div className={styles.mergeSelections}>{selected.map(source => <button type="button" key={source.id} onClick={() => { choose(source.id) }} aria-label={`移除来源 ${source.title}`}>{source.workspaceTitle} · {source.title}<Glyph name="close" size={12} /></button>)}</div> : null}
        <div className={styles.mergeChoices}>{visible.map(source => <label key={source.id} className={styles.mergeChoice}>
          <input type="checkbox" checked={sourceIds.includes(source.id)} onChange={() => { choose(source.id) }} /><span><strong>{source.title}</strong><small>{source.workspaceTitle}</small></span>
        </label>)}{!visible.length ? <p className={styles.formHint}>没有匹配的可用会话。可以切换工作区或调整关键词。</p> : null}</div>
      </section>
      <label className={styles.field}>2 · 希望汇聚解决什么<textarea rows={3} value={instruction} maxLength={4000} onChange={event => { setInstruction(event.target.value) }} /></label>
      <label className={styles.field}>3 · 新会话放在哪里<select value={workspaceId} onChange={event => { setWorkspaceId(event.target.value) }}>
        <option value="">选择目标工作区</option>{workspaces.items.map(workspace => <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title}</option>)}</select></label>
      <p className={styles.formHint}>可以放在任一来源工作区，也可以选择单独的研究工作区。来源会话继续保留在各自的位置。</p>
    </>}
    <div className={styles.pinnedActions}>{preview ? <>
      <button className={styles.primary} type="button" disabled={busy} onClick={() => { void submit() }}>{busy ? '正在汇聚…' : captured ? '完成研究关联' : targetId ? '重试当前汇聚' : '确认汇聚并创建会话'}<Glyph name="arrow" size={15} /></button>
      {!targetId ? <button type="button" disabled={busy} onClick={() => { setPreview(undefined) }}>修改</button> : null}
    </> : <button className={styles.primary} type="button" disabled={!props.mergeResearchSessions || selected.length < 2 || selected.length !== sourceIds.length || !destination || !instruction.trim()}
      onClick={() => { if (destination) { setError(''); setPreview({ sources: selected, instruction: instruction.trim(), workspaceId: destination.workspaceId,
        workspaceTitle: destination.title, workspacePath: destination.path, ...(topic ? { topicId: topic.topicId, topicTitle: topic.title } : {}) }) } }}>预览汇聚<Glyph name="arrow" size={15} /></button>}</div>
  </div>
  return { panel, open: sourceId => { if (sourceId && !preview && !sourceIds.includes(sourceId as SessionId) && sourceIds.length < 3 && sources.some(source => source.id === sourceId)) setSourceIds(value => [...value, sourceId as SessionId]) },
    state: { sourceIds, workspaceId, instruction, preview, targetId, captured, busy, error } }
}
