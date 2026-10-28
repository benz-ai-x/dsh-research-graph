export interface SidebarCategory {
  readonly categoryId: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

export interface SidebarCategoryWorkspace {
  readonly workspaceId: string
  readonly categories: readonly SidebarCategory[]
}

export type SidebarCategoryWrite =
  | {
    readonly kind: 'create'
    readonly workspaceId: string
    readonly categoryId: string
    readonly title: string
    readonly sessionId?: string
  }
  | {
    readonly kind: 'rename'
    readonly workspaceId: string
    readonly categoryId: string
    readonly title: string
  }
  | {
    readonly kind: 'delete'
    readonly workspaceId: string
    readonly categoryId: string
  }
  | {
    readonly kind: 'move'
    readonly workspaceId: string
    readonly sessionId: string
    readonly categoryId?: string
  }
