import {
  SESSION_BACKUP_IMPORT_ROUTE,
  type SessionBackupFailureReason,
  type SessionBackupImportLine,
  type SessionBackupProgress,
  type SessionBackupResult,
} from '../session-backup.ts'

export type SessionBackupUploadProgress =
  | { readonly phase: 'uploading'; readonly fraction: number }
  | SessionBackupProgress

export type SessionBackupResponse = Extract<SessionBackupImportLine, { type: 'outcome' }>['outcome']
export type SessionBackupUploadAnswer = SessionBackupResponse | { readonly ok: false; readonly transport: string }

type PageTransportFetch = (input: string | URL, init: RequestInit) => Promise<Response>
interface PageTransportGlobal {
  __DSH_TRANSPORT__?: { fetch?: PageTransportFetch }
}

type AnswerStep =
  | { readonly kind: 'progress'; readonly progress: SessionBackupProgress }
  | { readonly kind: 'outcome'; readonly outcome: SessionBackupResponse }
  | { readonly kind: 'invalid' }

function createAnswerReader(): (text: string) => AnswerStep[] {
  let parsed = 0
  return text => {
    const steps: AnswerStep[] = []
    for (let end = text.indexOf('\n', parsed); end >= 0; end = text.indexOf('\n', parsed)) {
      const line = parseLine(text.slice(parsed, end))
      parsed = end + 1
      if (line === undefined) steps.push({ kind: 'invalid' })
      else if (line.type === 'progress') steps.push({ kind: 'progress', progress: line.progress })
      else steps.push({ kind: 'outcome', outcome: line.outcome })
    }
    return steps
  }
}

const INVALID_ANSWER = 'the server answered with invalid JSON'

function createAnswerCollector(onProgress: (progress: SessionBackupUploadProgress) => void) {
  const read = createAnswerReader()
  const state: { outcome?: SessionBackupResponse; invalid: boolean } = { invalid: false }
  return {
    take(text: string): boolean {
      for (const step of read(text)) {
        if (step.kind === 'invalid') {
          state.invalid = true
          return true
        }
        if (step.kind === 'progress') onProgress(step.progress)
        else state.outcome = step.outcome
      }
      return false
    },
    finish(): SessionBackupUploadAnswer {
      if (state.invalid) return { ok: false, transport: INVALID_ANSWER }
      if (state.outcome !== undefined) return state.outcome
      return { ok: false, transport: 'the server ended the answer without a result' }
    },
  }
}

export function uploadSessionBackup(
  file: Blob,
  workspaceId: string,
  onProgress: (progress: SessionBackupUploadProgress) => void,
  signal: AbortSignal,
): Promise<SessionBackupUploadAnswer> {
  const url = new URL(`${SESSION_BACKUP_IMPORT_ROUTE}?${new URLSearchParams({ workspaceId }).toString()}`, document.baseURI)
  const carrier = (globalThis as PageTransportGlobal).__DSH_TRANSPORT__?.fetch
  return carrier === undefined ? sendWithXhr(file, url, onProgress, signal) : sendWithCarrier(carrier, file, url, onProgress, signal)
}

async function sendWithCarrier(
  carrier: PageTransportFetch,
  file: Blob,
  url: URL,
  onProgress: (progress: SessionBackupUploadProgress) => void,
  signal: AbortSignal,
): Promise<SessionBackupUploadAnswer> {
  onProgress({ phase: 'reading' })
  let response: Response
  try {
    response = await carrier(url.href, {
      method: 'POST', body: file, headers: { 'content-type': 'application/octet-stream' }, signal,
    })
  } catch (error) {
    return { ok: false, transport: signal.aborted ? 'the upload was cancelled' : errorText(error) }
  }
  if (response.status !== 200) return { ok: false, transport: `HTTP ${response.status}: ${await response.text()}` }
  const answer = createAnswerCollector(onProgress)
  try {
    const body = response.body
    if (body === null) answer.take(await response.text())
    else {
      const reader = body.pipeThrough(new TextDecoderStream()).getReader()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += value
        if (answer.take(text)) {
          void reader.cancel()
          return answer.finish()
        }
      }
    }
  } catch (error) {
    return { ok: false, transport: signal.aborted ? 'the upload was cancelled' : errorText(error) }
  }
  return answer.finish()
}

