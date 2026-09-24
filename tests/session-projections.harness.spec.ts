import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SESSION_FORMAT_VERSION, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { titleProjectionDefinition } from '@deepseek-ai/dsh-session-title'
import { createSessionTestRemote, testSessionPersistence } from 'harness-session-controller-test-support'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientSessions } from '@deepseek-ai/dsh-api-session-controller/src/client/sessions/service.ts'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

describe('non-activating Session projections', () => {
  it('folds the durable title over the directory-name fallback after refreshProjections', async () => {
    const host = new Context()
    contexts.push(host)
    await host.plugin(SessionStore)
    await host.plugin(AgentRegistry)
    await host.plugin(SessionProjectionRegistry)
    host.sessionProjections.register(titleProjectionDefinition)
    const coldId = 'projection-cold-title' as SessionId
    const header = {
      version: SESSION_FORMAT_VERSION,
      id: coldId,
      createdAt: 5,
      cwd: '/research/cold-directory',
      isSeeded: false,
    }
    const events = [
      { type: 'turn/start', seq: SessionSeq(0), time: 10, data: { turn: 1 } },
      {
        type: 'user/message', seq: SessionSeq(1), time: 11, surfaceOp: 'append',
        data: createUserMessage({
          source: { kind: 'user' },
          content: [{ type: 'text', text: '调研缓存架构的取舍' }],
        }),
      },
      {
        type: 'session/title', seq: SessionSeq(2), time: 12,
        data: { title: '缓存架构调研', messageSeqs: [SessionSeq(1)], source: { kind: 'user' } },
      },
      { type: 'turn/end', seq: SessionSeq(3), time: 13, data: { turn: 1, reason: { kind: 'completed' } } },
    ]
    host.provide('sessionPersistence', testSessionPersistence(host, {
      list: async () => [header],
      inspect: async () => ({ meta: header, events }),
    }) as never)
    const remote = createSessionTestRemote(host, {
      cwd: '/research',
      defaultModelSelection: () => ({ provider: 'test', model: 'test' }),
    })
    const projections = vi.spyOn(remote, 'projections')

    const clientCtx = new Context()
    contexts.push(clientCtx)
    const sessions = new ClientSessions(clientCtx, { session: remote } as never)
    await sessions.refresh()
    await Promise.resolve() // manager notifier flush

    // A cold Session lists under its directory basename until the
    // non-activating projection read lands the durable title.
    expect(sessions.list.getSnapshot().byId[coldId]).toMatchObject({
      displayTitle: 'cold-directory',
    })
    expect(sessions.list.getSnapshot().byId[coldId]?.title).toBeUndefined()

    await sessions.refreshProjections(coldId)
    await Promise.resolve()
    const ready = sessions.list.getSnapshot()
    expect(ready.projectionsBySession[coldId]?.state).toBe('ready')
    expect(ready.projectionsBySession[coldId]?.values.title).toBe('缓存架构调研')
    expect(ready.byId[coldId]).toMatchObject({
      title: '缓存架构调研',
      displayTitle: '缓存架构调研',
    })
    expect(ready.byId[coldId]?.projectionValues?.title).toBe('缓存架构调研')
    expect(projections).toHaveBeenCalledTimes(1)

    // A ready read short-circuits: repeat refreshes cost no Host round-trip.
    await sessions.refreshProjections(coldId)
    expect(projections).toHaveBeenCalledTimes(1)
  })
})
