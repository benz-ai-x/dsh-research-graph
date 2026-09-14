import type { GraphNode } from './graph-model.ts'

function identityPart(id: string): string {
  return id.replace(/^session-(?=.)/u, '')
}

/** Short readable identity; the full identity remains available in the inspector tooltip. */
export function shortSessionId(id: string): string {
  return identityPart(id).slice(0, 6)
}

/** Remove the generated operation prefix only when captured provenance supports it. */
export function canvasNodeTitle(node: GraphNode): string {
  if (node.kind === 'knowledge' || (node.mergeSources.length === 0 && !node.inheritedMergeSources?.length)) return node.title
  return node.title.replace(/^Merge:\s*/u, '') || node.title
}

/** Distinguish equal display titles with the shortest unique identity prefix (at least six characters). */
export function duplicateTitleIds(nodes: Iterable<GraphNode>): ReadonlyMap<string, string> {
  const groups = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.kind === 'knowledge') continue
    // Projection caches can omit inherited markers after a restart. The
    // disambiguator must still identify equal historical titles consistently.
    const title = node.title.replace(/^Merge:\s*/u, '').trim()
    const group = groups.get(title) ?? []
    group.push(node.id)
    groups.set(title, group)
  }
  const labels = new Map<string, string>()
  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    const compact = ids.map(identityPart)
    const identities = new Set(compact).size === ids.length ? compact : ids
    let length = 6
    while (new Set(identities.map(id => id.slice(0, length))).size !== ids.length) length += 1
    ids.forEach((id, index) => labels.set(id, identities[index]!.slice(0, length)))
  }
  return labels
}
