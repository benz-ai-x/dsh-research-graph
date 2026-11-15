import type { SessionBackupWorkspace } from './session-backup-import.ts'
import {
  SessionBackupError,
  type SessionBackupFailureReason,
  type SessionBackupImportLine,
  type SessionBackupResult,
} from './session-backup.ts'

export interface SessionBackupImportClaim {
  readonly signal: AbortSignal
  release(): void
}

export interface SessionBackupUploadHandler {
  readonly maxUploadBytes: number
  claim(): SessionBackupImportClaim | undefined
  workspace(workspaceId: string): SessionBackupWorkspace | undefined
  import(
    archive: Uint8Array,
    workspace: SessionBackupWorkspace,
    onProgress: (done: number, total: number) => void,
    signal: AbortSignal,
  ): Promise<SessionBackupResult>
  failed(error: unknown): void
}

const NDJSON_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store, no-transform',
  'x-content-type-options': 'nosniff',
}

export function createSessionBackupUploadRoute(
  handler: SessionBackupUploadHandler,
): (request: Request) => Promise<Response> {
  return async request => {
    const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (mediaType !== 'application/octet-stream') {
      return new Response('content type must be application/octet-stream', { status: 415 })
    }
    const workspaceId = new URL(request.url).searchParams.get('workspaceId')
    if (workspaceId === null || workspaceId === '') return new Response('workspaceId is required', { status: 400 })
    const claim = handler.claim()
    if (claim === undefined) {
      await request.body?.cancel()
      return failure('busy', 'another import is running')
    }
    let streaming = false
    try {
      const workspace = handler.workspace(workspaceId)
      if (workspace === undefined) {
        await request.body?.cancel()
        return failure('workspace-not-found', `workspace ${workspaceId} does not exist`)
      }
      const cancel = new AbortController()
      const signal = AbortSignal.any([claim.signal, request.signal, cancel.signal])
      const archive = await readBounded(request, handler.maxUploadBytes, signal)
      if (archive === undefined) return failure('too-large', `the archive exceeds ${handler.maxUploadBytes} bytes`)
      streaming = true
      return new Response(importStream(handler, archive, workspace, claim, cancel, signal), {
        status: 200, headers: NDJSON_HEADERS,
      })
    } finally {
      if (!streaming) claim.release()
    }
  }
}

function importStream(
  handler: SessionBackupUploadHandler,
  archive: Uint8Array,
  workspace: SessionBackupWorkspace,
  claim: SessionBackupImportClaim,
  cancel: AbortController,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  let open = true
  return new ReadableStream<Uint8Array>({
    start: controller => {
      const send = (line: SessionBackupImportLine): void => { if (open) controller.enqueue(encodeLine(line)) }
      const end = (): void => {
        if (open) controller.close()
        open = false
      }
      send({ type: 'progress', progress: { phase: 'reading' } })
      handler.import(archive, workspace, (done, total) => {
        send({ type: 'progress', progress: { phase: 'writing', done, total } })
      }, signal).then(value => {
        send({ type: 'outcome', outcome: { ok: true, value } })
        end()
      }, (error: unknown) => {
        if (signal.aborted) end()
        else if (error instanceof SessionBackupError) {
          send({ type: 'outcome', outcome: { ok: false, error: { reason: error.reason, message: error.message } } })
          end()
        } else {
          handler.failed(error)
          controller.error(error)
          open = false
        }
      }).finally(() => { claim.release() })
    },
    cancel: () => {
      open = false
      cancel.abort()
    },
  })
}

async function readBounded(
  request: Request,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array | undefined> {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN)
  if (declared > limit) {
    await request.body?.cancel()
    return undefined
  }
  let buffer = new Uint8Array(Number.isSafeInteger(declared) && declared >= 0 ? declared : 0)
  let total = 0
  if (request.body !== null) {
    const reader = request.body.getReader()
    const stop = (): void => { reader.cancel(signal.reason).catch(() => undefined) }
    signal.addEventListener('abort', stop, { once: true })
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        const end = total + chunk.value.byteLength
        if (end > limit) {
          await reader.cancel()
          return undefined
        }
        if (end > buffer.byteLength) {
          const grown = new Uint8Array(Math.min(limit, Math.max(end, buffer.byteLength * 2)))
          grown.set(buffer.subarray(0, total))
          buffer = grown
        }
        buffer.set(chunk.value, total)
        total = end
      }
    } finally {
      signal.removeEventListener('abort', stop)
    }
  }
  signal.throwIfAborted()
  return total === buffer.byteLength ? buffer : buffer.subarray(0, total)
}

function encodeLine(line: SessionBackupImportLine): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${JSON.stringify(line)}\n`)
}

function outcomeLine(reason: SessionBackupFailureReason, message: string): SessionBackupImportLine {
  return { type: 'outcome', outcome: { ok: false, error: { reason, message } } }
}

function failure(reason: SessionBackupFailureReason, message: string): Response {
  return new Response(encodeLine(outcomeLine(reason, message)), { status: 200, headers: NDJSON_HEADERS })
}
