/** Small shared Branch Origin wire codecs; keep Host libraries out of the lazy browser bundle. */
import {
  BRANCH_ORIGIN_QUERY_LIMIT, branchOriginSessionId,
  type BranchOrigin, type BranchOriginList, type BranchOriginQuery, type BranchOriginRecord,
} from './branch-links.ts'

function invalid(): never { throw new TypeError('Invalid Branch Origin value') }

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => !keys.includes(key))) return invalid()
  return record
}

function sessionId(value: unknown): string {
  return branchOriginSessionId(value) ?? invalid()
}

function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return invalid()
  return value
}

/** Parse one exact origin request supplied by the plugin that initiated a fork. */
function parseRecord(value: unknown): BranchOriginRecord {
  const item = object(value, ['childSessionId', 'parentSessionId'])
  const childSessionId = sessionId(item.childSessionId)
  const parentSessionId = sessionId(item.parentSessionId)
  if (childSessionId === parentSessionId) return invalid()
  return { childSessionId, parentSessionId }
}

/** Parse one stored Branch Origin record. */
function parseOrigin(value: unknown): BranchOrigin {
  const item = object(value, ['childSessionId', 'parentSessionId', 'source', 'createdAt'])
  const childSessionId = sessionId(item.childSessionId)
  const parentSessionId = sessionId(item.parentSessionId)
  if (childSessionId === parentSessionId) return invalid()
  if (item.source !== 'recorded' && item.source !== 'inferred') return invalid()
  return { childSessionId, parentSessionId, source: item.source, createdAt: timestamp(item.createdAt) }
}

/** Parse one origin query; omitted `sessionIds` asks for every stored origin. */
function parseQuery(value: unknown): BranchOriginQuery {
  const item = object(value, ['sessionIds'])
  if (item.sessionIds === undefined) return {}
  if (!Array.isArray(item.sessionIds) || item.sessionIds.length > BRANCH_ORIGIN_QUERY_LIMIT) return invalid()
  const sessionIds = item.sessionIds.map(sessionId)
  return { sessionIds: [...new Set(sessionIds)] }
}

/** Parse one origin list response. */
function parseList(value: unknown): BranchOriginList {
  const item = object(value, ['origins'])
  if (!Array.isArray(item.origins) || item.origins.length > BRANCH_ORIGIN_QUERY_LIMIT) return invalid()
  return { origins: item.origins.map(value => parseOrigin(value)) }
}

/** Wire/storage schema for one exact origin request. */
export const branchOriginRecordSchema = { parse: parseRecord }
/** Wire/storage schema for one stored Branch Origin. */
export const branchOriginSchema = { parse: parseOrigin }
/** Wire schema for one origin query. */
export const branchOriginQuerySchema = { parse: parseQuery }
/** Wire schema for one origin list response. */
export const branchOriginListSchema = { parse: parseList }
