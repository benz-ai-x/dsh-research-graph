// Local delta vs upstream: the native export route keeps its bytes; this package owns backup naming.
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export function sessionBackupWorkspaceTitle(
  workspaces: readonly { readonly title: string; readonly sessionIds: readonly SessionId[] }[],
  sessionId: SessionId,
  ungrouped: string,
): string {
  return workspaces.find(workspace => workspace.sessionIds.includes(sessionId))?.title ?? ungrouped
}

export interface SessionBackupFilenameInput {
  readonly workspaceTitle: string
  readonly sessionTitle: string
  readonly sessionId: SessionId
  readonly date: Date
}

export function sessionBackupFilename(input: SessionBackupFilenameInput): string {
  const workspace = safeSegment(input.workspaceTitle, 'workspace', 60)
  const title = safeSegment(input.sessionTitle, 'session', 80)
  const timestamp = input.date.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')
  const id = String(input.sessionId).replace(/^session-/u, '').slice(0, 8)
  return `DSH_${workspace}_${title}_${timestamp}_${id}.zip`
}

function safeSegment(value: string, fallback: string, maxBytes: number): string {
  const normalized = value.normalize('NFC')
    .replace(/[\\/\u0000-\u001f\u007f:*?"<>|]+/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/^[-. ]+|[-. ]+$/gu, '')
  return truncateUtf8(normalized || fallback, maxBytes, fallback)
}

function truncateUtf8(value: string, maxBytes: number, fallback: string): string {
  const encoder = new TextEncoder()
  let result = ''
  let bytes = 0
  for (const character of value) {
    const size = encoder.encode(character).byteLength
    if (bytes + size > maxBytes) break
    result += character
    bytes += size
  }
  return result.replace(/[-. ]+$/gu, '') || fallback
}

export async function downloadSessionBackup(input: SessionBackupFilenameInput & {
  readonly fetcher?: (input: string, init?: RequestInit) => Promise<Response>
  readonly save?: (url: string, filename: string) => void
  readonly signal?: AbortSignal
}): Promise<string> {
  const filename = sessionBackupFilename(input)
  const query = new URLSearchParams({ sessionId: String(input.sessionId), includeDescendants: 'true' })
  const route = `api/session.export?${query.toString()}`
  const fetcher = input.fetcher ?? ((url: string, init?: RequestInit) => fetch(url, init))
  const response = await fetcher(route, { method: 'HEAD', ...(input.signal === undefined ? {} : { signal: input.signal }) })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Session backup failed: HTTP ${response.status}${detail === '' ? '' : ` ${detail}`}`)
  }
  input.signal?.throwIfAborted()
  const download = await fetcher(route, { method: 'GET', ...(input.signal === undefined ? {} : { signal: input.signal }) })
  if (!download.ok) throw new Error(`Session backup failed: HTTP ${download.status}`)
  const blob = await download.blob()
  input.signal?.throwIfAborted()
  const save = input.save ?? ((url: string, name: string) => {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
  })
  if (input.save !== undefined) {
    save(route, filename)
  } else {
    const url = URL.createObjectURL(blob)
    try {
      save(url, filename)
    } finally {
      globalThis.setTimeout(() => { URL.revokeObjectURL(url) }, 60_000)
    }
  }
  return filename
}
