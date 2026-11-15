import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceMembershipRestoreRequest, WorkspaceMembershipRestoreResult } from '../../workspace-membership.ts'

export interface WorkspaceMembershipRemote {
  restore(request: WorkspaceMembershipRestoreRequest): Promise<RemoteResult<WorkspaceMembershipRestoreResult>>
}

export function createWorkspaceWithRestoredMembership(
  workspaces: Pick<IWorkspaces, 'create'>,
  remote: WorkspaceMembershipRemote,
): IWorkspaces['create'] {
  return async (input) => {
    const workspace = await workspaces.create(input)
    const result = await remote.restore({ workspaceId: String(workspace.workspaceId) })
    if (!result.ok) throw new Error(result.error.message)
    return workspace
  }
}
