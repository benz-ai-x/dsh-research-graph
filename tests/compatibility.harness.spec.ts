import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { sessionFormatCatalog } from '@deepseek-ai/dsh-session-format-catalog'
import { createSessionTestController } from 'harness-session-controller-test-support'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/index.ts'
import { sessionMergeDependenciesFromHarness } from '../src/session-merge-harness.ts'

describe('current Harness public APIs', () => {
  it('digests cold JSONL and newer attached state through the real Session Controller', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-digest-'))
    const ctx = new Context()
    try {
      await ctx.plugin(SessionStore)
      await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
      const session = ctx.sessions.prepare(undefined, { meta: { cwd: '/test' } })
      session.append('turn/start', { turn: 1 })
      session.append('step/start', { turn: 1, step: 1 })
      session.append('user/message', createUserMessage({
        source: { kind: 'user' }, content: [{ type: 'text', text: 'Persisted question.' }],
      }), { surfaceOp: 'append' })
      session.append('step/end', { turn: 1, step: 1 })
      session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      const writer = await ctx.sessionPersistence.create(session.header)
      try {
        await writer.append(session.snapshotEvents())
        await writer.flush()
      } finally {
        await writer.close()
      }
      const before = session.snapshotEvents()
      const stream = vi.fn(async function* () {
        yield { type: 'text-delta', index: 0, text: '{"overview":"Digest.","keyOutcomes":[],"openItems":[]}' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })
      ctx.provide('llm', { stream })
      await ctx.plugin({
        inject: ['sessions', 'sessionPersistence', 'llm'],
        apply(controllerCtx) {
          createSessionTestController(controllerCtx, {
            cwd: '/test', defaultModelSelection: () => ({ provider: 'test', model: 'test' }),
          })
        },
      })
      await ctx.plugin({ apply, inject }, { provider: 'test', model: 'test' })
      const service = ctx.get('sessionGraphDigest')
      const request = { sessionId: session.id, refresh: true }
      const signal = new AbortController().signal
      expect(ctx.sessions.get(session.id)).toBeUndefined()
      expect(await service.generate(request, signal)).toMatchObject({
        kind: 'ready', digest: { sourceRevision: '4', generatedWhileRunning: false },
      })
      ctx.effect(() => ctx.sessions.enter(session), 'test: attach newer Session')
      session.append('turn/start', { turn: 2 })
      session.append('step/start', { turn: 2, step: 1 })
      session.append('user/message', createUserMessage({
        source: { kind: 'user' }, content: [{ type: 'text', text: 'New attached content.' }],
      }), { surfaceOp: 'append' })
      expect(await service.generate(request, signal)).toMatchObject({
        kind: 'ready', digest: { sourceRevision: '7', generatedWhileRunning: true },
      })
      expect(session.snapshotEvents().slice(0, before.length)).toEqual(before)
      expect(session.snapshotEvents()).toHaveLength(8)
      expect(stream).toHaveBeenCalledTimes(2)
    } finally {
      vi.restoreAllMocks()
      await ctx.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('resolves a real current Session as an immutable Merge target', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SessionStore)
      const session = ctx.sessions.create(undefined, { meta: { cwd: '/test' } })
      ctx.provide('sessionController', { resolveAgent: async () => ({ agent: { id: session.id, session } }) })
      ctx.provide('workspaceRegistry', { archivedSessionIds: [] })
      const target = await sessionMergeDependenciesFromHarness(ctx)
        .resolveTarget(session.id, new AbortController().signal)
      expect(target).toMatchObject({ targetSessionId: session.id, cwd: '/test', events: [] })
      session.append('turn/start', { turn: 1 })
      expect(target.events).toEqual([])
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each([0, 1, 2, 3])('keeps new Merge markers readable through the V%i format catalog', async version => {
    const ctx = new Context()
    try {
      let marker: unknown
      sessionMergeDependenciesFromHarness(ctx).enqueue({
        targetSessionId: 'target', cwd: '/test', archived: false, events: [],
        handle: { inject: value => { marker = value }, steer: () => {} },
      }, {
        marker: { kind: 'session-graph-merge', version: 1, operationId: 'operation', sourceIds: ['a', 'b'] },
        directText: 'Compare the sources.',
      })
      const restore = sessionFormatCatalog.createRestore({
        type: 'session', version, id: 'target', createdAt: 1, delegationDepth: 0,
        ...(version < 2 ? {} : { isSeeded: false }),
      }, { recovery: 'strict', validation: 'current' })
      const events = [
        { type: 'turn/start', data: { turn: 1 } },
        { type: 'step/start', data: { turn: 1, step: 1 } },
        { type: 'user/message', data: marker, surfaceOp: 'append' },
        { type: 'step/end', data: { turn: 1, step: 1 } },
        { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
      ]
      for (const [seq, event] of events.entries()) restore.decodeRow({ ...event, seq, time: 1 })
      expect(restore.finish().header.version).toBe(3)
      expect(marker).toMatchObject({ source: {
        kind: 'plugin', plugin: 'dsh-session-graph', form: 'notice', summary: expect.any(String),
      } })
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
