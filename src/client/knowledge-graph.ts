import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { KnowledgeCard } from '../knowledge.ts'
import type { SessionGraph } from './graph-model.ts'

/** Project saved provenance explicitly, including sources outside topic membership. */
export function withKnowledgeCards(graph: SessionGraph, cards: readonly KnowledgeCard[], list: SessionListState, archived: ReadonlySet<string>): SessionGraph {
  const nodes = new Map(graph.nodes)
  const clusters = [...graph.clusters]
  const children = new Map(graph.children)
  const edges = [...graph.edges]
  const edgeIds = new Set(edges.map(edge => edge.id))
  for (const card of cards) {
    const revision = card.revisions.at(-1)!
    const id = `card:${card.cardId}` as const
    for (const source of revision.sources) {
      if (!nodes.has(source.sessionId)) {
        const sessionId = source.sessionId as SessionId
        const row = list.byId[sessionId]
        nodes.set(sessionId, {
          id: sessionId, clusterId: sessionId, title: source.title, blank: false, displayStatus: undefined, viewed: false,
          updatedAt: source.source.turns.at(-1)!.startedAt, subagentCount: 0, runningSubagents: 0, branchFrom: undefined, mergeSources: [],
          retainedSource: source.source,
          topicSource: { sessionId, title: source.title, status: row === undefined || row.origin === 'subagent' ? 'unavailable' : 'listed', archived: archived.has(sessionId),
            ...(source.cwd === undefined ? {} : { cwd: source.cwd }) },
        })
        children.set(sessionId, [])
        clusters.push({ rootId: sessionId, label: source.title, memberIds: [sessionId] })
      }
      const edgeId = `source:${source.sessionId}:${id}`
      if (!edgeIds.has(edgeId)) {
        edges.push({ id: edgeId, kind: 'source', from: source.sessionId, to: id })
        edgeIds.add(edgeId)
      }
    }
    nodes.set(id, {
      kind: 'knowledge', card, id, clusterId: id, title: revision.content.title, updatedAt: revision.savedAt,
    })
    children.set(id, [])
    clusters.push({ rootId: id, label: revision.content.title, memberIds: [id] })
  }
  return { ...graph, nodes, clusters, children, edges }
}
