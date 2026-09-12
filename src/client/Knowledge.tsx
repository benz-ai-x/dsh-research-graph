import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import type { KnowledgeCard, KnowledgeContent, KnowledgeDiscussionAddress, KnowledgeSave, KnowledgeSourceAddress } from '../knowledge.ts'
import type { ResearchTopic } from '../research-topic.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import { SessionHistory } from './SessionHistory.tsx'
import styles from './GraphView.module.css'
import { KnowledgeExtraction } from './KnowledgeExtraction.tsx'
import type { ExtractionDraft, ExtractionPreparation } from '../knowledge-extraction.ts'
import { KnowledgeExport, type ExportChoice } from './KnowledgeExport.tsx'
import { DraftGuard, useDraftProtection } from './DraftGuard.tsx'
import { knowledgePrefill } from './knowledge-prefill.ts'
import { editableKnowledgeSources, changeExtractionCitation } from './knowledge-citations.ts'
import { KnowledgeReader } from './KnowledgeReader.tsx'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
interface KnowledgeContextValue {
  readonly api: KnowledgeApi
  readonly refresh: number
  readonly topicId: string | undefined
  readonly selectTopic: (topicId: string | undefined) => void
  readonly create: (source?: KnowledgeDiscussionAddress) => void
  readonly open: (cardId: string) => void
  readonly edit: (cardId: string, revisionId: string) => void
  readonly extract: (source: KnowledgeDiscussionAddress) => void
  readonly exportCards: (cards: readonly ExportChoice[]) => void
  readonly saved: { readonly cardId: string; readonly title: string; readonly hasSources: boolean } | undefined
  readonly dismissSaved: () => void
}
const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined)
export function useKnowledge(): KnowledgeContextValue | undefined { return useContext(KnowledgeContext) }

interface KnowledgeDialog {
  readonly id: string
  readonly content: { readonly cardId?: string; readonly editRevisionId?: string; readonly source?: KnowledgeDiscussionAddress; readonly extraction?: KnowledgeDiscussionAddress }
  readonly trigger: HTMLElement | undefined
}

