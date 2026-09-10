import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { KnowledgeCard, KnowledgeMembership, KnowledgeSave, KnowledgeSearch } from '../knowledge.ts'
import { knowledgeCardSchema, knowledgeListSchema, knowledgeMembershipSchema, knowledgeNullableSchema,
  knowledgeReadSchema, knowledgeSaveSchema, knowledgeSearchSchema, knowledgeHostIdentitySchema } from '../knowledge-codec.ts'
import { extractionPreparationRequestSchema, extractionRequestSchema } from '../knowledge-codec.ts'
import { extractionPreparationSchema, extractionResultSchema } from '../knowledge-extraction-codec.ts'
import type { ExtractionPreparation, ExtractionPreparationRequest, ExtractionRequest, ExtractionResult } from '../knowledge-extraction.ts'
import type { KnowledgeExportRequest, KnowledgeExportResult } from '../knowledge-export.ts'
import { knowledgeExportRequestSchema, knowledgeExportResultSchema } from '../knowledge-export-codec.ts'

export interface KnowledgeApi {
  readonly prepareExport: (request: KnowledgeExportRequest, signal: AbortSignal) => Promise<KnowledgeExportResult>
  readonly prepareExtraction: (request: ExtractionPreparationRequest, signal: AbortSignal) => Promise<ExtractionPreparation>
  readonly extract: (request: ExtractionRequest, signal: AbortSignal) => Promise<ExtractionResult>
  readonly read: (request: { readonly cardId: string }, signal: AbortSignal) => Promise<KnowledgeCard | null>
  readonly save: (request: KnowledgeSave, signal: AbortSignal) => Promise<KnowledgeCard>
  readonly search: (request: KnowledgeSearch, signal: AbortSignal) => Promise<readonly KnowledgeCard[]>
  readonly membership: (request: KnowledgeMembership, signal: AbortSignal) => Promise<KnowledgeCard>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphKnowledge/prepareExport': (request: KnowledgeExportRequest, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeExportResult>>
    'sessionGraphKnowledge/hostIdentity': (signal?: AbortSignal) => Promise<RemoteResult<{ readonly hostId: string }>>
    'sessionGraphKnowledge/prepareExtraction': (request: ExtractionPreparationRequest, signal?: AbortSignal) => Promise<RemoteResult<ExtractionPreparation>>
    'sessionGraphKnowledge/extract': (request: ExtractionRequest, signal?: AbortSignal) => Promise<RemoteResult<ExtractionResult>>
    'sessionGraphKnowledge/read': (request: { readonly cardId: string }, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard | null>>
    'sessionGraphKnowledge/save': (request: KnowledgeSave, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard>>
    'sessionGraphKnowledge/search': (request: KnowledgeSearch, signal?: AbortSignal) => Promise<RemoteResult<readonly KnowledgeCard[]>>
    'sessionGraphKnowledge/membership': (request: KnowledgeMembership, signal?: AbortSignal) => Promise<RemoteResult<KnowledgeCard>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphKnowledge: {
      prepareExport: TypertRemoteMap['sessionGraphKnowledge/prepareExport']
      hostIdentity: TypertRemoteMap['sessionGraphKnowledge/hostIdentity']
      prepareExtraction: TypertRemoteMap['sessionGraphKnowledge/prepareExtraction']
      extract: TypertRemoteMap['sessionGraphKnowledge/extract']
      read: TypertRemoteMap['sessionGraphKnowledge/read']
      save: TypertRemoteMap['sessionGraphKnowledge/save']
      search: TypertRemoteMap['sessionGraphKnowledge/search']
      membership: TypertRemoteMap['sessionGraphKnowledge/membership']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'
export const KNOWLEDGE_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'prepareExport', request: knowledgeExportRequestSchema, result: knowledgeExportResultSchema },
    { method: 'hostIdentity', request: undefined, result: knowledgeHostIdentitySchema },
    { method: 'prepareExtraction', request: extractionPreparationRequestSchema, result: extractionPreparationSchema },
    { method: 'extract', request: extractionRequestSchema, result: extractionResultSchema },
    { method: 'read', request: knowledgeReadSchema, result: knowledgeNullableSchema },
    { method: 'save', request: knowledgeSaveSchema, result: knowledgeCardSchema },
    { method: 'search', request: knowledgeSearchSchema, result: knowledgeListSchema },
    { method: 'membership', request: knowledgeMembershipSchema, result: knowledgeCardSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphKnowledge/${method}`,
    service: 'sessionGraphKnowledge', namespace: 'sessionGraphKnowledge', method, invocation: { kind: 'direct' },
    parameters: request === undefined ? [] : [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#Knowledge/${method}/Request`, schema: request } }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#Knowledge/${method}/Result`, schema: result },
  })),
}
