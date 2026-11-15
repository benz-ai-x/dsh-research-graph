import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceMembershipRestoreRequest, WorkspaceMembershipRestoreResult } from '../workspace-membership.ts'
import {
  workspaceMembershipRestoreRequestSchema,
  workspaceMembershipRestoreResultSchema,
} from '../workspace-membership-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphWorkspaces/restore': (
      request: WorkspaceMembershipRestoreRequest,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<WorkspaceMembershipRestoreResult>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphWorkspaces: {
      restore: TypertRemoteMap['sessionGraphWorkspaces/restore']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const WORKSPACE_MEMBERSHIP_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphWorkspaces/restore`,
    service: 'sessionGraphWorkspaces', namespace: 'sessionGraphWorkspaces', method: 'restore',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request', wire: 'request', source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: `${PACKAGE_NAME}#WorkspaceMembershipRestoreRequest`,
        create: () => workspaceMembershipRestoreRequestSchema,
      },
    }],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: `${PACKAGE_NAME}#WorkspaceMembershipRestoreResult`,
      create: () => workspaceMembershipRestoreResultSchema,
    },
  }],
}
