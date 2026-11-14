/** Browser contribution for the plugin-owned Branch Origin Remote. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import {
  BRANCH_ORIGIN_QUERY_LIMIT,
  type BranchOrigin, type BranchOriginList, type BranchOriginQuery, type BranchOriginRecord,
} from '../branch-links.ts'
import {
  branchOriginListSchema as listSchema, branchOriginQuerySchema as querySchema,
  branchOriginRecordSchema as recordSchema, branchOriginSchema as originSchema,
} from '../branch-links-codec.ts'

/** Branch Origin read face used by graph entry points. */
export type ReadBranchOrigins = (
  request: BranchOriginQuery,
  signal: AbortSignal,
) => Promise<readonly BranchOrigin[]>

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphBranchOrigin/record': (
      request: BranchOriginRecord,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<BranchOrigin>>
    'sessionGraphBranchOrigin/list': (
      request: BranchOriginQuery,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<BranchOriginList>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphBranchOrigin: {
      record: TypertRemoteMap['sessionGraphBranchOrigin/record']
      list: TypertRemoteMap['sessionGraphBranchOrigin/list']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

/** Read all requested origins in bounded sequential batches. */
export async function readBranchOriginMap(
  read: ReadBranchOrigins,
  sessionIds: readonly string[],
  signal: AbortSignal,
): Promise<ReadonlyMap<string, string>> {
  const origins: BranchOrigin[] = []
  for (let start = 0; start < sessionIds.length; start += BRANCH_ORIGIN_QUERY_LIMIT) {
    origins.push(...await read({
      sessionIds: sessionIds.slice(start, start + BRANCH_ORIGIN_QUERY_LIMIT),
    }, signal))
  }
  return new Map(origins.map(origin => [origin.childSessionId, origin.parentSessionId]))
}

export const BRANCH_ORIGIN_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'record', request: recordSchema, result: originSchema },
    { method: 'list', request: querySchema, result: listSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphBranchOrigin/${method}`,
    service: 'sessionGraphBranchOrigin',
    namespace: 'sessionGraphBranchOrigin',
    method,
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#BranchOrigin/${method}/Request`, create: () => request },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#BranchOrigin/${method}/Result`, create: () => result },
  })),
}
