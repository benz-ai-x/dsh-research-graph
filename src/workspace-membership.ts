export interface WorkspaceMembershipRestoreRequest {
  readonly workspaceId: string
}

export interface WorkspaceMembershipRestoreResult {
  readonly sessionIds: readonly string[]
}
