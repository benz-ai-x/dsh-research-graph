import type { Context } from '@deepseek-ai/cordis'
import type { CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { SessionSeq, type SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-log-deepseek/types'
import type { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ownerPeer } from './fixtures/owner-peer.ts'
import { inspectSession } from './fixtures/sessions.ts'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

type Host = Awaited<ReturnType<typeof topicHost>>

async function fixture(beforeApply?: Parameters<typeof topicHost>[2]): Promise<{ readonly root: string; readonly host: Host }> {
  const root = await mkdtemp(join(tmpdir(), 'branch-origins-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  return { root, host: await topicHost(root, cleanups, beforeApply) }
}

function sourceWithTurn(ctx: Context): Session {
  const source = ctx.sessions.create(undefined, { meta: { cwd: '/a' } })
  source.append('turn/start', { turn: 1 })
  source.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text: 'Original discussion.' }],
  }), { surfaceOp: 'append' })
  source.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return source
}

async function persist(ctx: Context, session: Session): Promise<void> {
  const writer = await ctx.sessionPersistence.create(session.header, {
    inheritedEventCount: session.inheritedEventCount,
  })
  try {
    await writer.append(session.snapshotEvents())
    await writer.flush()
  } finally {
    await writer.close()
  }
}

async function nativeControllerFork(host: Host, source: Session): Promise<Session> {
  Object.assign(host.ctx.agents, {
    presetForObservation: () => undefined,
    composeAgent: async () => ({}),
    create: async (options: CreateAgentOptions) => {
      host.ctx.sessions.create(options.sessionId, {
        ...(options.seed === undefined ? {} : { seed: [...options.seed] }),
        ...(options.meta === undefined ? {} : { meta: options.meta }),
        ...(options.inheritedEventCount === undefined ? {} : { inheritedEventCount: options.inheritedEventCount }),
      })
    },
  })
  const result = await host.ctx.sessionController.fork({ sessionId: source.id })
  const child = host.ctx.sessions.get(result.sessionId)
  if (child === undefined) throw new Error('Native Controller fork did not publish its child')
  return child
}

async function invoke(
  host: Host,
  method: 'record' | 'list',
  request: unknown,
  signal = new AbortController().signal,
) {
  return host.ctx.typertGateway.invoke({
    namespace: 'sessionGraphBranchOrigin', method, args: { request },
    peer: ownerPeer(host.ctx), signal,
  })
}

