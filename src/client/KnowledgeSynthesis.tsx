import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ResearchMaterialSelection } from '../research-reuse.ts'
import type { SynthesisDraft, SynthesisPreparation } from '../knowledge-synthesis.ts'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { GraphViewInjected, GraphViewProps } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { ResearchMaterialPicker } from './ResearchMaterialPicker.tsx'
import { KnowledgeEditor } from './Knowledge.tsx'
import { SynthesisMaterialView } from './SynthesisClaims.tsx'
import { useDraftProtection } from './DraftGuard.tsx'
import styles from './GraphView.module.css'

/** Frozen previews and appended drafts have separate identities; new selections never replace prior edits. */
export function KnowledgeSynthesis({ topicId, api, topics, read, useSessions, changed, t }: {
  readonly topicId: string
  readonly api: KnowledgeApi
  readonly topics: GraphViewInjected['topics']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly useSessions: GraphViewProps['useSessions']
  readonly changed: () => void
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const [materials, setMaterials] = useState<readonly { readonly selection: ResearchMaterialSelection; readonly label: string }[]>([])
  const [question, setQuestion] = useState('')
  const [prepared, setPrepared] = useState<SynthesisPreparation>()
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [batches, setBatches] = useState<readonly { readonly draft: SynthesisDraft; readonly preparation: SynthesisPreparation }[]>([])
  const [savedPreparations, setSavedPreparations] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const active = useRef<AbortController>()
  const attempt = useRef<{ readonly payload: string; readonly operationId: string }>()
  const scroll = useRef<HTMLDivElement>(null)
  useDraftProtection((materials.length > 0 || question !== '') && (prepared === undefined || !savedPreparations.has(prepared.preparationId)), busy)
  useEffect(() => () => { active.current?.abort() }, [])
  const contains = (selection: ResearchMaterialSelection): boolean => materials.some(({ selection: item }) => selection.kind === 'card'
    ? item.kind === 'card' && item.cardId === selection.cardId
    : item.kind === 'turn' && item.sessionId === selection.sessionId && item.startSeq <= selection.endSeq && selection.startSeq <= item.endSeq)
  const change = (): void => { setPrepared(undefined); setError(undefined) }
  const run = async (generate: boolean): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller; setBusy(true); setError(undefined)
    try {
      if (generate && prepared !== undefined) {
        const draft = await api.synthesize!({ preparationId: prepared.preparationId, provider, model }, controller.signal)
        if (!controller.signal.aborted) setBatches(value => [...value, { draft, preparation: prepared }])
      } else {
        const base = { topicId, question: question.trim(), materials: materials.map(item => item.selection) }
        const payload = JSON.stringify(base)
        if (attempt.current?.payload !== payload) attempt.current = { payload, operationId: crypto.randomUUID() }
        const result = await api.prepareSynthesis!({ ...base, operationId: attempt.current.operationId }, controller.signal)
        if (!controller.signal.aborted) { setPrepared(result); setProvider(result.route?.provider ?? ''); setModel(result.route?.model ?? '') }
      }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div ref={scroll} className={styles.knowledgeBody}>
    <h3>{t('synthesis.select')}</h3><p>{t('synthesis.empty')}</p>
    <fieldset disabled={busy} className={styles.synthesisPicker}>
      <ResearchMaterialPicker api={api} useSessions={useSessions} read={read} topicId={topicId} t={t}
        selection={{ contains, count: materials.length, add: (selection, label) => {
          if (contains(selection)) { setError(t('synthesis.duplicate')); return }
          if (materials.length >= 3) { setError(t('synthesis.limit')); return }
          change(); setMaterials(value => [...value, { selection, label }])
        } }} />
      <ol>{materials.map((item, index) => <li key={JSON.stringify(item.selection)}>{item.label}
        <button type="button" onClick={() => { change(); setMaterials(value => value.filter((_, at) => at !== index)) }}>{t('reuse.remove')}</button>
      </li>)}</ol>
      <label>{t('synthesis.question')}<textarea rows={3} maxLength={4000} value={question} onChange={event => { change(); setQuestion(event.target.value) }} /></label>
      <button type="button" disabled={materials.length < 2 || question.trim() === ''} onClick={() => { void run(false) }}>{t('synthesis.preview')}</button>
    </fieldset>
    {prepared === undefined ? null : <section>
      <h3>{t('synthesis.frozen')}</h3><p>{t('reuse.budget', { size: prepared.materialText.length, budget: prepared.budgetChars })}</p>
      {prepared.materials.map((material, index) => <details key={index}><summary>{index + 1}. {material.kind === 'card'
        ? `${material.content.title} · ${t('knowledge.versionNumber', { number: material.revisionNumber })}` : `${material.source.title} · ${t('workbench.sourceTurns', { first: material.source.source.turns[0]!.turn, last: material.source.source.turns.at(-1)!.turn })}`}</summary>
        <SynthesisMaterialView material={material} read={read} t={t} /></details>)}
      <details><summary>{t('knowledge.exactPayload')}</summary><pre className={styles.historyText}>{prepared.materialText}</pre></details>
      <label>{t('extract.provider')}<input value={provider} maxLength={200} disabled={busy} onChange={event => { setProvider(event.target.value) }} /></label>
      <label>{t('extract.model')}<input value={model} maxLength={200} disabled={busy} onChange={event => { setModel(event.target.value) }} /></label>
      <p>{t('synthesis.manual')}</p>
      <button type="button" className={styles.primaryButton} disabled={busy || provider.trim() === '' || model.trim() === ''} onClick={() => { void run(true) }}>{t(batches.length === 0 ? 'synthesis.generate' : 'synthesis.append')}</button>
    </section>}
    {busy ? <p role="status">{t('extract.generating')} <button type="button" onClick={() => { active.current?.abort(); setBusy(false) }}>{t('extract.cancel')}</button></p> : null}
    {error === undefined ? null : <p role="alert">{error}</p>}
    {batches.map(batch => <section key={batch.draft.cardId}>
      <KnowledgeEditor cardId={undefined} source={undefined} topicId={topicId} api={api} topics={topics} read={read} t={t} changed={changed}
        synthesisDraft={batch.draft} frozenMaterials={batch.preparation.materials} scrollContainer={scroll}
        onSaved={() => { setSavedPreparations(value => new Set([...value, batch.preparation.preparationId])) }}
        close={() => { setBatches(value => value.filter(item => item.draft.cardId !== batch.draft.cardId)) }} />
    </section>)}
  </div>
}
