import type { WorkspaceFolder, WorkspaceFolderRecord, WorkspaceFolderWrite } from './workspace-folder.ts'

function invalid(): never { throw new TypeError('Invalid Workspace Folder data') }

function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (keys !== undefined && Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) return invalid()
  return value
}

function folderId(value: unknown): string {
  const id = string(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) return invalid()
  return id
}

function title(value: unknown): string {
  const label = string(value).trim()
  if (label.length > 120) return invalid()
  return label
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }

function folder(value: unknown): WorkspaceFolder {
  const item = object(value, ['folderId', 'title', 'sessionIds'])
  const sessionIds = array(item.sessionIds).map(string)
  if (new Set(sessionIds).size !== sessionIds.length) return invalid()
  return { folderId: folderId(item.folderId), title: title(item.title), sessionIds }
}

export const workspaceFolderRecordSchema = { parse(value: unknown): WorkspaceFolderRecord {
  const item = object(value, ['workspaceId', 'folders'])
  const folders = array(item.folders).map(folder)
  const folderIds = folders.map(item => item.folderId)
  const sessionIds = folders.flatMap(item => item.sessionIds)
  if (new Set(folderIds).size !== folderIds.length || new Set(sessionIds).size !== sessionIds.length) return invalid()
  return { workspaceId: string(item.workspaceId), folders }
} }

export const workspaceFolderWriteSchema = { parse(value: unknown): WorkspaceFolderWrite {
  const item = object(value)
  const workspaceId = string(item.workspaceId)
  if (item.kind === 'move') {
    object(item, ['kind', 'workspaceId', 'sessionId', 'folderId'])
    return {
      kind: item.kind, workspaceId, sessionId: string(item.sessionId),
      ...(item.folderId === undefined ? {} : { folderId: folderId(item.folderId) }),
    }
  }
  const id = folderId(item.folderId)
  if (item.kind === 'create') {
    object(item, ['kind', 'workspaceId', 'folderId', 'title', 'sessionId'])
    return {
      kind: item.kind, workspaceId, folderId: id, title: title(item.title),
      ...(item.sessionId === undefined ? {} : { sessionId: string(item.sessionId) }),
    }
  }
  if (item.kind === 'rename') {
    object(item, ['kind', 'workspaceId', 'folderId', 'title'])
    return { kind: item.kind, workspaceId, folderId: id, title: title(item.title) }
  }
  if (item.kind === 'delete') {
    object(item, ['kind', 'workspaceId', 'folderId'])
    return { kind: item.kind, workspaceId, folderId: id }
  }
  return invalid()
} }

export const workspaceFolderListSchema = { parse(value: unknown): readonly WorkspaceFolderRecord[] {
  return array(value).map(workspaceFolderRecordSchema.parse)
} }
