import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type { KnowledgeCard, KnowledgeMembership, KnowledgeSearch, KnowledgeSourceAddress, KnowledgeSave, KnowledgeSource } from './knowledge.ts'
import { knowledgeCardSchema, knowledgeMembershipSchema, knowledgeReadSchema, knowledgeSaveSchema, knowledgeSearchSchema } from './knowledge-codec.ts'
import { discussionTurns } from './session-discussion.ts'

const cardStorageSchema: z.ZodType<KnowledgeCard> = z.unknown().transform((value, context) => {
  try { return knowledgeCardSchema.parse(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Knowledge Card record' })
    return z.NEVER
  }
})
export const KNOWLEDGE_DOMAIN = { name: 'session_graph_knowledge', version: 1, tables: { cards: { valueSchema: cardStorageSchema } } } as const

/** Owns saved knowledge; every source read goes through Harness, without a model. */
export class KnowledgeService extends TypertRemoteService {
  private readonly lifecycle = new AbortController()
  private readonly active = new Set<Promise<unknown>>()
  private tail: Promise<void> = Promise.resolve()
  private disposal: Promise<void> | undefined

  constructor(ctx: Context, private readonly domain: Domain<typeof KNOWLEDGE_DOMAIN>) {
    super(ctx, 'sessionGraphKnowledge')
    ctx.effect(() => () => this.dispose(), 'session-graph.knowledge-quiescence')
  }

  @Remote('read')
  read(request: { readonly cardId: string }, signal: AbortSignal): Promise<KnowledgeCard | null> {
    return this.run(signal, async () => this.domain.table('cards').get(knowledgeReadSchema.parse(request).cardId) ?? null)
  }

  @Remote('search')
  search(request: KnowledgeSearch, signal: AbortSignal): Promise<readonly KnowledgeCard[]> {
    return this.run(signal, async combined => {
      const command = knowledgeSearchSchema.parse(request)
      if (command.topicId !== undefined) await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
      const query = command.query.toLocaleLowerCase()
      return [...this.domain.table('cards').entries()].map(([, card]) => card)
        .filter(card => (command.topicId === undefined || card.topicIds.includes(command.topicId))
          && Object.values(card.revisions.at(-1)!.content).some(value => value.toLocaleLowerCase().includes(query)))
        .sort((a, b) => b.revisions.at(-1)!.savedAt - a.revisions.at(-1)!.savedAt || a.cardId.localeCompare(b.cardId))
    })
  }

  @Remote('membership')
  membership(request: KnowledgeMembership, signal: AbortSignal): Promise<KnowledgeCard> {
    return this.run(signal, async combined => {
      const command = knowledgeMembershipSchema.parse(request)
      const operation = this.tail.then(async () => {
        combined.throwIfAborted()
        await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
        const table = this.domain.table('cards')
        const existing = table.get(command.cardId)
        if (existing === undefined) throw new Error('Knowledge Card is unavailable')
        const card = { ...existing, topicIds: command.attached
          ? [...new Set([...existing.topicIds, command.topicId])]
          : existing.topicIds.filter(topicId => topicId !== command.topicId) }
        combined.throwIfAborted()
        await table.put(card.cardId, card)
        return card
      })
      this.tail = operation.then(() => {}, () => {})
      return operation
    })
  }

  @Remote('save')
  save(request: KnowledgeSave, signal: AbortSignal): Promise<KnowledgeCard> {
    return this.run(signal, async combined => {
      const command = knowledgeSaveSchema.parse(request)
      const operation = this.tail.then(async () => {
        combined.throwIfAborted()
        const existing = this.domain.table('cards').get(command.cardId)
        const requestHash = createHash('sha256').update(JSON.stringify(command)).digest('hex')
        const saved = existing?.revisions.find(revision => revision.revisionId === command.revisionId)
        if (saved !== undefined) {
          if (saved.requestHash !== requestHash) throw new Error('This revision identity already belongs to another save')
          return existing!
        }
        if (command.topicId !== undefined) await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
        const sources = await Promise.all(command.sources.map(address => this.capture(address, combined)))
        if (Buffer.byteLength(JSON.stringify(sources), 'utf8') > 4_000_000) throw new Error('Selected source exceeds the 4 MB card limit; select a smaller range')
        combined.throwIfAborted()
        const card: KnowledgeCard = {
          cardId: command.cardId,
          topicIds: [...new Set([...(existing?.topicIds ?? []), ...(command.topicId === undefined ? [] : [command.topicId])])],
          revisions: [...(existing?.revisions ?? []), {
            revisionId: command.revisionId, requestHash, number: (existing?.revisions.length ?? 0) + 1,
            savedAt: Date.now(), content: command.content, sources,
          }],
        }
        await this.domain.table('cards').put(card.cardId, card)
        return card
      })
      this.tail = operation.then(() => {}, () => {})
      return operation
    })
  }

  private async capture(address: KnowledgeSourceAddress, signal: AbortSignal): Promise<KnowledgeSource> {
    if (address.kind === 'revision') {
      const source = this.domain.table('cards').get(address.cardId)?.revisions
        .find(revision => revision.revisionId === address.revisionId)?.sources[address.sourceIndex]
      if (source === undefined) throw new Error('Saved source is unavailable')
      return source
    }
    const snapshot = await this.ctx.sessionController.inspect(address.sessionId as SessionId, signal)
    signal.throwIfAborted()
    if (snapshot.meta.origin === 'subagent') throw new Error('Select a direct discussion')
    const turns = discussionTurns(snapshot.events)
    const first = turns.findIndex(turn => turn.startSeq === address.startSeq)
    const last = turns.findIndex(turn => turn.endSeq === address.endSeq)
    if (first < 0 || last < first || turns.slice(first, last + 1).some(turn => turn.endSeq === null)) {
      throw new Error('The selected completed discussion is unavailable')
    }
    const title = (await this.ctx.sessionQuery.readTitle(address.sessionId as SessionId, signal))?.title.trim() || address.sessionId
    return { sessionId: address.sessionId, title,
      ...(snapshot.meta.cwd === undefined ? {} : { cwd: snapshot.meta.cwd }),
      source: { startSeq: address.startSeq, endSeq: address.endSeq, turns: turns.slice(first, last + 1) } }
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.lifecycle.abort(new Error('Knowledge service is disposed'))
    this.disposal = Promise.allSettled([...this.active]).then(() => this.domain.close())
    return this.disposal
  }

  private run<Value>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<Value>): Promise<Value> {
    const combined = AbortSignal.any([signal, this.lifecycle.signal])
    const pending = Promise.resolve().then(async () => {
      combined.throwIfAborted()
      const value = await operation(combined)
      combined.throwIfAborted()
      return structuredClone(value)
    })
    this.active.add(pending)
    const release = (): void => { this.active.delete(pending) }
    void pending.then(release, release)
    return pending
  }
}
