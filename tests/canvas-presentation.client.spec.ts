import { describe, expect, it } from 'vitest'
import type { ClusterInfo, GraphNode } from '../src/client/graph-model.ts'
import type { LaidOutGraph } from '../src/client/layout.ts'
import { deriveCanvasPresentation } from '../src/client/canvas-presentation.ts'
import { deriveSessionGraph, resolveGraphScope } from '../src/client/graph-model.ts'
import { layoutSessionGraph } from '../src/client/layout.ts'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

describe('Canvas presentation derivation', () => {
  it('leaves a direct arrival channel above a Branch cluster instead of routing around its entire title band', () => {
    const list = { byId: Object.fromEntries(['source', 'merged', 'branch'].map(id => [id, {
      id, displayTitle: id, blank: false, running: false, updatedAt: 1, cwd: '/w',
      ...(id === 'branch' ? { parentId: 'merged' } : {}),
      ...(id === 'merged' ? { projectionValues: { sessionGraphMerge: { operationId: 'op', contextEventSeq: 8,
        sources: [{ sessionId: 'source', capturedThroughSeq: 6 }, { sessionId: 'outside', capturedThroughSeq: 6 }],
      } } } : {}),
    }])) } as unknown as SessionListState
    const scope = resolveGraphScope('source' as SessionId, list, { items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null })
    const graph = deriveSessionGraph(list, scope, undefined, new Map())
    const presentation = deriveCanvasPresentation({ laid: layoutSessionGraph(graph), clusters: graph.clusters,
      positions: { source: { x: 0, y: -200 }, merged: { x: 0, y: 0 }, branch: { x: 0, y: 120 } },
      collapsed: new Set(), offsets: {},
    })
    const arrival = presentation.shown.edges.find(({ edge }) => edge.kind === 'merge')!
    expect(arrival.points.every(point => point.x === 120)).toBe(true)
  })

  it('applies positions, collapse, and offsets in domain order and preserves automatic bounds', () => {
    const node = (id: string): GraphNode => ({ id, clusterId: 'root' } as GraphNode)
    const laid: LaidOutGraph = {
      nodes: [
        { node: node('root'), key: 'root', x: 100, y: 0 },
        { node: node('child'), key: 'child', x: 100, y: 120 },
      ],
      edges: [{
        edge: { id: 'branch:root->child', kind: 'branch', from: 'root', to: 'child' },
        path: 'automatic',
      }],
      x: 100,
      y: 0,
      width: 240,
      height: 176,
    }
    const clusters: readonly ClusterInfo[] = [{
      rootId: 'root',
      label: 'Root',
      memberIds: ['root', 'child'],
    }]

    const presentation = deriveCanvasPresentation({
      laid,
      clusters,
      positions: { child: { x: 500, y: 500 } },
      collapsed: new Set(['root']),
      offsets: { root: { dx: 50, dy: 30 } },
    })

    expect(presentation.shown.nodes.map(({ key, x, y }) => ({ key, x, y }))).toEqual([
      { key: 'root', x: 150, y: 30 },
      { key: 'child', x: 150, y: 94 },
    ])
    expect(presentation.frames[0]).toMatchObject({
      clusterId: 'root',
      collapsed: true,
      x: 134,
      y: -18,
    })
    expect(presentation.bounds).toEqual({ x: 134, y: -18, width: 272, height: 184 })
    expect(presentation.automaticBounds).toEqual({ x: 84, y: -48, width: 272, height: 240 })
  })
})
