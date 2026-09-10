import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { KnowledgeDiscussionAddress } from '../knowledge.ts'
import type { ExtractionPreparation, ExtractionResult } from '../knowledge-extraction.ts'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { KnowledgeEditor } from './Knowledge.tsx'
import styles from './GraphView.module.css'

/** Each model response appends a new batch, so in-progress edits never get replaced. */
export function KnowledgeExtraction({ source, api, topics, read, topicId, changed, t }: {
  readonly source: KnowledgeDiscussionAddress
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly topicId: string | undefined
  readonly changed: () => void
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const [budgetChars, setBudgetChars] = useState(20_000)
  const [prepared, setPrepared] = useState<ExtractionPreparation>()
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string>()
  const [canceled, setCanceled] = useState(false)
  const [batches, setBatches] = useState<readonly { readonly id: string; readonly result: ExtractionResult; readonly preparation: ExtractionPreparation }[]>([])
  const active = useRef<AbortController>()
  useEffect(() => () => { active.current?.abort() }, [])
  const run = async (generate: boolean): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setFailed(undefined)
    setCanceled(false)
    try {
      if (generate && prepared !== undefined) {
        const result = await api.extract({ preparationId: prepared.preparationId, provider, model }, controller.signal)
        if (!controller.signal.aborted) setBatches(value => [...value, { id: crypto.randomUUID(), result, preparation: prepared }])
      } else {
        setPrepared(undefined)
        const value = await api.prepareExtraction({ source, budgetChars }, controller.signal)
        if (controller.signal.aborted) return
        setPrepared(value)
        setProvider(value.route?.provider ?? '')
        setModel(value.route?.model ?? '')
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailed(error instanceof Error ? error.message : String(error))
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className={styles.knowledgeBody}>
    <h3>{t('extract.selected')}</h3><p>{source.sessionId} · {t('knowledge.sourceRange', { start: source.startSeq, end: source.endSeq })}</p>
    <label>{t('extract.budget')}<input type="number" min={500} max={64_000} step={500} disabled={busy} value={budgetChars}
      onChange={event => { setBudgetChars(event.target.valueAsNumber); setPrepared(undefined) }} /></label>
    <button type="button" disabled={busy || !Number.isSafeInteger(budgetChars) || budgetChars < 500 || budgetChars > 64_000}
      onClick={() => { void run(false) }}>{t('extract.preview')}</button>
    {prepared === undefined ? null : <>
      <h3>{t('extract.included')}</h3>
      <p>{t('knowledge.sourceRange', { start: prepared.included.source.startSeq, end: prepared.included.source.endSeq })} · {prepared.materialText.length}/{prepared.budgetChars}</p>
      <pre className={styles.historyText}>{prepared.materialText}</pre>
      <h4>{t('extract.omitted')}</h4>
      {prepared.omitted.length === 0 ? <p>{t('extract.noneOmitted')}</p> : <ul>{prepared.omitted.map(range => <li key={range.startSeq}>
        {t('knowledge.sourceRange', { start: range.startSeq, end: range.endSeq })}</li>)}</ul>}
      <p>{t('extract.hint')}</p>
      <label>{t('extract.provider')}<input disabled={busy} maxLength={200} value={provider} onChange={event => { setProvider(event.target.value) }} /></label>
      <label>{t('extract.model')}<input disabled={busy} maxLength={200} value={model} onChange={event => { setModel(event.target.value) }} /></label>
      <button type="button" disabled={busy || provider.trim() === '' || model.trim() === ''} onClick={() => { void run(true) }}>
        {t(batches.length === 0 ? 'extract.generate' : 'extract.append')}</button>
      <p>{t('extract.preserve')}</p><p>{t('extract.snapshot')}</p>
    </>}
    {busy ? <p role="status">{t('extract.generating')} <button type="button" onClick={() => {
      active.current?.abort()
      setBusy(false)
      setCanceled(true)
    }}>{t('extract.cancel')}</button></p> : null}
    {canceled ? <p role="status">{t('search.canceled')}</p> : null}
    {failed === undefined ? null : <p role="alert">{t('knowledge.error')} {failed}</p>}
    {batches.map(batch => <section key={batch.id}>
      <h3>{batch.result.provider} / {batch.result.model}</h3>
      {batch.result.drafts.map(draft => <KnowledgeEditor key={draft.cardId} cardId={undefined} source={undefined} topicId={topicId}
        draft={draft} preparation={batch.preparation} api={api} topics={topics} read={read} t={t} changed={changed}
        close={() => { setBatches(value => value.map(item => item.id !== batch.id ? item : { ...item,
          result: { ...item.result, drafts: item.result.drafts.filter(card => card.cardId !== draft.cardId) } })) }} />)}
    </section>)}
  </div>
}
