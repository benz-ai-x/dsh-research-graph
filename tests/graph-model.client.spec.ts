import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { branchLineage, deriveSessionGraph, deriveTopicGraph, matchFilter, resolveGraphScope } from '../src/client/graph-model.ts'
import type { GraphNode } from '../src/client/graph-model.ts'

const id = (value: string): SessionId => value as SessionId

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    cwd: '/w',
    ...over,
  }
}

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    projectionsBySession: {},
  }
}

function workspace(value: string, path: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: value as never,
    path,
    title: `Workspace ${value}`,
    sessionIds: sessionIds.map(id),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function workspacesState(items: WorkspaceView[], archived: string[] = []): WorkspaceSnapshot {
  return {
    items,
    archivedSessionIds: archived.map(id),
    state: 'idle',
    phase: 'ready',
    error: null,
  }
}

function graphFor(
  byId: Record<string, SessionSummary>,
  viewedId?: SessionId,
) {
  const list = listState(byId)
  const scope = resolveGraphScope(
    viewedId ?? id(Object.keys(byId)[0] ?? ''), list, workspacesState([]),
  )
  return deriveSessionGraph(list, scope, viewedId, new Map())
}

describe('resolveGraphScope', () => {
  it('keeps explicit topic references across scopes and availability, with only confirmed lineage', () => {
    const sources = [
      { sessionId: 'a', title: 'A', status: 'listed' as const, archived: false, workspace: { id: 'a', title: 'Workspace A' } },
      { sessionId: 'b', title: 'B', status: 'listed' as const, archived: true, parentSessionId: 'a', workspace: { id: 'b', title: 'Workspace B' } },
      { sessionId: 'missing', title: 'Saved source', status: 'unavailable' as const, archived: false },
      { sessionId: 'blank', title: 'Blank reference', status: 'listed' as const, archived: false },
      { sessionId: 'merge', title: 'Confirmed Merge', status: 'listed' as const, archived: false },
    ]
    const list = listState({ a: session('a'), b: session('b', { cwd: '/elsewhere' }), blank: session('blank', { blank: true }),
      merge: session('merge', { cwd: '/elsewhere', projectionValues: { sessionGraphMerge: {
        operationId: 'merge', contextEventSeq: 8, sources: [{ sessionId: 'a', capturedThroughSeq: 6 }, { sessionId: 'outside', capturedThroughSeq: 4 }],
      } } }),
    })
    const snapshot = { topic: {
      topicId: 'topic-a', title: 'Topic A', references: sources,
      arrangement: { positions: {}, collapsed: [], offsets: {} },
    }, sources }
    const graph = deriveTopicGraph(snapshot, list, id('a'), new Map())
    expect([...graph.nodes.keys()].sort()).toEqual(['a', 'b', 'blank', 'merge', 'missing'])
    expect(graph.edges).toEqual([
      { id: 'branch:a->b', kind: 'branch', from: 'a', to: 'b' }, { id: 'merge:a->merge', kind: 'merge', from: 'a', to: 'merge' },
    ])
    expect(graph.nodes.get('b')?.topicSource).toMatchObject({ workspace: { title: 'Workspace B' }, archived: true })
    expect(graph.nodes.get('missing')).toMatchObject({ title: 'Saved source', topicSource: { status: 'unavailable' } })
    const scope = resolveGraphScope(id('a'), list, workspacesState([], ['b']))
    expect([...deriveSessionGraph(list, scope, id('a'), new Map()).nodes.keys()]).toEqual(['a'])
  })

  it('resolves by sessionIds membership first and unions same-cwd rows into members', () => {
    const list = listState({
      a: session('a'),
      b: session('b', { cwd: '/w' }),
      c: session('c', { cwd: '/other' }),
    })
    const scope = resolveGraphScope(id('a'), list, workspacesState([workspace('w1', '/w', ['a'])]))
    expect(scope).toMatchObject({
      kind: 'workspace',
      arrangement: { key: 'workspace:w1', legacyKey: '/w' },
    })
    expect(scope?.label).toBe('Workspace w1')
    expect(scope?.path).toBe('/w')
    expect(scope?.members.has(id('a'))).toBe(true)
    expect(scope?.members.has(id('b'))).toBe(true)
    expect(scope?.members.has(id('c'))).toBe(false)
  })

  it('falls back to a path match on the viewed session cwd when unaccounted', () => {
    const list = listState({ a: session('a', { cwd: '/w' }) })
    const scope = resolveGraphScope(id('a'), list, workspacesState([workspace('w1', '/w', [])]))
    expect(scope?.label).toBe('Workspace w1')
    expect(scope?.members.has(id('a'))).toBe(true)
  })

  it('builds a label-less cwd-only bucket when no workspace matches', () => {
    const list = listState({
      a: session('a', { cwd: '/loose' }),
      b: session('b', { cwd: '/loose' }),
      c: session('c', { cwd: '/elsewhere' }),
    })
    const scope = resolveGraphScope(id('a'), list, workspacesState([]))
    expect(scope).toMatchObject({
      kind: 'directory',
      arrangement: { key: '/loose', legacyKey: undefined },
    })
    expect(scope?.path).toBe('/loose')
    expect(scope?.members.has(id('a'))).toBe(true)
    expect(scope?.members.has(id('b'))).toBe(true)
    expect(scope?.members.has(id('c'))).toBe(false)
  })

  it('returns undefined when the viewed session has neither membership nor cwd', () => {
    const loose = { ...session('a') }
    delete (loose as Partial<SessionSummary>).cwd
    const list = listState({ a: loose })
    expect(resolveGraphScope(id('a'), list, workspacesState([]))).toBeUndefined()
  })

  it('excludes archived sessions from members', () => {
    const list = listState({ a: session('a'), gone: session('gone') })
    const scope = resolveGraphScope(
      id('a'), list, workspacesState([workspace('w1', '/w', ['a', 'gone'])], ['gone']),
    )
    expect(scope?.members.has(id('gone'))).toBe(false)
  })
})

describe('deriveSessionGraph clusters', () => {
  it('groups Branch-connected Canvas Sessions into a Session Cluster and isolates unattached ones', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      grandchild: session('grandchild', { parentId: id('branchChild'), updatedAt: 300 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['root', 'lone'])
    expect(graph.clusters[0]).toMatchObject({
      rootId: id('root'), label: 'Session root', memberIds: [id('root'), id('branchChild'), id('grandchild')],
    })
    expect(graph.clusters[1]).toMatchObject({ rootId: id('lone'), memberIds: [id('lone')] })
    expect(graph.nodes.get('branchChild')?.clusterId).toBe(id('root'))
    expect(graph.sessionCount).toBe(4)
  })

  it('orders clusters by root recency with an id tiebreak', () => {
    const graph = graphFor({
      old: session('old', { updatedAt: 100 }),
      fresh: session('fresh', { updatedAt: 300 }),
      tieA: session('tieA', { updatedAt: 300 }),
      bB: session('bB', { updatedAt: 300 }),
      aA: session('aA', { updatedAt: 300 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['aA', 'bB', 'fresh', 'tieA', 'old'])
  })

  it('indexes Branch children with linear parent lookups', () => {
    let parentReads = 0
    const count = 80
    const rows: Record<string, SessionSummary> = {}
    for (let index = 0; index < count; index += 1) {
      const key = `node-${String(index)}`
      const row = session(key, { updatedAt: count - index })
      const parentId = index === 0 ? undefined : id(`node-${String(index - 1)}`)
      Object.defineProperty(row, 'parentId', {
        enumerable: true,
        get: () => {
          parentReads += 1
          return parentId
        },
      })
      rows[key] = row
    }

    expect(graphFor(rows).sessionCount).toBe(count)
    expect(parentReads).toBeLessThan(count * 10)
  })
})

describe('deriveSessionGraph subagent folding', () => {
  it('keeps subagent sessions off the canvas and badges every ancestor along the chain', () => {
    const graph = graphFor({
      root: session('root'),
      sub1: session('sub1', { parentId: id('root'), origin: 'subagent', running: true }),
      sub2: session('sub2', { parentId: id('root'), origin: 'subagent' }),
      deep: session('deep', { parentId: id('sub1'), origin: 'subagent', running: true }),
    })
    expect(graph.nodes.has('sub1')).toBe(false)
    expect(graph.nodes.has('sub2')).toBe(false)
    expect(graph.nodes.has('deep')).toBe(false)
    expect(graph.nodes.get('root')).toMatchObject({ subagentCount: 3, runningSubagents: 2 })
    expect(graph.nodes.get('root')?.subagents?.map(agent => agent.id).sort()).toEqual(['deep', 'sub1', 'sub2'])
    expect(graph.nodes.get('root')?.subagents?.find(agent => agent.id === 'sub1')?.displayStatus).toBe('running')
    expect(graph.clusters[0]?.memberIds).toEqual([id('root')])
  })

  it('terminates Subagent Summary propagation at a Branch boundary', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      branchSub: session('branchSub', { parentId: id('branchChild'), origin: 'subagent' }),
    })
    expect(graph.nodes.get('root')?.subagentCount).toBe(0)
    expect(graph.nodes.get('root')?.subagents).toBeUndefined()
    expect(graph.nodes.get('branchChild')).toMatchObject({ subagentCount: 1, runningSubagents: 0 })
    expect(graph.nodes.get('branchChild')?.subagents?.map(agent => agent.id)).toEqual(['branchSub'])
  })
})

describe('deriveSessionGraph edges', () => {
  it('keeps inherited Merge snapshots on Branches from creating repeated Merge Relations', () => {
    const projectionValues = { sessionGraphMerge: {
      operationId: 'palantir-merge', contextEventSeq: 8,
      sources: ['analysis-a', 'analysis-b', 'analysis-c'].map(sessionId => ({ sessionId, capturedThroughSeq: 6 })),
    } }
    const graph = graphFor({
      'analysis-a': session('analysis-a'),
      'analysis-b': session('analysis-b'),
      'analysis-c': session('analysis-c'),
      merged: session('merged', { projectionValues }),
      'branch-a': session('branch-a', { parentId: id('merged'), projectionValues }),
      'branch-b': session('branch-b', { parentId: id('merged'), projectionValues }),
    })

    expect(graph.edges.filter(edge => edge.kind === 'branch')).toHaveLength(2)
    expect(graph.edges.filter(edge => edge.kind === 'merge').map(edge => edge.to)).toEqual(['merged', 'merged', 'merged'])
    expect(graph.nodes.get('branch-a')).toMatchObject({ mergeSources: [], inheritedMergeSources: projectionValues.sessionGraphMerge.sources })
  })

  it.each(['workspace', 'topic', 'topic-before-refresh'] as const)('retains inherited snapshots without inventing a Merge when the parent is outside the %s', scopeKind => {
    const projectionValues = { sessionGraphMerge: { operationId: 'original-merge', contextEventSeq: 8,
      sources: [{ sessionId: 'a', capturedThroughSeq: 6 }, { sessionId: 'b', capturedThroughSeq: 4 }],
    } }
    const rows = { a: session('a'), b: session('b'), branch: session('branch', { parentId: id('outside'), projectionValues }) }
    const sources = Object.values(rows).map(row => ({ sessionId: row.id, title: row.displayTitle, status: 'listed' as const,
      archived: false, ...(row.parentId === undefined || scopeKind === 'topic-before-refresh' ? {} : { parentSessionId: row.parentId }),
    }))
    const graph = scopeKind === 'workspace' ? graphFor(rows) : deriveTopicGraph({
      topic: { topicId: 'topic', title: 'Topic', references: sources, arrangement: { positions: {}, collapsed: [], offsets: {} } }, sources,
    }, listState(rows), undefined, new Map())
    expect(graph.edges).toEqual([])
    expect(graph.nodes.get('branch')).toMatchObject({ branchFrom: undefined, mergeSources: [], inheritedMergeSources: projectionValues.sessionGraphMerge.sources })
  })

  it('preserves independent successive Merges even when they share source snapshots', () => {
    const projectionValues = { sessionGraphMerge: { operationId: 'operation-a', contextEventSeq: 8,
      sources: [{ sessionId: 'a', capturedThroughSeq: 6 }, { sessionId: 'b', capturedThroughSeq: 4 }],
    } }
    const graph = graphFor({ a: session('a'), b: session('b'), merged: session('merged', { projectionValues }),
      independent: session('independent', { projectionValues: { sessionGraphMerge: { ...projectionValues.sessionGraphMerge, operationId: 'operation-b' } } }),
    })
    expect(graph.edges.filter(edge => edge.kind === 'merge')).toHaveLength(4)
    expect(graph.nodes.get('independent')?.inheritedMergeSources).toBeUndefined()
  })

  it('keeps Branch edges inside the Session Cluster between attached Canvas Sessions', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      child: session('child', { parentId: id('root'), updatedAt: 400 }),
    })
    expect(graph.children.get('root')).toEqual(['child'])
    expect(graph.edges).toContainEqual({
      id: 'branch:root->child', kind: 'branch', from: 'root', to: 'child',
    })
  })

  it('renders a Branch from a Subagent Session as a new Root Session without an edge', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      sub: session('sub', { parentId: id('root'), origin: 'subagent', updatedAt: 400 }),
      branchOfSub: session('branchOfSub', { parentId: id('sub'), updatedAt: 300 }),
    })
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['root', 'branchOfSub'])
    expect(graph.edges.some(edge => edge.to === 'branchOfSub')).toBe(false)
  })

  it('excludes sessions outside the graph scope', () => {
    const list = listState({
      inside: session('inside'),
      outside: session('outside', { cwd: '/elsewhere' }),
    })
    const scope = resolveGraphScope(id('inside'), list, workspacesState([workspace('w1', '/w', ['inside'])]))
    const graph = deriveSessionGraph(list, scope, undefined, new Map())
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['inside'])
  })

  it('derives Merge Relations without joining the independent Session Clusters', () => {
    const graph = graphFor({
      sourceA: session('sourceA', { updatedAt: 300 }),
      sourceB: session('sourceB', { updatedAt: 200 }),
      target: session('target', {
        updatedAt: 900,
        projectionValues: {
          sessionGraphMerge: {
            operationId: 'operation-1',
            contextEventSeq: 8,
            sources: [
              { sessionId: 'sourceA', capturedThroughSeq: 3 },
              { sessionId: 'sourceB', capturedThroughSeq: 4 },
            ],
          },
        },
      }),
    })

    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual([
      'sourceA', 'sourceB', 'target',
    ])
    expect(graph.nodes.get('target')?.mergeSources).toEqual([
      { sessionId: 'sourceA', capturedThroughSeq: 3 },
      { sessionId: 'sourceB', capturedThroughSeq: 4 },
    ])
    expect(graph.edges).toEqual([
      { id: 'merge:sourceA->target', kind: 'merge', from: 'sourceA', to: 'target' },
      { id: 'merge:sourceB->target', kind: 'merge', from: 'sourceB', to: 'target' },
    ])
  })
})

