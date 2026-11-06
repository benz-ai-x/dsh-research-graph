/** DSH 0.2.2 Session fixtures: store-owned Sessions accept writes only between announcement and removal. */

import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/**
 * Write a prepared Session's history while it is briefly live, then remove it
 * from the store so only persistence can serve it — the cold shape the Host
 * sees after a restart. Persist `session.header` and `session.snapshotEvents()`
 * afterwards when the fixture needs a durable log.
 */
export async function writeColdHistory(ctx: Context, session: Session, write: (session: Session) => void): Promise<void> {
  const detach = ctx.effect(() => ctx.sessions.enter(session), 'test: write cold Session history')
  ctx.sessions.announce(session)
  write(session)
  await detach()
}

/** The pre-0.2.2 `sessionController.inspect` result shape. */
export interface SessionInspection {
  readonly meta: Session['header']
  readonly inheritedEventCount: number
  readonly events: ReturnType<Session['snapshotEvents']>
}

/** Read one live or persisted Session the way the removed `sessionController.inspect` did. */
export async function inspectSession(ctx: Context, sessionId: SessionId, signal?: AbortSignal): Promise<SessionInspection> {
  const observation = await ctx.sessionQuery.observeSession(sessionId, {
    ...(signal === undefined ? {} : { signal }),
    projectionMode: 'none',
  })
  try {
    if (observation.source !== 'live' && observation.header.cwd === undefined) throw new Error(`session "${sessionId}" not found`)
    return { meta: observation.header, inheritedEventCount: observation.inheritedEventCount, events: [...observation.events] }
  } finally {
    observation[Symbol.dispose]()
  }
}

/** Present an inspection as the disposable observation `sessionQuery.observeSession` resolves. */
export function observationOf(inspection: Pick<SessionInspection, 'meta' | 'events'> & Partial<SessionInspection>) {
  const events = Object.freeze([...inspection.events])
  return {
    source: 'live' as const,
    header: inspection.meta,
    inheritedEventCount: inspection.inheritedEventCount ?? 0,
    events,
    cursor: events.at(-1)?.seq ?? -1,
    retain: () => observationOf(inspection),
    [Symbol.dispose]: () => {},
  }
}

/** Serve an inspection stub through the observation face the Host reads since DSH 0.2.2. */
export function observing(inspect: (sessionId: SessionId, signal?: AbortSignal) => Promise<{
  readonly meta: { readonly id: string }
  readonly events: readonly unknown[]
}>) {
  return {
    observeSession: async (sessionId: SessionId, options?: { readonly signal?: AbortSignal }) =>
      observationOf(await inspect(sessionId, options?.signal) as Parameters<typeof observationOf>[0]),
  }
}
