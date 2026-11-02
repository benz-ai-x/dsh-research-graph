import type { WorkspaceFolderRecord, WorkspaceFolderWrite } from '../../workspace-folder.ts'

type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } }

export interface WorkspaceFolderRemote {
  readonly list: () => Promise<Result<readonly WorkspaceFolderRecord[]>>
  readonly write: (request: WorkspaceFolderWrite) => Promise<Result<WorkspaceFolderRecord>>
}

export interface WorkspaceFolderStore {
  readonly getSnapshot: () => readonly WorkspaceFolderRecord[]
  readonly set: (records: readonly WorkspaceFolderRecord[]) => void
}

export interface WorkspaceFolderSync {
  readonly refresh: () => Promise<void>
  readonly write: (request: WorkspaceFolderWrite) => Promise<WorkspaceFolderRecord>
  readonly dispose: () => void
}

export function createWorkspaceFolderSync({ remote, store, intervalMs = 5000 }: {
  readonly remote: WorkspaceFolderRemote
  readonly store: WorkspaceFolderStore
  readonly intervalMs?: number
}): WorkspaceFolderSync {
  let revision = 0
  let disposed = false
  const refresh = async (): Promise<void> => {
    const requested = ++revision
    const result = await remote.list()
    if (disposed || requested !== revision || !result.ok) return
    store.set(result.value)
  }
  const write = async (request: WorkspaceFolderWrite): Promise<WorkspaceFolderRecord> => {
    const result = await remote.write(request)
    if (!result.ok) throw new Error(result.error.message)
    revision += 1
    const current = store.getSnapshot()
    store.set([...current.filter(item => item.workspaceId !== result.value.workspaceId), result.value])
    return result.value
  }
  const poll = (): void => { void refresh().catch(() => {}) }
  poll()
  const timer = setInterval(poll, intervalMs)
  return {
    refresh,
    write,
    dispose: () => {
      disposed = true
      revision += 1
      clearInterval(timer)
    },
  }
}
