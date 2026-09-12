import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { historyBranchIdentitySchema, historyBranchNullableSchema, historyBranchRecordSchema, historyBranchRequestSchema,
  type HistoryBranchRecord, type HistoryBranchRequest } from '../history-branch.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphBranch/prepare': (request: HistoryBranchRequest, signal?: AbortSignal) => Promise<RemoteResult<HistoryBranchRecord>>
    'sessionGraphBranch/submit': (request: { readonly operationId: string }, signal?: AbortSignal) => Promise<RemoteResult<HistoryBranchRecord>>
    'sessionGraphBranch/read': (request: { readonly operationId: string }, signal?: AbortSignal) => Promise<RemoteResult<HistoryBranchRecord | null>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphBranch: {
      prepare: TypertRemoteMap['sessionGraphBranch/prepare']
      submit: TypertRemoteMap['sessionGraphBranch/submit']
      read: TypertRemoteMap['sessionGraphBranch/read']
    }
  }
}
const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'
export const HISTORY_BRANCH_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'prepare', request: historyBranchRequestSchema, result: historyBranchRecordSchema },
    { method: 'submit', request: historyBranchIdentitySchema, result: historyBranchRecordSchema },
    { method: 'read', request: historyBranchIdentitySchema, result: historyBranchNullableSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphBranch/${method}`, service: 'sessionGraphBranch', namespace: 'sessionGraphBranch', method,
    invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#HistoryBranch/${method}/Request`, schema: request } }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#HistoryBranch/${method}/Result`, schema: result },
  })),
}
