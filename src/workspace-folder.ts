export interface WorkspaceFolder {
  readonly folderId: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

export interface WorkspaceFolderRecord {
  readonly workspaceId: string
  readonly folders: readonly WorkspaceFolder[]
}

export type WorkspaceFolderWrite =
  | {
    readonly kind: 'create'
    readonly workspaceId: string
    readonly folderId: string
    readonly title: string
    readonly sessionId?: string
  }
  | {
    readonly kind: 'rename'
    readonly workspaceId: string
    readonly folderId: string
    readonly title: string
  }
  | {
    readonly kind: 'delete'
    readonly workspaceId: string
    readonly folderId: string
  }
  | {
    readonly kind: 'move'
    readonly workspaceId: string
    readonly sessionId: string
    readonly folderId?: string
  }
