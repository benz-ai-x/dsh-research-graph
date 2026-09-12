import { Context } from '@deepseek-ai/cordis'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import { SESSION_TITLE_REMOTE } from '../src/client/session-title-remote.ts'
import { sessionTitleResultSchema } from '../src/session-title.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })
const events = [
  { type: 'user/message', seq: 0, time: 1, data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Compare memory caching and permission revocation.' }] } },
  { type: 'assistant/message', seq: 1, time: 2, data: { message: { content: [{ type: 'text', text: 'Separate latency benefits from consistency guarantees.' }, { type: 'reasoning', text: 'PRIVATE_REASONING' }] } } },
  { type: 'request/context', seq: 2, time: 3, data: { provider: 'chosen', model: 'reasoning-model' } },
  { type: 'session/title', seq: 3, time: 4, data: { title: 'Old title' } },
]

async function fixture(outputs: readonly string[], source = events) {
  const ctx = new Context()
  contexts.push(ctx)
  const inspect = vi.fn(async () => ({ meta: { id: 'selected' }, events: structuredClone(source) }))
  const calls: Readonly<Record<string, unknown>>[] = []
  ctx.provide('sessionController', { inspect })
  ctx.provide('llm', { async *stream(options: Readonly<Record<string, unknown>>) {
    calls.push(options)
    yield { type: 'text-delta', index: 0, text: outputs[Math.min(calls.length - 1, outputs.length - 1)] }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } })
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(TypertGatewayService)
  await apply(ctx)
  return { ctx, calls, inspect, title: async () => await ctx.typertGateway.invoke({ namespace: 'sessionGraphTitle', method: 'generate',
    args: { request: { sessionId: 'selected' } }, signal: new AbortController().signal }) }
}

describe('Session title and concise digest through the Host seam', () => {
  it('suggests from the selected discussion through the real Gateway without renaming or starting an Agent', async () => {
    const b = await fixture(['{"title":"Caching latency and permission consistency"}'])
    const before = structuredClone(events)
    const result = await b.title()
    expect(result).toEqual({ kind: 'ready', sessionId: 'selected', title: 'Caching latency and permission consistency', sourceTitle: 'Old title', sourceRevision: '3' })
    expect(b.inspect).toHaveBeenCalledExactlyOnceWith('selected', expect.any(AbortSignal))
    expect(b.calls[0]).toMatchObject({ provider: 'chosen', model: 'reasoning-model', maxTokens: 4096, sessionId: 'selected' })
    const material = JSON.stringify(b.calls[0]?.messages)
    expect(material).toContain('permission revocation')
    expect(material).toContain('consistency guarantees')
    expect(material).not.toContain('PRIVATE_REASONING')
    expect(b.calls[0]).not.toHaveProperty('tools')
    expect(events).toEqual(before)
    expect(SESSION_TITLE_REMOTE.descriptors[0]?.cancellation).toEqual({ parameter: 'signal' })
    expect(sessionTitleResultSchema.parse(result)).toEqual(result)
  })

  it('does not call the model for an empty discussion', async () => {
    const b = await fixture(['unused'], [])
    expect(await b.title()).toEqual({ kind: 'empty' })
    expect(b.calls).toHaveLength(0)
  })

  it.each(['not JSON', JSON.stringify({ title: 'x'.repeat(81) }), JSON.stringify({ title: 'first\nsecond' }), '{"title":"  "}'])('rejects invalid title output without changing the source: %s', async output => {
    const b = await fixture([output])
    await expect(b.title()).rejects.toMatchObject({ code: 'invalid-model-output' })
    expect(b.calls).toHaveLength(1)
  })

  it('compresses an overlong complete digest once and keeps the reasoning budget', async () => {
    const b = await fixture([JSON.stringify({ overview: '长'.repeat(141), keyOutcomes: [], openItems: [] }),
      JSON.stringify({ overview: '**缓存**需要分别验证性能与一致性。', keyOutcomes: ['保留 **权限校验**。'], openItems: ['测量 `P95` 延迟。'] })])
    const result = await b.ctx.sessionGraphDigest.generate({ sessionId: 'selected', refresh: false }, new AbortController().signal)
    expect(result).toMatchObject({ kind: 'ready', digest: { overview: '**缓存**需要分别验证性能与一致性。' } })
    expect(b.calls).toHaveLength(2)
    expect(b.calls.every(call => call.maxTokens === 4096)).toBe(true)
    expect(b.calls[1]?.system).toContain('previous attempt was too long')
    await b.ctx.sessionGraphDigest.generate({ sessionId: 'selected', refresh: false }, new AbortController().signal)
    expect(b.calls).toHaveLength(2)
  })

  it('rejects a second overlong digest instead of cutting Markdown or caching it', async () => {
    const b = await fixture([JSON.stringify({ overview: '长'.repeat(141), keyOutcomes: [], openItems: [] })])
    await expect(b.ctx.sessionGraphDigest.generate({ sessionId: 'selected', refresh: false }, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-model-output' })
    expect(b.calls).toHaveLength(2)
  })

  it('cancels owned title work and waits for a provider that settles late during disposal', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const release = Promise.withResolvers<void>()
    const started = Promise.withResolvers<AbortSignal>()
    ctx.provide('sessionController', { inspect: async () => ({ meta: { id: 'selected' }, events }) })
    ctx.provide('llm', { async *stream(options: { signal: AbortSignal }) {
      started.resolve(options.signal)
      await release.promise
      yield { type: 'text-delta', index: 0, text: '{"title":"Late title"}' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } })
    await apply(ctx)
    const pending = ctx.sessionGraphTitle.generate({ sessionId: 'selected' }, new AbortController().signal).then(value => value, error => error)
    const signal = await started.promise
    let settled = false
    const disposal = ctx.fiber.dispose().then(() => { settled = true })
    await new Promise(resolve => setImmediate(resolve))
    expect(signal.aborted).toBe(true)
    expect(settled).toBe(false)
    release.resolve()
    await disposal
    expect(await pending).toBeInstanceOf(Error)
  })
})
