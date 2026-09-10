/** Read-only discussion material addressed by Session identity and event boundaries. */
export interface SessionHistoryMessage {
  readonly role: 'user' | 'assistant'
  readonly seq: number
  readonly text: string
}

export interface SessionHistoryTurn {
  readonly turn: number
  readonly startSeq: number
  readonly endSeq: number | null
  readonly startedAt: number
  readonly messages: readonly SessionHistoryMessage[]
}

/** Exact completed discussion boundaries, without storing discussion text in browser state. */
export interface SessionDiscussionRange {
  readonly startSeq: number
  readonly endSeq: number
}

/** An in-memory selection retains its exact original boundaries and a fallback excerpt. */
export interface SessionDiscussionSource extends SessionDiscussionRange {
  readonly turns: readonly SessionHistoryTurn[]
}

export interface SessionHistoryRequest {
  readonly sessionId: string
  readonly anchorSeq?: number
  readonly beforeSeq?: number
  readonly afterSeq?: number
  readonly limit?: number
  readonly source?: SessionDiscussionSource
  readonly range?: SessionDiscussionRange
}

export interface SessionHistoryResult {
  readonly kind: 'original' | 'excerpt' | 'unavailable'
  readonly sessionId: string
  readonly turns: readonly SessionHistoryTurn[]
  readonly hasEarlier: boolean
  readonly hasLater: boolean
}
