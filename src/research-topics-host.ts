import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopic, ResearchTopicReference, ResearchTopicSnapshot, ResearchTopicWrite } from './research-topic.ts'
import { researchTopicReadSchema, researchTopicWriteSchema } from './research-topic-codec.ts'
import { researchTopicStorageSchema } from './research-topic-storage.ts'

export const RESEARCH_TOPIC_DOMAIN = {
  name: 'session_graph_topics',
  version: 1,
  tables: { topics: { valueSchema: researchTopicStorageSchema } },
} as const

/** Durable topic operations use the Host's configured storage domain. */
export class ResearchTopicsService extends TypertRemoteService {
  private readonly lifecycle = new AbortController()
  private readonly active = new Set<Promise<unknown>>()
  private tail: Promise<void> = Promise.resolve()
  private disposal: Promise<void> | undefined

  constructor(ctx: Context, private readonly domain: Domain<typeof RESEARCH_TOPIC_DOMAIN>) {
    super(ctx, 'sessionGraphTopics')
    ctx.effect(() => () => this.dispose(), 'session-graph.topics-quiescence')
  }

  @Remote('list')
  list(signal: AbortSignal): Promise<readonly ResearchTopic[]> {
    return this.run(signal, async () => [...this.domain.table('topics').entries()].map(([, topic]) => topic))
  }

  @Remote('read')
  read(request: { readonly topicId: string }, signal: AbortSignal): Promise<ResearchTopicSnapshot> {
    return this.run(signal, async combined => {
      const { topicId } = researchTopicReadSchema.parse(request)
      const topic = this.domain.table('topics').get(topicId)
      if (topic === undefined) throw new Error('Research Topic is unavailable')
      const listed = await this.ctx.sessionQuery.listSessions(combined)
      combined.throwIfAborted()
      const byId = new Map(listed.map(item => [String(item.header.id), item.header]))
      const archived = new Set<string>(this.ctx.workspaceRegistry.archivedSessionIds)
      const owner = this.workspaceOwners()
      return {
        topic,
        sources: topic.references.map(reference => {
          const header = byId.get(reference.sessionId)
          const base = { ...reference, archived: archived.has(reference.sessionId) }
          if (header === undefined || header.origin === 'subagent') return { ...base, status: 'unavailable' as const }
          const workspace = owner(header)
          return {
            sessionId: reference.sessionId, title: reference.title,
            status: 'listed' as const, archived: base.archived,
            ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
            ...(workspace === undefined ? {} : { workspace }),
            ...(header.parentSession === undefined ? {} : { parentSessionId: String(header.parentSession) }),
          }
        }),
      }
    })
  }

  @Remote('write')
  write(request: ResearchTopicWrite, signal: AbortSignal): Promise<ResearchTopic> {
    return this.run(signal, async combined => {
      const command = researchTopicWriteSchema.parse(request)
      const operation = this.tail.then(async () => {
        combined.throwIfAborted()
        const table = this.domain.table('topics')
        if (command.kind === 'create') {
          const existing = table.get(command.topicId)
          if (existing !== undefined) return existing
          const topic: ResearchTopic = {
            topicId: command.topicId, title: command.title, references: [],
            arrangement: { positions: {}, collapsed: [], offsets: {} },
          }
          await table.put(command.topicId, topic)
          return topic
        }
        const current = table.get(command.topicId)
        if (current === undefined) throw new Error('Research Topic is unavailable')
        const references = command.kind === 'rename' || command.kind === 'arrange' ? current.references : command.kind === 'remove'
          ? current.references.filter(reference => reference.sessionId !== command.sessionId)
          : [...new Map([
            ...current.references,
            ...await this.references(command.sessionIds, combined),
          ].map(reference => [reference.sessionId, reference])).values()]
        combined.throwIfAborted()
        const topic: ResearchTopic = {
          ...current, references,
          title: command.kind === 'rename' ? command.title : current.title,
          arrangement: command.kind === 'arrange' ? command.arrangement : current.arrangement,
        }
        await table.put(command.topicId, topic)
        return topic
      })
      this.tail = operation.then(() => {}, () => {})
      return operation
    })
  }

  private async references(ids: readonly string[], signal: AbortSignal): Promise<readonly ResearchTopicReference[]> {
    const listed = await this.ctx.sessionQuery.listSessions(signal)
    signal.throwIfAborted()
    const byId = new Map(listed.map(item => [String(item.header.id), item.header]))
    const ownerOf = this.workspaceOwners()
    const references: ResearchTopicReference[] = []
    for (const id of new Set(ids)) {
      const source = byId.get(id)
      if (source === undefined || source.origin === 'subagent') throw new Error('Source Session is unavailable')
      const owner = ownerOf(source)
      references.push({
        sessionId: id,
        title: (await this.ctx.sessionQuery.readTitle(id as SessionId, signal))?.title.trim() || id,
        ...(source.cwd === undefined ? {} : { cwd: source.cwd }),
        ...(owner === undefined ? {} : { workspace: owner }),
      })
      signal.throwIfAborted()
    }
    return references
  }

  private workspaceOwners(): (source: { readonly id: string; readonly cwd?: string }) => ResearchTopicReference['workspace'] {
    const bySession = new Map<string, NonNullable<ResearchTopicReference['workspace']>>()
    const byPath = new Map<string, NonNullable<ResearchTopicReference['workspace']>>()
    for (const workspace of this.ctx.workspaceRegistry.list()) {
      const label = { id: String(workspace.id), title: workspace.title.trim() || workspace.path }
      if (!byPath.has(workspace.path)) byPath.set(workspace.path, label)
      for (const id of workspace.sessionIds) if (!bySession.has(id)) bySession.set(id, label)
    }
    return source => bySession.get(source.id) ?? (source.cwd === undefined ? undefined : byPath.get(source.cwd))
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.lifecycle.abort(new Error('Research Topics service is disposed'))
    this.disposal = Promise.allSettled([...this.active]).then(() => this.domain.close())
    return this.disposal
  }

  private run<Value>(signal: AbortSignal, operation: (combined: AbortSignal) => Promise<Value>): Promise<Value> {
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
