/**
 * Browser session-graph plugin contributing one entry to the conversation
 * view slot without defining a service.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
// Type-only: pulls the Session Controller's Context merge (ctx.sessions).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the Workspace Controller's Context merge (ctx.workspaces).
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
// Type-only: pulls the generated Remote gateway Context merge (ctx.remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row (declared by the slot's
// owning package) must be in the program for the register calls to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot service and global Session/Workspace standard props.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { createSessionMergeModule } from '../session-merge.ts'
import { GraphView, type GraphViewInjected } from './GraphView.tsx'
import { NS, en, zh } from './locales.ts'
import { SESSION_DIGEST_REMOTE } from './session-digest-remote.ts'
import { SESSION_MERGE_REMOTE } from './session-merge-remote.ts'
import { SESSION_HISTORY_REMOTE } from './session-history-remote.ts'
import { DISCUSSION_SEARCH_REMOTE } from './session-search-remote.ts'
import { RESEARCH_TOPICS_REMOTE } from './research-topics-remote.ts'
import { KNOWLEDGE_REMOTE } from './knowledge-remote.ts'
import { RESEARCH_REUSE_REMOTE } from './research-reuse-remote.ts'

export type { GraphViewInjected, GraphViewProps } from './GraphView.tsx'

/** Required services: the conversation view slot, the sessions list, and the locale service. */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'remote']

const SESSION_GRAPH_REMOTE: TypertRemoteContribution = {
  package: SESSION_DIGEST_REMOTE.package,
  descriptors: [
    ...SESSION_DIGEST_REMOTE.descriptors,
    ...SESSION_MERGE_REMOTE.descriptors,
    ...SESSION_HISTORY_REMOTE.descriptors,
    ...DISCUSSION_SEARCH_REMOTE.descriptors,
    ...RESEARCH_TOPICS_REMOTE.descriptors,
    ...KNOWLEDGE_REMOTE.descriptors,
    ...RESEARCH_REUSE_REMOTE.descriptors,
  ],
}

