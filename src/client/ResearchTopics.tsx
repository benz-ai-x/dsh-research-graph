import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ResearchTopic, ResearchTopicWrite } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import type { LayoutState } from './layout-store.ts'
import { TopicGraph, type TopicGraphContext } from './TopicGraph.tsx'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

/** Owns drafts and durable writes while the topic collection is open. */
export function ResearchTopics({ api, context, add, refresh = 0, t }: {
  readonly api: GraphViewInjected['topics']
  readonly context?: TopicGraphContext
  readonly add?: { readonly sessionId: string; readonly done: () => void }
  readonly refresh?: number
  readonly t: Translate
}): ReactElement {
  const knowledge = useKnowledge()
  const [items, setItems] = useState<readonly ResearchTopic[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [title, setTitle] = useState('')
  const [renames, setRenames] = useState<Record<string, string>>({})
  const [arrangements, setArrangements] = useState<Record<string, LayoutState>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const createAttempt = useRef<{ readonly topicId: string; readonly title: string; readonly rename: boolean }>()
  const writeController = useRef<AbortController>()
  useEffect(() => () => { writeController.current?.abort() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    void api.list(controller.signal).then(value => {
      if (controller.signal.aborted) return
      setItems(value)
      setSelectedId(current => value.some(topic => topic.topicId === current) ? current : value[0]?.topicId ?? '')
      setPhase('ready')
    }, () => { if (!controller.signal.aborted) setPhase('error') })
    return () => { controller.abort() }
  }, [api, revision, refresh])

  const write = async (request: ResearchTopicWrite): Promise<ResearchTopic | undefined> => {
    const controller = new AbortController()
    writeController.current = controller
    setBusy(true)
    setFailed(false)
    try {
      let topic = await api.write(request, controller.signal)
      if (controller.signal.aborted) return undefined
      if (request.kind === 'create' && createAttempt.current?.rename && topic.title !== request.title) {
        topic = await api.write({ kind: 'rename', topicId: topic.topicId, title: request.title }, controller.signal)
        if (controller.signal.aborted) return undefined
      }
      setItems(current => current.some(item => item.topicId === topic.topicId)
        ? current.map(item => item.topicId === topic.topicId ? topic : item) : [...current, topic])
      return topic
    } catch {
      if (!controller.signal.aborted) setFailed(true)
      return undefined
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  const selected = items.find(topic => topic.topicId === selectedId)
  const selectTopic = knowledge?.selectTopic
  useEffect(() => {
    if (context === undefined) return
    selectTopic?.(selected?.topicId)
    return () => { selectTopic?.(undefined) }
  }, [context === undefined, selectTopic, selected?.topicId])
  return <section className={styles.topics} aria-label={t('topic.title')}>
    <p className={styles.topicDescription}>{t('topic.description')}</p>
    {phase === 'loading' ? <p role="status">{t('topic.loading')}</p> : phase === 'error' ? <div role="alert">
      {t('topic.readError')} <button type="button" onClick={() => { setRevision(value => value + 1) }}>{t('topic.retry')}</button>
    </div> : <>
      <form className={styles.topicControls} onSubmit={event => {
        event.preventDefault()
        const previous = createAttempt.current
        const name = title.trim()
        createAttempt.current = {
          topicId: previous?.topicId ?? crypto.randomUUID(), title: name,
          // An edited retry may have saved even if its response failed again.
          rename: previous !== undefined && (previous.rename || previous.title !== name),
        }
        void write({ kind: 'create', topicId: createAttempt.current.topicId, title: name }).then(topic => {
          if (topic === undefined) return
          createAttempt.current = undefined
          setTitle('')
          setSelectedId(topic.topicId)
        })
      }}>
        <label>{t('topic.newName')}<input value={title} maxLength={120} disabled={busy}
          onChange={event => { setTitle(event.target.value) }} /></label>
        <button type="submit" disabled={busy || title.trim() === ''}>{t('topic.create')}</button>
      </form>
      {items.length === 0 ? <p>{t('topic.empty')}</p> : <label className={styles.topicSelection}>{t('topic.choose')}
        <select value={selectedId} disabled={busy} onChange={event => { setSelectedId(event.target.value); setFailed(false) }}>
          {items.map(topic => <option key={topic.topicId} value={topic.topicId}>{topic.title} ({topic.references.length})</option>)}
        </select>
      </label>}
      {selected === undefined ? null : add !== undefined ? <div className={styles.topicControls}>
        <button type="button" disabled={busy} onClick={() => {
          void write({ kind: 'add', topicId: selected.topicId, sessionIds: [add.sessionId] }).then(topic => {
            if (topic !== undefined) add.done()
          })
        }}>{t('topic.addSelected')}</button>
      </div> : <form className={styles.topicControls} onSubmit={event => {
        event.preventDefault()
        void write({ kind: 'rename', topicId: selected.topicId, title: renames[selected.topicId] ?? selected.title })
      }}>
        <label>{t('topic.name')}<input value={renames[selected.topicId] ?? selected.title} maxLength={120} disabled={busy}
          onChange={event => { setRenames(current => ({ ...current, [selected.topicId]: event.target.value })) }} /></label>
        <button type="submit" disabled={busy || (renames[selected.topicId] ?? selected.title).trim() === ''}>{t('topic.rename')}</button>
      </form>}
    </>}
    {busy ? <p role="status">{t('topic.saving')}</p> : null}
    {failed ? <p role="alert">{t('topic.saveError')}</p> : null}
    {context === undefined || selected === undefined ? null : <div className={styles.topicControls}>
      <button type="button" disabled={phase !== 'ready' || busy || arrangements[selected.topicId] === undefined} onClick={() => {
        const arrangement = arrangements[selected.topicId]
        if (arrangement === undefined) return
        void write({ kind: 'arrange', topicId: selected.topicId, arrangement }).then(saved => {
          if (saved === undefined) return
          setArrangements(current => {
            if (current[selected.topicId] !== arrangement) return current
            const next = { ...current }
            delete next[selected.topicId]
            return next
          })
        })
      }}>{t('topic.saveArrangement')}</button>
      <span role="status">{t(arrangements[selected.topicId] === undefined ? 'topic.arrangementHint' : 'topic.unsaved')}</span>
    </div>}
    {phase !== 'ready' || selected === undefined || context === undefined ? null : <TopicGraph key={selected.topicId} topic={selected}
      context={context} arrangement={arrangements[selected.topicId] ?? selected.arrangement}
      onArrange={state => { setArrangements(current => ({ ...current, [selected.topicId]: state })) }}
      remove={sessionId => { void write({ kind: 'remove', topicId: selected.topicId, sessionId }) }} busy={busy} t={t} />}
  </section>
}
