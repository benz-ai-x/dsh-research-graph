import { useState, type ReactElement } from 'react'
import { isSynthesisCitationValid, type SynthesisClaim, type SynthesisCategory } from '../knowledge-synthesis.ts'
import type { ResearchMaterial } from '../research-reuse.ts'
import type { SessionGraphKey } from './locales.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import { useKnowledge } from './Knowledge.tsx'
import { ResearchMarkdown } from './ResearchMarkdown.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import { SourcePreview } from './SourcePreview.tsx'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
const categoryKey = { agreement: 'synthesis.agreement', disagreement: 'synthesis.disagreement', condition: 'synthesis.condition', question: 'synthesis.questionClaim' } as const

export function SynthesisMaterialView({ material, read, t }: { readonly material: ResearchMaterial; readonly read: GraphViewInjected['readSessionHistory']; readonly t: Translate }): ReactElement {
  const knowledge = useKnowledge()
  const [readingOriginal, setReadingOriginal] = useState(false)
  if (material.kind === 'turn') return <section className={styles.synthesisMaterial}>
    <SourcePreview source={material.source} t={t} />
    <button type="button" aria-expanded={readingOriginal} onClick={() => { setReadingOriginal(value => !value) }}>{t('synthesis.readOriginal')}</button>
    {readingOriginal ? <section><p>{t('synthesis.originalHint')}</p>
      <SessionHistory sessionId={material.source.sessionId} sourceTitle={material.source.title} source={material.source.source} read={read} t={t} />
    </section> : null}
  </section>
  return <section className={styles.synthesisMaterial}>
    <h4>{material.content.title} · {t('knowledge.versionNumber', { number: material.revisionNumber })}</h4>
    <p>{t('synthesis.cardBoundary')}</p>
    {(['question', 'conclusion', 'rationale', 'openQuestions'] as const).map(field => material.content[field] ? <section key={field}>
      <h5>{t(`knowledge.field.${field}`)}</h5><ResearchMarkdown text={material.content[field]} t={t} /></section> : null)}
    {material.sources.length ? <details><summary>{t('reuse.sourceLabels')}</summary>{material.sources.map((source, index) => <p key={index}>{source.title} · {source.startSeq}–{source.endSeq}</p>)}</details> : null}
    <button type="button" onClick={() => { knowledge?.open(material.cardId, material.revisionId) }}>{t('synthesis.readRevision', { number: material.revisionNumber })}</button>
  </section>
}

/** Claims and their explicit quotes remain editable; invalid quotes never become source edges. */
export function SynthesisClaims({ claims, materials, onChange, busy = false, read, t }: {
  readonly claims: readonly SynthesisClaim[]
  readonly materials: readonly ResearchMaterial[]
  readonly onChange?: (claims: readonly SynthesisClaim[]) => void
  readonly busy?: boolean
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: Translate
}): ReactElement {
  const [reading, setReading] = useState<number>()
  const update = (index: number, change: Partial<SynthesisClaim>): void => { onChange?.(claims.map((claim, at) => at === index ? { ...claim, ...change } : claim)) }
  return <section className={styles.synthesisClaims}>
    {claims.map((claim, index) => <section key={index} className={styles.synthesisClaim}>
      {onChange === undefined ? <><h3>{t(categoryKey[claim.category])}</h3><ResearchMarkdown text={claim.text} t={t} /></> : <>
        <label>{t('synthesis.category')}<select disabled={busy} value={claim.category} onChange={event => { update(index, { category: event.target.value as SynthesisCategory }) }}>
          {(Object.keys(categoryKey) as SynthesisCategory[]).map(category => <option value={category} key={category}>{t(categoryKey[category])}</option>)}
        </select></label>
        <label>{t('synthesis.text')}<textarea required maxLength={6000} rows={4} disabled={busy} value={claim.text} onChange={event => { update(index, { text: event.target.value }) }} /></label>
      </>}
      {!claim.citations.some(citation => isSynthesisCitationValid(materials, citation)) ? <p role="status">{t('synthesis.noCitations')}</p> : null}
      {claim.citations.map((citation, at) => <div key={at} className={styles.synthesisCitation}>
        {onChange === undefined ? <blockquote>{citation.quote}</blockquote> : <>
          <label>{t('synthesis.material')}<select disabled={busy} value={citation.materialIndex} onChange={event => { update(index, { citations: claim.citations.map((item, n) => n === at ? { ...item, materialIndex: Number(event.target.value) } : item) }) }}>
            {materials.map((material, sourceIndex) => <option key={sourceIndex} value={sourceIndex}>{sourceIndex + 1}. {material.kind === 'card' ? material.content.title : material.source.title}</option>)}
          </select></label>
          <label>{t('synthesis.quote')}<textarea required rows={2} maxLength={4000} disabled={busy} value={citation.quote} onChange={event => { update(index, { citations: claim.citations.map((item, n) => n === at ? { ...item, quote: event.target.value } : item) }) }} /></label>
          {isSynthesisCitationValid(materials, citation) ? null : <p role="alert">{t('synthesis.invalidQuote')}</p>}
          <button type="button" disabled={busy} onClick={() => { update(index, { citations: claim.citations.filter((_, n) => n !== at) }) }}>{t('synthesis.removeCitation')}</button>
        </>}
        <button type="button" aria-expanded={reading === citation.materialIndex} onClick={() => { setReading(reading === citation.materialIndex ? undefined : citation.materialIndex) }}>{t('synthesis.citation', { number: citation.materialIndex + 1 })}</button>
      </div>)}
      {onChange === undefined ? null : <div className={styles.topicControls}>
        <button type="button" disabled={busy || claim.citations.length >= 12} onClick={() => { update(index, { citations: [...claim.citations, { materialIndex: 0, quote: '' }] }) }}>{t('synthesis.addCitation')}</button>
        <button type="button" disabled={busy || claims.length <= 1} onClick={() => { onChange(claims.filter((_, at) => at !== index)) }}>{t('synthesis.removeClaim')}</button>
      </div>}
    </section>)}
    {onChange === undefined ? null : <button type="button" disabled={busy || claims.length >= 24} onClick={() => { onChange([...claims, { category: 'question', text: '', citations: [] }]) }}>{t('synthesis.addClaim')}</button>}
    {reading === undefined || materials[reading] === undefined ? null : <section><h3>{t('synthesis.citation', { number: reading + 1 })}</h3>
      <SynthesisMaterialView key={reading} material={materials[reading]} read={read} t={t} /></section>}
  </section>
}
