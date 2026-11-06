/** Session log inspection without activating the Session's Agent (DSH >= 0.2.2 contract). */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionDigestEvent } from './session-digest.ts'

/** Header facts and raw event log of one live or persisted Session. */
export interface HarnessSessionInspection {
  readonly meta: {
    readonly id: SessionId
    readonly cwd?: string
    readonly origin?: 'subagent'
    readonly parentSession?: SessionId
    readonly agentPreset?: string
  }
  readonly events: readonly SessionDigestEvent[]
}

/**
 * Read one Session's header and complete event log without activating its
 * Agent, replacing the `sessionController.inspect` face removed in DSH 0.2.2.
 * Matches its semantics: the attached Session wins, a persisted header without
 * a working directory reports the Session as not found, and failures propagate.
 */
export async function inspectHarnessSession(
  ctx: Context,
  sessionId: SessionId,
  signal?: AbortSignal,
): Promise<HarnessSessionInspection> {
  const observation = await ctx.sessionQuery.observeSession(sessionId, {
    ...(signal === undefined ? {} : { signal }),
    projectionMode: 'none',
  })
  try {
    if (observation.source !== 'live' && observation.header.cwd === undefined) {
      throw new Error(`session "${sessionId}" not found`)
    }
    return { meta: observation.header, events: [...observation.events] }
  } finally {
    observation[Symbol.dispose]()
  }
}
