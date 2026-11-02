import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceFolderRecord, WorkspaceFolderWrite } from '../workspace-folder.ts'
import {
  workspaceFolderListSchema, workspaceFolderRecordSchema, workspaceFolderWriteSchema,
} from '../workspace-folder-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphFolders/list': (signal?: AbortSignal) => Promise<RemoteResult<readonly WorkspaceFolderRecord[]>>
    'sessionGraphFolders/write': (
      request: WorkspaceFolderWrite,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<WorkspaceFolderRecord>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphFolders: {
      list: TypertRemoteMap['sessionGraphFolders/list']
      write: TypertRemoteMap['sessionGraphFolders/write']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const WORKSPACE_FOLDERS_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'list', request: undefined, result: workspaceFolderListSchema },
    { method: 'write', request: workspaceFolderWriteSchema, result: workspaceFolderRecordSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphFolders/${method}`,
    service: 'sessionGraphFolders', namespace: 'sessionGraphFolders', method,
    invocation: { kind: 'direct' },
    parameters: request === undefined ? [] : [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#WorkspaceFolders/${method}/Request`, create: () => request },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#WorkspaceFolders/${method}/Result`, create: () => result },
  })),
}
