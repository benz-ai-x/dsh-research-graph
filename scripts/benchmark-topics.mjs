/** Descriptive local baseline; no performance threshold is imposed. */
import { cpus, arch, platform, release, totalmem } from 'node:os'
import { performance } from 'node:perf_hooks'
import { researchTopicFixture } from '../tests/fixtures/research-topics.ts'
import { deriveSessionGraph, deriveTopicGraph, resolveGraphScope, branchLineage } from '../src/client/graph-model.ts'
import { layoutSessionGraph } from '../src/client/layout.ts'
import { deriveCanvasPresentation } from '../src/client/canvas-presentation.ts'

const list = byId => ({ byId, ids: Object.keys(byId), phase: 'ready', current: undefined,
  subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
const fixture = researchTopicFixture()
const rows = list(fixture.rows)
const samples = []
for (let iteration = 0; iteration < 7; iteration += 1) {
  const start = performance.now()
  const graph = deriveTopicGraph(fixture.b, rows, undefined, new Map())
  const derived = performance.now()
  const laid = layoutSessionGraph(graph)
  const laidAt = performance.now()
  deriveCanvasPresentation({ laid, clusters: graph.clusters, positions: {}, collapsed: new Set(), offsets: {} })
  const presented = performance.now()
  branchLineage(graph.nodes.values(), 'source-0990')
  const selected = performance.now()
  if (iteration > 0) samples.push({ deriveMs: derived - start, layoutMs: laidAt - derived,
    presentationMs: presented - laidAt, lineageSelectionMs: selected - presented })
}
const chain = list(Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => {
  const id = `chain-${index}`
  return [id, { id, displayTitle: id, cwd: '/chain', running: false, blank: false, updatedAt: 1,
    ...(index === 0 ? {} : { parentId: `chain-${index - 1}` }) }]
})))
const start = performance.now()
const scope = resolveGraphScope('chain-0', chain, { items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null })
const graph = deriveSessionGraph(chain, scope, undefined, new Map())
const derived = performance.now()
const laid = layoutSessionGraph(graph)
const end = performance.now()
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}
console.log(JSON.stringify({
  recordedAt: new Date().toISOString(), node: process.version,
  device: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: totalmem() / 1024 ** 3, arch: arch(), os: `${platform()} ${release()}` },
  fixture: { references: 1000, workspaces: 4, archived: 200, missing: 100, warmups: 1, measuredRuns: samples.length },
  medianMs: Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))])),
  samples,
  deepChain: { nodes: laid.nodes.length, edges: laid.edges.length, deriveMs: derived - start, layoutMs: end - derived },
}, null, 2))