/** Register the Graph view after its dynamically mounted Remote is injectable. */
async function registerUi(ctx: Context): Promise<void> {
  const lifecycle = new AbortController()
  ctx.effect(() => () => { lifecycle.abort() }, 'ui-session-graph: identity request')
  const identity = await ctx.remote.sessionGraphKnowledge.hostIdentity(AbortSignal.any([lifecycle.signal, AbortSignal.timeout(30_000)]))
  lifecycle.signal.throwIfAborted()
  if (!identity.ok) throw new Error(identity.error.message)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-graph: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  const merges = createSessionMergeModule({
    inspectSource: async (sessionId, signal) => {
      signal.throwIfAborted()
      const row = ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]
      if (row === undefined) throw new Error(`Session ${JSON.stringify(sessionId)} is unavailable`)
      const workspaces = ctx.workspaces.list.getSnapshot()
      const workspace = workspaces.items.find(item => item.sessionIds.includes(row.id))
        ?? workspaces.items.find(item => item.path === row.cwd)
      return {
        sessionId,
        title: row.displayTitle,
        cwd: row.cwd ?? '',
        ...(workspace === undefined ? {} : { workspaceId: workspace.workspaceId }),
        canvas: row.origin !== 'subagent'
          && row.cwd !== undefined
          && !row.blank
          && !workspaces.archivedSessionIds.includes(row.id),
      }
    },
    createTarget: async (location, signal) => {
      signal.throwIfAborted()
      const target = await ctx.sessions.create(location.workspaceId === undefined
        ? { cwd: location.cwd }
        : { workspaceId: location.workspaceId as WorkspaceId })
      signal.throwIfAborted()
      return target
    },
    renameTarget: async (targetSessionId, title, signal) => {
      signal.throwIfAborted()
      const binding = ctx.sessions.binding(targetSessionId as SessionId)
      if (binding === undefined) {
        throw new Error(`Merge Session ${JSON.stringify(targetSessionId)} has no Client binding`)
      }
      const result = await binding.session.rename(title)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      signal.throwIfAborted()
    },
    submitMerge: async (request, signal) => {
      const result = await ctx.remote.sessionGraphMerge.submit(request, signal)
      if (!result.ok) {
        const error = new Error(result.error.message) as Error & {
          code?: string
          stage?: unknown
        }
        error.code = result.error.code
        error.stage = (result.error.details as Readonly<Record<string, unknown>>)['stage']
        throw error
      }
    },
    openTarget: targetSessionId => {
      ctx.sessions.open(targetSessionId as SessionId)
    },
    createOperationId: () => crypto.randomUUID(),
  })
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'graph',
    order: 20,
    locale: NS,
    label: () => t('view.graph'),
    inject: (): GraphViewInjected => ({
      hostId: identity.value.hostId,
      reuse: {
        prepare: async (request, signal) => {
          const result = await ctx.remote.sessionGraphReuse.prepare(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        submit: async (request, signal) => {
          const result = await ctx.remote.sessionGraphReuse.submit(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        read: async (request, signal) => {
          const result = await ctx.remote.sessionGraphReuse.read(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        forSession: async (request, signal) => {
          const result = await ctx.remote.sessionGraphReuse.forSession(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
      },
      knowledge: {
        prepareExport: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.prepareExport(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        prepareExtraction: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.prepareExtraction(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        extract: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.extract(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        read: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.read(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        save: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.save(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        search: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.search(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        membership: async (request, signal) => {
          const result = await ctx.remote.sessionGraphKnowledge.membership(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
      },
      topics: {
        list: async signal => {
          const result = await ctx.remote.sessionGraphTopics.list(signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        read: async (request, signal) => {
          const result = await ctx.remote.sessionGraphTopics.read(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
        write: async (request, signal) => {
          const result = await ctx.remote.sessionGraphTopics.write(request, signal)
          if (!result.ok) throw new Error(result.error.message)
          return result.value
        },
      },
      searchDiscussion: async (request, signal) => {
        const result = await ctx.remote.sessionGraphSearch.search(request, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      },
      readSessionHistory: async (request, signal) => {
        const result = await ctx.remote.sessionGraphHistory.read(request, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      },
      // Canvas Sessions exclude Subagent Sessions by construction, so
      // navigation is a plain open.
      openSession: (id: SessionId) => {
        ctx.sessions.open(id)
      },
      branchSession: async (id: SessionId) => {
        await ctx.sessions.fork({ sessionId: id, increaseTitle: true })
      },
      generateSessionDigest: async (id, options, signal) => {
        const result = await ctx.remote.sessionGraphDigest.generate({
          sessionId: id,
          refresh: options.refresh,
        }, signal)
        if (!result.ok) {
          const error = new Error(result.error.message) as Error & { code?: string }
          error.code = result.error.code
          throw error
        }
        return result.value
      },
      mergeSessions: async (sourceIds, instruction, signal) => await merges.mergeSessions(
        sourceIds,
        instruction,
        signal,
      ) as SessionId,
      retrySessionMerge: async (targetSessionId, sourceIds, instruction, signal) =>
        await merges.retryMerge(targetSessionId, sourceIds, instruction, signal) as SessionId,
    }),
  }, GraphView))
}

/**
 * Mount the Digest, Merge, and History Remotes, then register the Graph UI
 * inside a child Context that explicitly depends on those namespaces.
 * @param ctx - client root context.
 * @returns disposer that removes the UI before unmounting its Remote.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(SESSION_GRAPH_REMOTE)
  const ui = ctx.inject(
    [
      'slots',
      'sessions',
      'workspaces',
      'locale',
      'remote.sessionGraphDigest',
      'remote.sessionGraphMerge',
      'remote.sessionGraphHistory',
      'remote.sessionGraphSearch',
      'remote.sessionGraphTopics',
      'remote.sessionGraphKnowledge',
      'remote.sessionGraphReuse',
    ],
    registerUi,
  )
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await disposeRemote()
  }
}
