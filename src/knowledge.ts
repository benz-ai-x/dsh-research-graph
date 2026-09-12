import type { KnowledgeSynthesis, SynthesisSave } from './knowledge-synthesis.ts'
import type { SessionDiscussionSource } from './session-history.ts'

export interface KnowledgeContent {
  readonly title: string
  readonly question: string
  readonly conclusion: string
  readonly rationale: string
  readonly openQuestions: string
  readonly kind: 'conclusion' | 'method' | 'hypothesis' | 'question'
  readonly status: 'draft' | 'confirmed'
}

/** Original text captured by the Host at exact completed Discussion Turn boundaries. */
export interface KnowledgeSource {
  readonly sessionId: string
  readonly title: string
  readonly cwd?: string
  readonly source: SessionDiscussionSource
}

export interface KnowledgeRevision {
  readonly synthesis?: KnowledgeSynthesis
  readonly revisionId: string
  readonly requestHash: string
  readonly number: number
  readonly savedAt: number
  readonly content: KnowledgeContent
  readonly sources: readonly KnowledgeSource[]
}

/** Revisions are immutable; topic membership belongs to the card identity. */
export interface KnowledgeCard {
  readonly cardId: string
  readonly topicIds: readonly string[]
  readonly revisions: readonly KnowledgeRevision[]
}

export interface KnowledgeDiscussionAddress {
  readonly kind: 'discussion'
  readonly sessionId: string
  readonly startSeq: number
  readonly endSeq: number
}

export interface KnowledgeRevisionAddress {
  readonly kind: 'revision'
  readonly cardId: string
  readonly revisionId: string
  readonly sourceIndex: number
}

export interface KnowledgeExtractionAddress {
  readonly kind: 'extraction'
  readonly preparationId: string
  readonly startSeq: number
  readonly endSeq: number
}
export type KnowledgeSourceAddress = KnowledgeDiscussionAddress | KnowledgeRevisionAddress | KnowledgeExtractionAddress

export interface KnowledgeSearch {
  readonly query: string
  readonly topicId?: string
}

export interface KnowledgeMembership {
  readonly cardId: string
  readonly topicId: string
  readonly attached: boolean
}

export interface KnowledgeSave {
  readonly synthesis?: SynthesisSave
  readonly cardId: string
  readonly revisionId: string
  readonly topicId?: string
  readonly content: KnowledgeContent
  readonly sources: readonly KnowledgeSourceAddress[]
}
