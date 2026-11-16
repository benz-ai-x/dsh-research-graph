import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  IconClockOutlineRegular, IconDownloadOutlineRegular, IconEditOutlineRegular, IconInspectOutlineRegular,
  IconLayersOutlineRegular, IconLinkOutlineRegular, IconPaperPlaneOutlineRegular, IconQuestionOutlineRegular,
  IconWarningTriangleOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { KnowledgeCard, KnowledgeRevision, KnowledgeSource } from '../knowledge.ts'
import { useResearchRelations, type ResearchRelationsState } from './research-relations.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { useKnowledge } from './Knowledge.tsx'
import { useResearchReuse } from './ResearchReuse.tsx'
import { SessionHistory } from './SessionHistory.tsx'
import { InspectorFrame } from './InspectorFrame.tsx'
import { ResearchMarkdown } from './ResearchMarkdown.tsx'
import { KnowledgeKindBadge, KnowledgeStatusBadge } from './KnowledgeBadges.tsx'
import { SynthesisClaims, SynthesisMaterialView } from './SynthesisClaims.tsx'
import styles from './GraphView.module.css'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string
type SectionIcon = (props: { readonly size?: number }) => ReactElement

function KnowledgeSectionTitle({ icon: Icon, children }: {
  readonly icon: SectionIcon
  readonly children: ReactNode
}): ReactElement {
  return <h3 className={styles.readingSectionTitle}><Icon size={14} />{children}</h3>
}

function sourceExcerpt(source: KnowledgeSource): string {
  const text = source.source.turns.flatMap(turn => turn.messages).map(message => message.text.trim()).find(text => text !== '') ?? ''
  return text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text
}

