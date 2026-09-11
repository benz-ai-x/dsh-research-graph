import type { SessionGraph } from './graph-model.ts'
import { CARD_H, CLUSTER_GAP, COLLAPSED_ROW, layoutSessionGraph, nodeBounds, redrawEdges, type LaidOutGraph, type LaidOutNode } from './layout.ts'

/** Arrange research dependencies in readable rows while keeping each Branch cluster intact. */
export function layoutResearchGraph(graph: SessionGraph): LaidOutGraph {
  const base = layoutSessionGraph(graph)
  if (!base.nodes.length) return base
  const members = new Map<string, LaidOutNode[]>()
  for (const node of base.nodes) {
    const group = members.get(node.node.clusterId) ?? []
    group.push(node)
    members.set(node.node.clusterId, group)
  }
  const frames = graph.clusters.map(cluster => {
    const local = members.get(cluster.rootId)!
    const bounds = nodeBounds(local)
    return { id: String(cluster.rootId), local, bounds,
      height: Math.max(bounds.height, (local.length - 1) * COLLAPSED_ROW + CARD_H) }
  })
  const outgoing = new Map(frames.map(frame => [frame.id, new Set<string>()]))
  const incoming = new Map(frames.map(frame => [frame.id, new Set<string>()]))
  for (const edge of graph.edges) {
    const from = graph.nodes.get(edge.from)?.clusterId
    const to = graph.nodes.get(edge.to)?.clusterId
    if (from === undefined || to === undefined || from === to) continue
    outgoing.get(from)!.add(to)
    incoming.get(to)!.add(from)
  }
  const pending = new Map([...incoming].map(([key, values]) => [key, values.size]))
  const rank = new Map<string, number>()
  const queue = frames.filter(frame => pending.get(frame.id) === 0).map(frame => frame.id)
  for (const id of queue) rank.set(id, 0)
  let highest = 0
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]!
    for (const target of outgoing.get(id)!) {
      const depth = Math.max(rank.get(target) ?? 0, rank.get(id)! + 1)
      rank.set(target, depth)
      highest = Math.max(highest, depth)
      pending.set(target, pending.get(target)! - 1)
      if (pending.get(target) === 0) queue.push(target)
    }
  }
  // A later revision can cite a discussion that used an earlier revision of
  // that same card. Retain such cycles and their descendants in a stable grid.
  const layers = new Map<number, typeof frames>()
  for (const frame of frames) {
    const depth = pending.get(frame.id) === 0 ? rank.get(frame.id)! : highest + 1
    const layer = layers.get(depth) ?? []
    layer.push(frame)
    layers.set(depth, layer)
  }
  const centers = new Map<string, number>()
  const rows: { nodes: LaidOutNode[]; width: number }[] = []
  let y = 0
  for (const [, layer] of [...layers].sort(([left], [right]) => left - right)) {
    const center = (id: string): number => {
      const parents = [...incoming.get(id)!].flatMap(parent => centers.has(parent) ? [centers.get(parent)!] : [])
      return parents.length ? parents.reduce((sum, value) => sum + value, 0) / parents.length : 0
    }
    layer.sort((left, right) => center(left.id) - center(right.id))
    // Wide collections wrap instead of producing an unbounded single row.
    for (let start = 0; start < layer.length; start += 4) {
      const row = layer.slice(start, start + 4)
      const nodes: LaidOutNode[] = []
      let x = 0
      for (const frame of row) {
        centers.set(frame.id, x + frame.bounds.width / 2)
        for (const node of frame.local) nodes.push({ ...node, x: x + node.x - frame.bounds.x, y: y + node.y - frame.bounds.y })
        x += frame.bounds.width + CLUSTER_GAP
      }
      rows.push({ nodes, width: x - CLUSTER_GAP })
      y += Math.max(...row.map(frame => frame.height)) + CLUSTER_GAP
    }
  }
  const width = Math.max(...rows.map(row => row.width))
  const nodes = rows.flatMap(row => row.nodes.map(node => ({ ...node, x: node.x + (width - row.width) / 2 })))
  const edges = redrawEdges(base.edges, new Map(nodes.map(node => [node.key, node])), () => false)
  return { nodes, edges, ...nodeBounds(nodes) }
}