describe('deriveSessionGraph visibility rules', () => {
  it('excludes blank sessions except the Viewed Session', () => {
    const graph = graphFor({
      real: session('real', { updatedAt: 100 }),
      blankOther: session('blankOther', { blank: true }),
      blankMine: session('blankMine', { blank: true, updatedAt: 500 }),
    }, id('blankMine'))
    expect(graph.clusters.map(cluster => cluster.rootId)).toEqual(['blankMine', 'real'])
  })

  it('marks the Viewed Session', () => {
    const graph = graphFor({
      a: session('a'),
      b: session('b'),
    }, id('b'))
    expect(graph.nodes.get('a')?.viewed).toBe(false)
    expect(graph.nodes.get('b')?.viewed).toBe(true)
  })

  it('derives one Display Status with Running before Waiting for Input before Completed', () => {
    const list = listState({
      running: session('running', { running: true }),
      waiting: session('waiting'),
      completed: session('completed'),
    })
    const scope = resolveGraphScope(id('running'), list, workspacesState([]))
    const graph = deriveSessionGraph(
      list,
      scope,
      id('running'),
      new Map([
        [id('running'), { running: true, pendingInteraction: {}, completionUnread: true }],
        [id('waiting'), { running: false, pendingInteraction: {}, completionUnread: false }],
        [id('completed'), { running: false, pendingInteraction: undefined, completionUnread: true }],
      ]),
    )

    expect(graph.nodes.get('running')?.displayStatus).toBe('running')
    expect(graph.nodes.get('waiting')?.displayStatus).toBe('waiting-input')
    expect(graph.nodes.get('completed')?.displayStatus).toBe('completed')
  })
})

