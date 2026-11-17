import type { KnowledgeContent, KnowledgeRevision } from '../knowledge.ts'

export const KNOWLEDGE_KINDS = ['conclusion', 'method', 'hypothesis', 'question'] as const satisfies readonly KnowledgeContent['kind'][]
export const KNOWLEDGE_STATUSES = ['draft', 'confirmed'] as const satisfies readonly KnowledgeContent['status'][]

export function latestKnowledgeRevision(revisions: readonly KnowledgeRevision[]): KnowledgeRevision {
  return revisions.at(-1)!
}
