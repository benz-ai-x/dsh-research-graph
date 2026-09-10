import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ResolvedConfig } from './config.ts'
import { sessionDigestInspectionFromHarness } from './session-digest-harness.ts'
import { EXTRACTION_SYSTEM_PROMPT, type ExtractionDraft, type ExtractionPreparation, type ExtractionPreparationRequest, type ExtractionRequest, type ExtractionResult } from './knowledge-extraction.ts'
import type { KnowledgeCard, KnowledgeMembership, KnowledgeSearch, KnowledgeSourceAddress, KnowledgeSave, KnowledgeSource } from './knowledge.ts'
import { knowledgeCardSchema, knowledgeMembershipSchema, knowledgeReadSchema, knowledgeSaveSchema, knowledgeSearchSchema,
  extractionPreparationRequestSchema, extractionRequestSchema, knowledgeContentSchema } from './knowledge-codec.ts'
import { discussionTurns } from './session-discussion.ts'
import { extractionPreparationSchema } from './knowledge-extraction-codec.ts'

const cardStorageSchema: z.ZodType<KnowledgeCard> = z.unknown().transform((value, context) => {
  try { return knowledgeCardSchema.parse(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Knowledge Card record' })
    return z.NEVER
  }
})
const extractionStorageSchema: z.ZodType<ExtractionPreparation> = z.unknown().transform((value, context) => {
  try { return extractionPreparationSchema.parse(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid extraction source snapshot' })
    return z.NEVER
  }
})
export const KNOWLEDGE_DOMAIN = { name: 'session_graph_knowledge', version: 1, tables: {
  cards: { valueSchema: cardStorageSchema }, extraction_sources: { valueSchema: extractionStorageSchema },
} } as const

/** Owns saved knowledge and explicit extraction; all source reads go through Harness. */
export class KnowledgeService extends TypertRemoteService {
  private readonly lifecycle = new AbortController()
  private readonly active = new Set<Promise<unknown>>()
  private tail: Promise<void> = Promise.resolve()
  private disposal: Promise<void> | undefined

  constructor(ctx: Context, private readonly domain: Domain<typeof KNOWLEDGE_DOMAIN>, private readonly config: ResolvedConfig) {
    super(ctx, 'sessionGraphKnowledge')
    ctx.effect(() => () => this.dispose(), 'session-graph.knowledge-quiescence')
  }

  @Remote('prepareExtraction')
  prepareExtraction(request: ExtractionPreparationRequest, signal: AbortSignal): Promise<ExtractionPreparation> {
    return this.run(signal, async combined => {
      const command = extractionPreparationRequestSchema.parse(request)
      const selected = await this.capture(command.source, combined)
      if (Buffer.byteLength(JSON.stringify(selected), 'utf8') > 4_000_000) throw new Error('Select a smaller discussion range')
      const turns: typeof selected.source.turns[number][] = []
      const material = (): string => JSON.stringify({ sessionId: selected.sessionId, title: selected.title, turns })
      for (const turn of selected.source.turns) {
        turns.push(turn)
        if (material().length <= command.budgetChars) continue
        turns.pop()
        break
      }
      if (turns.length === 0) throw new Error('The first completed turn exceeds the material budget; increase the budget or choose another turn')
      const snapshot = await this.ctx.sessionController.inspect(selected.sessionId as SessionId, combined)
      const route = sessionDigestInspectionFromHarness(snapshot, this.config.route).modelRoute
      const value: ExtractionPreparation = {
        preparationId: randomUUID(), selected,
        included: { ...selected, source: { startSeq: turns[0]!.startSeq, endSeq: turns.at(-1)!.endSeq!, turns } },
        omitted: selected.source.turns.slice(turns.length).map(turn => ({ startSeq: turn.startSeq, endSeq: turn.endSeq! })),
        budgetChars: command.budgetChars, materialText: material(), ...(route === undefined ? {} : { route }),
      }
      combined.throwIfAborted()
      await this.domain.table('extraction_sources').put(value.preparationId, value)
      return value
    })
  }

  @Remote('extract')
  extract(request: ExtractionRequest, signal: AbortSignal): Promise<ExtractionResult> {
    return this.run(signal, async combined => {
      const command = extractionRequestSchema.parse(request)
      const prepared = this.preparation(command.preparationId)
      const callSignal = AbortSignal.any([combined, AbortSignal.timeout(this.config.timeoutMs)])
      const assembler = new BlockAssembler()
      let outputSize = 0
      for await (const chunk of this.ctx.llm.stream({ provider: command.provider, model: command.model,
        messages: [createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-session-graph' },
          content: [{ type: 'text', text: prepared.materialText }] })],
        system: EXTRACTION_SYSTEM_PROMPT, maxTokens: 4096, sessionId: prepared.selected.sessionId as SessionId, signal: callSignal,
      })) {
        callSignal.throwIfAborted()
        outputSize += JSON.stringify(chunk).length
        if (outputSize > 256_000) throw new Error('Extraction output exceeds the limit')
        assembler.push(chunk)
      }
      callSignal.throwIfAborted()
      const blocks = assembler.blocks()
      if (assembler.finish.kind !== 'stop' || blocks.some(block => block.type === 'tool-call')) throw new Error('Extraction did not finish with text')
      const output: unknown = JSON.parse(blocks.filter(block => block.type === 'text').map(block => block.text).join(''))
      const parsed = z.object({ cards: z.array(z.object({
        title: z.string(), question: z.string(), conclusion: z.string(), rationale: z.string(), openQuestions: z.string(),
        kind: z.enum(['conclusion', 'method', 'hypothesis', 'question']), citations: z.array(z.unknown()).max(32),
      })).min(1).max(5) }).parse(output)
      const drafts: ExtractionDraft[] = parsed.cards.map(item => {
        const sources: KnowledgeSourceAddress[] = []
        let invalidCitations = 0
        for (const citation of item.citations) {
          const parsed = z.object({ startSeq: z.number().int().nonnegative(), endSeq: z.number().int().nonnegative() }).strict().safeParse(citation)
          if (!parsed.success || this.extractionSource(prepared, parsed.data.startSeq, parsed.data.endSeq) === undefined) { invalidCitations += 1; continue }
          sources.push({ kind: 'extraction', preparationId: prepared.preparationId, ...parsed.data })
        }
        const { citations: _, ...fields } = item
        return { cardId: randomUUID(), revisionId: randomUUID(), content: knowledgeContentSchema.parse({ ...fields, status: 'draft' }),
          sources, invalidCitations, needsVerification: sources.length === 0 }
      })
      return { provider: command.provider, model: command.model, drafts }
    })
  }

  private preparation(id: string): ExtractionPreparation {
    const prepared = this.domain.table('extraction_sources').get(id)
    if (prepared === undefined) throw new Error('Extraction source is unavailable; preview the range again')
    return prepared
  }

  private extractionSource(prepared: ExtractionPreparation, startSeq: number, endSeq: number): KnowledgeSource | undefined {
    const turns = prepared.included.source.turns
    const first = turns.findIndex(turn => turn.startSeq === startSeq)
    const last = turns.findIndex(turn => turn.endSeq === endSeq)
    return first < 0 || last < first ? undefined : { ...prepared.included, source: { startSeq, endSeq, turns: turns.slice(first, last + 1) } }
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
    if (address.kind === 'extraction') {
      const source = this.extractionSource(this.preparation(address.preparationId), address.startSeq, address.endSeq)
      if (source === undefined) throw new Error('Citation is outside the included discussion')
      return source
    }
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
