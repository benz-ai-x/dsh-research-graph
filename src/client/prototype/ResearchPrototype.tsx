/** Three throwaway layouts on the existing Graph tab; real data lives in an isolated DSH profile. */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphViewProps } from '../GraphView.tsx'
import type { KnowledgeCard, KnowledgeContent, KnowledgeSave, KnowledgeSource } from '../../knowledge.ts'
import type { ExtractionPreparation } from '../../knowledge-extraction.ts'
import type { ResearchTopic } from '../../research-topic.ts'
import type { ResearchMaterialSelection, ResearchReuseRecord } from '../../research-reuse.ts'
import type { SessionHistoryResult, SessionHistoryTurn } from '../../session-history.ts'
import { SESSION_GRAPH_BUILD_LABEL } from '../build-info.ts'
import { Glyph, VariantA, VariantB, VariantC, type PrototypeNode, type PrototypeEdge } from './PrototypeViews.tsx'
import { useResearchMerge } from './ResearchMerge.tsx'
import styles from './Prototype.module.css'

const VARIANTS = ['A', 'B', 'C'] as const
type Variant = typeof VARIANTS[number]
const NAMES = { A: '图谱工作台', B: '知识书桌', C: '研究路径' }
const KINDS = { conclusion: '结论', method: '方法', hypothesis: '假设', question: '问题' }
const EMPTY: KnowledgeContent = { title: '', conclusion: '', question: '', rationale: '', openQuestions: '', kind: 'conclusion', status: 'draft' }
const latest = (card: KnowledgeCard) => card.revisions[card.revisions.length - 1]!
const date = (value: number): string => new Date(value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
const initialVariant = (): Variant => {
  const key = new URL(location.href).searchParams.get('variant')
  return VARIANTS.find(value => value === key) ?? 'A'
}

export function ResearchPrototype(props: GraphViewProps): ReactElement {
  const sessions = props.useSessions(state => state)
  const workspaces = props.useWorkspaces(state => state).items
  const liveSessions = useRef(sessions)
  liveSessions.current = sessions
  const lifetime = useRef(new AbortController())
  const historyRequest = useRef<AbortController>()
  const [variant, setVariant] = useState<Variant>(initialVariant)
  const [topics, setTopics] = useState<readonly ResearchTopic[]>([])
  const [topicId, setTopicId] = useState<string>()
  const [cards, setCards] = useState<readonly KnowledgeCard[]>([])
  const [records, setRecords] = useState<readonly ResearchReuseRecord[]>([])
  const [selected, setSelected] = useState('')
  const [revisionId, setRevisionId] = useState<string>()
  const [query, setQuery] = useState('')
  const [comparisons, setComparisons] = useState<readonly string[]>([])
  const [pane, setPane] = useState<'inspect' | 'edit' | 'history' | 'compose' | 'extract' | 'merge'>('inspect')
  const [detailOpen, setDetailOpen] = useState(false)
  const [busy, setBusy] = useState('正在读取研究资料…')
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState<KnowledgeSave>()
  const [history, setHistory] = useState<SessionHistoryResult>()
  const [historyTitle, setHistoryTitle] = useState('')
  const [historySource, setHistorySource] = useState<KnowledgeSource>()
  const [historyLoading, setHistoryLoading] = useState(false)
  const [preparation, setPreparation] = useState<ExtractionPreparation>()
  const [materials, setMaterials] = useState<readonly ResearchMaterialSelection[]>([])
  const [question, setQuestion] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [reuseTopicId, setReuseTopicId] = useState<string>()
  const [preview, setPreview] = useState<ResearchReuseRecord>()
  const operationId = useRef(crypto.randomUUID())
  const [showState, setShowState] = useState(false)
  const topic = topics.find(item => item.topicId === topicId)
  const card = cards.find(item => `card:${item.cardId}` === selected)
  const revision = card?.revisions.find(item => item.revisionId === revisionId) ?? (card ? latest(card) : undefined)
  const researchMerge = useResearchMerge(props, topic, async (target, preparation) => {
    if (preparation.topicId) await props.topics.write({ kind: 'add', topicId: preparation.topicId, sessionIds: [...preparation.sources.map(source => source.id), target] }, lifetime.current.signal)
    await refresh()
    if (preparation.topicId) setTopicId(preparation.topicId)
    setSelected(target)
    setQuery('')
    setNotice('汇聚会话已创建，来源与汇聚关系已保留。')
    openHistory(target, `汇聚：${preparation.instruction}`)
  })
  function openMerge(sourceId?: string): void {
    researchMerge.open(sourceId)
    setPane('merge')
    setDetailOpen(true)
  }
  function sessionWorkspace(id: string): string {
    const row = sessions.byId[id as SessionId]
    return workspaces.find(item => item.sessionIds?.includes(id as SessionId))?.title
      ?? workspaces.find(item => item.path === row?.cwd)?.title ?? row?.cwd ?? '来源工作区不可用'
  }

  async function refresh(): Promise<void> {
    const signal = lifetime.current.signal
    const [nextTopics, nextCards] = await Promise.all([props.topics.list(signal), props.knowledge.search({ query: '' }, signal)])
    const ids = new Set([...liveSessions.current.ids, ...nextTopics.flatMap(item => item.references.map(ref => ref.sessionId))])
    const nextRecords = (await Promise.all([...ids].map(sessionId => props.reuse.forSession({ sessionId }, signal)))).flat()
    signal.throwIfAborted()
    setTopics(nextTopics)
    setCards(nextCards)
    setRecords([...new Map(nextRecords.map(item => [item.operationId, item])).values()])
  }
  async function run(label: string, task: () => Promise<void>): Promise<void> {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(label)
    setError('')
    try { await task() } catch (reason) {
      if (!lifetime.current.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
    } finally { busyRef.current = false; setBusy('') }
  }
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    busyRef.current = true
    void refresh().catch(reason => {
      if (!controller.signal.aborted) setError(String(reason))
    }).finally(() => {
      if (!controller.signal.aborted) { busyRef.current = false; setBusy('') }
    })
    return () => { controller.abort(); historyRequest.current?.abort() }
  }, [props.hostId])
  useEffect(() => {
    if (topicId === undefined && topics.length) setTopicId(topics[0]!.topicId)
    const first = cards.find(item => !topicId || item.topicIds.includes(topicId))
    if (topicId !== undefined && !selected && first) setSelected(`card:${first.cardId}`)
  }, [topics, cards, topicId])
  useEffect(() => {
    if (!draft) return
    const protect = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => { window.removeEventListener('beforeunload', protect) }
  }, [draft])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => { setNotice('') }, 5000)
    return () => { window.clearTimeout(timeout) }
  }, [notice])
  function switchVariant(next: Variant): void {
    const url = new URL(location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState(window.history.state, '', url)
    setVariant(next)
  }
  useEffect(() => {
    const key = (event: KeyboardEvent): void => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]') || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      switchVariant(VARIANTS[(VARIANTS.indexOf(variant) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]!)
    }
    const pop = (): void => { setVariant(initialVariant()) }
    window.addEventListener('keydown', key)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('popstate', pop) }
  }, [variant])
  useEffect(() => {
    console.info('[Research prototype layout]', { variant, topicId, selected, pane, comparisons, draft, materials, question, preview })
  }, [variant])

  const accepted = records.filter(item => item.stage === 'accepted')
  const merges = sessions.ids.flatMap(id => {
    const projection = sessions.byId[id]?.projectionValues?.sessionGraphMerge
    return projection ? [{ targetId: id, ...projection }] : []
  })
  const targets = new Set([...accepted.map(item => item.targetSessionId), ...merges.map(item => item.targetId)])
  const scopedCards = cards.filter(item => !topicId || item.topicIds.includes(topicId))
  const referenceIds = new Set(topic ? topic.references.map(ref => ref.sessionId) : sessions.ids)
  for (const item of scopedCards) for (const source of latest(item).sources) referenceIds.add(source.sessionId)
  for (const item of accepted) if (item.materials.some(material => material.kind === 'card' && scopedCards.some(value => value.cardId === material.cardId))) referenceIds.add(item.targetSessionId)
  for (const merge of merges) if (referenceIds.has(merge.targetId) || merge.sources.some(source => referenceIds.has(source.sessionId))) {
    referenceIds.add(merge.targetId)
    for (const source of merge.sources) referenceIds.add(source.sessionId)
  }
  const edges: PrototypeEdge[] = [
    ...merges.flatMap(merge => merge.sources.map(source => ({ from: source.sessionId, to: merge.targetId, kind: 'merge' as const, label: '汇聚' }))),
    ...scopedCards.flatMap(item => latest(item).sources.map(source => ({ from: source.sessionId, to: `card:${item.cardId}`, kind: 'source' as const, label: '提炼自' }))),
    ...accepted.flatMap(item => item.materials.flatMap(material => material.kind === 'card' ? [{ from: `card:${material.cardId}`, to: item.targetSessionId, kind: 'reuse' as const, label: '沿用' }] : [])),
  ]
  const allNodes: PrototypeNode[] = [
    ...[...referenceIds].map(id => {
      const row = sessions.byId[id as SessionId]
      const saved = topic?.references.find(ref => ref.sessionId === id)
      const reuse = accepted.find(item => item.targetSessionId === id)
      const merge = merges.find(item => item.targetId === id)
      return { id, kind: 'session' as const, workspace: sessionWorkspace(id), merged: !!merge, title: reuse?.question ?? row?.displayTitle ?? saved?.title ?? '已保存的讨论来源', summary: merge ? `汇聚 ${merge.sources.length} 个会话 · ${sessionWorkspace(id)}` : reuse ? `沿用 ${reuse.materials.length} 条研究材料` : `打开原文 · ${sessionWorkspace(id)}`, date: row?.updatedAt ?? 0, stage: targets.has(id) ? 2 : 0 }
    }),
    ...scopedCards.map(item => ({ id: `card:${item.cardId}`, kind: 'card' as const, title: latest(item).content.title, summary: latest(item).content.conclusion, date: latest(item).savedAt, stage: latest(item).sources.some(source => targets.has(source.sessionId)) ? 3 : 1 })),
  ]
  const searchText = query.trim().toLocaleLowerCase()
  const nodes = allNodes.filter(node => {
    if (!searchText) return true
    if (node.kind === 'session') return `${node.title} ${node.summary}`.toLocaleLowerCase().includes(searchText)
    const saved = latest(scopedCards.find(item => `card:${item.cardId}` === node.id)!)
    return [saved.content.title, saved.content.question, saved.content.conclusion, saved.content.rationale, saved.content.openQuestions,
      ...saved.sources.flatMap(source => [source.title, ...source.source.turns.flatMap(turn => turn.messages.map(message => message.text))])]
      .join('\n').toLocaleLowerCase().includes(searchText)
  })

  function openHistory(sessionId: string, title: string, source?: KnowledgeSource): void {
    historyRequest.current?.abort()
    const request = new AbortController()
    historyRequest.current = request
    setHistory(undefined)
    setHistoryTitle(title)
    setHistorySource(source)
    setHistoryLoading(true)
    setPane('history')
    setDetailOpen(true)
    setError('')
    void props.readSessionHistory({ sessionId, limit: 10, ...(source ? { source: source.source } : {}) }, request.signal)
      .then(result => { if (!request.signal.aborted) setHistory(result) })
      .catch(reason => { if (!request.signal.aborted) setError(String(reason)) })
      .finally(() => { if (!request.signal.aborted) setHistoryLoading(false) })
  }
  function select(id: string): void {
    setSelected(id)
    setRevisionId(undefined)
    setDetailOpen(true)
    if (id.startsWith('card:')) { historyRequest.current?.abort(); setPane('inspect') }
    else openHistory(id, allNodes.find(node => node.id === id)?.title ?? '研究讨论')
  }
  function startDraft(value?: KnowledgeSave): void {
    if (draft) setNotice('未保存的卡片已保留，请先保存或放弃这份草稿。')
    else setDraft(value ?? { cardId: crypto.randomUUID(), revisionId: crypto.randomUUID(), content: EMPTY, sources: [], ...(topicId ? { topicId } : {}) })
    setPane('edit')
    setDetailOpen(true)
  }
  function changeDraft(field: keyof KnowledgeContent, value: string): void {
    setDraft(current => current ? { ...current, revisionId: crypto.randomUUID(), content: { ...current.content, [field]: value } } : current)
  }
  function capture(turn: SessionHistoryTurn): void {
    if (!history || turn.endSeq === null) return
    const answer = turn.messages.filter(item => item.role === 'assistant').map(item => item.text).join('\n\n')
    const prompt = turn.messages.find(item => item.role === 'user')?.text ?? ''
    startDraft({ cardId: crypto.randomUUID(), revisionId: crypto.randomUUID(), content: { ...EMPTY, title: `${historyTitle} · 新发现`, conclusion: answer || prompt, question: prompt },
      sources: [{ kind: 'discussion', sessionId: history.sessionId, startSeq: turn.startSeq, endSeq: turn.endSeq }], ...(topicId ? { topicId } : {}) })
  }
  function compare(id: string): void {
    if (!comparisons.includes(id) && comparisons.length >= 3) { setNotice('一次最多对照三条知识，先聚焦一个问题。'); return }
    setComparisons(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }
  function compose(ids: readonly string[]): void {
    if (preview) { setPane('compose'); setDetailOpen(true); setNotice('上一次讨论的准备记录仍保留，可继续提交。'); return }
    setMaterials(ids.flatMap(id => {
      const item = cards.find(value => `card:${value.cardId}` === id)
      if (!item) return []
      const chosen = id === selected && revision ? revision : latest(item)
      return [{ kind: 'card' as const, cardId: item.cardId, revisionId: chosen.revisionId }]
    }))
    setQuestion(ids.length > 1 ? '比较这些观点的依据和适用条件，找出可以组合的新思路。' : '')
    setWorkspaceId(workspaces[0]?.workspaceId ?? '')
    setReuseTopicId(topicId)
    operationId.current = crypto.randomUUID()
    setPane('compose')
    setDetailOpen(true)
  }
  async function submit(): Promise<void> {
    if (!preview) return
    let result: ResearchReuseRecord
    try { result = await props.reuse.submit({ operationId: preview.operationId }, lifetime.current.signal) } catch (reason) {
      const recovered = await props.reuse.read({ operationId: preview.operationId }, lifetime.current.signal)
      if (recovered) setPreview(recovered)
      if (recovered?.stage !== 'accepted') throw reason
      result = recovered
    }
    setPreview(result)
    if (result.stage !== 'accepted') throw new Error(result.error ?? 'DSH 尚未接收问题，可以重试当前讨论。')
    if (reuseTopicId) await props.topics.write({ kind: 'add', topicId: reuseTopicId, sessionIds: [result.targetSessionId] }, lifetime.current.signal)
    await refresh()
    setPreview(undefined)
    setMaterials([])
    setComparisons([])
    setNotice('新讨论已创建，沿用关系已回到研究图谱。回答完成后可刷新原文。')
    setSelected(result.targetSessionId)
    openHistory(result.targetSessionId, result.question)
  }

  const back = <div className={styles.backLine}><button className={`${styles.quiet} ${styles.mobileBack}`} type="button" onClick={() => { setDetailOpen(false) }}>← 返回{NAMES[variant]}</button>{pane !== 'inspect' && card ? <button type="button" className={styles.quiet} onClick={() => { setPane('inspect') }}>← 回到知识</button> : null}</div>
  let detail: ReactElement
  if (pane === 'edit' && draft) {
    detail = <div className={styles.detail}>{back}<div className={styles.detailTop}><span className={styles.eyebrow}>留下一个值得再用的想法</span><small className={styles.formHint}>未保存</small></div>
      <label className={styles.field}>标题<input className={styles.titleInput} value={draft.content.title} disabled={!!busy} placeholder="给这个发现起一个清晰的名字" onChange={event => { changeDraft('title', event.target.value) }} /></label>
      <label className={styles.field}>值得留下的内容<textarea rows={7} value={draft.content.conclusion} disabled={!!busy} placeholder="用自己的话留下结论、方法、假设或问题…" onChange={event => { changeDraft('conclusion', event.target.value) }} /></label>
      <p className={styles.formHint}>{draft.sources.length ? `已带上 ${draft.sources.length} 处来源，保存后可以回到对应原文。` : '这是一条独立笔记。也可以从讨论原文创建带来源的知识。'}</p>
      <details><summary>补充背景与待验证事项</summary>
        {([['question', '核心问题'], ['rationale', '依据与适用条件'], ['openQuestions', '待验证事项']] as const).map(([field, label]) => <label className={styles.field} key={field}>{label}<textarea rows={3} disabled={!!busy} value={draft.content[field]} onChange={event => { changeDraft(field, event.target.value) }} /></label>)}
        <label className={styles.field}>内容类型<select disabled={!!busy} value={draft.content.kind} onChange={event => { changeDraft('kind', event.target.value) }}>{Object.entries(KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={styles.field}>核实状态<select disabled={!!busy} value={draft.content.status} onChange={event => { changeDraft('status', event.target.value) }}><option value="draft">待核实</option><option value="confirmed">我已确认</option></select></label>
      </details>
      <div className={styles.pinnedActions}><button className={styles.primary} type="button" disabled={!!busy || !draft.content.title.trim() || !draft.content.conclusion.trim()} onClick={() => { void run('正在保存知识…', async () => {
        const saved = await props.knowledge.save(draft, lifetime.current.signal)
        setCards(current => [...current.filter(item => item.cardId !== saved.cardId), saved])
        setDraft(undefined)
        setQuery('')
        setSelected(`card:${saved.cardId}`)
        setRevisionId(undefined)
        setPane('inspect')
        setNotice('知识已保存，来源和修订记录一起保留。')
        await refresh()
      }) }}>保存知识</button><button type="button" className={styles.quiet} disabled={!!busy} onClick={() => { setDraft(undefined); setPane('inspect') }}>放弃草稿</button></div>
    </div>
  } else if (pane === 'merge') {
    detail = <div className={styles.detail}>{back}{researchMerge.panel}</div>
  } else if (pane === 'history') {
    const sourceRecord = accepted.find(item => item.targetSessionId === history?.sessionId)
    const mergedFrom = merges.find(item => item.targetId === history?.sessionId)
    detail = <div className={styles.detail}>{back}<div className={styles.detailTop}><span className={styles.eyebrow}>{historySource ? '回到知识形成的那一刻' : '讨论原文'}</span></div><h2>{historyTitle}</h2>
      <div className={styles.metadata}><span>{historyLoading ? '正在读取…' : history?.kind === 'excerpt' ? '原会话不可用 · 展示保存时的摘录' : history?.kind === 'original' ? '来自 DSH 原始讨论' : '暂时没有可读取的内容'}</span></div>
      {mergedFrom ? <section className={styles.detailSection}><h3>这次汇聚来自哪些会话</h3><p className={styles.formHint}>使用提交时的会话快照；点击来源可以回看原讨论。</p>{mergedFrom.sources.map(source => <button className={styles.sourceLink} type="button" key={source.sessionId} onClick={() => { select(source.sessionId) }}><Glyph name="session" size={15} /><div><strong>{sessions.byId[source.sessionId as SessionId]?.displayTitle ?? '来源讨论'}</strong><small>{sessionWorkspace(source.sessionId)}</small></div><Glyph name="arrow" size={14} /></button>)}</section> : null}
      {sourceRecord ? <details><summary>这次讨论沿用了哪些知识</summary>{sourceRecord.materials.map((material, index) => material.kind === 'card' ? <p key={index}>{material.content.title} · 第 {material.revisionNumber} 版<br />{material.content.conclusion}</p> : null)}</details> : null}
      {history?.turns.map(turn => <section className={styles.turn} key={turn.startSeq}><div className={styles.turnTitle}><span>第 {turn.turn} 轮</span><span>{date(turn.startedAt)}{turn.endSeq === null ? ' · 进行中' : ''}</span></div>
        {turn.messages.map(message => {
          const reusedPrompt = message.role === 'user' && sourceRecord?.promptText === message.text
          return <div className={styles.message} key={`${message.role}:${message.seq}`}><small>{message.role === 'user' ? '你提出的问题' : 'AI 的回应'}</small><p>{reusedPrompt ? sourceRecord.question : message.text}</p>{reusedPrompt ? <details><summary>本次实际发送的材料</summary><pre>{message.text}</pre></details> : null}</div>
        })}
        {turn.endSeq !== null && history.kind === 'original' ? <div className={styles.messageActions}><button type="button" onClick={() => { capture(turn) }}><Glyph name="card" size={14} />存为知识</button><button type="button" disabled={!!busy} onClick={() => { void run('正在准备原文…', async () => {
          const value = await props.knowledge.prepareExtraction({ source: { kind: 'discussion', sessionId: history.sessionId, startSeq: turn.startSeq, endSeq: turn.endSeq! }, budgetChars: 24000 }, lifetime.current.signal)
          setPreparation(value); setPane('extract')
        }) }}><Glyph name="sparkle" size={14} />AI 整理</button></div> : null}
      </section>)}
      {history && !history.turns.length ? <p className={styles.formHint}>讨论刚刚开始，回答完成后刷新即可阅读。</p> : null}
      {history?.hasEarlier || history?.hasLater ? <p className={styles.formHint}>当前展示所选范围；完整上下文可以在 DSH 会话中阅读。</p> : null}
      <div className={styles.detailActions}>{props.mergeResearchSessions && history?.kind === 'original' ? <button type="button" onClick={() => { openMerge(history.sessionId) }}>与其他会话汇聚</button> : null}<button type="button" onClick={() => { openHistory(history?.sessionId ?? (historySource?.sessionId ?? selected), historyTitle, historySource) }}>刷新原文</button>{history ? <button type="button" onClick={() => { props.openSession(history.sessionId as SessionId) }}>在 DSH 中打开</button> : null}</div>
    </div>
  } else if (pane === 'extract' && preparation) {
    detail = <div className={styles.detail}>{back}<span className={styles.eyebrow}>先看材料，再交给 AI</span><h2>把这段讨论整理成知识</h2><p className={styles.bodyText}>只整理下面已选中的原文。生成后仍由你修改和决定保存。</p>
      <div className={styles.previewBox}><h3>{preparation.included.title}</h3><p>{preparation.included.source.turns.length} 轮讨论 · {preparation.materialText.length} 字符</p><p>{preparation.omitted.length ? `有 ${preparation.omitted.length} 个范围未纳入，生成结果不代表全部讨论。` : '所选原文已完整纳入。'}</p></div>
      <details><summary>查看交给 AI 的原文</summary><pre>{preparation.materialText}</pre></details>
      <p className={styles.formHint}>模型：{preparation.route ? `${preparation.route.provider} / ${preparation.route.model}` : '未配置，请在 DSH 中选择模型'}</p>
      <div className={styles.detailActions}><button type="button" className={styles.primary} disabled={!!busy || !preparation.route || !!draft} onClick={() => { void run('正在整理…', async () => {
        const result = await props.knowledge.extract({ preparationId: preparation.preparationId, ...preparation.route! }, lifetime.current.signal)
        const value = result.drafts[0]
        if (!value) throw new Error('没有生成可用草稿，请返回原文手动保存。')
        startDraft({ cardId: value.cardId, revisionId: value.revisionId, content: value.content, sources: value.sources, ...(topicId ? { topicId } : {}) })
        setNotice(`AI 草稿尚未保存，请核实内容${value.needsVerification || value.invalidCitations ? '和引用' : ''}。${result.drafts.length > 1 ? '本原型先展示第一条草稿。' : ''}`)
      }) }}>生成可编辑草稿</button><button type="button" onClick={() => { setPane('history') }}>返回原文</button></div>{draft ? <p className={styles.formHint}>请先保存或放弃当前卡片草稿。</p> : null}
    </div>
  } else if (pane === 'compose') {
    const chosen = materials.flatMap(material => material.kind === 'card' ? cards.find(item => item.cardId === material.cardId)?.revisions.filter(item => item.revisionId === material.revisionId) ?? [] : [])
    detail = <div className={styles.detail}>{back}<span className={styles.eyebrow}>让已有知识进入新问题</span><h2>{preview ? '确认这次研究的起点' : '接下来，你想弄清什么？'}</h2>
      <div className={styles.selectedMaterials}>{chosen.map(item => <div key={item.revisionId}><Glyph name="card" size={16} /><div><strong>{item.content.title}</strong><small>沿用第 {item.number} 版 · {date(item.savedAt)}</small></div></div>)}</div>
      <label className={styles.field}>新的研究问题<textarea rows={4} placeholder="例如：这个结论在哪些条件下不成立？" value={question} disabled={!!preview || !!busy} onChange={event => { setQuestion(event.target.value); operationId.current = crypto.randomUUID() }} /></label>
      {!preview ? <div className={styles.directions}>{[['找反例', '找出这些观点不成立的条件，提出一个可以检验的反例。'], ['比较依据', '比较这些观点的依据和适用条件，找出可以组合的新思路。'], ['改变假设', '如果规模、约束或使用场景改变，哪些结论需要重新验证？']].map(([label, text]) => <button type="button" key={label} onClick={() => { setQuestion(text!); operationId.current = crypto.randomUUID() }}>{label}</button>)}</div> : null}
      <label className={styles.field}>新讨论的工作区<select value={workspaceId} disabled={!!preview || !!busy} onChange={event => { setWorkspaceId(event.target.value); operationId.current = crypto.randomUUID() }}><option value="" disabled>选择工作区</option>{workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}</select></label>
      <p className={styles.formHint}>{reuseTopicId ? `新讨论会加入「${topics.find(item => item.topicId === reuseTopicId)?.title ?? '当前主题'}」。` : '新讨论将在全部研究中显示。'}所选知识保留当前版本，来源说明随附；原讨论全文不随卡片发送。</p>
      {preview ? <><div className={styles.previewBox}><h3>{preview.stage === 'accepted' ? 'DSH 已接收，继续完成主题关联' : preview.targetCreated ? '讨论已创建，可在同一讨论中重试' : '材料已准备，可以开始'}</h3><p>{preview.materials.length} 条材料 · {preview.promptText.length} 字符<br />{preview.workspace.title}</p></div><details><summary>查看完整发送内容</summary><pre>{preview.promptText}</pre></details></> : null}
      <div className={styles.pinnedActions}>{preview ? <><button className={styles.primary} type="button" disabled={!!busy} onClick={() => { void run('正在创建讨论…', submit) }}>{preview.stage === 'accepted' ? '完成关联' : preview.targetCreated ? '重试当前讨论' : '确认并开始讨论'}<Glyph name="arrow" size={15} /></button>{!preview.targetCreated ? <button type="button" disabled={!!busy} onClick={() => { setPreview(undefined); operationId.current = crypto.randomUUID() }}>修改</button> : null}</> : <button className={styles.primary} type="button" disabled={!!busy || !question.trim() || !workspaceId || materials.length === 0} onClick={() => { void run('正在准备研究材料…', async () => { setPreview(await props.reuse.prepare({ operationId: operationId.current, materials, question, workspaceId }, lifetime.current.signal)) }) }}>预览本次讨论<Glyph name="arrow" size={15} /></button>}</div>
    </div>
  } else if (card && revision) {
    const continuations = accepted.filter(item => item.materials.some(material => material.kind === 'card' && material.cardId === card.cardId))
    detail = <div className={styles.detail}>{back}<div className={styles.detailTop}><span className={styles.eyebrow}>{KINDS[revision.content.kind]} · 知识卡片</span><span className={styles.saved}><Glyph name="check" size={12} />已保存</span></div>
      <h2>{revision.content.title}</h2><div className={styles.metadata}><span>{date(revision.savedAt)}</span><span>第 {revision.number} 版</span><span>{revision.content.status === 'confirmed' ? '你已确认' : '待核实'}</span></div>
      <p className={styles.bodyText}>{revision.content.conclusion}</p>
      <div className={styles.detailActions}><button className={styles.primary} type="button" onClick={() => { compose([selected]) }}>继续讨论<Glyph name="arrow" size={15} /></button><button type="button" onClick={() => { compare(selected) }} aria-pressed={comparisons.includes(selected)}>{comparisons.includes(selected) ? '已加入对照' : '加入对照'}</button><button type="button" className={styles.quiet} onClick={() => { startDraft({ cardId: card.cardId, revisionId: crypto.randomUUID(), content: revision.content, sources: revision.sources.map((_, sourceIndex) => ({ kind: 'revision', cardId: card.cardId, revisionId: revision.revisionId, sourceIndex })) }) }}>编辑</button></div>
      <section className={styles.detailSection}><h3><Glyph name="source" size={13} />这条知识从哪里来</h3>{revision.sources.length ? revision.sources.map((source, index) => <button key={`${source.sessionId}:${index}`} className={styles.sourceLink} type="button" onClick={() => { openHistory(source.sessionId, source.title, source) }}><Glyph name="session" size={15} /><div><strong>{source.title}</strong><small>{source.source.turns.length} 轮原文 · 点击回到对应内容</small></div><Glyph name="arrow" size={14} /></button>) : <p className={styles.formHint}>独立笔记，未关联讨论原文。</p>}</section>
      {revision.content.question ? <details><summary>当时想解决的问题</summary><p>{revision.content.question}</p></details> : null}
      {revision.content.rationale ? <details><summary>依据与适用条件</summary><p>{revision.content.rationale}</p></details> : null}
      {revision.content.openQuestions ? <details><summary>还值得验证</summary><p>{revision.content.openQuestions}</p></details> : null}
      {continuations.length ? <section className={styles.detailSection}><h3>它启发了哪些后续讨论</h3>{continuations.map(item => <button className={styles.sourceLink} key={item.operationId} type="button" onClick={() => { select(item.targetSessionId) }}><Glyph name="path" size={15} /><div><strong>{item.question}</strong><small>已由 DSH 接收 · 保留当时沿用的版本</small></div></button>)}</section> : null}
      {card.revisions.length > 1 ? <details><summary>查看修订记录 · {card.revisions.length} 个版本</summary><label className={styles.field}>阅读版本<select value={revision.revisionId} onChange={event => { setRevisionId(event.target.value) }}>{[...card.revisions].reverse().map(item => <option key={item.revisionId} value={item.revisionId}>第 {item.number} 版 · {date(item.savedAt)}</option>)}</select></label><p>继续讨论会沿用正在阅读的版本；编辑会保存为一个新版本。</p></details> : null}
    </div>
  } else detail = <div className={styles.empty}><Glyph name="card" size={32} /><h3>选择一条知识，打开新的可能</h3><p>读一段讨论，留下你想再次使用的内容。</p><button type="button" onClick={() => { startDraft() }}>写下一个发现</button></div>

  const viewProps = { nodes, edges, selected, comparisons, select, compare, detail, create: () => { startDraft() } }
  return <div className={styles.root} data-detail={detailOpen} data-task={pane} data-conversation-composer-overlay="" data-research-prototype={variant}>
    <header className={styles.topbar}><div className={styles.brand}><span className={styles.brandMark}><Glyph name="graph" /></span><strong>研图<small>体验原型</small></strong></div>
      <label className={styles.topicSelect}><select aria-label="研究主题" value={topicId ?? ''} onChange={event => { setTopicId(event.target.value); setQuery(''); setSelected(''); setPane('inspect'); setDetailOpen(false) }}><option value="">全部研究</option>{topics.map(item => <option key={item.topicId} value={item.topicId}>{item.title}</option>)}</select></label>
      <label className={styles.searchBox}><Glyph name="search" size={15} /><input aria-label="查找知识和讨论" placeholder="查找知识、内容和来源" value={query} onChange={event => { setQuery(event.target.value) }} />{query ? <button className={styles.iconButton} type="button" aria-label="清空搜索" onClick={() => { setQuery('') }}><Glyph name="close" size={12} /></button> : null}</label>
      <div className={styles.topActions}>{props.mergeResearchSessions ? <button type="button" disabled={!!busy} onClick={() => { openMerge() }}><Glyph name="graph" size={14} />汇聚会话</button> : null}<button type="button" className={styles.quiet} disabled={!!busy} onClick={() => { void run('正在刷新…', refresh) }}>刷新</button><button type="button" onClick={() => { startDraft() }}><Glyph name="plus" size={14} />新建卡片</button></div>
    </header>
    <div className={styles.workspaceHeader}><div><h1>{topic?.title ?? '让思考留下来，继续生长'}</h1><p>{searchText ? `找到 ${nodes.length} 项相关内容` : '从讨论中留下知识，带着知识探索下一个问题。'}</p></div><div className={styles.workspaceMeta}><span><strong>{referenceIds.size}</strong>讨论</span><span><strong>{scopedCards.length}</strong>知识</span>{merges.some(item => referenceIds.has(item.targetId)) ? <span><strong>{merges.filter(item => referenceIds.has(item.targetId)).length}</strong>汇聚</span> : null}<span><strong>{edges.filter(edge => edge.kind === 'reuse' && allNodes.some(node => node.id === edge.from)).length}</strong>沿用</span></div></div>
    {error ? <div className={styles.error} role="alert">{error}<button className={styles.quiet} type="button" onClick={() => { setError('') }}>关闭提示</button></div> : null}
    {busy || notice ? <div className={styles.notice} role="status"><span>{busy || notice}</span>{!busy ? <button type="button" className={styles.iconButton} aria-label="关闭提示" onClick={() => { setNotice('') }}><Glyph name="close" size={13} /></button> : null}</div> : null}
    {draft && pane !== 'edit' ? <div className={styles.notice}><span>一份未保存的卡片草稿</span><button type="button" onClick={() => { setPane('edit'); setDetailOpen(true) }}>继续编辑</button></div> : null}
    {preview && pane !== 'compose' ? <div className={styles.notice}><span>本次研究准备已保留</span><button type="button" onClick={() => { setPane('compose'); setDetailOpen(true) }}>继续本次讨论</button></div> : null}
    {comparisons.length ? <div className={styles.comparisonBar}><strong>已选 {comparisons.length} 条知识作为研究材料</strong><button type="button" onClick={() => { setComparisons([]) }}>清空</button><button className={styles.primary} type="button" onClick={() => { compose(comparisons) }}>带着它们继续<Glyph name="arrow" size={14} /></button></div> : null}
    <main className={styles.surface}>{variant === 'A' ? <VariantA {...viewProps} /> : variant === 'B' ? <VariantB {...viewProps} /> : <VariantC {...viewProps} />}</main>
    <div className={styles.switcherRow}><nav className={styles.switcher} aria-label="原型布局切换"><button type="button" aria-label="上一个布局" onClick={() => { switchVariant(VARIANTS[(VARIANTS.indexOf(variant) + 2) % 3]!) }}>←</button><span>PROTOTYPE</span>{VARIANTS.map(key => <button type="button" key={key} aria-pressed={variant === key} onClick={() => { switchVariant(key) }}>{key} · {NAMES[key]}</button>)}<button type="button" aria-label="下一个布局" onClick={() => { switchVariant(VARIANTS[(VARIANTS.indexOf(variant) + 1) % 3]!) }}>→</button></nav><button className={styles.stateButton} type="button" onClick={() => { setShowState(value => !value) }}>体验说明</button></div>
    {showState ? <aside className={styles.statePanel}><h3>真实 DSH 数据 · 演示模型</h3><p className={styles.formHint}>此独立体验环境使用演示回答，不调用付费模型。保存、来源定位和新讨论均由 DSH 处理。切换布局保留当前内容与草稿。</p><pre>{JSON.stringify({ variant, topicId, selected, pane, comparisons, draft, preparation, preview, materials, question, workspaceId, busy, error, merge: researchMerge.state }, null, 2)}</pre><small>{SESSION_GRAPH_BUILD_LABEL}</small><button type="button" onClick={() => { setShowState(false) }}>收起</button></aside> : null}
  </div>
}
