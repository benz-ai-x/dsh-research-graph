import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type { WorkspaceFolderRecord, WorkspaceFolderWrite } from './workspace-folder.ts'
import {
  workspaceFolderListSchema, workspaceFolderRecordSchema, workspaceFolderWriteSchema,
} from './workspace-folder-codec.ts'
import { ServiceRequests } from './service-requests.ts'

const workspaceStorageSchema: z.ZodType<WorkspaceFolderRecord> = z.unknown().transform((value, context) => {
  try {
    return workspaceFolderRecordSchema.parse(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Workspace Folder record' })
    return z.NEVER
  }
})

export const WORKSPACE_FOLDER_DOMAIN = {
  name: 'session_graph_workspace_folders',
  version: 1,
  tables: {
    workspaces: { valueSchema: workspaceStorageSchema },
    metadata: { valueSchema: z.object({ version: z.literal(1) }) },
  },
} as const

function emptyRecord(workspaceId: string): WorkspaceFolderRecord {
  return { workspaceId, folders: [] }
}

function moved(
  current: WorkspaceFolderRecord,
  sessionId: string,
  folderId?: string,
): WorkspaceFolderRecord {
  return {
    ...current,
    folders: current.folders.map(folder => ({
      ...folder,
      sessionIds: folder.folderId === folderId
        ? [...folder.sessionIds.filter(id => id !== sessionId), sessionId]
        : folder.sessionIds.filter(id => id !== sessionId),
    })),
  }
}

/**
 * Host service for browser-local Workspace folders: virtual per-Workspace
 * session folders persisted in their own storage domain. Folder membership
 * never alters Session ownership, history, or Workspace accounting; deleting
 * a folder simply drops its assignments.
 */
export class WorkspaceFoldersService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Workspace Folders service')
  private tail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly domain: Domain<typeof WORKSPACE_FOLDER_DOMAIN>) {
    super(ctx, 'sessionGraphFolders')
    ctx.effect(() => () => this.dispose(), 'session-graph.workspace-folders-quiescence')
  }

  @Remote('list')
  list(signal: AbortSignal): Promise<readonly WorkspaceFolderRecord[]> {
    return this.requests.run(signal, async () => {
      const records = [...this.domain.table('workspaces').entries()].map(([, record]) => record)
      return workspaceFolderListSchema.parse(records)
    })
  }

  @Remote('write')
  write(request: WorkspaceFolderWrite, signal: AbortSignal): Promise<WorkspaceFolderRecord> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      const command = workspaceFolderWriteSchema.parse(request)
      const workspace = this.ctx.workspaceRegistry.list().find(item => String(item.id) === command.workspaceId)
      if (workspace === undefined) throw new Error('Workspace Folder Workspace is unavailable')
      const sessionId = command.kind === 'move' || command.kind === 'create' ? command.sessionId : undefined
      if (sessionId !== undefined) await this.validateSession(sessionId, workspace.sessionIds.map(String), combined)
      const table = this.domain.table('workspaces')
      const current = table.get(command.workspaceId) ?? emptyRecord(command.workspaceId)
      let next = current
      if (command.kind === 'move') {
        if (command.folderId !== undefined && !current.folders.some(folder => folder.folderId === command.folderId)) {
          throw new Error('Workspace Folder is unavailable')
        }
        next = moved(current, command.sessionId, command.folderId)
      } else if (command.kind === 'delete') {
        if (!current.folders.some(folder => folder.folderId === command.folderId)) {
          throw new Error('Workspace Folder is unavailable')
        }
        next = {
          ...current,
          folders: current.folders.filter(folder => folder.folderId !== command.folderId),
        }
      } else {
        const duplicate = current.folders.find(folder =>
          folder.folderId !== command.folderId && folder.title.toLocaleLowerCase() === command.title.toLocaleLowerCase())
        if (duplicate !== undefined) throw new Error('A Workspace Folder with this title already exists')
        if (command.kind === 'rename') {
          if (!current.folders.some(folder => folder.folderId === command.folderId)) {
            throw new Error('Workspace Folder is unavailable')
          }
          next = {
            ...current,
            folders: current.folders.map(folder => folder.folderId === command.folderId
              ? { ...folder, title: command.title }
              : folder),
          }
        } else {
          const existing = current.folders.find(folder => folder.folderId === command.folderId)
          if (existing !== undefined && existing.title !== command.title) {
            throw new Error('This Workspace Folder identity already belongs to another title')
          }
          const withFolder = existing === undefined
            ? {
                ...current,
                folders: [...current.folders, { folderId: command.folderId, title: command.title, sessionIds: [] }],
              }
            : current
          next = command.sessionId === undefined ? withFolder : moved(withFolder, command.sessionId, command.folderId)
        }
      }
      combined.throwIfAborted()
      if (next !== current) await table.put(command.workspaceId, next)
      return next
    }))
  }

  private async validateSession(sessionId: string, account: readonly string[], signal: AbortSignal): Promise<void> {
    if (!account.includes(sessionId)) throw new Error('Session does not belong to this Workspace')
    const listed = await this.ctx.sessionQuery.listSessions(signal)
    const source = listed.find(item => String(item.header.id) === sessionId)
    if (source === undefined || source.header.origin === 'subagent') throw new Error('Session is unavailable')
    signal.throwIfAborted()
  }

  private serialize<Value>(operation: () => Promise<Value>): Promise<Value> {
    const pending = this.tail.then(operation)
    this.tail = pending.then(() => {}, () => {})
    return pending
  }

  dispose(): Promise<void> {
    return this.requests.dispose(() => this.domain.close())
  }
}
