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
import { readKnowledgeDiscussion } from './knowledge-discussion.ts'
import { extractionPreparationSchema } from './knowledge-extraction-codec.ts'
import { discussionTurns } from './session-discussion.ts'
import { renderKnowledgeExport, type ExportCard, type ExportSourceStatus, type KnowledgeExportRequest, type KnowledgeExportResult } from './knowledge-export.ts'
import { knowledgeExportRequestSchema } from './knowledge-export-codec.ts'
import { freezeResearchMaterials } from './research-materials-host.ts'
import { RESEARCH_MATERIAL_BUDGET, researchReusePrompt } from './research-reuse.ts'
import { synthesisContent, verifySynthesisClaims, SYNTHESIS_SYSTEM_PROMPT, type KnowledgeSynthesis, type SynthesisDraft, type SynthesisPreparation, type SynthesisRequest, type SynthesisSave } from './knowledge-synthesis.ts'
import { synthesisModelSchema, synthesisPreparationSchema, synthesisRequestSchema } from './knowledge-synthesis-codec.ts'
import { ServiceRequests } from './service-requests.ts'

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
  synthesis_sources: { valueSchema: z.object({ requestHash: z.string(), preparation: z.unknown().transform(value => synthesisPreparationSchema.parse(value)) }) },
  cards: { valueSchema: cardStorageSchema }, extraction_sources: { valueSchema: extractionStorageSchema },
  metadata: { valueSchema: z.object({ hostId: z.string().uuid() }) },
} } as const

