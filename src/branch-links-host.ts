/** Host storage and inference for plugin-owned Branch Origins of ordinary forks. */
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import {
  inferForkParent, type BranchOrigin, type BranchOriginList, type BranchOriginQuery, type BranchOriginRecord,
} from './branch-links.ts'
import {
  branchOriginQuerySchema, branchOriginRecordSchema, branchOriginSchema,
} from './branch-links-codec.ts'
import { ServiceRequests } from './service-requests.ts'

/** Concurrency for cold inherited-prefix reads during one list; keeps a graph read bounded. */
const INFERENCE_CONCURRENCY = 4

/** Detach one caller from shared inference without cancelling the storage operation. */
function waitForOrigin(
  operation: Promise<BranchOrigin | undefined>,
  signal: AbortSignal,
): Promise<BranchOrigin | undefined> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let waiting = true
    const release = (): void => {
      if (!waiting) return
      waiting = false
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      release()
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    void operation.then(
      value => { release(); resolve(value) },
      (error: unknown) => { release(); reject(error) },
    )
  })
}

const originSchema: z.ZodType<BranchOrigin> = z.unknown().transform((value, context) => {
  try { return branchOriginSchema.parse(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Branch Origin record' })
    return z.NEVER
  }
})

/** Durable plugin-owned Branch Origins; one table keyed by the child Canvas Session. */
export const BRANCH_ORIGIN_DOMAIN = { name: 'session_graph_branch_links', version: 1, tables: { origins: { valueSchema: originSchema } } } as const

/**
 * Record and read Branch Origins.
 *
 * Recorded origins are exact facts supplied by the plugin action that created the
 * fork. Inferred origins recover the direct parent of a seeded Session without one
 * from its inherited prefix; both are presentation provenance, never Session
 * Lineage, and nothing here writes to DSH Session storage.
 */
export class BranchOriginService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Branch Origin service')
  private readonly inferenceLifecycle = new AbortController()
  private readonly pending = new Map<string, Promise<BranchOrigin | undefined>>()
  private readonly recording = new Map<string, Promise<void>>()

  constructor(ctx: Context, private readonly domain: Domain<typeof BRANCH_ORIGIN_DOMAIN>) {
    super(ctx, 'sessionGraphBranchOrigin')
    ctx.effect(() => () => this.dispose(), 'session-graph.branch-origin-quiescence')
  }

  @Remote('record')
  record(request: BranchOriginRecord, signal: AbortSignal): Promise<BranchOrigin> {
    return this.requests.run(signal, combined => this.recordOrigin(request, combined))
  }

  @Remote('list')
  list(request: BranchOriginQuery, signal: AbortSignal): Promise<BranchOriginList> {
    return this.requests.run(signal, combined => this.listOrigins(request, combined))
  }

  dispose(): Promise<void> {
    this.inferenceLifecycle.abort(new Error('Branch Origin service is disposed'))
    return this.requests.dispose(async () => {
      await Promise.allSettled([...this.pending.values()])
      await this.domain.close()
    })
  }

  private async recordOrigin(request: BranchOriginRecord, signal: AbortSignal): Promise<BranchOrigin> {
    signal.throwIfAborted()
    let command: BranchOriginRecord
    try { command = branchOriginRecordSchema.parse(request) } catch { throw new TypeError('Invalid Branch Origin request') }
    await this.recording.get(command.childSessionId)?.catch(() => undefined)
    const table = this.domain.table('origins')
    const existing = table.get(command.childSessionId)
    if (existing !== undefined && existing.source === 'recorded' && existing.parentSessionId !== command.parentSessionId) {
      throw new Error('This Session already records a different Branch Origin')
    }
    signal.throwIfAborted()
    const origin: BranchOrigin = {
      ...command, source: 'recorded', createdAt: existing?.createdAt ?? Date.now(),
    }
    const writing = table.put(command.childSessionId, origin)
    this.recording.set(command.childSessionId, writing)
    try {
      await writing
      return origin
    } finally {
      this.recording.delete(command.childSessionId)
    }
  }

  private async listOrigins(request: BranchOriginQuery, signal: AbortSignal): Promise<BranchOriginList> {
    signal.throwIfAborted()
    let query: BranchOriginQuery
    try { query = branchOriginQuerySchema.parse(request) } catch { throw new TypeError('Invalid Branch Origin query') }
    const stored = [...this.domain.table('origins').entries()].map(([, origin]) => origin)
    if (query.sessionIds === undefined) return { origins: stored }
    const wanted = new Set(query.sessionIds)
    const known = stored.filter(origin => wanted.has(origin.childSessionId))
    const missing = [...wanted].filter(id => !known.some(origin => origin.childSessionId === id))
    signal.throwIfAborted()
    const inferred: BranchOrigin[] = []
    for (let start = 0; start < missing.length; start += INFERENCE_CONCURRENCY) {
      signal.throwIfAborted()
      const batch = missing.slice(start, start + INFERENCE_CONCURRENCY)
      const results = await Promise.all(batch.map(id => this.inferOnce(id, signal)))
      for (const origin of results) if (origin !== undefined) inferred.push(origin)
    }
    return { origins: [...known, ...inferred] }
  }

  /** Share service-owned storage work while each graph read retains its own cancellation. */
  private inferOnce(childSessionId: string, signal: AbortSignal): Promise<BranchOrigin | undefined> {
    const pending = this.pending.get(childSessionId)
    if (pending !== undefined) return waitForOrigin(pending, signal)
    const operation = this.inferOrigin(childSessionId, this.inferenceLifecycle.signal)
      .finally(() => { this.pending.delete(childSessionId) })
    this.pending.set(childSessionId, operation)
    return waitForOrigin(operation, signal)
  }

  private async inferOrigin(childSessionId: string, signal: AbortSignal): Promise<BranchOrigin | undefined> {
    const table = this.domain.table('origins')
    if (table.get(childSessionId) !== undefined || this.recording.has(childSessionId)) return undefined
    signal.throwIfAborted()
    try {
      if ((await this.ctx.sessionPersistence.stat(childSessionId as SessionId)) === undefined) return undefined
      const handle = await this.ctx.sessionPersistence.open(childSessionId as SessionId, 'read')
      try {
        if (handle.header.isSeeded !== true || handle.header.parentSession !== undefined) return undefined
        const inherited = handle.inheritedEventCount
        if (inherited <= 0) return undefined
        const events = (await handle.read()).events
        signal.throwIfAborted()
        const parentSessionId = inferForkParent(events, inherited, childSessionId)
        if (parentSessionId === undefined) return undefined
        if ((await this.ctx.sessionPersistence.stat(parentSessionId as SessionId)) === undefined) return undefined
        // An exact record may land or already be writing; never shadow it.
        if (table.get(childSessionId) !== undefined || this.recording.has(childSessionId)) return undefined
        signal.throwIfAborted()
        const origin: BranchOrigin = { childSessionId, parentSessionId, source: 'inferred', createdAt: Date.now() }
        await table.put(childSessionId, origin)
        return origin
      } finally {
        await handle.close()
      }
    } catch (error) {
      signal.throwIfAborted()
      return undefined
    }
  }
}
