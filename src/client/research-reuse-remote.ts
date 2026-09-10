import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { ResearchReusePreparation, ResearchReuseRecord } from '../research-reuse.ts'
import { researchReusePreparationSchema, researchReuseReadSchema, researchReuseSessionSchema,
  researchReuseRecordSchema, researchReuseNullableSchema, researchReuseListSchema } from '../research-reuse-codec.ts'

export interface ResearchReuseApi {
  readonly prepare: (request: ResearchReusePreparation, signal: AbortSignal) => Promise<ResearchReuseRecord>
  readonly submit: (request: { readonly operationId: string }, signal: AbortSignal) => Promise<ResearchReuseRecord>
  readonly read: (request: { readonly operationId: string }, signal: AbortSignal) => Promise<ResearchReuseRecord | null>
  readonly forSession: (request: { readonly sessionId: string }, signal: AbortSignal) => Promise<readonly ResearchReuseRecord[]>
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphReuse/prepare': (request: ResearchReusePreparation, signal?: AbortSignal) => Promise<RemoteResult<ResearchReuseRecord>>
    'sessionGraphReuse/submit': (request: { readonly operationId: string }, signal?: AbortSignal) => Promise<RemoteResult<ResearchReuseRecord>>
    'sessionGraphReuse/read': (request: { readonly operationId: string }, signal?: AbortSignal) => Promise<RemoteResult<ResearchReuseRecord | null>>
    'sessionGraphReuse/forSession': (request: { readonly sessionId: string }, signal?: AbortSignal) => Promise<RemoteResult<readonly ResearchReuseRecord[]>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphReuse: {
      prepare: TypertRemoteMap['sessionGraphReuse/prepare']
      submit: TypertRemoteMap['sessionGraphReuse/submit']
      read: TypertRemoteMap['sessionGraphReuse/read']
      forSession: TypertRemoteMap['sessionGraphReuse/forSession']
    }
  }
}
const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'
export const RESEARCH_REUSE_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'prepare', request: researchReusePreparationSchema, result: researchReuseRecordSchema },
    { method: 'submit', request: researchReuseReadSchema, result: researchReuseRecordSchema },
    { method: 'read', request: researchReuseReadSchema, result: researchReuseNullableSchema },
    { method: 'forSession', request: researchReuseSessionSchema, result: researchReuseListSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphReuse/${method}`, service: 'sessionGraphReuse', namespace: 'sessionGraphReuse', method,
    invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#ResearchReuse/${method}/Request`, schema: request } }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#ResearchReuse/${method}/Result`, schema: result },
  })),
}
