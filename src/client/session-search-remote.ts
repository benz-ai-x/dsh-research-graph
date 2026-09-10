import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { DiscussionSearchRequest, DiscussionSearchResult } from '../session-search.ts'
import { discussionSearchRequestSchema, discussionSearchResultSchema } from '../session-search-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphSearch/search': (
      request: DiscussionSearchRequest,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<DiscussionSearchResult>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphSearch: { search: TypertRemoteMap['sessionGraphSearch/search'] }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const DISCUSSION_SEARCH_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphSearch/search`,
    service: 'sessionGraphSearch', namespace: 'sessionGraphSearch', method: 'search',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#DiscussionSearchRequest`, schema: discussionSearchRequestSchema },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#DiscussionSearchResult`, schema: discussionSearchResultSchema },
  }],
}
