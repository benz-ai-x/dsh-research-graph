import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { containsSessionReferenceUri } from './session-merge.ts'
import { readKnowledgeDiscussion } from './knowledge-discussion.ts'
import { RESEARCH_MATERIAL_BUDGET, researchReusePrompt, type ResearchMaterial, type ResearchReusePreparation, type ResearchReuseRecord } from './research-reuse.ts'
import { researchReusePreparationSchema, researchReuseReadSchema, researchReuseRecordSchema, researchReuseSessionSchema } from './research-reuse-codec.ts'
import { ServiceRequests } from './service-requests.ts'

const recordSchema: z.ZodType<ResearchReuseRecord> = z.unknown().transform((value, context) => {
  try { return researchReuseRecordSchema.parse(value) } catch {
    context.addIssue({ code: 'custom', message: 'Invalid research reuse record' })
    return z.NEVER
  }
})
export const RESEARCH_REUSE_DOMAIN = { name: 'session_graph_reuse', version: 1, tables: { attempts: { valueSchema: recordSchema } } } as const

/** A durable admission journal binds one frozen preview to one native Session/request identity. */
export class ResearchReuseService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Research reuse service')
  private tail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly domain: Domain<typeof RESEARCH_REUSE_DOMAIN>) {
    super(ctx, 'sessionGraphReuse')
    ctx.effect(() => () => this.dispose(), 'session-graph.reuse-quiescence')
  }

  @Remote('prepare')
  prepare(request: ResearchReusePreparation, signal: AbortSignal): Promise<ResearchReuseRecord> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      combined.throwIfAborted()
      const command = researchReusePreparationSchema.parse(request)
      const requestHash = createHash('sha256').update(JSON.stringify(command)).digest('hex')
      const existing = this.domain.table('attempts').get(command.operationId)
      if (existing !== undefined) {
        if (existing.requestHash !== requestHash) throw new Error('This preview identity already belongs to other materials')
        return this.recoverTarget(existing, combined)
      }
      const workspace = this.ctx.workspaceRegistry.list().find(item => String(item.id) === command.workspaceId)
      if (workspace === undefined) throw new Error('Choose an available target Workspace')
      const materials: ResearchMaterial[] = []
      for (const selection of command.materials) {
        combined.throwIfAborted()
        if (selection.kind === 'card') {
          const card = await this.ctx.sessionGraphKnowledge.read({ cardId: selection.cardId }, combined)
          const revision = card?.revisions.find(item => item.revisionId === selection.revisionId)
          if (revision === undefined) throw new Error('Selected Card Revision is unavailable')
          materials.push({ kind: 'card', cardId: selection.cardId, revisionId: revision.revisionId, revisionNumber: revision.number,
            savedAt: revision.savedAt, content: revision.content, sources: revision.sources.map(source => ({
              sessionId: source.sessionId, title: source.title, startSeq: source.source.startSeq, endSeq: source.source.endSeq,
              startedAt: source.source.turns[0]!.startedAt,
            })) })
        } else {
          const source = await readKnowledgeDiscussion(this.ctx, { ...selection, kind: 'discussion' }, combined)
          if (source.source.turns.length !== 1) throw new Error('Each original material must contain one complete turn')
          materials.push({ kind: 'turn', source })
        }
      }
      const promptText = researchReusePrompt(materials, command.question)
      if (containsSessionReferenceUri(promptText)) throw new Error('Selected text contains a Harness Session reference. Edit or remove that material before sending')
      if (promptText.length > RESEARCH_MATERIAL_BUDGET) throw new Error(`Selected material exceeds the ${RESEARCH_MATERIAL_BUDGET} character budget; reduce it and preview again`)
      const record: ResearchReuseRecord = {
        operationId: command.operationId, requestHash, requestId: randomUUID(), targetSessionId: `session-${randomUUID()}`,
        targetCreated: false, stage: 'prepared', workspace: { id: String(workspace.id), title: workspace.title, cwd: workspace.path },
        createdAt: Date.now(), question: command.question, materials, promptText, budgetChars: RESEARCH_MATERIAL_BUDGET,
      }
      combined.throwIfAborted()
      await this.domain.table('attempts').put(record.operationId, record)
      return record
    }))
  }

  @Remote('read')
  read(request: { readonly operationId: string }, signal: AbortSignal): Promise<ResearchReuseRecord | null> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      // Wait for uncancellable creation, then verify the reserved native identity:
      // failed journal writes can leave an older prepared record in storage.
      combined.throwIfAborted()
      const record = this.domain.table('attempts').get(researchReuseReadSchema.parse(request).operationId)
      return record === undefined ? null : this.recoverTarget(record, combined)
    }))
  }

  @Remote('forSession')
  forSession(request: { readonly sessionId: string }, signal: AbortSignal): Promise<readonly ResearchReuseRecord[]> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      combined.throwIfAborted()
      const { sessionId } = researchReuseSessionSchema.parse(request)
      const records = [...this.domain.table('attempts').entries()].map(([, record]) => record)
        .filter(record => record.targetSessionId === sessionId)
      return (await Promise.all(records.map(record => this.recoverTarget(record, combined))))
        .filter(record => record.targetCreated)
    }))
  }

  @Remote('submit')
  submit(request: { readonly operationId: string }, signal: AbortSignal): Promise<ResearchReuseRecord> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      combined.throwIfAborted()
      const { operationId } = researchReuseReadSchema.parse(request)
      const table = this.domain.table('attempts')
      let record = table.get(operationId)
      if (record === undefined) throw new Error('Preview is unavailable; preview materials again')
      if (record.stage === 'accepted') return record
      try {
        const workspace = this.ctx.workspaceRegistry.list().find(item => String(item.id) === record!.workspace.id)
        if (workspace === undefined || workspace.path !== record.workspace.cwd) throw new Error('Target Workspace changed; choose it and preview again')
        if (record.stage === 'prepared') {
          const target = await this.ctx.sessionController.create({ workspaceId: record.workspace.id as WorkspaceId, sessionId: record.targetSessionId as SessionId })
          if (target.sessionId !== record.targetSessionId) throw new Error('Harness returned a different target Session')
          record = { ...record, targetCreated: true, stage: 'created' }
          await table.put(operationId, record)
        }
        combined.throwIfAborted()
        const receipt = await this.ctx.sessionController.prompt({ sessionId: record.targetSessionId as SessionId,
          requestId: record.requestId as SessionRequestId, mode: 'queue', content: [{ type: 'text', text: record.promptText }] }, combined)
        if (receipt.accepted !== true) throw new Error('Harness did not acknowledge prompt admission')
        const { error: _, ...saved } = record
        record = { ...saved, stage: 'accepted', acceptedAt: Date.now() }
        // Admission has happened. Persist its receipt even if the browser disconnected.
        await table.put(operationId, record)
        return record
      } catch (error) {
        // A receipt write failure is uncertain to the caller. Leave recovery to
        // the same native request identity instead of persisting a false failure.
        if (record.stage === 'accepted') throw error
        const recovered = await this.recoverTarget(record)
        const failed = { ...recovered, error: (error instanceof Error ? error.message : String(error)).slice(0, 4000) }
        await table.put(operationId, failed)
        return failed
      }
    }))
  }

  private async recoverTarget(record: ResearchReuseRecord, signal?: AbortSignal): Promise<ResearchReuseRecord> {
    if (record.targetCreated) return record
    try {
      // An empty history cut verifies existence without starting an Agent or
      // returning source text. Its public error codes survive module copies.
      await this.ctx.sessionController.page({ address: { kind: 'session', sessionId: record.targetSessionId as SessionId },
        throughSeq: -1 }, signal ?? new AbortController().signal)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'session/not-found') return record
      throw error
    }
    // Recovery stays read-only and works while the journal is unwritable.
    // Keep `prepared` so retry still adopts/attaches the same native target.
    return { ...record, targetCreated: true }
  }

  private serialize<Value>(operation: () => Promise<Value>): Promise<Value> {
    const pending = this.tail.then(operation)
    this.tail = pending.then(() => {}, () => {})
    return pending
  }

  dispose(): Promise<void> {
    return this.requests.dispose(() => this.domain.close())
  }
}
