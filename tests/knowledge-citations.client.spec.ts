import { expect, it } from 'vitest'
import { editableKnowledgeSources, changeExtractionCitation } from '../src/client/knowledge-citations.ts'
import type { KnowledgeRevision } from '../src/knowledge.ts'
import { knowledgeContent, knowledgeSource } from './fixtures/knowledge-client.ts'

it('preserves unrelated saved sources while editing a long frozen citation without exceeding the source limit', () => {
  const included = knowledgeSource(1, 40)
  const preparation = { preparationId: 'snapshot', selected: included, included, omitted: [], budgetChars: 20_000, materialText: 'frozen' }
  const revision: KnowledgeRevision = { revisionId: 'revision', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
    content: knowledgeContent(), sources: [knowledgeSource(1, 39), { ...knowledgeSource(2), sessionId: 'another-session' }] }
  const editing = editableKnowledgeSources('card', revision, preparation)
  expect(editing).toEqual([{ kind: 'extraction', preparationId: 'snapshot', startSeq: 10, endSeq: 394 },
    { kind: 'revision', cardId: 'card', revisionId: 'revision', sourceIndex: 1 }])
  const withLast = changeExtractionCitation(preparation, editing, 400, true)
  expect(withLast).toEqual([editing[1], { kind: 'extraction', preparationId: 'snapshot', startSeq: 10, endSeq: 404 }])
  expect(changeExtractionCitation(preparation, withLast, 200, false)).toEqual([editing[1],
    { kind: 'extraction', preparationId: 'snapshot', startSeq: 10, endSeq: 194 },
    { kind: 'extraction', preparationId: 'snapshot', startSeq: 210, endSeq: 404 }])
  expect(revision.sources[0]!.source.turns).toHaveLength(39)
})

it('does not substitute a different frozen excerpt merely because its Session and event addresses match', () => {
  const included = knowledgeSource()
  const preparation = { preparationId: 'snapshot', selected: included, included, omitted: [], budgetChars: 20_000, materialText: 'frozen' }
  const changed = structuredClone(included)
  const revision: KnowledgeRevision = { revisionId: 'revision', requestHash: 'a'.repeat(64), number: 1, savedAt: 1000,
    content: knowledgeContent(), sources: [{ ...changed, source: { ...changed.source,
      turns: changed.source.turns.map(turn => ({ ...turn, messages: turn.messages.map(message => ({ ...message, text: 'Different saved evidence' })) })) } }] }
  const editing = editableKnowledgeSources('card', revision, preparation)
  expect(editing).toEqual([{ kind: 'revision', cardId: 'card', revisionId: 'revision', sourceIndex: 0 }])
  expect(changeExtractionCitation(preparation, editing, 10, true)[0]).toEqual(editing[0])
})
