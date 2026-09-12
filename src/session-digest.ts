/** Host-side Session Digest domain interface and orchestration. */
import { sessionInsightSource } from './session-insight-source.ts'

/** Structurally readable Session event used by the digest module. */
export interface SessionDigestEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data: unknown
}

/** Exact provider route reconstructed from the addressed Session log. */
export interface SessionDigestModelRoute {
  readonly provider: string
  readonly model: string
}

/** Immutable source observed for one addressed Session. */
export interface SessionDigestInspection {
  readonly title: string
  readonly running: boolean
  readonly modelRoute?: SessionDigestModelRoute
  readonly events: readonly SessionDigestEvent[]
}

/** Explicit user request to generate or refresh one Session Digest. */
export interface SessionDigestRequest {
  readonly sessionId: string
  readonly refresh: boolean
}

/** Model input owned by the Session Digest module. */
export interface SessionDigestModelRequest {
  readonly sessionId: string
  readonly title: string
  readonly modelRoute?: SessionDigestModelRoute
  readonly source: string
}

/** Successful digest payload. */
export interface SessionDigest {
  readonly sessionId: string
  readonly sourceRevision: string
  readonly sourceTurnCount: number
  readonly generatedAt: number
  readonly generatedWhileRunning: boolean
  readonly overview: string
  readonly keyOutcomes: readonly string[]
  readonly openItems: readonly string[]
}

/** Every non-transport outcome exposed by the Host interface. */
export type SessionDigestResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly digest: SessionDigest; readonly cached: boolean }

/** Stable failure categories consumed by the browser UI. */
export type SessionDigestErrorCode =
  | 'disposed'
  | 'invalid-model-output'
  | 'model-route-unavailable'
  | 'output-limit'
  | 'generation-failed'

/** Domain error whose code is safe to transport across the Remote boundary. */
export class SessionDigestError extends Error {
  readonly code: SessionDigestErrorCode

  constructor(code: SessionDigestErrorCode, message: string) {
    super(message)
    this.name = 'SessionDigestError'
    this.code = code
  }
}

/** System-boundary adapters accepted by the deep digest module. */
export interface SessionDigestDependencies {
  readonly inspect: (
    sessionId: string,
    signal: AbortSignal,
  ) => Promise<SessionDigestInspection>
  readonly generate: (
    request: SessionDigestModelRequest,
    signal: AbortSignal,
  ) => Promise<string>
  readonly now: () => number
}

/** Public Host seam exercised by Remote and tests alike. */
export interface SessionDigestModule {
  generate(request: SessionDigestRequest, signal: AbortSignal): Promise<SessionDigestResult>
  dispose(): Promise<void>
}

interface DigestShape {
  readonly overview: string
  readonly keyOutcomes: readonly string[]
  readonly openItems: readonly string[]
}

interface InflightDigest {
  readonly controller: AbortController
  readonly promise: Promise<SessionDigestResult>
  waiters: number
  settled: boolean
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new SessionDigestError(
      'invalid-model-output',
      `Session Digest model output has invalid ${field}`,
    )
  }
  return value.map(item => item.trim()).filter(item => item !== '')
}

/** Visible text limits are independent of the provider's reasoning-token budget. */
export const SESSION_DIGEST_LIMITS = { overview: 140, item: 160, outcomes: 5, openItems: 3, total: 1_000 } as const

export class SessionDigestLengthError extends SessionDigestError {
  constructor() {
    super('invalid-model-output', 'Session Digest exceeds the concise reading limits')
  }
}

/** Validate complete Markdown strings without cutting emphasis or changing factual claims. */
export function parseSessionDigestOutput(output: string): DigestShape {
  let value: unknown
  try {
    value = JSON.parse(output)
  } catch {
    throw new SessionDigestError(
      'invalid-model-output',
      'Session Digest model output is not valid JSON',
    )
  }
  const record = recordOf(value)
  if (record === undefined || typeof record.overview !== 'string' || record.overview.trim() === '') {
    throw new SessionDigestError(
      'invalid-model-output',
      'Session Digest model output has invalid overview',
    )
  }
  const shape = {
    overview: record.overview.trim(),
    keyOutcomes: stringList(record.keyOutcomes, 'keyOutcomes'),
    openItems: stringList(record.openItems, 'openItems'),
  }
  const length = (text: string): number => [...text].length
  const items = [...shape.keyOutcomes, ...shape.openItems]
  if (length(shape.overview) > SESSION_DIGEST_LIMITS.overview
    || shape.keyOutcomes.length > SESSION_DIGEST_LIMITS.outcomes
    || shape.openItems.length > SESSION_DIGEST_LIMITS.openItems
    || items.some(item => length(item) > SESSION_DIGEST_LIMITS.item)
    || length(shape.overview) + items.reduce((sum, item) => sum + length(item), 0) > SESSION_DIGEST_LIMITS.total) {
    throw new SessionDigestLengthError()
  }
  return shape
}

