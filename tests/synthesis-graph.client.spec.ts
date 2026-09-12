import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { SessionGraph } from '../src/client/graph-model.ts'
import { withKnowledgeCards } from '../src/client/knowledge-graph.ts'
import { layoutResearchGraph } from '../src/client/research-layout.ts'
import { knowledgeCardSchema } from '../src/knowledge-codec.ts'

it('projects only cited card revisions and preserves old provenance when the source gains a revision', () => {
  const content = { title: '来源', question: '', conclusion: '明确前提', rationale: '', openQuestions: '', kind: 'method' as const, status: 'draft' as const }
  const cards: KnowledgeCard[] = [1, 2, 3].map(number => ({ cardId: randomUUID(), topicIds: [], revisions: [{
    revisionId: randomUUID(), number: 1, savedAt: number, requestHash: 'a'.repeat(64), content, sources: [],
  }] }))
  const first = cards[0]!
  const synthesis: KnowledgeCard = { cardId: randomUUID(), topicIds: [], revisions: [{
    revisionId: randomUUID(), number: 1, savedAt: 5, requestHash: 'b'.repeat(64), content: { ...content, title: '综合卡片' }, sources: [],
    synthesis: { materials: cards.map(card => ({ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0]!.revisionId,
      revisionNumber: 1, savedAt: 1, content, sources: [] })), claims: [
      { category: 'condition', text: '引用第一项', citations: [{ materialIndex: 0, quote: '明确前提' }] },
      { category: 'question', text: '未引用的观点不建立边', citations: [] },
    ] },
  }] }
  const latest = { ...first, revisions: [...first.revisions, { ...first.revisions[0]!, revisionId: randomUUID(), number: 2, content: { ...content, title: '来源第二版' } }] }
  const graph: SessionGraph = { nodes: new Map(), edges: [], children: new Map(), clusters: [], sessionCount: 0 }
  const derived = withKnowledgeCards(graph, [latest, ...cards.slice(1), synthesis], { byId: {}, ids: [] } as unknown as SessionListState, new Set())
  expect(derived.edges).toEqual([{ id: `synthesis:${first.cardId}:${synthesis.cardId}`, kind: 'synthesis', from: `card:${first.cardId}`, to: `card:${synthesis.cardId}`,
    synthesis: { revisionId: first.revisions[0]!.revisionId, revisionNumber: 1 } }])
  expect(derived.nodes.get(`card:${first.cardId}`)?.title).toBe('来源第二版')
  expect(layoutResearchGraph(derived).edges).toHaveLength(1)
  expect(knowledgeCardSchema.parse(JSON.parse(JSON.stringify(synthesis)))).toEqual(synthesis)
  expect(graph.nodes.size).toBe(0)
})
