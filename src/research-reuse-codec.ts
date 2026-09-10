import type { ResearchMaterial, ResearchMaterialSelection, ResearchReusePreparation, ResearchReuseRecord } from './research-reuse.ts'
import { knowledgeContentSchema, knowledgeSourceSchema } from './knowledge-codec.ts'

function invalid(): never { throw new TypeError('Invalid research material data') }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 32_000): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max) return invalid()
  return value
}
function identity(value: unknown): string {
  const id = text(value, 200)
  return id.trim() === '' ? invalid() : id
}
function uuid(value: unknown): string {
  const id = identity(value)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id) ? id : invalid()
}
function count(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid() }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }
function selection(value: unknown): ResearchMaterialSelection {
  const item = object(value, ['kind', 'cardId', 'revisionId', 'sessionId', 'startSeq', 'endSeq'])
  if (item.kind === 'card') {
    object(value, ['kind', 'cardId', 'revisionId'])
    return { kind: 'card', cardId: uuid(item.cardId), revisionId: uuid(item.revisionId) }
  }
  object(value, ['kind', 'sessionId', 'startSeq', 'endSeq'])
  const startSeq = count(item.startSeq)
  const endSeq = count(item.endSeq)
  if (item.kind !== 'turn' || endSeq <= startSeq) return invalid()
  return { kind: 'turn', sessionId: identity(item.sessionId), startSeq, endSeq }
}
function material(value: unknown): ResearchMaterial {
  const item = object(value, ['kind', 'cardId', 'revisionId', 'revisionNumber', 'savedAt', 'content', 'sources', 'source'])
  if (item.kind === 'turn') {
    object(value, ['kind', 'source'])
    const source = knowledgeSourceSchema.parse(item.source)
    if (source.source.turns.length !== 1) return invalid()
    return { kind: 'turn', source }
  }
  object(value, ['kind', 'cardId', 'revisionId', 'revisionNumber', 'savedAt', 'content', 'sources'])
  if (item.kind !== 'card' || count(item.revisionNumber) < 1) return invalid()
  return { kind: 'card', cardId: uuid(item.cardId), revisionId: uuid(item.revisionId), revisionNumber: count(item.revisionNumber),
    savedAt: count(item.savedAt), content: knowledgeContentSchema.parse(item.content), sources: array(item.sources).map(value => {
      const source = object(value, ['sessionId', 'title', 'startSeq', 'endSeq', 'startedAt'])
      return { sessionId: identity(source.sessionId), title: text(source.title), startSeq: count(source.startSeq),
        endSeq: count(source.endSeq), startedAt: count(source.startedAt) }
    }) }
}
export const researchReusePreparationSchema = { parse(value: unknown): ResearchReusePreparation {
  const item = object(value, ['operationId', 'materials', 'question', 'workspaceId'])
  const materials = array(item.materials).map(selection)
  const question = text(item.question, 4000).trim()
  if (materials.length < 1 || materials.length > 3 || question === '' || new Set(materials.map(item => JSON.stringify(item))).size !== materials.length) return invalid()
  return { operationId: uuid(item.operationId), materials, question, workspaceId: identity(item.workspaceId) }
} }
export const researchReuseReadSchema = { parse(value: unknown): { readonly operationId: string } {
  return { operationId: uuid(object(value, ['operationId']).operationId) }
} }
export const researchReuseSessionSchema = { parse(value: unknown): { readonly sessionId: string } {
  return { sessionId: identity(object(value, ['sessionId']).sessionId) }
} }
export const researchReuseRecordSchema = { parse(value: unknown): ResearchReuseRecord {
  const item = object(value, ['operationId', 'requestHash', 'requestId', 'targetSessionId', 'targetCreated', 'stage', 'workspace',
    'createdAt', 'question', 'materials', 'promptText', 'budgetChars', 'acceptedAt', 'error'])
  const workspace = object(item.workspace, ['id', 'title', 'cwd'])
  const requestHash = text(item.requestHash, 64)
  if (!/^[0-9a-f]{64}$/u.test(requestHash) || typeof item.targetCreated !== 'boolean'
    || (item.stage !== 'prepared' && item.stage !== 'created' && item.stage !== 'accepted')) return invalid()
  const materials = array(item.materials).map(material)
  const promptText = text(item.promptText)
  const budgetChars = count(item.budgetChars)
  if (materials.length < 1 || materials.length > 3 || promptText.length > budgetChars
    || (item.stage === 'accepted') !== (item.acceptedAt !== undefined) || (item.stage !== 'prepared' && !item.targetCreated)) return invalid()
  return { operationId: uuid(item.operationId), requestHash, requestId: identity(item.requestId), targetSessionId: identity(item.targetSessionId),
    targetCreated: item.targetCreated, stage: item.stage,
    workspace: { id: identity(workspace.id), title: text(workspace.title), cwd: text(workspace.cwd) },
    createdAt: count(item.createdAt), question: text(item.question, 4000), materials, promptText, budgetChars,
    ...(item.acceptedAt === undefined ? {} : { acceptedAt: count(item.acceptedAt) }), ...(item.error === undefined ? {} : { error: text(item.error) }) }
} }
export const researchReuseNullableSchema = { parse(value: unknown): ResearchReuseRecord | null { return value === null ? null : researchReuseRecordSchema.parse(value) } }
export const researchReuseListSchema = { parse(value: unknown): readonly ResearchReuseRecord[] { return array(value).map(researchReuseRecordSchema.parse) } }