async function waitForDigest(
  active: InflightDigest,
  signal: AbortSignal,
): Promise<SessionDigestResult> {
  signal.throwIfAborted()
  active.waiters += 1
  return await new Promise<SessionDigestResult>((resolve, reject) => {
    let waiting = true
    const release = (): void => {
      if (!waiting) return
      waiting = false
      signal.removeEventListener('abort', onAbort)
      active.waiters -= 1
      if (active.waiters === 0 && !active.settled) {
        active.controller.abort(signal.reason)
      }
    }
    const onAbort = (): void => {
      release()
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    // Abort may race between the initial check and listener registration.
    if (signal.aborted) onAbort()
    void active.promise.then(
      (result) => {
        release()
        resolve(result)
      },
      (error: unknown) => {
        release()
        reject(error)
      },
    )
  })
}

/**
 * Create the Host-side Session Digest module.
 * @param dependencies - persistence, model, and clock system boundaries.
 * @returns one session-addressed digest interface.
 */
export function createSessionDigestModule(
  dependencies: SessionDigestDependencies,
): SessionDigestModule {
  const cache = new Map<string, SessionDigest>()
  const inflight = new Map<string, InflightDigest>()
  const activeCalls = new Set<Promise<SessionDigestResult>>()
  const ownedOperations = new Set<Promise<SessionDigestResult>>()
  const lifecycle = new AbortController()
  let disposed = false
  let disposal: Promise<void> | undefined

  const disposedError = (): SessionDigestError => new SessionDigestError(
    'disposed',
    'Session Digest module is disposed',
  )

  const generate = async (
    request: SessionDigestRequest,
    signal: AbortSignal,
  ): Promise<SessionDigestResult> => {
    signal.throwIfAborted()
    const inspection = await dependencies.inspect(request.sessionId, signal)
    signal.throwIfAborted()
    const sourceRevision = String(inspection.events.at(-1)?.seq ?? -1)
    const cached = cache.get(request.sessionId)
    if (!request.refresh && cached?.sourceRevision === sourceRevision) {
      return { kind: 'ready', digest: cached, cached: true }
    }
    const source = sessionInsightSource(inspection)
    if (source === '') return { kind: 'empty' }
    const inflightKey = `${request.sessionId}\0${sourceRevision}`
    const active = inflight.get(inflightKey)
    if (active !== undefined && !active.controller.signal.aborted) {
      return await waitForDigest(active, signal)
    }
    const controller = new AbortController()
    let created: InflightDigest
    const operation = (async (): Promise<SessionDigestResult> => {
      const output = await dependencies.generate({
        sessionId: request.sessionId,
        title: inspection.title,
        ...inspection.modelRoute === undefined ? {} : { modelRoute: inspection.modelRoute },
        source,
      }, controller.signal)
      controller.signal.throwIfAborted()
      const shape = parseSessionDigestOutput(output)
      const digest: SessionDigest = {
        sessionId: request.sessionId,
        sourceRevision,
        sourceTurnCount: inspection.events.filter(event => event.type === 'turn/end').length,
        generatedAt: dependencies.now(),
        generatedWhileRunning: inspection.running,
        ...shape,
      }
      cache.set(request.sessionId, digest)
      return { kind: 'ready', cached: false, digest }
    })().finally(() => {
      created.settled = true
      ownedOperations.delete(created.promise)
      if (inflight.get(inflightKey) === created) inflight.delete(inflightKey)
    })
    created = {
      controller,
      promise: operation,
      waiters: 0,
      settled: false,
    }
    inflight.set(inflightKey, created)
    ownedOperations.add(operation)
    return await waitForDigest(created, signal)
  }

  return {
    generate(request, callerSignal) {
      if (disposed) return Promise.reject(disposedError())
      const signal = AbortSignal.any([callerSignal, lifecycle.signal])
      const call = generate(request, signal)
      activeCalls.add(call)
      void call.then(
        () => { activeCalls.delete(call) },
        () => { activeCalls.delete(call) },
      )
      return call
    },
    dispose() {
      if (disposal !== undefined) return disposal
      disposed = true
      const error = disposedError()
      lifecycle.abort(error)
      for (const active of inflight.values()) active.controller.abort(error)
      const admitted = [...activeCalls, ...ownedOperations]
      disposal = Promise.allSettled(admitted).then(() => {})
      return disposal
    },
  }
}