/** Owns explicit card dialogs; source readers only supply an address, never authoritative text. */
export function KnowledgeProvider({ api, topics, read, t, children }: {
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: Translate
  readonly children: ReactNode
}): ReactElement {
  const [dialogs, setDialogs] = useState<readonly KnowledgeDialog[]>([])
  const [exporting, setExporting] = useState<readonly ExportChoice[]>()
  const exportTrigger = useRef<HTMLElement>()
  const returnFocus = useRef<HTMLElement>()
  useLayoutEffect(() => {
    // An async save can close before React removes inert from the reader.
    // Restore focus only after that commit, without moving the source scroll.
    const trigger = returnFocus.current
    if (trigger === undefined) return
    returnFocus.current = undefined
    if (trigger.isConnected) trigger.focus({ preventScroll: true })
  }, [dialogs, exporting])
  const [refresh, setRefresh] = useState(0)
  const [topicId, selectTopic] = useState<string>()
  const [saved, setSaved] = useState<KnowledgeContextValue['saved']>()
  const open = (content: KnowledgeDialog['content']): void => {
    const dialog = { id: crypto.randomUUID(), content, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined }
    setDialogs(current => [...current, dialog])
  }
  const close = (): void => {
    returnFocus.current = dialogs.at(-1)?.trigger
    setDialogs(current => current.slice(0, -1))
  }
  const closeExport = (): void => {
    returnFocus.current = exportTrigger.current
    setExporting(undefined)
  }
  return <KnowledgeContext.Provider value={{ api, refresh, topicId, selectTopic, saved, dismissSaved: () => { setSaved(undefined) },
    create: source => { open(source === undefined ? {} : { source }) }, open: cardId => { open({ cardId }) },
    edit: (cardId, editRevisionId) => { open({ cardId, editRevisionId }) },
    extract: extraction => { open({ extraction }) }, exportCards: cards => {
      if (document.activeElement instanceof HTMLElement) exportTrigger.current = document.activeElement
      setExporting(cards)
    } }}>
    <div className={styles.knowledgeRoot} aria-hidden={dialogs.length > 0 || exporting !== undefined || undefined}
      ref={element => { if (element !== null) element.inert = dialogs.length > 0 || exporting !== undefined }}>{children}</div>
    {dialogs.map(({ id, content: dialog }, index) => {
      const covered = index !== dialogs.length - 1 || exporting !== undefined
      const title = dialog.extraction !== undefined ? 'extract.title' : 'knowledge.title'
      const capturing = dialog.source !== undefined && dialog.cardId === undefined
      return <DraftGuard key={id} close={close} t={t}>{requestClose => <section className={`${styles.knowledgeDialog} ${capturing ? styles.captureDialog : ''}`} role="dialog" aria-modal={!covered} aria-label={t(title)}
      aria-hidden={covered || undefined} ref={element => { if (element !== null) element.inert = covered }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); requestClose() }
        retainDialogFocus(event)
      }}>
      <div className={styles.searchHeader}><h2>{t(title)}</h2><button type="button" autoFocus onClick={requestClose}>{t('knowledge.close')}</button></div>
      {!covered && saved !== undefined && !capturing && (dialog.cardId !== undefined || dialog.extraction !== undefined)
        && saved.cardId !== dialog.cardId ? <KnowledgeSavedNotice t={t} /> : null}
      {dialog.extraction === undefined ? <KnowledgeEditor cardId={dialog.cardId} editRevisionId={dialog.editRevisionId} source={dialog.source} topicId={topicId}
        api={api} topics={topics} read={read} t={t} close={close} changed={() => { setRefresh(value => value + 1) }} onSaved={card => {
          const revision = card.revisions.at(-1)!
          setSaved({ cardId: card.cardId, title: revision.content.title, hasSources: revision.sources.length > 0 })
          if (capturing) close()
        }} />
        : <KnowledgeExtraction source={dialog.extraction} topicId={topicId} api={api} topics={topics} read={read} t={t}
          changed={() => { setRefresh(value => value + 1) }} />}
    </section>}</DraftGuard>
    })}
    {exporting === undefined ? null : <section className={styles.knowledgeDialog} role="dialog" aria-modal="true" aria-label={t('export.title')}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeExport() }
        retainDialogFocus(event)
      }}>
      <div className={styles.searchHeader}><h2>{t('export.title')}</h2><button type="button" autoFocus onClick={closeExport}>{t('export.close')}</button></div>
      <KnowledgeExport cards={exporting} api={api} t={t} />
    </section>}
  </KnowledgeContext.Provider>
}

/** A concrete saved result remains available after returning to the source reader. */
export function KnowledgeSavedNotice({ t }: { readonly t: Translate }): ReactElement | null {
  const knowledge = useKnowledge()
  if (knowledge?.saved === undefined) return null
  const saved = knowledge.saved
  return <div className={styles.savedDiscovery} role="status">
    <span className={styles.savedDiscoveryMark} aria-hidden="true">✓</span>
    <div><strong title={saved.title}>{t('reading.savedTitle', { title: saved.title })}</strong>
      {saved.hasSources ? <span>{t('reading.sourceSaved')}</span> : null}</div>
    <button type="button" onClick={() => { knowledge.open(saved.cardId) }}>{t('reading.viewSaved')}</button>
    <button type="button" aria-label={t('reading.dismissSaved')} onClick={knowledge.dismissSaved}>×</button>
  </div>
}

const EMPTY_CONTENT: KnowledgeContent = {
  title: '', question: '', conclusion: '', rationale: '', openQuestions: '', kind: 'conclusion', status: 'draft',
}

