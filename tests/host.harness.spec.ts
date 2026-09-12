import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SessionStore from '@deepseek-ai/dsh-session'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SessionProjectionCache from '@deepseek-ai/dsh-session-projection-cache'
import Storage from '@deepseek-ai/dsh-storage'
import {
  apply as storageJsonApply,
  Config as storageJsonConfig,
  inject as storageJsonInject,
  name as storageJsonName,
} from '@deepseek-ai/dsh-storage-json'
import {
  apply as storageDomainApply,
  Config as storageDomainConfig,
  inject as storageDomainInject,
  name as storageDomainName,
} from '@deepseek-ai/dsh-storage-domain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import { sessionMergeDependenciesFromHarness } from '../src/session-merge-harness.ts'
import { sessionMergeMarkerOfEvent } from '../src/session-merge-projection.ts'

const id = (value: string): SessionId => value as SessionId

function remoteFailureOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Readonly<Record<string, unknown>>
  if (typeof record.code === 'string') return record
  const failure = record.failure
  return failure !== null && typeof failure === 'object' && !Array.isArray(failure)
    ? failure as Readonly<Record<string, unknown>>
    : undefined
}

describe('Session Graph Host integration', () => {
  const contexts: Context[] = []
  const roots: string[] = []

  afterEach(async () => {
    for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
  })

  async function durableContext(root: string): Promise<Context> {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Storage)
    await ctx.plugin({
      name: storageJsonName,
      inject: storageJsonInject,
      apply: storageJsonApply,
      Config: storageJsonConfig,
    }, { root })
    await ctx.plugin({
      name: storageDomainName,
      inject: storageDomainInject,
      apply: storageDomainApply,
      Config: storageDomainConfig,
    }, { backend: 'json' })
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('llm', { async *stream() {} })
    await apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    await ctx.plugin(SessionProjectionCache, {
      writeEveryEvents: 100,
      writeIntervalMs: 60_000,
    })
    return ctx
  }

  it('reads the addressed Session and makes a separate routed model call without mutating its log', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const events = [
      {
        type: 'user/message', seq: 0, time: 1,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Choose the cache architecture.' }],
        },
      },
      {
        type: 'request/context', seq: 1, time: 2,
        data: { provider: 'session-provider', model: 'session-model' },
      },
      { type: 'turn/end', seq: 2, time: 3, data: { turn: 1 } },
      { type: 'session/title', seq: 3, time: 4, data: { title: 'Cache architecture' } },
    ]
    const before = structuredClone(events)
    const inspect = vi.fn(async (sessionId: SessionId) => ({
      meta: { id: sessionId },
      events,
    }))
    const calls: Readonly<Record<string, unknown>>[] = []
    ctx.provide('sessionController', { inspect })
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        calls.push(options)
        yield {
          type: 'text-delta', index: 0,
          text: '{"overview":"A cache strategy was chosen.","keyOutcomes":["Use memory first."],"openItems":["Evaluate persistence."]}',
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    })
    await apply(ctx)
    const service = ctx.get('sessionGraphDigest') as {
      generate: (
        request: { readonly sessionId: string; readonly refresh: boolean },
        signal: AbortSignal,
      ) => Promise<unknown>
    }

    const result = await service.generate(
      { sessionId: 'selected-session', refresh: false },
      new AbortController().signal,
    )

    expect(inspect).toHaveBeenCalledWith(id('selected-session'), expect.any(AbortSignal))
    expect(result).toMatchObject({
      kind: 'ready',
      digest: {
        sessionId: 'selected-session',
        sourceRevision: '3',
        overview: 'A cache strategy was chosen.',
        generatedWhileRunning: false,
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      provider: 'session-provider',
      model: 'session-model',
      maxTokens: 4_096,
    })
    expect(calls[0]).not.toHaveProperty('tools')
    expect(events).toEqual(before)

    await service.generate(
      { sessionId: 'selected-session', refresh: false },
      new AbortController().signal,
    )
    expect(calls).toHaveLength(1)
  })

  it('leaves room for reasoning and structured digest output with the default budget', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const events = [
      {
        type: 'request/context', seq: 0, time: 1,
        data: { provider: 'reasoning-provider', model: 'reasoning-model' },
      },
      {
        type: 'user/message', seq: 1, time: 2,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Compare the research findings.' }],
        },
      },
    ]
    const before = structuredClone(events)
    ctx.provide('sessionController', { inspect: async () => ({ meta: { id: 'source' }, events }) })
    const calls: Readonly<Record<string, unknown>>[] = []
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        calls.push(options)
        // Simulate 1,024 reasoning tokens followed by a 512-token JSON response.
        yield {
          type: 'reasoning-delta', index: 0,
          text: 'Identify supported findings and unresolved questions.',
        }
        if (Number(options.maxTokens) < 1_536) {
          yield { type: 'finish', reason: { kind: 'max-tokens' } }
          return
        }
        yield {
          type: 'text-delta', index: 1,
          text: JSON.stringify({
            overview: 'The approaches have different tradeoffs.',
            keyOutcomes: ['Keep the sources.'],
            openItems: ['Test both approaches.'],
          }),
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    })
    await apply(ctx)

    const result = await ctx.sessionGraphDigest.generate(
      { sessionId: 'source', refresh: false },
      new AbortController().signal,
    )

    expect(result).toMatchObject({ kind: 'ready', digest: { overview: 'The approaches have different tradeoffs.' } })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ provider: 'reasoning-provider', model: 'reasoning-model' })
    expect(calls[0]).not.toHaveProperty('reasoningEffort')
    expect(events).toEqual(before)
  })

  it('reports an explicit output cap without caching truncated JSON or retrying the model automatically', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const events = [
      {
        type: 'request/context', seq: 0, time: 1,
        data: { provider: 'provider', model: 'model' },
      },
      {
        type: 'user/message', seq: 1, time: 2,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Summarize the decision.' }],
        },
      },
    ]
    const before = structuredClone(events)
    ctx.provide('sessionController', { inspect: async () => ({ meta: { id: 'source' }, events }) })
    const calls: Readonly<Record<string, unknown>>[] = []
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        calls.push(options)
        const first = calls.length === 1
        yield {
          type: 'text-delta', index: 0,
          text: JSON.stringify({
            overview: first ? 'Partial result.' : 'Complete result.',
            keyOutcomes: [],
            openItems: [],
          }),
        }
        yield { type: 'finish', reason: { kind: first ? 'max-tokens' : 'stop' } }
      },
    })
    await apply(ctx, { maxOutputTokens: 800 })
    const request = { sessionId: 'source', refresh: false }

    await expect(ctx.sessionGraphDigest.generate(request, new AbortController().signal))
      .rejects.toMatchObject({ code: 'output-limit' })
    expect(calls).toHaveLength(1)
    const result = await ctx.sessionGraphDigest.generate(request, new AbortController().signal)
    expect(result).toMatchObject({ kind: 'ready', cached: false, digest: { overview: 'Complete result.' } })
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.maxTokens === 800)).toBe(true)
    expect(await ctx.sessionGraphDigest.generate(request, new AbortController().signal))
      .toMatchObject({ kind: 'ready', cached: true, digest: { overview: 'Complete result.' } })
    expect(calls).toHaveLength(2)
    expect(events).toEqual(before)
  })

  it('aborts and joins Session Digest work before Host disposal completes', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    let releaseModel: (() => void) | undefined
    const modelBarrier = new Promise<void>((resolve) => { releaseModel = resolve })
    let modelSignal: AbortSignal | undefined
    ctx.provide('sessionController', {
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId },
        events: [{
          type: 'user/message',
          seq: 0,
          time: 1,
          data: {
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'Wait for plugin disposal.' }],
          },
        }],
      }),
    })
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        modelSignal = options.signal as AbortSignal
        await modelBarrier
        modelSignal.throwIfAborted()
      },
    })
    await apply(ctx, { provider: 'provider', model: 'model' })
    const service = ctx.get('sessionGraphDigest') as {
      generate: (
        request: { readonly sessionId: string; readonly refresh: boolean },
        signal: AbortSignal,
      ) => Promise<unknown>
    }
    const result = service.generate(
      { sessionId: 'dispose-session', refresh: false },
      new AbortController().signal,
    ).then(value => value, error => error)
    while (modelSignal === undefined) await Promise.resolve()

    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    await new Promise(resolve => setImmediate(resolve))
    const modelAbortedDuringDisposal = modelSignal.aborted
    const disposalSettledBeforeModel = disposed
    const disposalService = ctx.get('sessionGraphDigest') as typeof service | undefined
    const servicePublishedDuringDisposal = disposalService !== undefined
    const lateRequest = disposalService?.generate(
      { sessionId: 'late-session', refresh: false },
      new AbortController().signal,
    ).then(value => value, error => error) ?? Promise.resolve(undefined)

    releaseModel?.()
    await disposal
    expect(modelAbortedDuringDisposal).toBe(true)
    expect(disposalSettledBeforeModel).toBe(false)
    expect(servicePublishedDuringDisposal).toBe(true)
    expect(remoteFailureOf(await lateRequest)).toMatchObject({ code: 'disposed' })
    expect(remoteFailureOf(await result)).toMatchObject({ code: 'disposed' })
    expect(ctx.get('sessionGraphDigest')).toBeUndefined()
  })

  it('registers the durable Session Merge projection with the Harness registry', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('llm', { async *stream() {} })

    await apply(ctx)
    await Promise.resolve()
    const session = ctx.sessions.create()
    session.append('step/start', { turn: 1, step: 1 })
    session.append('user/message', {
      id: 'marker',
      role: 'user',
      source: {
        kind: 'session-graph-merge', version: 1,
        operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
      },
      content: [{ type: 'text', text: 'Merge sources.' }],
    } as never, { surfaceOp: 'append' })
    session.append('user/message', {
      id: 'references',
      role: 'user',
      source: {
        kind: 'session-reference', version: 1,
        references: [
          { sessionId: 'source-a', capturedThroughSeq: 3, inputIndex: 0 },
          { sessionId: 'source-b', capturedThroughSeq: 4, inputIndex: 1 },
        ],
      },
      content: [{ type: 'text', text: 'snapshots' }],
    } as never, { surfaceOp: 'append' })

    expect(ctx.sessionProjections.snapshot(session).values.sessionGraphMerge).toEqual({
      operationId: 'operation-1',
      contextEventSeq: 2,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    })
  })

  it('restores a Merge relation from the durable Projection Cache after restart and log replay', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-session-merge-'))
    roots.push(root)
    const first = await durableContext(root)
    const targetId = id('merge-target')
    const target = first.sessions.create(targetId, {
      meta: { cwd: '/workspace', createdAt: 1_000 },
    })
    target.append('step/start', { turn: 1, step: 1 })
    target.append('user/message', {
      id: 'marker',
      role: 'user',
      source: {
        kind: 'session-graph-merge', version: 1,
        operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
      },
      content: [{ type: 'text', text: 'Merge sources.' }],
    } as never, { surfaceOp: 'append' })
    target.append('user/message', {
      id: 'references',
      role: 'user',
      source: {
        kind: 'session-reference', version: 1,
        references: [
          { sessionId: 'source-a', capturedThroughSeq: 3, inputIndex: 0 },
          { sessionId: 'source-b', capturedThroughSeq: 4, inputIndex: 1 },
        ],
      },
      content: [{ type: 'text', text: 'snapshots' }],
    } as never, { surfaceOp: 'append' })
    const header = structuredClone(target.header)
    const events = structuredClone(target.snapshotEvents())
    await first.sessionProjectionCache.write(target)
    expect(first.sessionProjectionCache.cachedSnapshot(header, target.inheritedEventCount)?.values.sessionGraphMerge)
      .toMatchObject({ operationId: 'operation-1', contextEventSeq: 2 })

    await first.fiber.dispose()
    contexts.splice(contexts.indexOf(first), 1)

    const restarted = await durableContext(root)
    expect(restarted.sessionProjectionCache.cachedSnapshot(header, target.inheritedEventCount)?.values.sessionGraphMerge)
      .toEqual({
        operationId: 'operation-1',
        contextEventSeq: 2,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      })
    expect(restarted.sessionProjectionCache.coldSnapshot(header, target.inheritedEventCount, events).values.sessionGraphMerge)
      .toEqual({
        operationId: 'operation-1',
        contextEventSeq: 2,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      })
  })

  it('submits marker and canonical mentions through the package Host Remote', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const queued: Array<Readonly<Record<string, unknown>>> = []
    const capture = {
      operationId: 'operation-1',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    let projection: typeof capture | null = null
    const targetSession = { header: { cwd: '/workspace' }, snapshotEvents: () => [] }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: (message: Readonly<Record<string, unknown>>) => {
        queued.push(message)
      },
      steer: (message: Readonly<Record<string, unknown>>) => {
        queued.push(message)
        projection = capture
      },
    }
    const write = vi.fn(async () => {})
    ctx.provide('llm', { async *stream() {} })
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ agent }),
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId, cwd: `/${sessionId}` },
        events: [{ type: 'turn/start', data: { turn: 1 } }],
      }),
    })
    ctx.provide('sessionReferenceResolver', {
      remoteExportCandidates: async (_agent: unknown, query: string) => [{
        sessionId: query,
        label: query,
        cwd: '/workspace',
        sameWorkspace: true,
        createdAt: 0,
        mention: `@[${query}](dsh-session:${query})`,
      }],
    })
    ctx.provide('sessionProjections', {
      register: () => () => {},
      stateOf: () => projection === null
        ? { inStep: false, marker: null, value: null }
        : { inStep: true, marker: null, value: projection },
      onChanged: () => () => {},
    })
    ctx.provide('sessionProjectionCache', { write })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [], list: () => [{ id: 'research', path: '/workspace', sessionIds: [id('target-session')] }] })
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(TypertGatewayService)

    await apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    // Source-mode discovery recognizes the final parameter named signal.
    // A direct service call would conceal a missing cancellation wire argument.
    const result = await ctx.typertGateway.invoke({ namespace: 'sessionGraphMerge', method: 'submit', args: { request: {
      targetSessionId: 'target-session', targetWorkspaceId: 'research',
      sourceIds: ['source-a', 'source-b'], instruction: 'Compare conclusions.', operationId: 'operation-1',
    } }, signal: new AbortController().signal })

    expect(result).toEqual(capture)
    expect(queued).toHaveLength(2)
    expect(queued[0]).toMatchObject({
      role: 'user',
      source: {
        kind: 'plugin',
        plugin: 'dsh-session-graph',
        form: 'notice',
        summary: 'Session Merge source snapshot request.',
      },
    })
    expect(sessionMergeMarkerOfEvent({ type: 'user/message', data: queued[0] })).toEqual({
      operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
    })
    expect(queued[1]).toMatchObject({
      role: 'user',
      source: { kind: 'user' },
      content: [{
        type: 'text',
        text: 'Compare conclusions.\n\n@[source-a](dsh-session:source-a)\n@[source-b](dsh-session:source-b)',
      }],
    })
    expect(write).toHaveBeenCalledWith(targetSession)
  })

  it('aborts pre-commit Merge work and stays published until Host-owned commit settles', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const capture = {
      operationId: 'operation-1',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    let projection: typeof capture | null = null
    const targetSession = { header: { cwd: '/workspace' }, snapshotEvents: () => [] }
    const waitingTargetSession = { header: { cwd: '/workspace' }, snapshotEvents: () => [] }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: () => {},
      steer: () => { projection = capture },
    }
    const waitingAgent = {
      id: id('waiting-target'),
      session: waitingTargetSession,
      inject: () => {},
      steer: () => {},
    }
    let startCaptureWait: (() => void) | undefined
    const captureWaitStarted = new Promise<void>((resolve) => { startCaptureWait = resolve })
    let captureListenerDisposed = false
    let startCommit: (() => void) | undefined
    const commitStarted = new Promise<void>((resolve) => { startCommit = resolve })
    let releaseCommit: (() => void) | undefined
    const commitBarrier = new Promise<void>((resolve) => { releaseCommit = resolve })
    ctx.provide('llm', { async *stream() {} })
    ctx.provide('sessionController', {
      resolveAgent: async (sessionId: SessionId) => ({
        agent: sessionId === id('waiting-target') ? waitingAgent : agent,
      }),
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId, cwd: '/workspace' },
        events: [{ type: 'turn/start', data: { turn: 1 } }],
      }),
    })
    ctx.provide('sessionReferenceResolver', {
      remoteExportCandidates: async (_agent: unknown, query: string) => [{
        sessionId: query,
        label: query,
        cwd: '/workspace',
        sameWorkspace: true,
        createdAt: 0,
        mention: `@[${query}](dsh-session:${query})`,
      }],
    })
    ctx.provide('sessionProjections', {
      register: () => () => {},
      stateOf: (session: unknown) => session !== targetSession || projection === null
        ? { inStep: false, marker: null, value: null }
        : { inStep: true, marker: null, value: projection },
      onChanged: () => {
        startCaptureWait?.()
        return () => { captureListenerDisposed = true }
      },
    })
    ctx.provide('sessionProjectionCache', {
      write: async () => {
        startCommit?.()
        await commitBarrier
      },
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [], list: () => [] })

    await apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    const service = ctx.get('sessionGraphMerge') as {
      submit: (request: Readonly<Record<string, unknown>>, signal: AbortSignal) => Promise<unknown>
    }
    const request = {
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }
    const waitingController = new AbortController()
    let waitingSettled = false
    let waitingOutcome: unknown
    const waitingResult = service.submit({
      ...request,
      targetSessionId: 'waiting-target',
      operationId: 'waiting-operation',
    }, waitingController.signal).then(
      value => {
        waitingSettled = true
        waitingOutcome = value
      },
      error => {
        waitingSettled = true
        waitingOutcome = error
      },
    )
    await captureWaitStarted
    const result = service.submit(request, new AbortController().signal)
    await commitStarted

    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    await new Promise(resolve => setImmediate(resolve))
    const disposalSettledBeforeCommit = disposed
    const preCommitAbortedDuringDisposal = waitingSettled
    const captureListenerRemovedDuringDisposal = captureListenerDisposed
    const disposalService = ctx.get('sessionGraphMerge') as typeof service | undefined
    const servicePublishedDuringCommit = disposalService !== undefined
    const lateRequest = disposalService?.submit({ ...request, operationId: 'late-operation' },
      new AbortController().signal).then(value => value, error => error)
      ?? Promise.resolve(undefined)

    waitingController.abort(new Error('test cleanup'))
    releaseCommit?.()
    await expect(result).resolves.toEqual(capture)
    await waitingResult
    await disposal
    expect(disposalSettledBeforeCommit).toBe(false)
    expect(preCommitAbortedDuringDisposal).toBe(true)
    expect(captureListenerRemovedDuringDisposal).toBe(true)
    expect(servicePublishedDuringCommit).toBe(true)
    expect(remoteFailureOf(waitingOutcome)).toMatchObject({ code: 'disposed' })
    expect(remoteFailureOf(await lateRequest)).toMatchObject({ code: 'disposed' })
    expect(ctx.get('sessionGraphMerge')).toBeUndefined()
  })

  it('derives source qualification from Host Session and Workspace truth', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ error: { message: 'unused' } }),
      inspect: async (sessionId: SessionId) => ({
        meta: {
          id: sessionId,
          cwd: '/workspace',
          origin: 'subagent' as const,
        },
        events: [],
      }),
    })
    ctx.provide('sessionReferenceResolver', {
      remoteExportCandidates: async (_agent: unknown, query: string) => [{
        sessionId: id(query),
        cwd: '/workspace',
        mention: `@[${query}](dsh-session:${query})`,
      }],
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [id('source-a')] })
    const dependencies = sessionMergeDependenciesFromHarness(ctx)

    const source = await dependencies.resolveSource({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      archived: false,
      events: [],
      handle: {
        id: id('target-session'),
        session: { header: { cwd: '/workspace' }, snapshotEvents: () => [] },
        inject: () => {},
        steer: () => {},
      },
    }, 'source-a', new AbortController().signal)

    expect(source).toEqual({
      sessionId: 'source-a',
      cwd: '/workspace',
      mention: '@[source-a](dsh-session:source-a)',
      origin: 'subagent',
      archived: true,
      blank: true,
    })
  })

  it('derives target lineage qualification from the Host Session header', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const targetSession = {
      header: {
        cwd: '/workspace',
        parentSession: id('parent-session'),
      },
      snapshotEvents: () => [{ type: 'turn/start', data: { turn: 1 } }],
    }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: () => {},
      steer: () => {},
    }
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ agent }),
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [], list: () => [] })
    const dependencies = sessionMergeDependenciesFromHarness(ctx)

    const target = await dependencies.resolveTarget(
      'target-session',
      new AbortController().signal,
    )

    expect(target).toMatchObject({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      parentSessionId: 'parent-session',
      archived: false,
      events: targetSession.snapshotEvents(),
    })
    expect(target.handle).toBe(agent)
  })

  it('bounds capture waiting when the target produces neither a projection nor an error', async () => {
    vi.useFakeTimers()
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('sessionProjections', {
      stateOf: () => ({ inStep: false, marker: null, value: null }),
      onChanged: () => () => {},
    })
    const dependencies = sessionMergeDependenciesFromHarness(ctx, { captureTimeoutMs: 25 })
    const controller = new AbortController()
    let failure: unknown
    void dependencies.waitForCapture({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      archived: false,
      events: [],
      handle: {
        id: id('target-session'),
        session: { header: { cwd: '/workspace' }, snapshotEvents: () => [] },
        inject: () => {},
        steer: () => {},
      },
    }, 'operation-1', ['source-a', 'source-b'], controller.signal)
      .catch(error => { failure = error })

    try {
      await vi.advanceTimersByTimeAsync(25)
      expect(failure).toMatchObject({
        code: 'capture-timeout',
        message: 'Session Merge capture timed out after 25ms',
      })
    } finally {
      controller.abort()
      vi.useRealTimers()
    }
  })

  it('accepts a late capture from a previous retry operation when sources match exactly', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    let notifyProjection: ((session: unknown, key: string, value: unknown) => void) | undefined
    let projection: Readonly<Record<string, unknown>> | null = null
    const targetSession = { header: { cwd: '/workspace' } }
    ctx.provide('sessionProjections', {
      stateOf: () => ({ inStep: false, marker: null, value: projection }),
      onChanged: (listener: (session: unknown, key: string, value: unknown) => void) => {
        notifyProjection = listener
        return () => {}
      },
    })
    const dependencies = sessionMergeDependenciesFromHarness(ctx, { captureTimeoutMs: 100 })
    const controller = new AbortController()
    let outcome: unknown
    void dependencies.waitForCapture({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      archived: false,
      events: [],
      handle: {
        id: id('target-session'),
        session: targetSession,
        inject: () => {},
        steer: () => {},
      },
    }, 'retry-operation', ['source-a', 'source-b'], controller.signal)
      .then(value => { outcome = { value } }, error => { outcome = { error } })

    projection = {
      operationId: 'previous-operation',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    notifyProjection?.(targetSession, 'sessionGraphMerge', projection)
    await new Promise(resolve => setImmediate(resolve))

    try {
      expect(outcome).toEqual({ value: projection })
    } finally {
      controller.abort()
    }
  })
})
