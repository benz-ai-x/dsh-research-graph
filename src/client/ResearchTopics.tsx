import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { ResearchTopic, ResearchTopicWrite } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { loadLayout, saveLayout, type LayoutState } from './layout-store.ts'
import { KnowledgeLibrary } from './KnowledgeLibrary.tsx'
import { ActionMenu } from './ActionMenu.tsx'
import { TopicGraph, type TopicGraphContext } from './TopicGraph.tsx'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'
import { loadWorkingPosition, saveWorkingPosition, workingPositionKey } from './working-position.ts'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

/** Owns drafts and durable writes while the topic collection is open. */
export function ResearchTopics({ api, context, add, scopeControl, contextTools, refresh = 0, view = 'graph', t }: {
  readonly api: GraphViewInjected['topics']
  readonly context?: TopicGraphContext
  readonly add?: { readonly sessionId: string; readonly done: () => void }
  readonly scopeControl?: ReactNode
  readonly contextTools?: ReactNode
  readonly refresh?: number
  readonly view?: 'graph' | 'reading'
  readonly t: Translate
}): ReactElement {
  const knowledge = useKnowledge()
  const menuButton = useRef<HTMLButtonElement>(null)
  const [items, setItems] = useState<readonly ResearchTopic[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  const [remembered] = useState(() => loadWorkingPosition(context?.workingKey).topicId)
  const [selectedId, setSelectedId] = useState(remembered ?? '')
  const [unavailable, setUnavailable] = useState(false)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
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
      setSelectedId(current => {
        if (value.some(topic => topic.topicId === current)) return current
        if (current !== '' || remembered !== undefined) {
          setUnavailable(true)
          return ''
        }
        return value[0]?.topicId ?? ''
      })
      setPhase('ready')
    }, () => { if (!controller.signal.aborted) setPhase('error') })
    return () => { controller.abort() }
  }, [api, revision, refresh])
  useEffect(() => {
    if (phase === 'ready') saveWorkingPosition(context?.workingKey, { topicId: selectedId })
  }, [context?.workingKey, phase, selectedId])

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
  const closeEditor = (): void => {
    setCreating(false)
    setRenaming(false)
    menuButton.current?.focus({ preventScroll: true })
  }
  const selected = items.find(topic => topic.topicId === selectedId)
  const arrangementKey = context === undefined ? undefined : workingPositionKey(context.actions.hostId, context.workingKey, selectedId)
  const draftArrangement = arrangements[selectedId] ?? (arrangementKey === undefined ? undefined : loadLayout(arrangementKey))
  const selectTopic = knowledge?.selectTopic
  useEffect(() => {
    if (context === undefined) return
    selectTopic?.(selected?.topicId)
    return () => { selectTopic?.(undefined) }
  }, [context === undefined, selectTopic, selected?.topicId])
  const arrangementControls = view === 'reading' || context === undefined || selected === undefined || draftArrangement === undefined ? null : <div className={styles.arrangementStatus}>
      <button className={styles.primaryButton} type="button" disabled={phase !== 'ready' || busy} onClick={event => {
        const button = event.currentTarget
        const arrangement = draftArrangement
        void write({ kind: 'arrange', topicId: selected.topicId, arrangement }).then(saved => {
          if (saved === undefined) return
          if (document.activeElement === button) menuButton.current?.focus({ preventScroll: true })
          if (arrangementKey !== undefined && JSON.stringify(loadLayout(arrangementKey)) === JSON.stringify(arrangement)) {
            try { localStorage.removeItem(`dsh.session-graph.layout.${arrangementKey}`) } catch { /* presentation storage may be denied */ }
          }
          setArrangements(current => {
            if (current[selected.topicId] !== undefined && current[selected.topicId] !== arrangement) return current
            const next = { ...current }
            delete next[selected.topicId]
            return next
          })
        })
      }}>{t('topic.saveArrangement')}</button>
      <span role="status">{t('topic.unsaved')}</span>
    </div>
  return <section className={`${styles.topics} ${scopeControl === undefined ? '' : styles.workbenchTopics}`} aria-label={t('topic.title')}>
    {scopeControl === undefined ? <p className={styles.topicDescription}>{t('topic.description')}</p> : null}
    <div className={scopeControl === undefined ? styles.topicToolbar : styles.researchContext}>
      <div className={scopeControl === undefined ? styles.topicScope : styles.contextScope}>
        {scopeControl}
        {scopeControl === undefined ? null : <span className={styles.contextDivider} aria-hidden="true">/</span>}
        {items.length === 0 ? null : <label className={styles.topicSelection}>
          {scopeControl === undefined ? t('topic.choose') : null}<select aria-label={t('topic.choose')} value={selectedId} disabled={busy || phase !== 'ready'}
            onChange={event => { setSelectedId(event.target.value); setRenaming(false); setFailed(false); setUnavailable(false) }}>
            <option value="">{t('topic.choose')}</option>
            {items.map(topic => <option key={topic.topicId} value={topic.topicId}>{topic.title} ({topic.references.length})</option>)}
          </select></label>}
        {phase !== 'ready' || items.length === 0 ? null : <ActionMenu label={t('reading.topicOptions')} triggerRef={menuButton} iconOnly>
          <button type="button" disabled={busy} aria-expanded={creating} onClick={() => { setCreating(value => !value); setRenaming(false) }}>{t('topic.new')}</button>
          {selected === undefined || add !== undefined ? null : <button type="button" disabled={busy} aria-expanded={renaming}
            onClick={() => { setRenaming(value => !value); setCreating(false) }}>{t('topic.rename')}</button>}
          <p>{t('topic.description')}</p>
        </ActionMenu>}
        {arrangementControls}
      </div>
      {contextTools}
    </div>
    {unavailable ? <p role="status">{t('position.topicUnavailable')}</p> : null}
    {phase === 'loading' ? <p role="status">{t('topic.loading')}</p> : phase === 'error' ? <div role="alert">
      {t('topic.readError')} <button type="button" onClick={() => { setRevision(value => value + 1) }}>{t('topic.retry')}</button>
    </div> : <>
      {items.length !== 0 && !creating ? null : <form className={styles.topicControls} onSubmit={event => {
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
          closeEditor()
          setSelectedId(topic.topicId)
        })
      }}>
        <label>{t('topic.newName')}<input autoFocus value={title} maxLength={120} disabled={busy}
          onChange={event => { setTitle(event.target.value) }} /></label>
        <button type="submit" disabled={busy || title.trim() === ''}>{t('topic.create')}</button>
        {items.length === 0 ? null : <button type="button" disabled={busy} onClick={closeEditor}>{t('reading.cancel')}</button>}
      </form>}
      {items.length === 0 ? <p>{t('topic.empty')}</p> : null}
      {selected === undefined ? null : add !== undefined ? <div className={styles.topicControls}>
        <button type="button" disabled={busy} onClick={() => {
          void write({ kind: 'add', topicId: selected.topicId, sessionIds: [add.sessionId] }).then(topic => {
            if (topic !== undefined) add.done()
          })
        }}>{t('topic.addSelected')}</button>
      </div> : !renaming ? null : <form className={styles.topicControls} onSubmit={event => {
        event.preventDefault()
        void write({ kind: 'rename', topicId: selected.topicId, title: renames[selected.topicId] ?? selected.title }).then(saved => { if (saved !== undefined) closeEditor() })
      }}>
        <label>{t('topic.name')}<input autoFocus value={renames[selected.topicId] ?? selected.title} maxLength={120} disabled={busy}
          onChange={event => { setRenames(current => ({ ...current, [selected.topicId]: event.target.value })) }} /></label>
        <button type="submit" disabled={busy || (renames[selected.topicId] ?? selected.title).trim() === ''}>{t('topic.applyName')}</button>
        <button type="button" disabled={busy} onClick={closeEditor}>{t('reading.cancel')}</button>
      </form>}
    </>}
    {busy ? <p role="status">{t('topic.saving')}</p> : null}
    {failed ? <p role="alert">{t('topic.saveError')}</p> : null}
    {phase !== 'ready' || selected === undefined || context === undefined ? null : view === 'reading' ? <KnowledgeLibrary key={selected.topicId} workingKey={arrangementKey!} actions={context.actions} t={t} /> : <TopicGraph key={selected.topicId} topic={selected}
      context={context} arrangement={draftArrangement ?? selected.arrangement}
      onArrange={state => {
        if (arrangementKey !== undefined) saveLayout(arrangementKey, state)
        setArrangements(current => ({ ...current, [selected.topicId]: state }))
      }}
      remove={sessionId => { void write({ kind: 'remove', topicId: selected.topicId, sessionId }) }} busy={busy} t={t} />}
  </section>
}
