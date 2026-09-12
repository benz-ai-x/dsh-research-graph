import { researchMaterialSchema, researchMaterialSelectionSchema } from './research-reuse-codec.ts'
import { knowledgeContentSchema } from './knowledge-codec.ts'
import type { KnowledgeContent } from './knowledge.ts'
import type { ResearchMaterial } from './research-reuse.ts'
import type { KnowledgeSynthesis, SynthesisCategory, SynthesisClaim, SynthesisDraft, SynthesisPreparation, SynthesisRequest, SynthesisSave } from './knowledge-synthesis.ts'
import { createWirePrimitives } from './wire-primitives.ts'

const { invalid, object, text, uuid, count, array, identity } = createWirePrimitives('Invalid synthesis data', 32_000)
const CATEGORIES: readonly SynthesisCategory[] = ['agreement', 'disagreement', 'condition', 'question']
function claims(value: unknown, minimum = 1, onInvalidCitation?: () => void): readonly SynthesisClaim[] {
  const items = array(value)
  if (items.length < minimum || items.length > 24) return invalid()
  return items.map(value => {
    const item = object(value, ['category', 'text', 'citations'])
    const claimText = text(item.text, 6000).trim()
    const citations = array(item.citations)
    if (claimText === '' || !CATEGORIES.includes(item.category as SynthesisCategory) || citations.length > 12) return invalid()
    return { category: item.category as SynthesisCategory, text: claimText, citations: citations.flatMap(value => {
      try {
        const citation = object(value, ['materialIndex', 'quote'])
        return [{ materialIndex: count(citation.materialIndex), quote: text(citation.quote, 4000) }]
      } catch (error) {
        if (onInvalidCitation === undefined) throw error
        onInvalidCitation()
        return []
      }
    }) }
  })
}
function materials(value: unknown): readonly ResearchMaterial[] {
  const items = array(value)
  if (items.length < 2 || items.length > 3) return invalid()
  return items.map(researchMaterialSchema.parse)
}
export const synthesisRequestSchema = { parse(value: unknown): SynthesisRequest {
  const item = object(value, ['operationId', 'topicId', 'question', 'materials'])
  const selected = array(item.materials)
  const question = text(item.question, 4000).trim()
  if (question === '' || selected.length < 2 || selected.length > 3) return invalid()
  const selections = selected.map(researchMaterialSelectionSchema.parse)
  selections.forEach((item, index) => {
    if (selections.slice(0, index).some(previous => item.kind === 'card' ? previous.kind === 'card' && previous.cardId === item.cardId
      : previous.kind === 'turn' && previous.sessionId === item.sessionId && item.startSeq <= previous.endSeq && previous.startSeq <= item.endSeq)) {
      throw new TypeError('Duplicate cards or overlapping original ranges; adjust the selection')
    }
  })
  return { operationId: uuid(item.operationId), topicId: uuid(item.topicId), question, materials: selections }
} }
export const synthesisSaveSchema = { parse(value: unknown): SynthesisSave {
  const item = object(value, ['source', 'claims'])
  const source = object(item.source, ['kind', 'preparationId', 'cardId', 'revisionId'])
  if (source.kind === 'preparation') {
    object(source, ['kind', 'preparationId'])
    return { source: { kind: 'preparation', preparationId: uuid(source.preparationId) }, claims: claims(item.claims) }
  }
  object(source, ['kind', 'cardId', 'revisionId'])
  if (source.kind !== 'revision') return invalid()
  return { source: { kind: 'revision', cardId: uuid(source.cardId), revisionId: uuid(source.revisionId) }, claims: claims(item.claims) }
} }
export const knowledgeSynthesisSchema = { parse(value: unknown): KnowledgeSynthesis {
  const item = object(value, ['materials', 'claims'])
  return { materials: materials(item.materials), claims: claims(item.claims) }
} }
export const synthesisPreparationSchema = { parse(value: unknown): SynthesisPreparation {
  const item = object(value, ['preparationId', 'topicId', 'question', 'materials', 'claims', 'materialText', 'budgetChars', 'route'])
  const route = item.route === undefined ? undefined : object(item.route, ['provider', 'model'])
  const budgetChars = count(item.budgetChars)
  const materialText = text(item.materialText)
  if (budgetChars < 1 || budgetChars > 32_000 || materialText.length > budgetChars) return invalid()
  return { preparationId: uuid(item.preparationId), topicId: uuid(item.topicId), question: text(item.question, 4000),
    materials: materials(item.materials), claims: claims(item.claims, 0), materialText, budgetChars,
    ...(route === undefined ? {} : { route: { provider: identity(route.provider), model: identity(route.model) } }) }
} }
export const synthesisModelSchema = { parse(value: unknown): { readonly title: string; readonly question: string; readonly kind: KnowledgeContent['kind']; readonly claims: readonly SynthesisClaim[]; readonly invalidCitations: number } {
  const item = object(value, ['title', 'question', 'kind', 'claims'])
  const content = knowledgeContentSchema.parse({ title: item.title, question: text(item.question, 4000), kind: item.kind,
    conclusion: '', rationale: '', openQuestions: '', status: 'draft' })
  let invalidCitations = 0
  const parsedClaims = claims(item.claims, 1, () => { invalidCitations += 1 })
  return { title: content.title, question: content.question, kind: content.kind, claims: parsedClaims, invalidCitations }
} }
export const synthesisDraftSchema = { parse(value: unknown): SynthesisDraft {
  const item = object(value, ['cardId', 'revisionId', 'content', 'synthesis', 'invalidCitations'])
  return { cardId: uuid(item.cardId), revisionId: uuid(item.revisionId), content: knowledgeContentSchema.parse(item.content),
    synthesis: synthesisSaveSchema.parse(item.synthesis), invalidCitations: count(item.invalidCitations) }
} }
