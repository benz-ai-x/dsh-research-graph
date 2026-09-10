import type { KnowledgeCard, KnowledgeContent, KnowledgeMembership, KnowledgeSearch, KnowledgeSourceAddress, KnowledgeSave, KnowledgeSource } from './knowledge.ts'
import { sessionHistoryRequestSchema } from './session-history-codec.ts'

function invalid(): never { throw new TypeError('Invalid Knowledge Card data') }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 24_000): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max) return invalid()
  return value
}
function identity(value: unknown): string {
  const id = text(value, 200)
  if (id.trim() === '') return invalid()
  return id
}
function uuid(value: unknown): string {
  const id = identity(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) return invalid()
  return id
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid()
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }

const CONTENT_KEYS = ['title', 'question', 'conclusion', 'rationale', 'openQuestions', 'kind', 'status']
function content(value: unknown): KnowledgeContent {
  const item = object(value, CONTENT_KEYS)
  const title = text(item.title, 120).trim()
  if (title === '' || !['conclusion', 'method', 'hypothesis', 'question'].includes(String(item.kind))
    || (item.status !== 'draft' && item.status !== 'confirmed')) return invalid()
  return {
    title, question: text(item.question), conclusion: text(item.conclusion), rationale: text(item.rationale),
    openQuestions: text(item.openQuestions), kind: item.kind as KnowledgeContent['kind'], status: item.status,
  }
}
function address(value: unknown): KnowledgeSourceAddress {
  const raw = object(value, ['kind', 'sessionId', 'startSeq', 'endSeq', 'cardId', 'revisionId', 'sourceIndex'])
  if (raw.kind === 'revision') {
    const item = object(value, ['kind', 'cardId', 'revisionId', 'sourceIndex'])
    return { kind: 'revision', cardId: uuid(item.cardId), revisionId: uuid(item.revisionId), sourceIndex: count(item.sourceIndex) }
  }
  const item = object(value, ['kind', 'sessionId', 'startSeq', 'endSeq'])
  const startSeq = count(item.startSeq)
  const endSeq = count(item.endSeq)
  if (item.kind !== 'discussion' || endSeq < startSeq) return invalid()
  return { kind: 'discussion', sessionId: identity(item.sessionId), startSeq, endSeq }
}
function source(value: unknown): KnowledgeSource {
  const item = object(value, ['sessionId', 'title', 'cwd', 'source'])
  const request = sessionHistoryRequestSchema.parse({ sessionId: item.sessionId, source: item.source })
  if (request.source === undefined) return invalid()
  return {
    sessionId: request.sessionId, title: text(item.title), source: request.source,
    ...(item.cwd === undefined ? {} : { cwd: text(item.cwd) }),
  }
}

export const knowledgeSaveSchema = { parse(value: unknown): KnowledgeSave {
  const item = object(value, ['cardId', 'revisionId', 'topicId', 'content', 'sources'])
  if (array(item.sources).length > 32) return invalid()
  return {
    cardId: uuid(item.cardId), revisionId: uuid(item.revisionId), content: content(item.content),
    sources: array(item.sources).map(address), ...(item.topicId === undefined ? {} : { topicId: uuid(item.topicId) }),
  }
} }
export const knowledgeSearchSchema = { parse(value: unknown): KnowledgeSearch {
  const item = object(value, ['query', 'topicId'])
  return { query: text(item.query, 200).trim(), ...(item.topicId === undefined ? {} : { topicId: uuid(item.topicId) }) }
} }
export const knowledgeMembershipSchema = { parse(value: unknown): KnowledgeMembership {
  const item = object(value, ['cardId', 'topicId', 'attached'])
  if (typeof item.attached !== 'boolean') return invalid()
  return { cardId: uuid(item.cardId), topicId: uuid(item.topicId), attached: item.attached }
} }
export const knowledgeReadSchema = { parse(value: unknown): { readonly cardId: string } {
  return { cardId: uuid(object(value, ['cardId']).cardId) }
} }
export const knowledgeCardSchema = { parse(value: unknown): KnowledgeCard {
  const item = object(value, ['cardId', 'topicIds', 'revisions'])
  const revisions = array(item.revisions).map((value, index) => {
    const revision = object(value, ['revisionId', 'requestHash', 'number', 'savedAt', 'content', 'sources'])
    if (count(revision.number) !== index + 1) return invalid()
    const requestHash = text(revision.requestHash, 64)
    if (!/^[0-9a-f]{64}$/u.test(requestHash)) return invalid()
    return { revisionId: uuid(revision.revisionId), requestHash, number: index + 1, savedAt: count(revision.savedAt),
      content: content(revision.content), sources: array(revision.sources).map(source) }
  })
  if (revisions.length === 0 || new Set(revisions.map(revision => revision.revisionId)).size !== revisions.length) return invalid()
  return { cardId: uuid(item.cardId), topicIds: array(item.topicIds).map(uuid), revisions }
} }
export const knowledgeListSchema = { parse(value: unknown): readonly KnowledgeCard[] { return array(value).map(knowledgeCardSchema.parse) } }
export const knowledgeNullableSchema = { parse(value: unknown): KnowledgeCard | null { return value === null ? null : knowledgeCardSchema.parse(value) } }