function sendWithXhr(
  file: Blob,
  url: URL,
  onProgress: (progress: SessionBackupUploadProgress) => void,
  signal: AbortSignal,
): Promise<SessionBackupUploadAnswer> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    const answer = createAnswerCollector(onProgress)
    let settled = false
    const settle = (result: SessionBackupUploadAnswer): void => {
      if (settled) return
      settled = true
      resolve(result)
    }
    const take = (): void => {
      if (settled) return
      if (answer.take(xhr.responseText)) {
        settle({ ok: false, transport: INVALID_ANSWER })
        xhr.abort()
      }
    }
    xhr.open('POST', url.href)
    xhr.setRequestHeader('content-type', 'application/octet-stream')
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress({ phase: 'uploading', fraction: event.loaded / event.total })
    }
    xhr.upload.onload = () => { onProgress({ phase: 'reading' }) }
    xhr.onprogress = () => { if (xhr.status === 200) take() }
    xhr.onload = () => {
      if (settled) return
      if (xhr.status !== 200) {
        settle({ ok: false, transport: `HTTP ${xhr.status}: ${xhr.responseText}` })
        return
      }
      take()
      settle(answer.finish())
    }
    xhr.onerror = () => { settle({ ok: false, transport: 'the upload connection failed' }) }
    xhr.onabort = () => { settle({ ok: false, transport: 'the upload was cancelled' }) }
    signal.addEventListener('abort', () => { xhr.abort() }, { once: true })
    xhr.send(file)
  })
}

const FAILURE_REASONS: ReadonlySet<string> = new Set<SessionBackupFailureReason>([
  'too-large', 'unreadable-archive', 'unsupported-archive', 'missing-attachment',
  'session-conflict', 'attachment-failed', 'workspace-not-found', 'busy', 'write-failed',
])

type JsonObject = Record<string, unknown>
function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isReason(value: unknown): value is SessionBackupFailureReason {
  return typeof value === 'string' && FAILURE_REASONS.has(value)
}
function isResult(value: unknown): value is SessionBackupResult {
  return isObject(value)
    && typeof value['rootSessionId'] === 'string'
    && Array.isArray(value['importedSessionIds']) && value['importedSessionIds'].every(id => typeof id === 'string')
    && Array.isArray(value['existingSessionIds']) && value['existingSessionIds'].every(id => typeof id === 'string')
    && typeof value['attachmentCount'] === 'number'
    && typeof value['partial'] === 'boolean'
    && (value['failedSessionId'] === undefined || typeof value['failedSessionId'] === 'string')
    && (value['error'] === undefined || typeof value['error'] === 'string')
}
function responseOf(value: unknown): SessionBackupResponse | undefined {
  if (!isObject(value)) return undefined
  if (value['ok'] === true) return isResult(value['value']) ? { ok: true, value: value['value'] } : undefined
  if (value['ok'] === false) {
    const error = value['error']
    if (!isObject(error) || !isReason(error['reason']) || typeof error['message'] !== 'string') return undefined
    return { ok: false, error: { reason: error['reason'], message: error['message'] } }
  }
  return undefined
}
function progressOf(value: unknown): SessionBackupProgress | undefined {
  if (!isObject(value)) return undefined
  if (value['phase'] === 'reading') return { phase: 'reading' }
  if (value['phase'] === 'writing' && typeof value['done'] === 'number' && typeof value['total'] === 'number') {
    return { phase: 'writing', done: value['done'], total: value['total'] }
  }
  return undefined
}
function lineOf(value: unknown): SessionBackupImportLine | undefined {
  if (!isObject(value)) return undefined
  if (value['type'] === 'progress') {
    const progress = progressOf(value['progress'])
    return progress === undefined ? undefined : { type: 'progress', progress }
  }
  if (value['type'] === 'outcome') {
    const outcome = responseOf(value['outcome'])
    return outcome === undefined ? undefined : { type: 'outcome', outcome }
  }
  return undefined
}
function parseLine(text: string): SessionBackupImportLine | undefined {
  try {
    return lineOf(JSON.parse(text))
  } catch {
    return undefined
  }
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
