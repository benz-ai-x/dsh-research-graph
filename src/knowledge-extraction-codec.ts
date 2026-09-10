import type { ExtractionPreparation, ExtractionResult } from './knowledge-extraction.ts'
import { extractionRequestSchema, knowledgeSaveSchema, knowledgeSourceSchema } from './knowledge-codec.ts'

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid extraction data')
  return value as Record<string, unknown>
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid extraction count')
  return value
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid extraction text')
  return value
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid extraction list')
  return value
}
export const extractionPreparationSchema = { parse(value: unknown): ExtractionPreparation {
  const item = object(value)
  const route = item.route === undefined ? undefined : object(item.route)
  const request = extractionRequestSchema.parse({ preparationId: item.preparationId, provider: route?.provider ?? '_', model: route?.model ?? '_' })
  return {
    preparationId: request.preparationId, selected: knowledgeSourceSchema.parse(item.selected), included: knowledgeSourceSchema.parse(item.included),
    omitted: array(item.omitted).map(value => { const range = object(value); return { startSeq: count(range.startSeq), endSeq: count(range.endSeq) } }),
    budgetChars: count(item.budgetChars), materialText: text(item.materialText),
    ...(route === undefined ? {} : { route: { provider: request.provider, model: request.model } }),
  }
} }
export const extractionResultSchema = { parse(value: unknown): ExtractionResult {
  const item = object(value)
  return { provider: text(item.provider), model: text(item.model), drafts: array(item.drafts).map(value => {
    const draft = object(value)
    const save = knowledgeSaveSchema.parse({ cardId: draft.cardId, revisionId: draft.revisionId, content: draft.content, sources: draft.sources })
    if (typeof draft.needsVerification !== 'boolean') throw new TypeError('Invalid verification state')
    return { cardId: save.cardId, revisionId: save.revisionId, content: save.content, sources: save.sources,
      invalidCitations: count(draft.invalidCitations), needsVerification: draft.needsVerification }
  }) }
} }
