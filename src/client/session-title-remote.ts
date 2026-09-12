import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { sessionTitleRequestSchema, sessionTitleResultSchema, type SessionTitleRequest, type SessionTitleResult } from '../session-title.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphTitle/generate': (request: SessionTitleRequest, signal?: AbortSignal) => Promise<RemoteResult<SessionTitleResult>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphTitle: { generate: TypertRemoteMap['sessionGraphTitle/generate'] }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'
export const SESSION_TITLE_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphTitle/generate`, service: 'sessionGraphTitle', namespace: 'sessionGraphTitle', method: 'generate',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: {
      mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SessionTitleRequest`, schema: sessionTitleRequestSchema,
    } }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SessionTitleResult`, schema: sessionTitleResultSchema },
  }],
}