describe('Branch Origin public Host interface', () => {
  it('persists an exact fork origin across restart without adding Host parentage', async () => {
    const { root, host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    const child = host.ctx.sessions.fork(source.id)
    await persist(host.ctx, source)
    await persist(host.ctx, child)
    const before = await inspectSession(host.ctx, child.id)

    const recorded = await invoke(host, 'record', { childSessionId: child.id, parentSessionId: source.id })
    expect(recorded).toMatchObject({
      childSessionId: child.id, parentSessionId: source.id, source: 'recorded',
    })
    expect(await invoke(host, 'record', { childSessionId: child.id, parentSessionId: source.id }))
      .toEqual(recorded)
    await expect(invoke(host, 'record', { childSessionId: child.id, parentSessionId: 'session-other' }))
      .rejects.toThrow('already records a different Branch Origin')
    expect((await inspectSession(host.ctx, child.id)).meta.parentSession).toBeUndefined()
    expect((await inspectSession(host.ctx, child.id)).events).toEqual(before.events)

    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect(await invoke(restarted, 'list', { sessionIds: [child.id] })).toEqual({ origins: [recorded] })
  })

  it('infers a native Controller fork from its inherited delivery marker and caches it', async () => {
    const { root, host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    source.append('session-log-deepseek/delivery-accepted', {
      sessionId: source.id, sessionFormatVersion: 4, throughSeq: SessionSeq(2),
    })
    const child = await nativeControllerFork(host, source)
    await persist(host.ctx, source)
    await persist(host.ctx, child)
    const before = await inspectSession(host.ctx, child.id)
    expect(before.meta.parentSession).toBeUndefined()
    expect(before.meta.isSeeded).toBe(true)

    const listed = await invoke(host, 'list', { sessionIds: [child.id] })
    expect(listed).toEqual({ origins: [expect.objectContaining({
      childSessionId: child.id, parentSessionId: source.id, source: 'inferred',
    })] })
    expect((await inspectSession(host.ctx, child.id)).events).toEqual(before.events)

    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect(await invoke(restarted, 'list', { sessionIds: [child.id] })).toEqual(listed)
  })

  it('keeps shared inference available when another caller cancels its graph read', async () => {
    const { host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    source.append('session-log-deepseek/delivery-accepted', {
      sessionId: source.id, sessionFormatVersion: 4, throughSeq: SessionSeq(2),
    })
    const child = host.ctx.sessions.fork(source.id)
    await persist(host.ctx, source)
    await persist(host.ctx, child)
    const readStarted = Promise.withResolvers<void>()
    const releaseRead = Promise.withResolvers<void>()
    const open = host.ctx.sessionPersistence.open.bind(host.ctx.sessionPersistence)
    vi.spyOn(host.ctx.sessionPersistence, 'open').mockImplementation(async (sessionId, access) => {
      const handle = await open(sessionId, access)
      if (sessionId !== child.id) return handle
      const read = handle.read.bind(handle)
      vi.spyOn(handle, 'read').mockImplementation(async () => {
        readStarted.resolve()
        await releaseRead.promise
        return read()
      })
      return handle
    })
    const firstController = new AbortController()
    const first = invoke(host, 'list', { sessionIds: [child.id] }, firstController.signal)
    try {
      await readStarted.promise
      const second = invoke(host, 'list', { sessionIds: [child.id] }, new AbortController().signal)
      await new Promise(resolve => setImmediate(resolve))

      const firstRejected = expect(first).rejects.toThrow('was aborted')
      const secondResolved = expect(second).resolves.toEqual({ origins: [expect.objectContaining({
        childSessionId: child.id, parentSessionId: source.id, source: 'inferred',
      })] })
      firstController.abort(new Error('scope changed'))
      releaseRead.resolve()
      await firstRejected
      await secondResolved
    } finally {
      releaseRead.resolve()
    }
  })

  it('drains detached shared inference before closing its storage', async () => {
    const { host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    source.append('session-log-deepseek/delivery-accepted', {
      sessionId: source.id, sessionFormatVersion: 4, throughSeq: SessionSeq(2),
    })
    const child = host.ctx.sessions.fork(source.id)
    await persist(host.ctx, source)
    await persist(host.ctx, child)
    const readStarted = Promise.withResolvers<void>()
    const releaseRead = Promise.withResolvers<void>()
    const open = host.ctx.sessionPersistence.open.bind(host.ctx.sessionPersistence)
    vi.spyOn(host.ctx.sessionPersistence, 'open').mockImplementation(async (sessionId, access) => {
      const handle = await open(sessionId, access)
      if (sessionId !== child.id) return handle
      const read = handle.read.bind(handle)
      vi.spyOn(handle, 'read').mockImplementation(async () => {
        readStarted.resolve()
        await releaseRead.promise
        return read()
      })
      return handle
    })
    const controller = new AbortController()
    const reading = invoke(host, 'list', { sessionIds: [child.id] }, controller.signal)
    await readStarted.promise
    const rejected = expect(reading).rejects.toThrow('was aborted')
    controller.abort()
    await rejected

    let closed = false
    const closing = host.ctx.sessionGraphBranchOrigin.dispose().then(() => { closed = true })
    try {
      await new Promise(resolve => setImmediate(resolve))
      expect(closed).toBe(false)
    } finally {
      releaseRead.resolve()
    }
    await closing
    expect(closed).toBe(true)
  })

  it('never lets an inferred write overwrite an exact record already being persisted', async () => {
    const recordWriteStarted = Promise.withResolvers<void>()
    const releaseRecordWrite = Promise.withResolvers<void>()
    const parentChecked = Promise.withResolvers<void>()
    const { host } = await fixture(async ctx => {
      const backend = ctx.get('storage.backend.json') as JsonStorageBackend
      const open = backend.kv.open
      vi.spyOn(backend.kv, 'open').mockImplementation(async descriptor => {
        const unit = await open(descriptor)
        if (descriptor.name !== 'session_graph_branch_links') return unit
        const putRecord = unit.putRecord.bind(unit)
        vi.spyOn(unit, 'putRecord').mockImplementation(async (table, key, value) => {
          const source = value !== null && typeof value === 'object' && !Array.isArray(value)
            ? (value as { readonly source?: unknown }).source
            : undefined
          if (table === 'origins' && source === 'recorded') {
            recordWriteStarted.resolve()
            await releaseRecordWrite.promise
          }
          await putRecord(table, key, value)
        })
        return unit
      })
    })
    const source = sourceWithTurn(host.ctx)
    source.append('session-log-deepseek/delivery-accepted', {
      sessionId: source.id, sessionFormatVersion: 4, throughSeq: SessionSeq(2),
    })
    const exactParent = sourceWithTurn(host.ctx)
    const child = host.ctx.sessions.fork(source.id)
    await persist(host.ctx, source)
    await persist(host.ctx, exactParent)
    await persist(host.ctx, child)
    const stat = host.ctx.sessionPersistence.stat.bind(host.ctx.sessionPersistence)
    vi.spyOn(host.ctx.sessionPersistence, 'stat').mockImplementation(async sessionId => {
      const result = await stat(sessionId)
      if (sessionId === source.id) parentChecked.resolve()
      return result
    })

    try {
      const recorded = invoke(host, 'record', { childSessionId: child.id, parentSessionId: exactParent.id })
      await recordWriteStarted.promise
      const inferred = invoke(host, 'list', { sessionIds: [child.id] })
      await Promise.race([parentChecked.promise, inferred])
      await new Promise(resolve => setImmediate(resolve))
      releaseRecordWrite.resolve()
      await recorded
      await inferred

      expect(await invoke(host, 'list', { sessionIds: [child.id] })).toEqual({ origins: [expect.objectContaining({
        childSessionId: child.id, parentSessionId: exactParent.id, source: 'recorded',
      })] })
    } finally {
      releaseRecordWrite.resolve()
    }
  })

  it('does not cache an ancestor as the direct parent of a nested fork without its own marker', async () => {
    const { host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    source.append('session-log-deepseek/delivery-accepted', {
      sessionId: source.id, sessionFormatVersion: 4, throughSeq: SessionSeq(2),
    })
    const parent = host.ctx.sessions.fork(source.id)
    const child = host.ctx.sessions.fork(parent.id)
    await persist(host.ctx, source)
    await persist(host.ctx, parent)
    await persist(host.ctx, child)

    expect(await invoke(host, 'list', { sessionIds: [child.id] })).toEqual({ origins: [] })
  })

  it('leaves a seeded Session without a verifiable source marker unparented', async () => {
    const { host } = await fixture()
    const source = sourceWithTurn(host.ctx)
    const child = host.ctx.sessions.fork(source.id)
    await persist(host.ctx, source)
    await persist(host.ctx, child)

    expect(await invoke(host, 'list', { sessionIds: [child.id] })).toEqual({ origins: [] })
    expect((await inspectSession(host.ctx, child.id)).meta.parentSession).toBeUndefined()
  })
})
