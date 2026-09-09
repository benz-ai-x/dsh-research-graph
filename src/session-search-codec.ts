import type { DiscussionSearchHit, DiscussionSearchRequest, DiscussionSearchResult, DiscussionSearchScope } from './session-search.ts'

function invalid(): never { throw new TypeError('Invalid Discussion Search request') }

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) return invalid()
  return value
}

function parseRequest(value: unknown): DiscussionSearchRequest {
  const item = object(value, ['query', 'scope', 'includeArchived', 'limit', 'cursor'])
  const query = string(item.query)
  if (query.length > 256 || typeof item.includeArchived !== 'boolean') return invalid()
  const rawScope = object(item.scope, ['kind', 'workspaceId', 'cwd'])
  let scope: DiscussionSearchScope
  if (rawScope.kind === 'all' && Object.keys(rawScope).length === 1) scope = { kind: 'all' }
  else if (rawScope.kind === 'workspace' && Object.keys(rawScope).length === 2 && rawScope.cwd === undefined) {
    scope = { kind: 'workspace', workspaceId: string(rawScope.workspaceId) }
  } else if (rawScope.kind === 'directory' && Object.keys(rawScope).length === 2 && rawScope.workspaceId === undefined) {
    scope = { kind: 'directory', cwd: string(rawScope.cwd) }
  } else return invalid()
  if (item.limit !== undefined && (typeof item.limit !== 'number' || !Number.isInteger(item.limit) || item.limit < 1 || item.limit > 20)) return invalid()
  if (item.cursor !== undefined && (typeof item.cursor !== 'string' || !/^[a-f0-9-]{36}:\d{1,10}$/u.test(item.cursor))) return invalid()
  return {
    query: query.trim().replace(/\s+/gu, ' '), scope, includeArchived: item.includeArchived,
    ...(item.limit === undefined ? {} : { limit: item.limit as number }),
    ...(item.cursor === undefined ? {} : { cursor: item.cursor as string }),
  }
}

export const discussionSearchRequestSchema = { parse: parseRequest }

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid Discussion Search result')
  return value
}

function sequence(value: unknown): number {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result < 0) throw new TypeError('Invalid Discussion Search result')
  return result
}

function hit(value: unknown): DiscussionSearchHit {
  const item = object(value, ['sessionId', 'title', 'workspace', 'cwd', 'archived', 'eventSeq', 'turnStartSeq', 'time', 'snippet'])
  if (typeof item.archived !== 'boolean') throw new TypeError('Invalid Discussion Search result')
  const workspace = item.workspace === undefined ? undefined : object(item.workspace, ['id', 'title'])
  return {
    sessionId: string(item.sessionId), title: string(item.title), archived: item.archived,
    ...(workspace === undefined ? {} : { workspace: { id: string(workspace.id), title: string(workspace.title) } }),
    ...(item.cwd === undefined ? {} : { cwd: string(item.cwd) }),
    eventSeq: sequence(item.eventSeq), turnStartSeq: sequence(item.turnStartSeq),
    time: number(item.time), snippet: string(item.snippet),
  }
}

function parseResult(value: unknown): DiscussionSearchResult {
  const item = object(value, ['kind', 'hits', 'nextCursor'])
  if (item.kind === 'disabled' || item.kind === 'stale') {
    if (Object.keys(item).length !== 1) throw new TypeError('Invalid Discussion Search result')
    return { kind: item.kind }
  }
  if (item.kind !== 'results' || !Array.isArray(item.hits) || item.hits.length > 20) throw new TypeError('Invalid Discussion Search result')
  return {
    kind: 'results', hits: item.hits.map(hit),
    ...(item.nextCursor === undefined ? {} : { nextCursor: string(item.nextCursor) }),
  }
}

export const discussionSearchResultSchema = { parse: parseResult }
