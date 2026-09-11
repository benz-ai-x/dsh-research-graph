import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResearchRelation } from '../research-relations.ts'
import type { SessionGraph } from './graph-model.ts'

/** Add admitted follow-up discussions without changing topic membership or earlier card revisions. */
export function withResearchRelations(graph: SessionGraph, relations: readonly ResearchRelation[], list: SessionListState, workspaces: WorkspaceSnapshot): SessionGraph {
  const nodes = new Map(graph.nodes)
  const children = new Map(graph.children)
  const clusters = [...graph.clusters]
  const edges = [...graph.edges]
  const edgeIds = new Set(edges.map(edge => edge.id))
  const archived = new Set<string>(workspaces.archivedSessionIds)
  for (const relation of relations) {
    const materials = relation.materials.filter(material => nodes.has(material.kind === 'card' ? `card:${material.cardId}` : material.sessionId))
    if (materials.length === 0 && !nodes.has(relation.targetSessionId)) continue
    const targetId = relation.targetSessionId as SessionId
    const current = nodes.get(targetId)
    if (current === undefined) {
      const row = list.byId[targetId]
      nodes.set(targetId, {
        id: targetId, clusterId: targetId, title: row?.displayTitle || relation.question, updatedAt: row?.updatedAt ?? relation.acceptedAt,
        blank: false, viewed: false, displayStatus: undefined, subagentCount: 0, runningSubagents: 0,
        branchFrom: undefined, mergeSources: [], reuseRelations: [relation],
        topicSource: { sessionId: targetId, title: row?.displayTitle || relation.question,
          status: row === undefined || row.origin === 'subagent' ? 'unavailable' : 'listed', archived: archived.has(targetId),
          cwd: row?.cwd ?? relation.workspace.cwd, workspace: { id: relation.workspace.id, title: relation.workspace.title } },
      })
      clusters.push({ rootId: targetId, label: relation.question, memberIds: [targetId] })
      children.set(targetId, [])
    } else if (current.kind !== 'knowledge') {
      nodes.set(targetId, { ...current, reuseRelations: [...(current.reuseRelations ?? []), relation] })
    }
    for (const material of materials) {
      const from = material.kind === 'card' ? `card:${material.cardId}` : material.sessionId
      const identity = material.kind === 'card' ? material.revisionId : `${material.startSeq}:${material.endSeq}`
      const id = `reuse:${relation.operationId}:${from}:${identity}`
      if (edgeIds.has(id) || from === targetId) continue
      edges.push({ id, kind: 'reuse', from, to: targetId, reuse: { operationId: relation.operationId,
        ...(material.kind === 'card' ? { revisionId: material.revisionId, revisionNumber: material.revisionNumber } : {}) } })
      edgeIds.add(id)
    }
  }
  return { ...graph, nodes, children, clusters, edges, sessionCount: [...nodes.values()].filter(node => node.kind !== 'knowledge').length }
}
