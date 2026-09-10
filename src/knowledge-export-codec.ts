import { knowledgeReadSchema } from './knowledge-codec.ts'
import type { KnowledgeExportRequest, KnowledgeExportResult } from './knowledge-export.ts'

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new TypeError('Invalid knowledge export')
  return value as Record<string, unknown>
}
export const knowledgeExportRequestSchema = { parse(value: unknown): KnowledgeExportRequest {
  const item = object(value, ['cardIds'])
  if (!Array.isArray(item.cardIds) || item.cardIds.length < 1 || item.cardIds.length > 50) throw new TypeError('Select 1–50 cards for export')
  const cardIds = item.cardIds.map(cardId => knowledgeReadSchema.parse({ cardId }).cardId)
  if (new Set(cardIds).size !== cardIds.length) throw new TypeError('Select each card once')
  return { cardIds }
} }
export const knowledgeExportResultSchema = { parse(value: unknown): KnowledgeExportResult {
  const item = object(value, ['filename', 'markdown', 'cards'])
  if (typeof item.filename !== 'string' || !item.filename.endsWith('.md') || /[\u0000-\u001f/\\]/u.test(item.filename)
    || item.filename.length > 240 || typeof item.markdown !== 'string' || item.markdown.length > 8_000_000
    || !Array.isArray(item.cards) || item.cards.length < 1 || item.cards.length > 50) throw new TypeError('Invalid knowledge export preview')
  const cards = item.cards.map(value => {
    const card = object(value, ['cardId', 'revisionId', 'number', 'title'])
    if (typeof card.title !== 'string' || card.title.length > 120 || !Number.isSafeInteger(card.number) || (card.number as number) < 1) throw new TypeError('Invalid export revision')
    return { cardId: knowledgeReadSchema.parse({ cardId: card.cardId }).cardId,
      revisionId: knowledgeReadSchema.parse({ cardId: card.revisionId }).cardId, number: card.number as number, title: card.title }
  })
  return { filename: item.filename, markdown: item.markdown, cards }
} }
