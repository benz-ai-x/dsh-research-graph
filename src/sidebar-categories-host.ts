import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type { SidebarCategoryWorkspace, SidebarCategoryWrite } from './sidebar-category.ts'
import { sidebarCategoryListSchema, sidebarCategoryWorkspaceSchema, sidebarCategoryWriteSchema } from './sidebar-category-codec.ts'
import { ServiceRequests } from './service-requests.ts'

const workspaceStorageSchema: z.ZodType<SidebarCategoryWorkspace> = z.unknown().transform((value, context) => {
  try {
    return sidebarCategoryWorkspaceSchema.parse(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Sidebar Category Workspace record' })
    return z.NEVER
  }
})

export const SIDEBAR_CATEGORY_DOMAIN = {
  name: 'session_graph_sidebar_categories',
  version: 1,
  tables: {
    workspaces: { valueSchema: workspaceStorageSchema },
    metadata: { valueSchema: z.object({ version: z.literal(1) }) },
  },
} as const

const LEGACY_MIGRATION_KEY = 'research-topic-workspaces-v1'

function emptyWorkspace(workspaceId: string): SidebarCategoryWorkspace {
  return { workspaceId, categories: [] }
}

function moved(
  current: SidebarCategoryWorkspace,
  sessionId: string,
  categoryId?: string,
): SidebarCategoryWorkspace {
  return {
    ...current,
    categories: current.categories.map(category => ({
      ...category,
      sessionIds: category.categoryId === categoryId
        ? [...category.sessionIds.filter(id => id !== sessionId), sessionId]
        : category.sessionIds.filter(id => id !== sessionId),
    })),
  }
}

export class SidebarCategoriesService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Sidebar Categories service')
  private tail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly domain: Domain<typeof SIDEBAR_CATEGORY_DOMAIN>) {
    super(ctx, 'sessionGraphCategories')
    ctx.effect(() => () => this.dispose(), 'session-graph.sidebar-categories-quiescence')
  }

  async migrateLegacyCategories(): Promise<void> {
    const metadata = this.domain.table('metadata')
    if (metadata.get(LEGACY_MIGRATION_KEY) !== undefined) return
    const topics = await this.ctx.sessionGraphTopics.list(new AbortController().signal)
    const workspaces = new Map(this.ctx.workspaceRegistry.list().map(workspace => [String(workspace.id), workspace]))
    const table = this.domain.table('workspaces')
    for (const topic of topics) {
      if (topic.workspaceId === undefined) continue
      const workspace = workspaces.get(topic.workspaceId)
      if (workspace === undefined) continue
      const current = table.get(topic.workspaceId) ?? emptyWorkspace(topic.workspaceId)
      if (current.categories.some(category => category.categoryId === topic.topicId)) continue
      const members = new Set(workspace.sessionIds.map(String))
      const assigned = new Set(current.categories.flatMap(category => category.sessionIds))
      const sessionIds = topic.references.flatMap(reference => {
        if (!members.has(reference.sessionId) || assigned.has(reference.sessionId)) return []
        assigned.add(reference.sessionId)
        return [reference.sessionId]
      })
      await table.put(topic.workspaceId, {
        ...current,
        categories: [...current.categories, { categoryId: topic.topicId, title: topic.title, sessionIds }],
      })
    }
    await metadata.put(LEGACY_MIGRATION_KEY, { version: 1 })
  }

  @Remote('list')
  list(signal: AbortSignal): Promise<readonly SidebarCategoryWorkspace[]> {
    return this.requests.run(signal, async () => {
      const records = [...this.domain.table('workspaces').entries()].map(([, record]) => record)
      return sidebarCategoryListSchema.parse(records)
    })
  }

  @Remote('write')
  write(request: SidebarCategoryWrite, signal: AbortSignal): Promise<SidebarCategoryWorkspace> {
    return this.requests.run(signal, combined => this.serialize(async () => {
      const command = sidebarCategoryWriteSchema.parse(request)
      const workspace = this.ctx.workspaceRegistry.list().find(item => String(item.id) === command.workspaceId)
      if (workspace === undefined) throw new Error('Sidebar Category Workspace is unavailable')
      const sessionId = command.kind === 'move' || command.kind === 'create' ? command.sessionId : undefined
      if (sessionId !== undefined) await this.validateSession(sessionId, workspace.sessionIds.map(String), combined)
      const table = this.domain.table('workspaces')
      const current = table.get(command.workspaceId) ?? emptyWorkspace(command.workspaceId)
      let next = current
      if (command.kind === 'move') {
        if (command.categoryId !== undefined && !current.categories.some(category => category.categoryId === command.categoryId)) {
          throw new Error('Sidebar Category is unavailable')
        }
        next = moved(current, command.sessionId, command.categoryId)
      } else if (command.kind === 'delete') {
        if (!current.categories.some(category => category.categoryId === command.categoryId)) {
          throw new Error('Sidebar Category is unavailable')
        }
        next = {
          ...current,
          categories: current.categories.filter(category => category.categoryId !== command.categoryId),
        }
      } else {
        const duplicate = current.categories.find(category =>
          category.categoryId !== command.categoryId && category.title.toLocaleLowerCase() === command.title.toLocaleLowerCase())
        if (duplicate !== undefined) throw new Error('A Sidebar Category with this title already exists')
        if (command.kind === 'rename') {
          if (!current.categories.some(category => category.categoryId === command.categoryId)) {
            throw new Error('Sidebar Category is unavailable')
          }
          next = {
            ...current,
            categories: current.categories.map(category => category.categoryId === command.categoryId
              ? { ...category, title: command.title }
              : category),
          }
        } else {
          const existing = current.categories.find(category => category.categoryId === command.categoryId)
          if (existing !== undefined && existing.title !== command.title) {
            throw new Error('This Sidebar Category identity already belongs to another title')
          }
          const withCategory = existing === undefined
            ? {
                ...current,
                categories: [...current.categories, { categoryId: command.categoryId, title: command.title, sessionIds: [] }],
              }
            : current
          next = command.sessionId === undefined ? withCategory : moved(withCategory, command.sessionId, command.categoryId)
        }
      }
      combined.throwIfAborted()
      if (next !== current) await table.put(command.workspaceId, next)
      return next
    }))
  }

  private async validateSession(sessionId: string, account: readonly string[], signal: AbortSignal): Promise<void> {
    if (!account.includes(sessionId)) throw new Error('Session does not belong to this Workspace')
    const listed = await this.ctx.sessionQuery.listSessions(signal)
    const source = listed.find(item => String(item.header.id) === sessionId)
    if (source === undefined || source.header.origin === 'subagent') throw new Error('Session is unavailable')
    signal.throwIfAborted()
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
