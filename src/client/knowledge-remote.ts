import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { KnowledgeCard, KnowledgeMembership, KnowledgeSave, KnowledgeSearch } from '../knowledge.ts'
import { knowledgeCardSchema, knowledgeListSchema, knowledgeMembershipSchema, knowledgeNullableSchema,
  knowledgeReadSchema, knowledgeSaveSchema, knowledgeSearchSchema } from '../knowledge-codec.ts'

export interface KnowledgeApi {
  readonly read: (request: { readonly cardId: string }, signal: AbortSignal) => Promise<KnowledgeCard | null>
  readonly save: (request: KnowledgeSave, signal: AbortSignal) => Promise<KnowledgeCard>
  readonly search: (request: KnowledgeSearch, signal: AbortSignal) => Promise<readonly KnowledgeCard[]>
  readonly membership: (request: KnowledgeMembership, signal: AbortSignal) => Promise<KnowledgeCard>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphKnowledge/read': (request: { readonly cardId: string }, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard | null>>
    'sessionGraphKnowledge/save': (request: KnowledgeSave, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard>>
    'sessionGraphKnowledge/search': (request: KnowledgeSearch, signal?: AbortSignal) => Promise<RemoteResult<readonly KnowledgeCard[]>>
    'sessionGraphKnowledge/membership': (request: KnowledgeMembership, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphKnowledge: {
      read: TypertRemoteMap['sessionGraphKnowledge/read']
      save: TypertRemoteMap['sessionGraphKnowledge/save']
      search: TypertRemoteMap['sessionGraphKnowledge/search']
      membership: TypertRemoteMap['sessionGraphKnowledge/membership']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'
export const KNOWLEDGE_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'read', request: knowledgeReadSchema, result: knowledgeNullableSchema },
    { method: 'save', request: knowledgeSaveSchema, result: knowledgeCardSchema },
    { method: 'search', request: knowledgeSearchSchema, result: knowledgeListSchema },
    { method: 'membership', request: knowledgeMembershipSchema, result: knowledgeCardSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphKnowledge/${method}`,
    service: 'sessionGraphKnowledge', namespace: 'sessionGraphKnowledge', method, invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#Knowledge/${method}/Request`, schema: request } }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#Knowledge/${method}/Result`, schema: result },
  })),
}
