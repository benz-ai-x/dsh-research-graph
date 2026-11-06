import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionHeader, SessionEvent, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { discussionTurns } from './session-discussion.ts'
import { ServiceRequests } from './service-requests.ts'
import { historyBranchIdentitySchema, historyBranchRecordSchema, historyBranchRequestSchema, type HistoryBranchRecord, type HistoryBranchRequest } from './history-branch.ts'

interface BranchSeed {
  readonly header: SessionHeader
  readonly events: readonly SessionEvent[]
  readonly inheritedEventCount: SessionLogOffset
}
interface StoredBranch { readonly record: HistoryBranchRecord; readonly sourceHash: string; readonly seed?: BranchSeed | undefined }
const storageSchema: z.ZodType<StoredBranch> = z.object({
  record: z.unknown().transform(value => historyBranchRecordSchema.parse(value)), sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
  seed: z.custom<BranchSeed>(value => value !== null && typeof value === 'object' && 'header' in value && 'events' in value).optional(),
})
export const HISTORY_BRANCH_DOMAIN = { name: 'session_graph_history_branches', version: 1, tables: { attempts: { valueSchema: storageSchema } } } as const
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value, (_key, item: unknown) => {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
  return Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]]))
})).digest('hex')
// Released persistence normalizes an omitted root delegation depth to zero.
const headerHash = (header: SessionHeader): string => hash({ ...header, delegationDepth: header.delegationDepth ?? 0 })
const inboxSpliceSchema = z.object({ target: z.enum(['next-turn', 'next-step']), start: z.number().int().nonnegative(),
  removedCount: z.number().int().nonnegative().optional(), inserted: z.array(z.unknown()) })

/**
 * The native cut includes between-turn inbox admissions. Preserve that history but cancel
 * inherited pending work before activation. A store-prepared Session stays read-only until
 * announced (DSH 0.2.2), so the cancellations are journaled after the inherited prefix of the
 * frozen seed — the same persisted log the released Agent restore path adopts.
 */
function inheritedInputCancellations(events: BranchSeed['events']): SessionEvent[] {
  const counts = { 'next-turn': 0, 'next-step': 0 }
  for (const event of events) {
    if (event.type !== 'agent/inbox/spliced') continue
    const splice = inboxSpliceSchema.parse(event.data)
    const removed = splice.removedCount ?? 0
    if (splice.start > counts[splice.target] || splice.start + removed > counts[splice.target]) throw new Error('Inherited input history is invalid')
    counts[splice.target] += splice.inserted.length - removed
  }
  const last = events.at(-1)
  let seq = last === undefined ? 0 : last.seq + 1
  const time = Math.max(Date.now(), last?.time ?? 0)
  const cancellations: SessionEvent[] = []
  for (const target of ['next-turn', 'next-step'] as const) {
    if (counts[target] > 0) cancellations.push({ type: 'agent/inbox/spliced', seq: seq++ as SessionEvent['seq'], time,
      data: { target, start: 0, removedCount: counts[target], inserted: [], outcome: 'canceled' } })
  }
  return cancellations
}