describe('deriveSessionGraph projection facts', () => {
  const factValues = {
    title: '缓存架构调研',
    sessionStats: { turns: 3, steps: 12, llmMs: 45_000, toolMs: 8_200, ttftMs: 300, ttftSteps: 3, decodeMs: 4_000, decodeTokens: 700 },
    modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-chat' }, next: { provider: 'deepseek', model: 'deepseek-reasoner' } },
    turnOutline: [
      { turn: 1, seq: 1, prompt: '调研缓存方案', response: '已比较三种方案' },
      { turn: 2, seq: 5, prompt: '比较一致性边界', response: '一致性取决于失效策略' },
    ],
    tokenUsage: { uncachedInputTokens: 1_200, outputTokens: 800, cacheReadTokens: 3_000, cacheWriteTokens: 400 },
    contextPressure: { projectedTokens: 63_000, contextWindow: 100_000 },
    goal: {
      goal: { id: 'goal-1' as never, revision: 2, objective: '输出缓存调研报告', phase: 'active' as const, maxGoalRounds: 10 },
      roundsStarted: 2, createdAt: 1, updatedAt: 2,
    },
    todos: [
      { content: '收集方案', status: 'completed' as const },
      { content: '对比验证', status: 'completed' as const },
      { content: '撰写报告', status: 'in_progress' as const },
    ],
    agentPreset: 'researcher',
  }

  it('folds projection values into the node fact fields', () => {
    const graph = graphFor({ root: session('root', { projectionValues: factValues }) })
    expect(graph.nodes.get('root')).toMatchObject({
      turns: 3,
      sessionStats: factValues.sessionStats,
      modelLabel: 'deepseek/deepseek-reasoner',
      lastPromptPreview: '比较一致性边界',
      lastResponsePreview: '一致性取决于失效策略',
      tokenTotal: 5_400,
      goalLabel: '输出缓存调研报告',
      goalPhase: 'active',
      todoProgress: { completed: 2, total: 3 },
      contextPressurePercent: '63%',
      presetLabel: 'researcher',
    })
  })

  it('keeps every fact field absent when no projection values exist', () => {
    const node = graphFor({ root: session('root') }).nodes.get('root')
    expect(node).toBeDefined()
    for (const key of ['turns', 'sessionStats', 'modelLabel', 'lastPromptPreview', 'lastResponsePreview',
      'tokenTotal', 'goalLabel', 'goalPhase', 'todoProgress', 'contextPressurePercent', 'presetLabel'] as const) {
      expect(node).not.toHaveProperty(key)
    }
  })

  it('falls back to the last-used route and skips empty previews, a null goal, and empty todos', () => {
    const graph = graphFor({
      root: session('root', {
        projectionValues: {
          modelSelection: { lastUsed: { provider: 'p', model: 'm' }, next: null },
          turnOutline: [{ turn: 1, seq: 1, prompt: '', response: '' }],
          goal: null,
          todos: [],
          contextPressure: { projectedTokens: 50 },
        },
      }),
    })
    const node = graph.nodes.get('root')
    expect(node?.modelLabel).toBe('p/m')
    for (const key of ['lastPromptPreview', 'lastResponsePreview', 'goalLabel', 'goalPhase', 'todoProgress', 'contextPressurePercent'] as const) {
      expect(node).not.toHaveProperty(key)
    }
  })

  it('omits the context pressure text without a positive context window', () => {
    for (const contextPressure of [{ contextWindow: 100_000 }, { projectedTokens: 63_000, contextWindow: 0 }]) {
      const node = graphFor({ root: session('root', { projectionValues: { contextPressure } }) }).nodes.get('root')
      expect(node).not.toHaveProperty('contextPressurePercent')
    }
  })
})

