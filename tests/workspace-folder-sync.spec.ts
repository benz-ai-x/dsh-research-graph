import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFolderRecord, WorkspaceFolderWrite } from '../src/workspace-folder.ts'
import { createWorkspaceFolderSync } from '../src/client/workspace/folder-sync.ts'

const FOLDER = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const record = (title: string): WorkspaceFolderRecord => ({ workspaceId: 'w1', folders: [{ folderId: FOLDER, title, sessionIds: [] }] })
const request: WorkspaceFolderWrite = { kind: 'rename', workspaceId: 'w1', folderId: FOLDER, title: 'new' }

afterEach(() => { vi.useRealTimers() })

describe('Workspace folder synchronization', () => {
  it('refreshes records from the Host on an interval and stops after disposal', async () => {
    vi.useFakeTimers()
    const list = vi.fn(async () => ({ ok: true as const, value: [record('remote')] }))
    const store = { value: [] as readonly WorkspaceFolderRecord[], getSnapshot() { return this.value }, set(next: readonly WorkspaceFolderRecord[]) { this.value = next } }
    const sync = createWorkspaceFolderSync({ remote: { list, write: vi.fn() }, store, intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(0)
    expect(store.value[0]?.folders[0]?.title).toBe('remote')
    await vi.advanceTimersByTimeAsync(1000)
    expect(list).toHaveBeenCalledTimes(2)
    sync.dispose()
    await vi.advanceTimersByTimeAsync(3000)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('does not let an older list response overwrite a newer local write', async () => {
    const pending = Promise.withResolvers<{ ok: true; value: WorkspaceFolderRecord[] }>()
    const list = vi.fn(() => pending.promise)
    const write = vi.fn(async (_request: WorkspaceFolderWrite) => ({ ok: true as const, value: record('new') }))
    const store = { value: [] as readonly WorkspaceFolderRecord[], getSnapshot() { return this.value }, set(next: readonly WorkspaceFolderRecord[]) { this.value = next } }
    const sync = createWorkspaceFolderSync({ remote: { list, write }, store })
    await sync.write(request)
    expect(store.value[0]?.folders[0]?.title).toBe('new')
    pending.resolve({ ok: true, value: [record('old')] })
    await Promise.resolve()
    expect(store.value[0]?.folders[0]?.title).toBe('new')
    sync.dispose()
  })
})
