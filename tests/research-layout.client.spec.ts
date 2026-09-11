import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphEdge, SessionGraph, SessionGraphNode } from '../src/client/graph-model.ts'
import { layoutResearchGraph } from '../src/client/research-layout.ts'
import { applyCollapse, clusterFrames } from '../src/client/clusters.ts'
import { CARD_H } from '../src/client/layout.ts'

function graph(ids: readonly string[], edges: readonly GraphEdge[]): SessionGraph {
  const nodes = ids.map(key => {
    const id = key as SessionId
    const node: SessionGraphNode = { id, clusterId: id, title: key, updatedAt: 1000, blank: false, viewed: false,
      displayStatus: undefined, subagentCount: 0, runningSubagents: 0, branchFrom: undefined, mergeSources: [] }
    return node
  })
  return { nodes: new Map(nodes.map(node => [node.id, node])), edges, children: new Map(ids.map(id => [id, []])),
    clusters: nodes.map(node => ({ rootId: node.id, label: node.title, memberIds: [node.id] })), sessionCount: ids.length }
}
const edge = (kind: GraphEdge['kind'], from: string, to: string): GraphEdge => ({ id: `${from}:${to}`, from, to, kind })

describe('research relationship layout', () => {
  it('places sources, cards, and follow-ups on successive rows and keeps source pairs aligned', () => {
    const input = graph(['followup', 'source-b', 'source-a', 'card-a', 'card-b', 'new-discussion'], [
      edge('source', 'source-a', 'card-a'), edge('source', 'source-b', 'card-b'),
      edge('reuse', 'card-a', 'followup'), edge('reuse', 'card-b', 'followup'), edge('reuse', 'card-a', 'new-discussion'),
    ])
    const laid = layoutResearchGraph(input)
    const nodes = new Map(laid.nodes.map(node => [node.key, node]))
    for (const relation of input.edges) expect(nodes.get(relation.to)!.y).toBeGreaterThan(nodes.get(relation.from)!.y + CARD_H)
    expect(nodes.get('source-a')!.x).toBe(nodes.get('card-a')!.x)
    expect(nodes.get('source-b')!.x).toBe(nodes.get('card-b')!.x)
    expect(laid.nodes).toHaveLength(6)
    expect(laid.edges).toHaveLength(5)
    expect(laid.height).toBeLessThan(400)
  })

  it('keeps cycles and disconnected collections deterministic, finite and wrapped', () => {
    const input = graph(['source', 'card', 'followup', ...Array.from({ length: 21 }, (_, i) => `other-${i}`)], [
      edge('source', 'source', 'card'), edge('reuse', 'card', 'followup'), edge('source', 'followup', 'card'),
    ])
    const laid = layoutResearchGraph(input)
    expect(laid).toEqual(layoutResearchGraph(input))
    expect(laid.nodes).toHaveLength(input.nodes.size)
    expect(laid.edges).toHaveLength(input.edges.length)
    expect(laid.width).toBeLessThan(1400)
    expect(new Set(laid.nodes.map(node => `${node.x},${node.y}`)).size).toBe(input.nodes.size)
  })

  it('reserves expanded and collapsed Branch frames without moving their descendants into other clusters', () => {
    const initial = graph(['root', 'left', 'right', 'target'], [edge('branch', 'root', 'left'), edge('branch', 'root', 'right'), edge('merge', 'right', 'target')])
    const input: SessionGraph = { ...initial, nodes: new Map([...initial.nodes].map(([key, node]) => [key,
      key === 'left' || key === 'right' ? { ...node, clusterId: 'root' as SessionId } : node])),
    children: new Map([['root', ['left', 'right']], ['left', []], ['right', []], ['target', []]]),
    clusters: [{ rootId: 'root' as SessionId, label: 'root', memberIds: ['root', 'left', 'right'] as SessionId[] }, initial.clusters[3]!] }
    const laid = layoutResearchGraph(input)
    for (const collapsed of [new Set<string>(), new Set(['root'])]) {
      const frames = clusterFrames(applyCollapse(laid, input.clusters, collapsed), input.clusters, collapsed)
      expect(frames[0]!.y + frames[0]!.height).toBeLessThan(frames[1]!.y)
    }
  })
})
