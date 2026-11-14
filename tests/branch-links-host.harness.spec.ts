import type { Context } from '@deepseek-ai/cordis'
import type { CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { SessionSeq, type SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-log-deepseek/types'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ownerPeer } from './fixtures/owner-peer.ts'
import { inspectSession } from './fixtures/sessions.ts'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

type Host = Awaited<ReturnType<typeof topicHost>>

async function fixture(): Promise<{ readonly root: string; readonly host: Host }> {
  const root = await mkdtemp(join(tmpdir(), 'branch-origins-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  return { root, host: await topicHost(root, cleanups) }
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

async function invoke(host: Host, method: 'record' | 'list', request: unknown) {
  return host.ctx.typertGateway.invoke({
    namespace: 'sessionGraphBranchOrigin', method, args: { request },
    peer: ownerPeer(host.ctx), signal: new AbortController().signal,
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