export function KnowledgeEditor({ cardId, editRevisionId, source, topicId, api, topics, read, close, changed, onSaved, draft, preparation, scrollContainer, t }: {
  readonly cardId: string | undefined
  readonly editRevisionId?: string | undefined
  readonly source: KnowledgeDiscussionAddress | undefined
  readonly topicId: string | undefined
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly close: () => void
  readonly changed: () => void
  readonly onSaved?: (card: KnowledgeCard) => void
  readonly t: Translate
  readonly draft?: ExtractionDraft
  readonly preparation?: ExtractionPreparation
  readonly scrollContainer?: RefObject<HTMLElement>
}): ReactElement {
  const [identity] = useState(() => cardId ?? draft?.cardId ?? crypto.randomUUID())
  const [card, setCard] = useState<KnowledgeCard>()
  const directEditInitialized = useRef(false)
  const [version, setVersion] = useState('')
  const editedFields = useRef(new Set<string>())
  const [prefilling, setPrefilling] = useState(source !== undefined && cardId === undefined && draft === undefined)
  const [prefillError, setPrefillError] = useState(false)
  const [prefillInfo, setPrefillInfo] = useState<{ first: number; last: number; truncated: boolean }>()
  const [prefillAttempt, setPrefillAttempt] = useState(0)
  const [content, setContent] = useState<KnowledgeContent>(draft?.content ?? EMPTY_CONTENT)
  const [sources, setSources] = useState<readonly KnowledgeSourceAddress[]>(draft?.sources ?? (source === undefined ? [] : [source]))
  const [invalidCitations, setInvalidCitations] = useState(draft?.invalidCitations ?? 0)
  const [citationReading, setCitationReading] = useState<number>()
  const [selectedTopic, setSelectedTopic] = useState(topicId ?? '')
  const [topicList, setTopicList] = useState<readonly ResearchTopic[]>([])
  const [topicError, setTopicError] = useState(false)
  const [editing, setEditing] = useState(cardId === undefined || editRevisionId !== undefined)
  const [loading, setLoading] = useState(cardId !== undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollRef = scrollContainer ?? editorRef
  const resultRef = useRef<HTMLDivElement>(null)
  const editTrigger = useRef<HTMLElement>()
  const readingScroll = useRef<number>()
  useLayoutEffect(() => {
    if (editing || editTrigger.current === undefined) return
    const trigger = editTrigger.current
    editTrigger.current = undefined
    let cancelled = false
    // DraftGuard's parent ref removes inert after this child's layout effect.
    queueMicrotask(() => {
      if (cancelled || !resultRef.current?.isConnected) return
      const target = trigger.isConnected ? trigger : resultRef.current.querySelector<HTMLElement>('select')
      if (scrollRef.current && readingScroll.current !== undefined) scrollRef.current.scrollTop = readingScroll.current
      target?.focus({ preventScroll: true })
    })
    return () => { cancelled = true }
  }, [editing])
  const baseline = useRef(JSON.stringify({ content: EMPTY_CONTENT, sources, selectedTopic }))
  const dirty = editing && (draft !== undefined && card === undefined || JSON.stringify({ content, sources, selectedTopic }) !== baseline.current)
  const discard = useDraftProtection(dirty, busy)
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
        const revision = editRevisionId === undefined ? value.revisions.at(-1)! : value.revisions.find(item => item.revisionId === editRevisionId)
        if (revision === undefined) throw new Error('Card revision unavailable')
        setCard(value)
        setVersion(revision.revisionId)
        if (editRevisionId !== undefined && !directEditInitialized.current) {
          const editable = editableKnowledgeSources(cardId, revision, preparation)
          baseline.current = JSON.stringify({ content: revision.content, sources: editable, selectedTopic })
          setContent(revision.content)
          setSources(editable)
          directEditInitialized.current = true
        }
      }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => { controller.abort() }
  }, [api, topics, cardId, editRevisionId, reload])
  useEffect(() => {
    if (!source || cardId !== undefined || draft !== undefined) return
    const controller = new AbortController()
    setPrefilling(true)
    setPrefillError(false)
    void read({ sessionId: source.sessionId, range: { startSeq: source.startSeq, endSeq: source.endSeq } }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      const prefill = knowledgePrefill(source, result)
      setContent(current => ({ ...current, ...Object.fromEntries(Object.entries(prefill.content).filter(([field]) => !editedFields.current.has(field))) }))
      setPrefillInfo(prefill)
    }).catch(() => { if (!controller.signal.aborted) setPrefillError(true) })
      .finally(() => { if (!controller.signal.aborted) setPrefilling(false) })
    return () => { controller.abort() }
  }, [source, cardId, draft, read, prefillAttempt])
  const commit = async (operation: (signal: AbortSignal) => Promise<KnowledgeCard>, savedRevision = true): Promise<void> => {
    if (write.current !== undefined) return
    const controller = new AbortController()
    write.current = controller
    setBusy(true)
    setFailed(false)
    try {
      const saved = await operation(controller.signal)
      if (controller.signal.aborted) return
      setCard(saved)
      if (savedRevision) {
        // A new reader resets its own position, never the surrounding draft batch.
        readingScroll.current = undefined
        setVersion(saved.revisions.at(-1)!.revisionId)
        setEditing(false)
        attempt.current = undefined
        onSaved?.(saved)
      }
      changed()
    } catch { if (!controller.signal.aborted) setFailed(true) } finally {
      if (!controller.signal.aborted) { setBusy(false); write.current = undefined }
    }
  }
  return <div ref={editorRef} className={`${styles.knowledgeBody} ${styles.knowledgeEditor}`} data-working-scroll={scrollContainer === undefined ? '' : undefined}>
    {loading ? <p role="status">{t('topic.loading')}</p> : null}
    {failed || topicError ? <div role="alert">{t('knowledge.error')}
      {(cardId !== undefined && card === undefined) || topicError ? <button type="button" onClick={() => { setReload(value => value + 1) }}>{t('topic.retry')}</button> : null}</div> : null}
    {loading || (cardId !== undefined && card === undefined) ? null : <>
      {!editing ? <label>{t('knowledge.topic')}<select value={selectedTopic} disabled={busy} onChange={event => { setSelectedTopic(event.target.value) }}>
        <option value="">{t('knowledge.noTopic')}</option>
        {topicList.map(topic => <option key={topic.topicId} value={topic.topicId}>{topic.title}</option>)}
      </select></label> : null}
      {editing ? <form className={styles.knowledgeForm} onSubmit={event => {
        event.preventDefault()
        if (busy || prefilling) return
        const base = { cardId: identity, content: { ...content, title: content.title.trim() }, sources,
          ...(selectedTopic === '' ? {} : { topicId: selectedTopic }) }
        const payload = JSON.stringify(base)
        if (attempt.current?.payload !== payload) attempt.current = { payload, revisionId: crypto.randomUUID() }
        const request: KnowledgeSave = { ...base, revisionId: attempt.current.revisionId }
        void commit(signal => api.save(request, signal))
      }}>
        {draft !== undefined && sources.length === 0 ? <p role="status">{t('extract.verify')}</p> : null}
        {invalidCitations > 0 ? <p role="alert">{t('extract.invalid', { count: invalidCitations })}</p> : null}
        <p className={styles.topicDescription}>{t(source === undefined ? 'knowledge.formHint' : 'reading.captureHint')}</p>
        {prefilling ? <p role="status">{t('workbench.prefill')}</p> : null}
        {prefillError ? <p role="status">{t('workbench.prefillError')} <button type="button" onClick={() => { setPrefillAttempt(value => value + 1) }}>{t('topic.retry')}</button></p> : null}
        {prefillInfo?.truncated ? <p role="status">{t('workbench.prefillTruncated')}</p> : null}
        {(['title', 'conclusion'] as const).map(field => <label key={field}>{t(`knowledge.field.${field}`)}
          {field === 'title' ? <input value={content[field]} required aria-required="true" maxLength={120} disabled={busy}
            onChange={event => { editedFields.current.add(field); setContent(value => ({ ...value, [field]: event.target.value })) }} />
            : <textarea value={content[field]} maxLength={24_000} rows={8} disabled={busy}
              onChange={event => { editedFields.current.add(field); setContent(value => ({ ...value, [field]: event.target.value })) }} />}</label>)}
        <details className={styles.optionalFields}><summary>{t('knowledge.moreFields')}</summary>
          <label>{t('knowledge.topic')}<select value={selectedTopic} disabled={busy} onChange={event => { setSelectedTopic(event.target.value) }}>
            <option value="">{t('knowledge.noTopic')}</option>
            {topicList.map(topic => <option key={topic.topicId} value={topic.topicId}>{topic.title}</option>)}
          </select></label>
          {(['question', 'rationale', 'openQuestions'] as const).map(field => <label key={field}>{t(`knowledge.field.${field}`)}
            <textarea value={content[field]} maxLength={24_000} rows={3} disabled={busy}
              onChange={event => { editedFields.current.add(field); setContent(value => ({ ...value, [field]: event.target.value })) }} /></label>)}
        <label>{t('knowledge.kind')}<select value={content.kind} disabled={busy}
          onChange={event => { setContent(value => ({ ...value, kind: event.target.value as KnowledgeContent['kind'] })) }}>
          {(['conclusion', 'method', 'hypothesis', 'question'] as const).map(kind => <option key={kind} value={kind}>{t(`knowledge.kind.${kind}`)}</option>)}
        </select></label>
        <label>{t('knowledge.status')}<select value={content.status} disabled={busy}
          onChange={event => { setContent(value => ({ ...value, status: event.target.value as KnowledgeContent['status'] })) }}>
          {(['draft', 'confirmed'] as const).map(status => <option key={status} value={status}>{t(`knowledge.status.${status}`)}</option>)}
        </select></label>
        </details>
        <p>{prefillInfo ? t('workbench.sourceTurns', { first: prefillInfo.first, last: prefillInfo.last }) : t('knowledge.sourceHint')}</p>
        {sources.length ? <p>{t('workbench.sourceRetained')}</p> : null}
        {preparation?.included.source.turns.map(turn => <div key={turn.startSeq}>
          <label><input type="checkbox" disabled={busy} checked={sources.some(address => address.kind === 'extraction' && address.preparationId === preparation.preparationId
            && turn.startSeq >= address.startSeq && turn.endSeq! <= address.endSeq)} onChange={event => {
              setSources(changeExtractionCitation(preparation, sources, turn.startSeq, event.target.checked))
              setInvalidCitations(0)
            }} />{t('extract.citation', { turn: turn.turn })}</label>
          <button type="button" onClick={() => { setCitationReading(turn.startSeq) }}>{t('extract.review')}</button>
          {citationReading !== turn.startSeq ? null : <SessionHistory key={turn.startSeq} sessionId={preparation.included.sessionId}
            source={{ startSeq: turn.startSeq, endSeq: turn.endSeq!, turns: [turn] }} read={read} t={t} />}
        </div>)}
        <details><summary>{t('knowledge.sourceDetails')}</summary>
        {sources.length === 0 ? <p>{t('knowledge.noSources')}</p> : sources.map((address, index) => <div key={index}>
          <span>{address.kind === 'discussion' ? `${address.sessionId} · ${t('knowledge.sourceRange', { start: address.startSeq, end: address.endSeq })}`
            : address.kind === 'revision' ? `${address.cardId} · ${address.revisionId} · ${address.sourceIndex + 1}`
              : t('knowledge.sourceRange', { start: address.startSeq, end: address.endSeq })}</span>
          <button type="button" disabled={busy} onClick={() => { setSources(value => value.filter((_, i) => i !== index)) }}>{t('knowledge.removeSource')}</button>
        </div>)}
        </details>
        <div className={styles.editorActions}><span role="status">{t(busy ? 'topic.saving' : dirty ? 'knowledge.unsaved' : card === undefined ? 'knowledge.draftHint' : 'knowledge.noChanges')}</span><button className={styles.primaryButton} type="submit" disabled={busy || prefilling || content.title.trim() === ''}>{t('knowledge.save')}</button>
          <button type="button" disabled={busy} onClick={() => { discard(() => { if (card === undefined) close(); else { setEditing(false); setFailed(false) } }) }}>{t('knowledge.cancel')}</button></div>
      </form> : null}
      {card === undefined ? null : <div ref={resultRef} hidden={editing}>
        <KnowledgeReader key={`${identity}:${version}`} card={card} initialRevisionId={version} read={read} t={t}
          onRetry={() => { setReload(value => value + 1) }} onEdit={revision => {
            if (busy) return
            editTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
            readingScroll.current = scrollRef.current?.scrollTop
            const editable = editableKnowledgeSources(identity, revision, preparation)
            baseline.current = JSON.stringify({ content: revision.content, sources: editable, selectedTopic })
            setContent(revision.content)
            setSources(editable)
            setFailed(false)
            setEditing(true)
          }} />
        {selectedTopic === '' ? null : <button type="button" disabled={busy} onClick={() => {
          void commit(signal => api.membership({ cardId: identity, topicId: selectedTopic, attached: !card.topicIds.includes(selectedTopic) }, signal), false)
        }}>{t(card.topicIds.includes(selectedTopic) ? 'knowledge.detach' : 'knowledge.attach')}</button>}
        <p>{t('knowledge.detached')}</p>
      </div>}
    </>}
    {busy ? <p role="status">{t('topic.saving')}</p> : null}
  </div>
}
