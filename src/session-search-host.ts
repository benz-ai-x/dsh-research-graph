import type { Context } from '@deepseek-ai/cordis'
import { createHash, randomUUID } from 'node:crypto'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { discussionTurns } from './session-discussion.ts'
import { discussionSearchRequestSchema } from './session-search-codec.ts'
import type { DiscussionSearchHit, DiscussionSearchRequest, DiscussionSearchResult } from './session-search.ts'

interface SearchSnapshot {
  readonly fingerprint: string
  readonly createdAt: number
  readonly hits: readonly DiscussionSearchHit[]
}

function snippetAround(text: string, needle: string): string {
  const normalized = text.replace(/\s+/gu, ' ')
  const index = normalized.toLowerCase().indexOf(needle)
  const position = Array.from(normalized.slice(0, Math.max(0, index))).length
  const points = Array.from(normalized)
  const start = Math.max(0, position - 48)
  const end = Math.min(points.length, start + 240)
  return `${start === 0 ? '' : '…'}${points.slice(start, end).join('')}${end === points.length ? '' : '…'}`
}

/** Host-owned search and source verification; queries never activate an Agent. */
export class SessionGraphSearchService extends TypertRemoteService {
  private readonly snapshots = new Map<string, SearchSnapshot>()
  private readonly lifecycle = new AbortController()
  private readonly activeSearches = new Set<Promise<DiscussionSearchResult>>()
  private disposal: Promise<void> | undefined

  constructor(ctx: Context) {
    super(ctx, 'sessionGraphSearch')
    ctx.effect(() => async () => { await this.dispose() }, 'session-graph.search-quiescence')
  }

  @Remote('search')
  search(request: DiscussionSearchRequest, signal: AbortSignal): Promise<DiscussionSearchResult> {
    const combined = AbortSignal.any([signal, this.lifecycle.signal])
    const operation = this.searchValidated(request, combined)
    this.activeSearches.add(operation)
    const release = (): void => { this.activeSearches.delete(operation) }
    void operation.then(release, release)
    return operation
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.lifecycle.abort(new Error('Discussion Search service is disposed'))
    this.disposal = Promise.allSettled([...this.activeSearches]).then(() => { this.snapshots.clear() })
    return this.disposal
  }

  private async searchValidated(request: DiscussionSearchRequest, signal: AbortSignal): Promise<DiscussionSearchResult> {
    signal.throwIfAborted()
    request = discussionSearchRequestSchema.parse(request)
    try {
      return await this.searchDiscussion(request, signal)
    } catch (error) {
      signal.throwIfAborted()
      if (error !== null && typeof error === 'object') {
        const code = Reflect.get(error, 'code')
        if (code === 'SESSION_QUERY_SEARCH_DISABLED') return { kind: 'disabled' }
        if (code === 'SESSION_QUERY_STALE_CURSOR' || code === 'SESSION_QUERY_INVALID_CURSOR') return { kind: 'stale' }
      }
      throw error
    }
  }

