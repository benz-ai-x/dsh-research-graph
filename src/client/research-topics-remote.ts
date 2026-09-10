import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { ResearchTopic, ResearchTopicSnapshot, ResearchTopicWrite } from '../research-topic.ts'
import {
  researchTopicListSchema, researchTopicReadSchema, researchTopicSchema,
  researchTopicSnapshotSchema, researchTopicWriteSchema,
} from '../research-topic-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphTopics/list': (signal?: AbortSignal) => Promise<RemoteResult<readonly ResearchTopic[]>>
    'sessionGraphTopics/read': (request: { readonly topicId: string }, signal?: AbortSignal) => Promise<RemoteResult<ResearchTopicSnapshot>>
    'sessionGraphTopics/write': (request: ResearchTopicWrite, signal?: AbortSignal) => Promise<RemoteResult<ResearchTopic>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphTopics: {
      list: TypertRemoteMap['sessionGraphTopics/list']
      read: TypertRemoteMap['sessionGraphTopics/read']
      write: TypertRemoteMap['sessionGraphTopics/write']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const RESEARCH_TOPICS_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'list', request: undefined, result: researchTopicListSchema },
    { method: 'read', request: researchTopicReadSchema, result: researchTopicSnapshotSchema },
    { method: 'write', request: researchTopicWriteSchema, result: researchTopicSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphTopics/${method}`,
    service: 'sessionGraphTopics', namespace: 'sessionGraphTopics', method,
    invocation: { kind: 'direct' },
    parameters: request === undefined ? [] : [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#ResearchTopics/${method}/Request`, schema: request },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#ResearchTopics/${method}/Result`, schema: result },
  })),
}