/** One reader for graph inspection and the knowledge desk, including saved editor results, with revision-specific actions. */
export function KnowledgeReader({ card, relations, read, workingKey, inspector, initialRevisionId, onEdit, onRetry, t }: {
  readonly workingKey?: string | undefined
  readonly inspector?: { readonly onClose: () => void }
  readonly card: KnowledgeCard
  readonly relations?: ResearchRelationsState
  readonly initialRevisionId?: string
  readonly onEdit?: (revision: KnowledgeRevision) => void
  readonly onRetry?: () => void
  readonly read: GraphViewInjected['readSessionHistory']
  readonly t: Translate
}): ReactElement {
  const knowledge = useKnowledge()
  const reuse = useResearchReuse()
  const [restored] = useState(() => {
    if (initialRevisionId !== undefined) return undefined
    const saved = loadWorkingPosition(workingKey).knowledgeReading
    return saved?.cardId === card.cardId && (!saved.revisionId || card.revisions.some(item => item.revisionId === saved.revisionId)) ? saved : undefined
  })
  const [version, setVersion] = useState(initialRevisionId ?? restored?.revisionId ?? '')
  const [source, setSource] = useState<number | undefined>(restored?.sourceIndex)
  const fetched = useResearchRelations(relations === undefined ? reuse?.relationApi : undefined,
    { cardIds: [card.cardId], sessionIds: [] }, (knowledge?.refresh ?? 0) + (reuse?.refresh ?? 0))
  const related = relations ?? fetched
  const element = useRef<HTMLDivElement>(null)
  const initialScroll = useRef<number | undefined>(restored?.scrollTop ?? 0)
  useLayoutEffect(() => {
    const panel = element.current?.closest<HTMLElement>('[data-working-scroll]')
    if (initialScroll.current !== undefined && panel) { panel.scrollTop = initialScroll.current; initialScroll.current = undefined }
    const remember = (): void => { saveWorkingPosition(workingKey, { knowledgeReading: {
      cardId: card.cardId, revisionId: version, sourceIndex: source, scrollTop: panel?.scrollTop ?? 0,
    } }) }
    remember()
    panel?.addEventListener('scroll', remember, { passive: true })
    return () => { panel?.removeEventListener('scroll', remember) }
  }, [workingKey, card.cardId, version, source])
  const latest = card.revisions.at(-1)!
  const revision = version === '' ? latest : card.revisions.find(item => item.revisionId === version)
  if (revision === undefined) return <div role="alert">{t('knowledge.error')}
    {onRetry ? <button type="button" onClick={onRetry}>{t('topic.retry')}</button> : null}</div>
  const next = related.relations.filter(item => item.materials.some(material => material.kind === 'card' && material.cardId === card.cardId))
  const sourceGroups: { title: string; items: { source: KnowledgeSource; index: number }[] }[] = []
  revision.sources.forEach((item, index) => {
    const existing = sourceGroups.find(group => group.items[0]?.source.sessionId === item.sessionId)
    if (existing === undefined) sourceGroups.push({ title: item.title, items: [{ source: item, index }] })
    else existing.items.push({ source: item, index })
  })
  const meta = <div className={styles.readingMeta}><KnowledgeStatusBadge status={revision.content.status} t={t} />
      <KnowledgeKindBadge kind={revision.content.kind} t={t} />
      <label className={styles.readingRevision}><IconLayersOutlineRegular size={13} />{t('knowledge.version')}<select value={revision.revisionId === latest.revisionId ? '' : version} onChange={event => { setVersion(event.target.value); setSource(undefined) }}>
        <option value="">{t('knowledge.versionNumber', { number: card.revisions.at(-1)!.number })}</option>
        {card.revisions.slice(0, -1).map(item => <option key={item.revisionId} value={item.revisionId}>{t('knowledge.versionNumber', { number: item.number })}</option>)}
      </select></label><span className={styles.readingSavedAt} title={new Date(revision.savedAt).toLocaleString()}>
        <IconClockOutlineRegular size={13} />{t('knowledge.savedAt', { time: new Date(revision.savedAt).toLocaleDateString() })}</span></div>
  const actions = <div className={styles.readingActions}>
      {reuse ? <button className={styles.primaryButton} type="button" onClick={() => {
        reuse.continueWith({ kind: 'card', cardId: card.cardId, revisionId: revision.revisionId },
          `${revision.content.title} · ${t('knowledge.versionNumber', { number: revision.number })}`)
      }}><IconPaperPlaneOutlineRegular size={15} />{t('workbench.continue')}</button> : null}
      <button type="button" onClick={() => { if (onEdit) onEdit(revision); else knowledge?.edit(card.cardId, revision.revisionId) }}><IconEditOutlineRegular size={15} />{t('knowledge.edit')}</button>
      <button className={styles.tertiaryButton} type="button" onClick={() => { knowledge?.exportCards([{ cardId: card.cardId, title: card.revisions.at(-1)!.content.title }]) }}><IconDownloadOutlineRegular size={15} />{t(revision.revisionId !== latest.revisionId ? 'workbench.exportLatest' : 'export.title')}</button>
    </div>
  const content = <div ref={element} className={styles.knowledgeReading}>
    {inspector === undefined ? <h2>{revision.content.title}</h2> : null}
    {inspector === undefined ? meta : null}
    {(['question', 'conclusion', 'rationale', 'openQuestions'] as const).filter(field => revision.synthesis === undefined || field === 'question').map(field => revision.content[field] ? <section key={field} data-field={field}>
      {field === 'conclusion' ? null : <KnowledgeSectionTitle icon={field === 'question' ? IconQuestionOutlineRegular : field === 'rationale' ? IconInspectOutlineRegular : IconWarningTriangleOutlineRegular}>{t(`knowledge.field.${field}`)}</KnowledgeSectionTitle>}
      <ResearchMarkdown text={revision.content[field]} t={t} /></section> : null)}
    {revision.synthesis === undefined ? null : <>
      <SynthesisClaims key={revision.revisionId} claims={revision.synthesis.claims} materials={revision.synthesis.materials} read={read} t={t} />
      <section className={styles.readingSources}><h3>{t('synthesis.frozen')}</h3><p>{t('synthesis.savedMaterials')}</p>
        {revision.synthesis.materials.map((material, index) => <details key={index}>
          <summary>{index + 1}. {material.kind === 'card' ? `${material.content.title} · ${t('knowledge.versionNumber', { number: material.revisionNumber })}`
            : `${material.source.title} · ${t('workbench.sourceTurns', { first: material.source.source.turns[0]!.turn, last: material.source.source.turns.at(-1)!.turn })}`}
            {' · '}{t(revision.synthesis!.claims.some(claim => claim.citations.some(citation => citation.materialIndex === index)) ? 'synthesis.cited' : 'synthesis.uncited')}</summary>
          <SynthesisMaterialView material={material} read={read} t={t} />
        </details>)}
      </section>
    </>}
    {inspector === undefined ? actions : null}
    <section className={styles.readingSources}><KnowledgeSectionTitle icon={IconLinkOutlineRegular}>{t('workbench.original')}</KnowledgeSectionTitle>
      {sourceGroups.length ? sourceGroups.map(group => <section className={styles.readingSourceGroup} key={group.items[0]!.source.sessionId}>
        <div className={styles.readingSourceGroupTitle}><IconLinkOutlineRegular size={14} /><strong title={group.title}>{group.title}</strong></div>
        {group.items.map(({ source: item, index }) => <div className={styles.readingSourceItem} key={`${item.sessionId}:${index}`}>
          <button className={styles.readingSourceLink} type="button" aria-expanded={source === index} onClick={() => { setSource(source === index ? undefined : index) }}>
            <strong>{t('workbench.sourceTurns', { first: item.source.turns[0]?.turn, last: item.source.turns.at(-1)?.turn })}</strong><small>{t('knowledge.readSource')}</small>
          </button>
          {sourceExcerpt(item) ? <p className={styles.readingSourceExcerpt}>{sourceExcerpt(item)}</p> : null}
          <details><summary>{t('knowledge.sourceDetails')}</summary>
            <div className={styles.historyIdentity}>{item.sessionId} · {item.cwd}</div>
            <p>{t('knowledge.sourceRange', { start: item.source.startSeq, end: item.source.endSeq })}</p>
          </details>
          {source === index ? <SessionHistory key={`${revision.revisionId}:${index}`} sourceTitle={item.title} sessionId={item.sessionId} source={item.source} read={read} t={t} /> : null}
        </div>)}
      </section>) : revision.synthesis === undefined ? <p className={styles.searchMeta}>{t('knowledge.noSources')}</p> : null}
    </section>
    {(related.loading || related.failed || next.length > 0) ? <section className={styles.readingSources}>
      <KnowledgeSectionTitle icon={IconPaperPlaneOutlineRegular}>{t('workbench.next')}</KnowledgeSectionTitle>
      {related.loading ? <p role="status">{t('topic.loading')}</p> : related.failed
        ? <p role="alert">{t('workbench.relationsError')} <button type="button" onClick={related.retry}>{t('topic.retry')}</button></p>
        : next.map(item => {
        const versions = item.materials.flatMap(material => material.kind === 'card' && material.cardId === card.cardId
          ? [t('knowledge.versionNumber', { number: material.revisionNumber })] : [])
        return <button className={styles.readingSourceLink} type="button" key={item.operationId} onClick={() => { reuse?.inspect(item.operationId) }}>
          <strong>{item.question}</strong><small>{item.workspace.title} · {versions.join(' / ')}</small>
          <small>{t('workbench.frozen')}</small></button>
      })}
    </section> : null}
  </div>
  return inspector === undefined ? content : <InspectorFrame label={t('knowledge.title')} title={revision.content.title}
    meta={meta} actions={actions} workingKey={workingKey} onClose={inspector.onClose} closeLabel={t('reading.close')} t={t}>{content}</InspectorFrame>
}