  private async searchDiscussion(request: DiscussionSearchRequest, signal: AbortSignal): Promise<DiscussionSearchResult> {
    signal.throwIfAborted()
    const query = this.ctx.sessionQuery
    const workspaces = this.ctx.workspaceRegistry.list()
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    const scope = request.scope
    const workspace = scope.kind === 'workspace' ? workspaces.find(item => item.id === scope.workspaceId) : undefined
    const sessions = (await query.listSessions(signal)).filter(({ header }) =>
      header.origin !== 'subagent'
      && (request.includeArchived || !archived.has(header.id))
      && (scope.kind === 'all' || (scope.kind === 'directory' ? header.cwd === scope.cwd
        : workspace !== undefined && (workspace.sessionIds.includes(header.id) || workspace.path === header.cwd))),
    )
    signal.throwIfAborted()
    const limit = request.limit ?? 20
    const needle = request.query.trim().replace(/\s+/gu, ' ').toLowerCase()
    const fingerprint = createHash('sha256').update(JSON.stringify({
      query: needle, scope, includeArchived: request.includeArchived, limit,
      ids: sessions.map(item => [item.header.id, item.header.cwd]).sort(),
      workspaces: workspaces.map(item => [item.id, item.path, item.title, [...item.sessionIds].sort()]),
      archived: [...archived].sort(),
    })).digest('hex')
    for (const [key, snapshot] of this.snapshots) {
      if (Date.now() - snapshot.createdAt > 300_000) this.snapshots.delete(key)
    }
    if (request.cursor !== undefined) {
      const [key, position] = request.cursor.split(':')
      const snapshot = this.snapshots.get(key ?? '')
      const offset = Number(position)
      if (snapshot === undefined || snapshot.fingerprint !== fingerprint || !Number.isSafeInteger(offset) || offset < 0) {
        throw Object.assign(new Error('Search results expired; repeat the query'), { code: 'SESSION_QUERY_STALE_CURSOR' })
      }
      return this.page(key!, snapshot, offset, limit)
    }
    const search = {
      query: request.query,
      sessionFilters: [{ kind: 'id' as const, values: sessions.map(item => item.header.id) }],
      eventFilters: [{ kind: 'type' as const, values: ['user/message' as const, 'assistant/message' as const] }],
      limit,
    }
    let page = await query.searchSessions(search, { signal })
    const indexed = [...page.items]
    const literal = /\p{Script=Han}/u.test(request.query)
    while (!literal && page.nextCursor !== undefined) {
      page = await query.searchSessions({ ...search, cursor: page.nextCursor }, { signal })
      indexed.push(...page.items)
    }
    const hits: DiscussionSearchHit[] = []
    // unicode61 treats uninterrupted Chinese as a single token. Verify that
    // query against scoped originals as well, after the real index succeeds.
    const candidates = literal ? sessions : indexed
    for (const candidate of candidates) {
      const source = await this.ctx.sessionController.inspect(candidate.header.id, signal)
      signal.throwIfAborted()
      const turns = discussionTurns(source.events).filter(turn => turn.endSeq !== null)
      const matches = turns.flatMap(turn => turn.messages.map(message => ({ turn, message })))
      const match = matches.reverse().find(({ message }) => message.text.replace(/\s+/gu, ' ').toLowerCase().includes(needle))
      if (match === undefined) continue
      const owner = workspaces.find(item => item.sessionIds.includes(candidate.header.id))
        ?? workspaces.find(item => item.path === candidate.header.cwd)
      hits.push({
        sessionId: candidate.header.id,
        title: (await query.readTitle(candidate.header.id, signal))?.title ?? candidate.header.id,
        ...(owner === undefined ? {} : { workspace: { id: owner.id, title: owner.title } }),
        ...(candidate.header.cwd === undefined ? {} : { cwd: candidate.header.cwd }),
        archived: archived.has(candidate.header.id),
        eventSeq: match.message.seq, turnStartSeq: match.turn.startSeq,
        time: source.events.find(event => event.seq === match.message.seq)!.time,
        snippet: snippetAround(match.message.text, needle),
      })
    }
    signal.throwIfAborted()
    hits.sort((left, right) => right.time - left.time || left.sessionId.localeCompare(right.sessionId))
    const key = randomUUID()
    const snapshot = { fingerprint, createdAt: Date.now(), hits }
    while (this.snapshots.size >= 4) this.snapshots.delete(this.snapshots.keys().next().value!)
    this.snapshots.set(key, snapshot)
    return this.page(key, snapshot, 0, limit)
  }

  private page(key: string, snapshot: SearchSnapshot, offset: number, limit: number): DiscussionSearchResult {
    const end = offset + limit
    return {
      kind: 'results', hits: structuredClone(snapshot.hits.slice(offset, end)),
      ...(end >= snapshot.hits.length ? {} : { nextCursor: `${key}:${end}` }),
    }
  }
}
