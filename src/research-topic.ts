/** A Host-owned collection; membership does not move or change a Session. */
export interface ResearchTopic {
  readonly topicId: string
  readonly title: string
  readonly references: readonly ResearchTopicReference[]
  readonly arrangement: ResearchTopicArrangement
}

/** Topic-owned display data, saved atomically with its collection. */
export interface ResearchTopicArrangement {
  readonly positions: Record<string, { readonly x: number; readonly y: number }>
  readonly collapsed: readonly string[]
  readonly offsets: Record<string, { readonly dx: number; readonly dy: number }>
}

/** A durable identity with display fallbacks, never a copy of the original text. */
export interface ResearchTopicReference {
  readonly sessionId: string
  readonly title: string
  readonly cwd?: string
  readonly workspace?: { readonly id: string; readonly title: string }
}

/** Header availability only; original text is checked when explicitly read. */
export interface ResearchTopicSource extends ResearchTopicReference {
  readonly status: 'listed' | 'unavailable'
  readonly archived: boolean
  readonly parentSessionId?: string
}

export interface ResearchTopicSnapshot {
  readonly topic: ResearchTopic
  readonly sources: readonly ResearchTopicSource[]
}

export type ResearchTopicWrite =
  | { readonly kind: 'create'; readonly topicId: string; readonly title: string }
  | { readonly kind: 'rename'; readonly topicId: string; readonly title: string }
  | { readonly kind: 'add'; readonly topicId: string; readonly sessionIds: readonly string[] }
  | { readonly kind: 'remove'; readonly topicId: string; readonly sessionId: string }
  | { readonly kind: 'arrange'; readonly topicId: string; readonly arrangement: ResearchTopicArrangement }
