import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { ResearchReuseRecord } from '../src/research-reuse.ts'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { researchRelations, researchRelationListSchema, researchRelationQuerySchema } from '../src/research-relations.ts'
import { withResearchRelations } from '../src/client/research-graph.ts'
import { knowledgePrefill } from '../src/client/knowledge-prefill.ts'
import type { SessionGraph } from '../src/client/graph-model.ts'

const content = { title: '条件性结论', question: '如何验证？', conclusion: '保留适用条件', rationale: '', openQuestions: '', kind: 'method' as const, status: 'draft' as const }
function record(): ResearchReuseRecord {
  return { operationId: randomUUID(), requestHash: 'a'.repeat(64), requestId: 'request', targetSessionId: 'session-followup',
    targetCreated: true, stage: 'accepted', workspace: { id: 'research', title: '研究空间', cwd: '/research' },
    createdAt: 1000, acceptedAt: 2000, question: '有哪些反例？', budgetChars: 32000, promptText: 'Full private research content',
    materials: [{ kind: 'card', cardId: randomUUID(), revisionId: randomUUID(), revisionNumber: 1, savedAt: 1000, content, sources: [] }] }
}

describe('accepted research relations', () => {
  it('projects only admitted uses and keeps frozen identities without returning prompt or card bodies', () => {
    const accepted = record()
    const material = accepted.materials[0]!
    if (material.kind !== 'card') throw new Error('fixture')
    const query = { cardIds: [material.cardId], sessionIds: [] }
    const found = researchRelations([accepted, { ...accepted, operationId: randomUUID(), stage: 'prepared', targetCreated: false, acceptedAt: undefined } as unknown as ResearchReuseRecord,
      { ...accepted, operationId: randomUUID(), stage: 'created', acceptedAt: undefined } as unknown as ResearchReuseRecord], query)
    expect(found).toHaveLength(1)
    expect(found[0]!.materials[0]).toEqual({ kind: 'card', cardId: material.cardId, revisionId: material.revisionId, revisionNumber: 1, title: content.title })
    expect(JSON.stringify(found)).not.toContain('Full private research content')
    expect(JSON.stringify(found)).not.toContain(content.conclusion)
    expect(researchRelationListSchema.parse(found)).toEqual(found)
    expect(researchRelations([accepted], { cardIds: [], sessionIds: [accepted.targetSessionId] })).toEqual(found)
    expect(researchRelations([accepted], { cardIds: [], sessionIds: [] })).toEqual([])
    expect(() => researchRelationQuerySchema.parse({ ...query, extra: true })).toThrow()
    expect(() => researchRelationQuerySchema.parse({ cardIds: [], sessionIds: Array(1001).fill('session-a') })).toThrow()
  })

  it('adds an out-of-topic target and displays the old revision after its source card is edited', () => {
    const accepted = record()
    const material = accepted.materials[0]!
    if (material.kind !== 'card') throw new Error('fixture')
    const card: KnowledgeCard = { cardId: material.cardId, topicIds: ['topic'], revisions: [
      { revisionId: material.revisionId, requestHash: 'b'.repeat(64), number: 1, savedAt: 1000, content, sources: [] },
      { revisionId: randomUUID(), requestHash: 'c'.repeat(64), number: 2, savedAt: 3000, content: { ...content, title: '修改后的结论' }, sources: [] },
    ] }
    const id = `card:${card.cardId}` as const
    const graph: SessionGraph = { nodes: new Map([[id, { kind: 'knowledge', id, clusterId: id, card, title: '修改后的结论', updatedAt: 3000 }]]),
      edges: [], children: new Map([[id, []]]), clusters: [{ rootId: id, label: card.revisions[1]!.content.title, memberIds: [id] }], sessionCount: 0 }
    const relations = researchRelations([accepted], { cardIds: [card.cardId], sessionIds: [] })
    const withTarget = withResearchRelations(graph, relations, { byId: {}, ids: [] } as unknown as SessionListState,
      { archivedSessionIds: ['session-followup'], items: [] } as unknown as WorkspaceSnapshot)
    expect(withTarget.nodes.get('session-followup')).toMatchObject({ title: accepted.question, topicSource: { status: 'unavailable', archived: true } })
    expect(withTarget.edges).toEqual([{ id: `reuse:${accepted.operationId}:${id}:${material.revisionId}`, kind: 'reuse', from: id, to: accepted.targetSessionId,
      reuse: { operationId: accepted.operationId, revisionId: material.revisionId, revisionNumber: 1 } }])
    expect(withTarget.nodes.get(id)).toEqual(graph.nodes.get(id))
    expect(graph.nodes.size).toBe(1)
    const compared = withResearchRelations(graph, [{ ...relations[0]!, materials: [relations[0]!.materials[0]!,
      { kind: 'card', cardId: card.cardId, title: card.revisions[1]!.content.title, revisionId: card.revisions[1]!.revisionId, revisionNumber: 2 }] }],
    { byId: {}, ids: [] } as unknown as SessionListState, { archivedSessionIds: [], items: [] } as unknown as WorkspaceSnapshot)
    expect(compared.edges.map(edge => edge.reuse?.revisionNumber)).toEqual([1, 2])
  })
})

describe('original discussion prefill', () => {
  it('prefills only a complete exact range and reports long editable excerpts', () => {
    const source = { kind: 'discussion' as const, sessionId: 'a', startSeq: 10, endSeq: 14 }
    const result = { kind: 'original' as const, sessionId: 'a', hasEarlier: false, hasLater: false,
      turns: [{ turn: 2, startSeq: 10, endSeq: 14, startedAt: 1000, messages: [
        { role: 'user' as const, seq: 11, text: '如何验证这条结论？' }, { role: 'assistant' as const, seq: 13, text: '保留前提，然后寻找反例。' },
      ] }] }
    expect(knowledgePrefill(source, result)).toEqual({ content: { title: '如何验证这条结论？', question: '如何验证这条结论？', conclusion: '保留前提，然后寻找反例。' }, first: 2, last: 2, truncated: false })
    expect(() => knowledgePrefill({ ...source, endSeq: 24 }, result)).toThrow()
    expect(() => knowledgePrefill(source, { ...result, kind: 'excerpt' })).toThrow()
    const long = knowledgePrefill(source, { ...result, turns: [{ ...result.turns[0]!, messages: [{ role: 'assistant', seq: 13, text: '长'.repeat(24001) }] }] })
    expect(long.truncated).toBe(true)
    expect(long.content.conclusion).toHaveLength(24000)
  })
})
