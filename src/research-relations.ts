import type { ResearchReuseRecord } from './research-reuse.ts'
import { createWirePrimitives } from './wire-primitives.ts'

/** A compact, accepted-use projection; full frozen content is read by operation identity. */
export interface ResearchRelation {
  readonly operationId: string
  readonly targetSessionId: string
  readonly question: string
  readonly workspace: ResearchReuseRecord['workspace']
  readonly acceptedAt: number
  readonly materials: readonly ({
    readonly kind: 'card'
    readonly cardId: string
    readonly revisionId: string
    readonly revisionNumber: number
    readonly title: string
  } | {
    readonly kind: 'turn'
    readonly sessionId: string
    readonly startSeq: number
    readonly endSeq: number
    readonly title: string
  })[]
}

export interface ResearchRelationQuery {
  readonly cardIds: readonly string[]
  readonly sessionIds: readonly string[]
}

/** Select only actual admissions touching the requested material or target identities. */
export function researchRelations(records: readonly ResearchReuseRecord[], query: ResearchRelationQuery): readonly ResearchRelation[] {
  const cards = new Set(query.cardIds)
  const sessions = new Set(query.sessionIds)
  return records.filter(record => record.stage === 'accepted' && record.targetCreated && record.acceptedAt !== undefined
    && (sessions.has(record.targetSessionId) || record.materials.some(material => material.kind === 'card'
      ? cards.has(material.cardId) : sessions.has(material.source.sessionId))))
    .map(record => ({
      operationId: record.operationId, targetSessionId: record.targetSessionId, question: record.question,
      workspace: record.workspace, acceptedAt: record.acceptedAt!,
      materials: record.materials.map(material => material.kind === 'card' ? {
        kind: 'card' as const, cardId: material.cardId, revisionId: material.revisionId,
        revisionNumber: material.revisionNumber, title: material.content.title,
      } : {
        kind: 'turn' as const, sessionId: material.source.sessionId, startSeq: material.source.source.startSeq,
        endSeq: material.source.source.endSeq, title: material.source.title,
      }),
    }))
    .sort((left, right) => right.acceptedAt - left.acceptedAt || left.operationId.localeCompare(right.operationId))
}

const { object, array, identity, uuid, count, text, invalid } = createWirePrimitives('Invalid research relation', 4000)
export const researchRelationQuerySchema = { parse(value: unknown): ResearchRelationQuery {
  const item = object(value, ['cardIds', 'sessionIds'])
  const cardIds = array(item.cardIds).map(uuid)
  const sessionIds = array(item.sessionIds).map(identity)
  if (cardIds.length + sessionIds.length > 1000) return invalid()
  return { cardIds: [...new Set(cardIds)], sessionIds: [...new Set(sessionIds)] }
} }
export const researchRelationListSchema = { parse(value: unknown): readonly ResearchRelation[] {
  return array(value).map(value => {
    const item = object(value, ['operationId', 'targetSessionId', 'question', 'workspace', 'acceptedAt', 'materials'])
    const workspace = object(item.workspace, ['id', 'title', 'cwd'])
    const materials = array(item.materials).map(value => {
      const material = object(value, ['kind', 'cardId', 'revisionId', 'revisionNumber', 'title', 'sessionId', 'startSeq', 'endSeq'])
      if (material.kind === 'card') {
        object(value, ['kind', 'cardId', 'revisionId', 'revisionNumber', 'title'])
        const revisionNumber = count(material.revisionNumber)
        if (revisionNumber < 1) return invalid()
        return { kind: 'card' as const, cardId: uuid(material.cardId), revisionId: uuid(material.revisionId), revisionNumber, title: text(material.title, 120) }
      }
      object(value, ['kind', 'sessionId', 'startSeq', 'endSeq', 'title'])
      const startSeq = count(material.startSeq), endSeq = count(material.endSeq)
      if (material.kind !== 'turn' || endSeq <= startSeq) return invalid()
      return { kind: 'turn' as const, sessionId: identity(material.sessionId), startSeq, endSeq, title: text(material.title) }
    })
    if (materials.length < 1 || materials.length > 3) return invalid()
    return { operationId: uuid(item.operationId), targetSessionId: identity(item.targetSessionId), question: text(item.question),
      workspace: { id: identity(workspace.id), title: text(workspace.title), cwd: text(workspace.cwd) }, acceptedAt: count(item.acceptedAt), materials }
  })
} }
