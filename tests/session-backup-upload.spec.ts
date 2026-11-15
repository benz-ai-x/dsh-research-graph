import { describe, expect, it, vi } from 'vitest'
import { createSessionBackupUploadRoute, type SessionBackupUploadHandler } from '../src/session-backup-upload.ts'
import type { SessionBackupResult } from '../src/session-backup.ts'

const result: SessionBackupResult = {
  rootSessionId: 'session-root', importedSessionIds: ['session-root'], existingSessionIds: [], attachmentCount: 0, partial: false,
}

function handler(overrides: Partial<SessionBackupUploadHandler> = {}): SessionBackupUploadHandler {
  return {
    maxUploadBytes: 8,
    claim: () => ({ signal: new AbortController().signal, release: vi.fn() }),
    workspace: () => ({ id: 'w1', path: '/w1', attachSession: async () => {} }),
    import: async () => result,
    failed: vi.fn(),
    ...overrides,
  }
}

function request(body = new Uint8Array([1, 2, 3])): Request {
  return new Request('http://host/api/session-graph/backup-import?workspaceId=w1', {
    method: 'POST', body, headers: { 'content-type': 'application/octet-stream' },
  })
}

describe('Session Backup upload route', () => {
  it('validates media type, Workspace, concurrency, and upload size', async () => {
    const wrongType = await createSessionBackupUploadRoute(handler())(new Request('http://host/api/session-graph/backup-import?workspaceId=w1', {
      method: 'POST', body: new Uint8Array(), headers: { 'content-type': 'application/json' },
    }))
    expect(wrongType.status).toBe(415)

    const busy = await createSessionBackupUploadRoute(handler({ claim: () => undefined }))(request())
    expect(await busy.text()).toContain('busy')
    const missing = await createSessionBackupUploadRoute(handler({ workspace: () => undefined }))(request())
    expect(await missing.text()).toContain('workspace-not-found')
    const large = await createSessionBackupUploadRoute(handler())(request(new Uint8Array(9)))
    expect(await large.text()).toContain('too-large')
  })

  it('streams validation and write progress before the result', async () => {
    const importBackup = vi.fn(async (_archive, _workspace, onProgress) => {
      onProgress(1, 1)
      return result
    })
    const response = await createSessionBackupUploadRoute(handler({ import: importBackup }))(request())
    const lines = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
    expect(lines[0]).toEqual({ type: 'progress', progress: { phase: 'reading' } })
    expect(lines[1]).toEqual({ type: 'progress', progress: { phase: 'writing', done: 1, total: 1 } })
    expect(lines[2]).toEqual({ type: 'outcome', outcome: { ok: true, value: result } })
  })

  it('cancels the import and releases the single import slot when the response is abandoned', async () => {
    const release = vi.fn()
    const controller = new AbortController()
    const response = await createSessionBackupUploadRoute(handler({
      claim: () => ({ signal: controller.signal, release }),
      import: async (_archive, _workspace, _progress, signal) => await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { reject(signal.reason) }, { once: true })
      }),
    }))(request())
    await response.body?.cancel()
    await vi.waitFor(() => { expect(release).toHaveBeenCalledOnce() })
  })
})
