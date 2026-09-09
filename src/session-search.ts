/** Read-only discussion discovery within an explicitly chosen Host scope. */
export type DiscussionSearchScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'workspace'; readonly workspaceId: string }
  | { readonly kind: 'directory'; readonly cwd: string }

export interface DiscussionSearchRequest {
  readonly query: string
  readonly scope: DiscussionSearchScope
  readonly includeArchived: boolean
  readonly limit?: number
  readonly cursor?: string
}

export interface DiscussionSearchHit {
  readonly sessionId: string
  readonly title: string
  readonly workspace?: { readonly id: string; readonly title: string }
  readonly cwd?: string
  readonly archived: boolean
  readonly eventSeq: number
  readonly turnStartSeq: number
  readonly time: number
  readonly snippet: string
}

export interface DiscussionSearchPage {
  readonly kind: 'results'
  readonly hits: readonly DiscussionSearchHit[]
  readonly nextCursor?: string
}

export type DiscussionSearchResult = DiscussionSearchPage | { readonly kind: 'disabled' | 'stale' }
