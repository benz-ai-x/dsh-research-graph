/** Browser contribution for the package-owned, read-only history Remote. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionHistoryRequest, SessionHistoryResult } from '../session-history.ts'
import {
  sessionHistoryRequestSchema as requestSchema, sessionHistoryResultSchema as resultSchema,
} from '../session-history-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphHistory/read': (
      request: SessionHistoryRequest,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<SessionHistoryResult>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphHistory: { read: TypertRemoteMap['sessionGraphHistory/read'] }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const SESSION_HISTORY_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphHistory/read`,
    service: 'sessionGraphHistory',
    namespace: 'sessionGraphHistory',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SessionHistoryRequest`, schema: requestSchema },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SessionHistoryResult`, schema: resultSchema },
  }],
}
