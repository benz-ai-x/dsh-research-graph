import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { KnowledgeCard, KnowledgeContent, KnowledgeDiscussionAddress, KnowledgeSave, KnowledgeSourceAddress } from '../knowledge.ts'
import type { ResearchTopic } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import { SessionHistory } from './SessionHistory.tsx'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
interface KnowledgeContextValue {
  readonly api: KnowledgeApi
  readonly refresh: number
  readonly topicId: string | undefined
  readonly selectTopic: (topicId: string | undefined) => void
  readonly create: (source?: KnowledgeDiscussionAddress) => void
  readonly open: (cardId: string) => void
}
const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined)
export function useKnowledge(): KnowledgeContextValue | undefined { return useContext(KnowledgeContext) }

/** Owns explicit card dialogs; source readers only supply an address, never authoritative text. */
export function KnowledgeProvider({ api, topics, read, t, children }: {
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: Translate
  readonly children: ReactNode
}): ReactElement {
  const [dialog, setDialog] = useState<{ readonly cardId?: string; readonly source?: KnowledgeDiscussionAddress }>()
  const [refresh, setRefresh] = useState(0)
  const [topicId, selectTopic] = useState<string>()
  const trigger = useRef<HTMLElement>()
  const open = (value: NonNullable<typeof dialog>): void => {
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement
    setDialog(value)
  }
  const close = (): void => {
    setDialog(undefined)
    queueMicrotask(() => { trigger.current?.focus() })
  }
  return <KnowledgeContext.Provider value={{ api, refresh, topicId, selectTopic,
    create: source => { open(source === undefined ? {} : { source }) }, open: cardId => { open({ cardId }) } }}>
    <div className={styles.knowledgeRoot} aria-hidden={dialog !== undefined || undefined}
      ref={element => { if (element !== null) element.inert = dialog !== undefined }}>{children}</div>
    {dialog === undefined ? null : <section className={styles.knowledgeDialog} role="dialog" aria-modal="true" aria-label={t('knowledge.title')}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); close() }
        retainDialogFocus(event)
      }}>
      <div className={styles.searchHeader}><h2>{t('knowledge.title')}</h2><button type="button" autoFocus onClick={close}>{t('knowledge.close')}</button></div>
      <KnowledgeEditor key={dialog.cardId ?? 'new'} cardId={dialog.cardId} source={dialog.source} topicId={topicId}
        api={api} topics={topics} read={read} t={t} close={close} changed={() => { setRefresh(value => value + 1) }} />
    </section>}
  </KnowledgeContext.Provider>
}

const EMPTY_CONTENT: KnowledgeContent = {
  title: '', question: '', conclusion: '', rationale: '', openQuestions: '', kind: 'conclusion', status: 'draft',
}
const TEXT_FIELDS = ['title', 'question', 'conclusion', 'rationale', 'openQuestions'] as const

