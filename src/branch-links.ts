/**
 * Plugin-owned Branch Origin for ordinary forks the Host no longer parents.
 *
 * DSH 0.2.2 makes ordinary forks independent Sessions: neither fork path writes
 * `SessionHeader.parentSession`, so the graph cannot derive their Branch edges
 * from Host lineage alone. A Branch Origin is a presentation-provenance record
 * owned by this plugin: exact origin recorded when the plugin initiates a fork,
 * or inferred from a seeded Session's Host-validated inherited prefix.
 */

/** How one Branch Origin became known: an exact creation record or verified inheritance evidence. */
export type BranchOriginSource = 'recorded' | 'inferred'

/** One durable branch-origin record from a child fork copy to its source Canvas Session. */
export interface BranchOrigin {
  readonly childSessionId: string
  readonly parentSessionId: string
  readonly source: BranchOriginSource
  readonly createdAt: number
}

/** Exact origin supplied by the plugin that initiated the fork. */
export interface BranchOriginRecord {
  readonly childSessionId: string
  readonly parentSessionId: string
}

/** Child Sessions whose stored origin is wanted; omitted asks for every stored origin. */
export interface BranchOriginQuery {
  readonly sessionIds?: readonly string[]
}

/** Stored Branch Origins matching a query. */
export interface BranchOriginList {
  readonly origins: readonly BranchOrigin[]
}

/** Delivery watermark copied with a fork's inherited prefix; only sessions using that log carry one. */
const DELIVERY_MARKER = 'session-log-deepseek/delivery-accepted'

/** Bounded Session identity accepted from a wire or storage record. */
const MAX_SESSION_ID_CHARS = 200

/** Longest candidate list honored by one graph read (larger graphs keep prior edges). */
export const BRANCH_ORIGIN_QUERY_LIMIT = 120

/** Validate one Session identity without importing Host brand helpers into the browser bundle. */
export function branchOriginSessionId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SESSION_ID_CHARS) return undefined
  if (value.trim() !== value || value.includes('\0')) return undefined
  return value
}

/** Read one foreign delivery marker's Session identity from an opaque stored event. */
function foreignDeliverySession(event: unknown): string | undefined {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) return undefined
  const record = event as { readonly type?: unknown; readonly data?: unknown }
  if (record.type !== DELIVERY_MARKER) return undefined
  const data = record.data
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined
  return branchOriginSessionId((data as { readonly sessionId?: unknown }).sessionId)
}

/** Recognize the inherited-generation boundary inside a fork prefix. */
function inheritedSeedBoundary(event: unknown): boolean {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) return false
  const record = event as { readonly type?: unknown; readonly data?: unknown }
  if (record.type !== 'session/end-seed' || record.data === null || typeof record.data !== 'object' || Array.isArray(record.data)) return false
  return (record.data as { readonly inherited?: unknown }).inherited === true
}

/**
 * Infer one direct parent from a seeded Session's inherited prefix.
 *
 * The Host's V4 reader permits foreign Session delivery IDs only inside a
 * fork-inherited prefix, so any foreign id there names an ancestor Session.
 * The direct parent's markers follow every earlier generation's seed boundary;
 * the last foreign id in that final generation wins. A boundary with no later
 * marker leaves the direct parent unknown rather than promoting an ancestor.
 * The result is evidence, not Host lineage; callers must verify that the
 * referenced Session exists before presenting it.
 * @param events - the child Session's stored events in sequence order.
 * @param inheritedEventCount - exact inherited prefix length reported by storage.
 * @param selfSessionId - the child Session identity, never a candidate parent.
 * @returns the inferred direct parent Session id, or undefined without evidence.
 */
export function inferForkParent(
  events: readonly unknown[],
  inheritedEventCount: number | undefined,
  selfSessionId: string,
): string | undefined {
  if (inheritedEventCount === undefined || !Number.isSafeInteger(inheritedEventCount) || inheritedEventCount <= 0) return undefined
  const self = branchOriginSessionId(selfSessionId)
  if (self === undefined) return undefined
  const cut = Math.min(inheritedEventCount, events.length)
  let parent: string | undefined
  for (let index = 0; index < cut; index += 1) {
    if (inheritedSeedBoundary(events[index])) {
      parent = undefined
      continue
    }
    const referenced = foreignDeliverySession(events[index])
    if (referenced === undefined || referenced === self) continue
    parent = referenced
  }
  return parent
}