/** Owns saved knowledge and explicit extraction; all source reads go through Harness. */
export class KnowledgeService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Knowledge service')
  private tail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly domain: Domain<typeof KNOWLEDGE_DOMAIN>, private readonly config: ResolvedConfig) {
    super(ctx, 'sessionGraphKnowledge')
    ctx.effect(() => () => this.dispose(), 'session-graph.knowledge-quiescence')
  }

  @Remote('hostIdentity')
  hostIdentity(signal: AbortSignal): Promise<{ readonly hostId: string }> {
    return this.requests.run(signal, async combined => {
      const operation = this.tail.then(async () => {
        combined.throwIfAborted()
        const table = this.domain.table('metadata')
        const saved = table.get('identity')
        if (saved !== undefined) return saved
        const identity = { hostId: randomUUID() }
        await table.put('identity', identity)
        return identity
      })
      this.tail = operation.then(() => {}, () => {})
      return operation
    })
  }

  @Remote('prepareExport')
  prepareExport(request: KnowledgeExportRequest, signal: AbortSignal): Promise<KnowledgeExportResult> {
    return this.requests.run(signal, async combined => {
      const command = knowledgeExportRequestSchema.parse(request)
      let size = 0
      // Freeze every selected revision before the first asynchronous source read.
      const selected = command.cardIds.map(cardId => {
        const revision = this.domain.table('cards').get(cardId)?.revisions.at(-1)
        if (revision === undefined) throw new Error(`Knowledge Card ${cardId} is unavailable`)
        size += Buffer.byteLength(JSON.stringify(revision), 'utf8')
        if (size > 8_000_000) throw new Error('Export exceeds 8 MB; select fewer cards')
        return { cardId, revision }
      })
      const reading = AbortSignal.any([combined, AbortSignal.timeout(this.config.timeoutMs)])
      const cards: ExportCard[] = []
      for (const card of selected) {
        const sourceStatuses: ExportSourceStatus[] = []
        for (const source of card.revision.sources) {
          let snapshot: Awaited<ReturnType<Context['sessionController']['inspect']>>
          try { snapshot = await this.ctx.sessionController.inspect(source.sessionId as SessionId, reading) } catch {
            reading.throwIfAborted()
            sourceStatuses.push('unavailable')
            continue
          }
          reading.throwIfAborted()
          const turns = discussionTurns(snapshot.events)
          const start = turns.findIndex(turn => turn.startSeq === source.source.startSeq)
          const end = turns.findIndex(turn => turn.endSeq === source.source.endSeq)
          sourceStatuses.push(start < 0 || end < start || turns.slice(start, end + 1).some(turn => turn.endSeq === null) ? 'incomplete'
            : JSON.stringify(turns.slice(start, end + 1)) === JSON.stringify(source.source.turns) ? 'available' : 'changed')
        }
        cards.push({ ...card, sourceStatuses })
      }
      const result = renderKnowledgeExport(cards)
      if (Buffer.byteLength(result.markdown, 'utf8') > 8_000_000) throw new Error('Export exceeds 8 MB; select fewer cards')
      reading.throwIfAborted()
      return result
    })
  }

  @Remote('prepareSynthesis')
  prepareSynthesis(request: SynthesisRequest, signal: AbortSignal): Promise<SynthesisPreparation> {
    return this.requests.run(signal, async combined => {
      const command = synthesisRequestSchema.parse(request)
      const requestHash = createHash('sha256').update(JSON.stringify(command)).digest('hex')
      const existing = this.domain.table('synthesis_sources').get(command.operationId)
      if (existing !== undefined) {
        if (existing.requestHash !== requestHash) throw new Error('This synthesis preview belongs to another selection')
        return existing.preparation
      }
      await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
      for (const selection of command.materials) {
        if (selection.kind === 'card' && !this.domain.table('cards').get(selection.cardId)?.topicIds.includes(command.topicId)) {
          throw new Error('Select saved cards from this Research Topic')
        }
      }
      const materials = await freezeResearchMaterials(this.ctx, command.materials, combined)
      const materialText = researchReusePrompt(materials, command.question)
      if (materialText.length > RESEARCH_MATERIAL_BUDGET) throw new Error('Synthesis material exceeds the 32000 character budget; adjust the selection')
      const sourceId = materials.flatMap(material => material.kind === 'turn' ? [material.source.sessionId] : material.sources.map(source => source.sessionId))[0]
      let route = this.config.route
      if (sourceId !== undefined) {
        try { route = sessionDigestInspectionFromHarness(await this.ctx.sessionController.inspect(sourceId as SessionId, combined), route).modelRoute } catch { combined.throwIfAborted() }
      }
      const preparation: SynthesisPreparation = { preparationId: command.operationId, topicId: command.topicId, question: command.question,
        materials, claims: [], materialText, budgetChars: RESEARCH_MATERIAL_BUDGET, ...(route === undefined ? {} : { route }) }
      combined.throwIfAborted()
      const write = this.tail.then(async () => {
        const old = this.domain.table('synthesis_sources').get(command.operationId)
        if (old !== undefined) {
          if (old.requestHash !== requestHash) throw new Error('This synthesis preview belongs to another selection')
          return old.preparation
        }
        await this.domain.table('synthesis_sources').put(command.operationId, { requestHash, preparation: synthesisPreparationSchema.parse(preparation) })
        return preparation
      })
      this.tail = write.then(() => {}, () => {})
      return write
    })
  }

  @Remote('synthesize')
  synthesize(request: ExtractionRequest, signal: AbortSignal): Promise<SynthesisDraft> {
    return this.requests.run(signal, async combined => {
      const command = extractionRequestSchema.parse(request)
      const preparation = this.domain.table('synthesis_sources').get(command.preparationId)?.preparation
      if (preparation === undefined) throw new Error('Synthesis preview is unavailable')
      const callSignal = AbortSignal.any([combined, AbortSignal.timeout(this.config.timeoutMs)])
      const assembler = new BlockAssembler()
      let size = 0
      for await (const chunk of this.ctx.llm.stream({ provider: command.provider, model: command.model,
        messages: [createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-session-graph' }, content: [{ type: 'text', text: preparation.materialText }] })],
        system: SYNTHESIS_SYSTEM_PROMPT, maxTokens: 8192, signal: callSignal,
      })) {
        callSignal.throwIfAborted()
        size += JSON.stringify(chunk).length
        if (size > 256_000) throw new Error('Synthesis output exceeds the limit')
        assembler.push(chunk)
      }
      callSignal.throwIfAborted()
      const blocks = assembler.blocks()
      if (assembler.finish.kind !== 'stop' || blocks.some(block => block.type === 'tool-call')) throw new Error('Synthesis did not finish with text')
      const parsed = synthesisModelSchema.parse(JSON.parse(blocks.filter(block => block.type === 'text').map(block => block.text).join('')))
      const verified = verifySynthesisClaims(preparation.materials, parsed.claims)
      return { cardId: randomUUID(), revisionId: randomUUID(),
        content: knowledgeContentSchema.parse(synthesisContent({ title: parsed.title, question: parsed.question, kind: parsed.kind, status: 'draft', conclusion: '', rationale: '', openQuestions: '' }, verified.claims)),
        synthesis: { source: { kind: 'preparation', preparationId: preparation.preparationId }, claims: verified.claims }, invalidCitations: parsed.invalidCitations + verified.invalidCitations }
    })
  }

  private synthesis(save: SynthesisSave, targetId: string): KnowledgeSynthesis {
    const source = save.source
    if (source.kind === 'preparation' && this.domain.table('cards').get(targetId) !== undefined) throw new Error('Save synthesis as an independent card')
    if (source.kind === 'revision' && source.cardId !== targetId) throw new Error('Edit the original synthesis card revision')
    const materials = source.kind === 'preparation' ? this.domain.table('synthesis_sources').get(source.preparationId)?.preparation.materials
      : this.domain.table('cards').get(source.cardId)?.revisions.find(revision => revision.revisionId === source.revisionId)?.synthesis?.materials
    if (materials === undefined) throw new Error('Frozen synthesis materials are unavailable')
    if (materials.some(material => material.kind === 'card' && material.cardId === targetId)) throw new Error('Save synthesis as an independent card')
    const verified = verifySynthesisClaims(materials, save.claims)
    if (verified.invalidCitations > 0) throw new Error('A citation is outside the frozen material; remove or correct it before saving')
    return { materials, claims: verified.claims }
  }

  @Remote('prepareExtraction')
  prepareExtraction(request: ExtractionPreparationRequest, signal: AbortSignal): Promise<ExtractionPreparation> {
    return this.requests.run(signal, async combined => {
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
    return this.requests.run(signal, async combined => {
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
    return this.requests.run(signal, async () => this.domain.table('cards').get(knowledgeReadSchema.parse(request).cardId) ?? null)
  }

  @Remote('search')
  search(request: KnowledgeSearch, signal: AbortSignal): Promise<readonly KnowledgeCard[]> {
    return this.requests.run(signal, async combined => {
      const command = knowledgeSearchSchema.parse(request)
      if (command.topicId !== undefined) await this.ctx.sessionGraphTopics.read({ topicId: command.topicId }, combined)
      const query = command.query.toLocaleLowerCase()
      return [...this.domain.table('cards').entries()].map(([, card]) => card)
        .filter(card => {
          if (command.topicId !== undefined && !card.topicIds.includes(command.topicId)) return false
          const { title, question, conclusion, rationale, openQuestions } = card.revisions.at(-1)!.content
          return [title, question, conclusion, rationale, openQuestions].some(value => value.toLocaleLowerCase().includes(query))
        })
        .sort((a, b) => b.revisions.at(-1)!.savedAt - a.revisions.at(-1)!.savedAt || a.cardId.localeCompare(b.cardId))
    })
  }

  @Remote('membership')
  membership(request: KnowledgeMembership, signal: AbortSignal): Promise<KnowledgeCard> {
    return this.requests.run(signal, async combined => {
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
    return this.requests.run(signal, async combined => {
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
        if (command.synthesis?.source.kind === 'preparation'
          && this.domain.table('synthesis_sources').get(command.synthesis.source.preparationId)?.preparation.topicId !== command.topicId) {
          throw new Error('Save the synthesis in its selected Research Topic')
        }
        const synthesis = command.synthesis === undefined ? undefined : this.synthesis(command.synthesis, command.cardId)
        const cited = new Set(synthesis?.claims.flatMap(claim => claim.citations.map(citation => citation.materialIndex)))
        const sources = synthesis === undefined ? await Promise.all(command.sources.map(address => this.capture(address, combined)))
          : synthesis.materials.flatMap((material, index) => material.kind === 'turn' && cited.has(index) ? [material.source] : [])
        const content = synthesis === undefined ? command.content : knowledgeContentSchema.parse(synthesisContent(command.content, synthesis.claims))
        if (Buffer.byteLength(JSON.stringify(sources), 'utf8') > 4_000_000) throw new Error('Selected source exceeds the 4 MB card limit; select a smaller range')
        combined.throwIfAborted()
        const card: KnowledgeCard = {
          cardId: command.cardId,
          topicIds: [...new Set([...(existing?.topicIds ?? []), ...(command.topicId === undefined ? [] : [command.topicId])])],
          revisions: [...(existing?.revisions ?? []), {
            revisionId: command.revisionId, requestHash, number: (existing?.revisions.length ?? 0) + 1,
            savedAt: Date.now(), content, sources, ...(synthesis === undefined ? {} : { synthesis }),
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
    return readKnowledgeDiscussion(this.ctx, address, signal)
  }

  dispose(): Promise<void> {
    return this.requests.dispose(() => this.domain.close())
  }
}