describe('branchLineage', () => {
  it('collects the Branch ancestors, self, and descendants — never siblings', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 500 }),
      branchChild: session('branchChild', { parentId: id('root'), updatedAt: 400 }),
      branchChild2: session('branchChild2', { parentId: id('root'), updatedAt: 350 }),
      grandchild: session('grandchild', { parentId: id('branchChild'), updatedAt: 300 }),
      lone: session('lone', { updatedAt: 200 }),
    })
    const around = branchLineage(graph.nodes.values(), 'branchChild')
    expect([...around].sort()).toEqual(['branchChild', 'grandchild', 'root'])
    expect(branchLineage(graph.nodes.values(), 'branchChild2')).toEqual(new Set(['branchChild2', 'root']))
    expect(branchLineage(graph.nodes.values(), 'lone')).toEqual(new Set(['lone']))
  })

  it('returns an empty set for an unknown key and survives branch cycles', () => {
    const graph = graphFor({ solo: session('solo') })
    expect(branchLineage(graph.nodes.values(), 'ghost').size).toBe(0)
    const cyclic = [
      { id: 'a', branchFrom: 'b' },
      { id: 'b', branchFrom: 'a' },
    ] as unknown as GraphNode[]
    expect([...branchLineage(cyclic, 'a')].sort()).toEqual(['a', 'b'])
  })
})

describe('matchFilter', () => {
  it('matches titles case-insensitively, empty-handed queries dim all, blank stays inactive', () => {
    const graph = graphFor({
      alpha: session('alpha', { displayTitle: 'Fix login bug' }),
      beta: session('beta', { displayTitle: 'Add LOGIN page' }),
      gamma: session('gamma', { displayTitle: 'Refactor graph' }),
    })
    expect(matchFilter(graph.nodes.values(), 'login')).toEqual(new Set(['alpha', 'beta']))
    expect(matchFilter(graph.nodes.values(), ' graph ')).toEqual(new Set(['gamma']))
    expect(matchFilter(graph.nodes.values(), 'zzz')?.size).toBe(0)
    expect(matchFilter(graph.nodes.values(), '')).toBeNull()
    expect(matchFilter(graph.nodes.values(), '   ')).toBeNull()
  })
})