function KnowledgeEditor({ cardId, source, topicId, api, topics, read, close, changed, t }: {
  readonly cardId: string | undefined
  readonly source: KnowledgeDiscussionAddress | undefined
  readonly topicId: string | undefined
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly close: () => void
  readonly changed: () => void
  readonly t: Translate
}): ReactElement {
  const [identity] = useState(() => cardId ?? crypto.randomUUID())
  const [card, setCard] = useState<KnowledgeCard>()
  const [version, setVersion] = useState('')
  const [content, setContent] = useState<KnowledgeContent>(EMPTY_CONTENT)
  const [sources, setSources] = useState<readonly KnowledgeSourceAddress[]>(source === undefined ? [] : [source])
  const [selectedTopic, setSelectedTopic] = useState(topicId ?? '')
  const [topicList, setTopicList] = useState<readonly ResearchTopic[]>([])
  const [topicError, setTopicError] = useState(false)
  const [editing, setEditing] = useState(cardId === undefined)
  const [loading, setLoading] = useState(cardId !== undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [reading, setReading] = useState<number>()
  const attempt = useRef<{ readonly payload: string; readonly revisionId: string }>()
  const write = useRef<AbortController>()
  useEffect(() => () => { write.current?.abort() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setTopicError(false)
    void topics.list(controller.signal).then(value => {
      if (!controller.signal.aborted) setTopicList(value)
    }, () => { if (!controller.signal.aborted) setTopicError(true) })
    if (cardId !== undefined) {
      setLoading(true)
      setFailed(false)
      void api.read({ cardId }, controller.signal).then(value => {
        if (controller.signal.aborted) return
        if (value === null) throw new Error('Card unavailable')
        setCard(value)
        setVersion(value.revisions.at(-1)!.revisionId)
      }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => { controller.abort() }
  }, [api, topics, cardId, reload])
  const revision = card?.revisions.find(item => item.revisionId === version) ?? card?.revisions.at(-1)
  const commit = async (operation: (signal: AbortSignal) => Promise<KnowledgeCard>): Promise<void> => {
    if (write.current !== undefined) return
    const controller = new AbortController()
    write.current = controller
    setBusy(true)
    setFailed(false)
    try {
      const saved = await operation(controller.signal)
      if (controller.signal.aborted) return
      setCard(saved)
      setVersion(saved.revisions.at(-1)!.revisionId)
      setEditing(false)
      setReading(undefined)
      attempt.current = undefined
      changed()
    } catch { if (!controller.signal.aborted) setFailed(true) } finally {
      if (!controller.signal.aborted) { setBusy(false); write.current = undefined }
    }
  }
  return <div className={styles.knowledgeBody}>
    {loading ? <p role="status">{t('topic.loading')}</p> : null}
    {failed || topicError ? <div role="alert">{t('knowledge.error')}
      {(!editing && card === undefined) || topicError ? <button type="button" onClick={() => { setReload(value => value + 1) }}>{t('topic.retry')}</button> : null}</div> : null}
    {loading ? null : <>
      <label>{t('knowledge.topic')}<select value={selectedTopic} disabled={busy} onChange={event => { setSelectedTopic(event.target.value) }}>
        <option value="">{t('knowledge.noTopic')}</option>
        {topicList.map(topic => <option key={topic.topicId} value={topic.topicId}>{topic.title}</option>)}
      </select></label>
      {editing ? <form className={styles.knowledgeForm} onSubmit={event => {
        event.preventDefault()
        const base = { cardId: identity, content: { ...content, title: content.title.trim() }, sources,
          ...(selectedTopic === '' ? {} : { topicId: selectedTopic }) }
        const payload = JSON.stringify(base)
        if (attempt.current?.payload !== payload) attempt.current = { payload, revisionId: crypto.randomUUID() }
        const request: KnowledgeSave = { ...base, revisionId: attempt.current.revisionId }
        void commit(signal => api.save(request, signal))
      }}>
        {TEXT_FIELDS.map(field => <label key={field}>{t(`knowledge.field.${field}`)}
          {field === 'title' ? <input value={content[field]} maxLength={120} disabled={busy}
            onChange={event => { setContent(value => ({ ...value, [field]: event.target.value })) }} />
            : <textarea value={content[field]} maxLength={24_000} rows={3} disabled={busy}
              onChange={event => { setContent(value => ({ ...value, [field]: event.target.value })) }} />}</label>)}
        <label>{t('knowledge.kind')}<select value={content.kind} disabled={busy}
          onChange={event => { setContent(value => ({ ...value, kind: event.target.value as KnowledgeContent['kind'] })) }}>
          {(['conclusion', 'method', 'hypothesis', 'question'] as const).map(kind => <option key={kind} value={kind}>{t(`knowledge.kind.${kind}`)}</option>)}
        </select></label>
        <label>{t('knowledge.status')}<select value={content.status} disabled={busy}
          onChange={event => { setContent(value => ({ ...value, status: event.target.value as KnowledgeContent['status'] })) }}>
          {(['draft', 'confirmed'] as const).map(status => <option key={status} value={status}>{t(`knowledge.status.${status}`)}</option>)}
        </select></label>
        <p>{t('knowledge.sourceHint')}</p>
        {sources.length === 0 ? <p>{t('knowledge.noSources')}</p> : sources.map((address, index) => <div key={index}>
          <span>{address.kind === 'discussion' ? `${address.sessionId} · ${t('knowledge.sourceRange', { start: address.startSeq, end: address.endSeq })}`
            : `${address.cardId} · ${address.revisionId} · ${address.sourceIndex + 1}`}</span>
          <button type="button" disabled={busy} onClick={() => { setSources(value => value.filter((_, i) => i !== index)) }}>{t('knowledge.removeSource')}</button>
        </div>)}
        <div className={styles.topicControls}><button type="submit" disabled={busy || content.title.trim() === ''}>{t('knowledge.save')}</button>
          <button type="button" disabled={busy} onClick={() => { if (card === undefined) close(); else { setEditing(false); setFailed(false) } }}>{t('knowledge.cancel')}</button></div>
      </form> : revision === undefined ? null : <>
        <label>{t('knowledge.version')}<select value={version} onChange={event => { setVersion(event.target.value); setReading(undefined) }}>
          {card!.revisions.map(item => <option key={item.revisionId} value={item.revisionId}>{t('knowledge.versionNumber', { number: item.number })}</option>)}
        </select></label>
        <h3>{revision.content.title}</h3>
        <p>{t(`knowledge.kind.${revision.content.kind}`)} · {t(`knowledge.status.${revision.content.status}`)} · {t('knowledge.savedAt', { time: new Date(revision.savedAt).toLocaleString() })}</p>
        {TEXT_FIELDS.filter(field => field !== 'title').map(field => revision.content[field] === '' ? null : <section key={field}>
          <h4>{t(`knowledge.field.${field}`)}</h4><p className={styles.historyText}>{revision.content[field]}</p></section>)}
        <div className={styles.topicControls}><button type="button" disabled={busy} onClick={() => {
          setContent(revision.content)
          setSources(revision.sources.map((_, sourceIndex) => ({ kind: 'revision', cardId: identity, revisionId: revision.revisionId, sourceIndex })))
          setFailed(false)
          setEditing(true)
        }}>{t('knowledge.edit')}</button>
          {selectedTopic === '' ? null : <button type="button" disabled={busy} onClick={() => {
            void commit(signal => api.membership({ cardId: identity, topicId: selectedTopic, attached: !card!.topicIds.includes(selectedTopic) }, signal))
          }}>{t(card!.topicIds.includes(selectedTopic) ? 'knowledge.detach' : 'knowledge.attach')}</button>}</div>
        <p>{t('knowledge.detached')}</p>
        <h4>{t('knowledge.source')}</h4>
        {revision.sources.length === 0 ? <p>{t('knowledge.noSources')}</p> : revision.sources.map((item, index) => <section key={index} className={styles.knowledgeSource}>
          <strong>{item.title}</strong><div className={styles.historyIdentity}>{item.sessionId} · {item.cwd}</div>
          <div>{t('knowledge.sourceRange', { start: item.source.startSeq, end: item.source.endSeq })}</div>
          <details><summary>{t('knowledge.excerpt')}</summary>{item.source.turns.map(turn => <article key={turn.startSeq}>
            <h5>{t('history.turn', { turn: turn.turn })} · {new Date(turn.startedAt).toLocaleString()}</h5>
            {turn.messages.map(message => <p key={message.seq} className={styles.historyText}><strong>{t(message.role === 'user' ? 'history.user' : 'history.assistant')}</strong>{'\n'}{message.text}</p>)}
          </article>)}</details>
          <button type="button" onClick={() => { setReading(index) }}>{t('knowledge.readSource')}</button>
          {reading !== index ? null : <SessionHistory key={`${revision.revisionId}:${index}`} sessionId={item.sessionId} source={item.source} read={read} t={t} />}
        </section>)}
      </>}
    </>}
    {busy ? <p role="status">{t('topic.saving')}</p> : null}
  </div>
}