/** Reserves a native identity before writing its inherited prefix; retries only finish that identity. */
export class HistoryBranchService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Historical branching')
  private tail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly domain: Domain<typeof HISTORY_BRANCH_DOMAIN>) {
    super(ctx, 'sessionGraphBranch')
    ctx.effect(() => () => this.dispose(), 'session-graph.branch-quiescence')
  }

  private serialize<Value>(operation: () => Promise<Value>): Promise<Value> {
    const result = this.tail.then(operation)
    this.tail = result.then(() => {}, () => {})
    return result
  }

  private async source(request: HistoryBranchRequest, signal: AbortSignal) {
    // The seed path needs the store's real event type, so observe directly
    // instead of folding through the digest-oriented inspection helper.
    const observation = await this.ctx.sessionQuery.observeSession(request.sessionId as SessionId, {
      signal,
      projectionMode: 'none',
    })
    try {
      const source = { meta: observation.header, events: [...observation.events] }
      if (source.meta.origin === 'subagent' || source.meta.cwd === undefined
        || this.ctx.workspaceRegistry.archivedSessionIds.includes(source.meta.id)) throw new Error('This source cannot be branched')
      const turns = discussionTurns(source.events)
      const last = turns.findIndex(turn => turn.startSeq === request.startSeq && turn.endSeq === request.endSeq)
      if (last < 0 || turns.slice(0, last + 1).some(turn => turn.endSeq === null)) throw new Error('The selected completed turn is unavailable; read the original again')
      // Match the native controller: retain between-turn events through the next turn/start.
      let cut = request.endSeq + 1
      while (cut < source.events.length && source.events[cut]?.type !== 'turn/start') cut += 1
      return { source, cwd: source.meta.cwd, turns: turns.slice(0, last + 1), events: source.events.slice(0, cut), cut: cut as SessionLogOffset }
    } finally {
      observation[Symbol.dispose]()
    }
  }

  @Remote('prepare')
  prepare(request: HistoryBranchRequest, signal: AbortSignal): Promise<HistoryBranchRecord> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      const command = historyBranchRequestSchema.parse(request)
      const old = this.domain.table('attempts').get(command.operationId)
      if (old !== undefined) {
        const { targetSessionId: _, title: _title, sourceTitle: _sourceTitle, firstTurn: _first, lastTurn: _last,
          inheritedEventCount: _cut, stage: _stage, error: _error, ...original } = old.record
        if (hash(original) !== hash(command)) throw new Error('This branch preview belongs to another source')
        return old.record
      }
      const selected = await this.source(command, combined)
      if (command.topicId !== undefined) await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
      const sourceTitle = (await this.ctx.sessionQuery.readTitle(selected.source.meta.id, combined))?.title || command.sessionId
      const record: HistoryBranchRecord = { ...command, targetSessionId: `session-${randomUUID()}`,
        title: `${sourceTitle.slice(0, 100).replace(/[\uD800-\uDBFF]$/u, '')} · ${selected.turns.at(-1)!.turn}`, sourceTitle,
        firstTurn: selected.turns[0]!.turn, lastTurn: selected.turns.at(-1)!.turn, inheritedEventCount: selected.cut, stage: 'prepared' }
      combined.throwIfAborted()
      await this.domain.table('attempts').put(command.operationId, { record, sourceHash: hash(selected.events) })
      return record
    }))
  }

  @Remote('read')
  read(request: { readonly operationId: string }, signal: AbortSignal): Promise<HistoryBranchRecord | null> {
    return this.requests.run(signal, () => this.serialize(async () => this.domain.table('attempts').get(historyBranchIdentitySchema.parse(request).operationId)?.record ?? null))
  }

  private async persist(seed: BranchSeed): Promise<void> {
    // Read first: a previous call may have durably written the seed before losing its journal reply.
    const exists = await this.ctx.sessionPersistence.stat(seed.header.id)
    let handle = exists === undefined ? await this.ctx.sessionPersistence.create(seed.header, { inheritedEventCount: seed.inheritedEventCount })
      : await this.ctx.sessionPersistence.open(seed.header.id, 'read')
    try {
      if (headerHash(handle.header) !== headerHash(seed.header) || handle.inheritedEventCount !== seed.inheritedEventCount) throw new Error('Branch target identity conflicts with another Session')
      const saved = (await handle.read()).events
      const matched = Math.min(saved.length, seed.events.length)
      if (hash(saved.slice(0, matched)) !== hash(seed.events.slice(0, matched))) throw new Error('Branch target history differs from its frozen seed')
      if (saved.length >= seed.events.length) return
      if (handle.access === 'read') {
        await handle.close()
        handle = await this.ctx.sessionPersistence.open(seed.header.id, 'write')
      }
      const current = (await handle.read()).events
      if (hash(current) !== hash(seed.events.slice(0, current.length))) throw new Error('Branch target changed during recovery')
      await handle.append(seed.events.slice(current.length))
      await handle.flush()
    } finally { await handle.close() }
  }

  @Remote('submit')
  submit(request: { readonly operationId: string }, signal: AbortSignal): Promise<HistoryBranchRecord> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      const { operationId } = historyBranchIdentitySchema.parse(request)
      const table = this.domain.table('attempts')
      let stored = table.get(operationId)
      if (stored === undefined) throw new Error('Branch preview is unavailable')
      if (stored.record.stage === 'ready') return stored.record
      try {
        if (stored.seed === undefined) {
          const selected = await this.source(stored.record, combined)
          if (hash(selected.events) !== stored.sourceHash) throw new Error('The inherited history changed; prepare a new preview')
          const child = this.ctx.sessions.prepare(stored.record.targetSessionId as SessionId, {
            seed: selected.events, inheritedEventCount: selected.cut,
            meta: { cwd: selected.cwd, parentSession: selected.source.meta.id, isSeeded: true,
              ...(selected.source.meta.agentPreset === undefined ? {} : { agentPreset: selected.source.meta.agentPreset }) },
          })
          // The prepared log already closes its inherited cut with the native end-seed marker.
          const prepared = child.snapshotEvents()
          stored = { ...stored, seed: { header: child.header,
            events: [...prepared, ...inheritedInputCancellations(prepared)], inheritedEventCount: selected.cut } }
          combined.throwIfAborted()
          await table.put(operationId, stored)
        }
        // Once the frozen seed is journaled, finish creation despite a disconnected browser.
        if (stored.record.stage === 'prepared') {
          await this.persist(stored.seed!)
        }
        const { record, seed } = stored
        const cwd = seed?.header.cwd
        if (cwd === undefined) throw new Error('Branch target has no working directory')
        const workspaces = this.ctx.workspaceRegistry.list()
        const workspace = workspaces.find(item => item.path === cwd && item.sessionIds.includes(record.sessionId as SessionId))
          ?? workspaces.find(item => item.path === seed!.header.cwd)
        // The released session.create no longer adopts a persisted seeded Session under its
        // named id; resume the persisted seed as its live Agent and attach membership directly.
        if (this.ctx.agents.get(record.targetSessionId as SessionId) === undefined) {
          const { provider, model } = this.ctx.agentDefaultModel.currentSelection()
          await this.ctx.agents.resume({
            resumeSessionId: record.targetSessionId as SessionId,
            agentOptions: { provider, model },
          })
        }
        if (workspace !== undefined && !workspace.sessionIds.includes(record.targetSessionId as SessionId)) {
          try {
            await workspace.attachSession(record.targetSessionId as SessionId)
          } catch (error) {
            // The live Agent confirms adoption even though Workspace attachment failed.
            if (stored.record.stage === 'prepared') {
              stored = { ...stored, record: { ...stored.record, stage: 'created' } }
              await table.put(operationId, stored)
            }
            throw error
          }
        }
        if (stored.record.stage === 'prepared') {
          stored = { ...stored, record: { ...stored.record, stage: 'created' } }
          await table.put(operationId, stored)
        }
        await this.ctx.sessionController.rename({ sessionId: record.targetSessionId as SessionId, title: record.title })
        if (record.topicId !== undefined) await this.ctx.sessionGraphTopics.write({ kind: 'add', topicId: record.topicId,
          sessionIds: [record.sessionId, record.targetSessionId] }, new AbortController().signal)
        const { error: _, ...ready } = stored.record
        stored = { ...stored, record: { ...ready, stage: 'ready' } }
        await table.put(operationId, stored)
        return stored.record
      } catch (error) {
        stored = { ...stored, record: { ...stored.record, error: error instanceof Error ? error.message : String(error) } }
        await table.put(operationId, stored)
        return stored.record
      }
    }))
  }

  dispose(): Promise<void> { return this.requests.dispose(() => this.domain.close()) }
}
