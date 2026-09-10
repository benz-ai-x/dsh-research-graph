import '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/error'(payload: { readonly agent: import('@deepseek-ai/dsh-agent').Agent; readonly error: unknown }): void
  }
  interface Context {
    readonly storageDomain: {
      open: <Spec extends import('@deepseek-ai/dsh-storage-domain').DomainSpec>(spec: Spec) => Promise<import('@deepseek-ai/dsh-storage-domain').Domain<Spec>>
    }
    readonly locale: {
      register: (namespace: string, dictionaries: Readonly<Record<string, object>>) => () => void
      bind: (namespace: string) => (key: string, params?: Record<string, unknown>) => string
    }
    readonly slots: {
      inject: (name: string, install: () => unknown) => void
      register: (
        definition: Readonly<Record<string, unknown>>,
        component: unknown,
      ) => () => void
    }
    readonly sessions: {
      readonly list: {
        getSnapshot: () => import('@deepseek-ai/dsh-api-session-controller/client').SessionListState
      }
      create: (options: { readonly workspaceId?: string; readonly cwd?: string }) => Promise<
        import('@deepseek-ai/dsh-session/types').SessionId
      >
      open: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => void
      fork: (request: {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly increaseTitle: boolean
      }) => Promise<unknown>
      binding: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => {
        readonly session: {
          rename: (title: string) => Promise<
            | { readonly ok: true; readonly value: { readonly title: string; readonly seq: number } }
            | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
          >
        }
      } | undefined
    }
    readonly workspaces: {
      readonly list: {
        getSnapshot: () => import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceSnapshot
      }
    }
    readonly remote: {
      $mount: (
        contribution: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteContribution,
      ) => Promise<() => Promise<void>>
      sessionGraphDigest: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphDigest']
      sessionGraphMerge: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphMerge']
      sessionGraphHistory: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphHistory']
      sessionGraphSearch: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphSearch']
      sessionGraphTopics: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphTopics']
      sessionGraphKnowledge: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphKnowledge']
      sessionGraphReuse: import('@deepseek-ai/dsh-typert-protocol').TypertRemoteNamespaceMap['sessionGraphReuse']
    }
    readonly invariants: {
      register: (packageName: string, installer: unknown) => () => void
    }
    readonly sessionProjections: {
      register: (definition: unknown) => () => void
      stateOf: (session: unknown, key: string) => unknown
      onChanged: (listener: (
        session: unknown,
        key: string,
        value: unknown,
        seq: number,
      ) => void) => () => void
    }
    readonly sessionController: {
      page: (request: {
        readonly address: { readonly kind: 'session'; readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId }
        readonly throughSeq: number
      }, signal: AbortSignal) => Promise<unknown>
      create: (request: {
        readonly sessionId?: import('@deepseek-ai/dsh-session/types').SessionId
        readonly workspaceId?: import('@deepseek-ai/dsh-workspace/types').WorkspaceId
        readonly cwd?: string
      }) => Promise<{ readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId }>
      prompt: (request: {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly requestId: import('@deepseek-ai/dsh-api-session-controller').SessionRequestId
        readonly mode: 'queue' | 'steer'
        readonly content: readonly { readonly type: 'text'; readonly text: string }[]
      }, signal: AbortSignal) => Promise<{ readonly accepted: true }>
      resolveAgent: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId) => Promise<
        | { readonly agent: import('@deepseek-ai/dsh-agent').Agent }
        | { readonly error: { readonly message: string } }
      >
      inspect: (
        sessionId: import('@deepseek-ai/dsh-session/types').SessionId,
        signal?: AbortSignal,
      ) => Promise<{
        readonly meta: {
          readonly id: import('@deepseek-ai/dsh-session/types').SessionId
          readonly cwd?: string
          readonly origin?: 'subagent'
          readonly parentSession?: import('@deepseek-ai/dsh-session/types').SessionId
        }
        readonly events: readonly { readonly type: string; readonly seq: number; readonly time: number; readonly data: unknown }[]
      }>
    }
    readonly sessionReferenceResolver: {
      remoteExportCandidates: (
        agent: unknown,
        query: string,
        signal: AbortSignal,
      ) => Promise<readonly {
        readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
        readonly cwd?: string
        readonly mention: string
      }[]>
    }
    readonly sessionProjectionCache: {
      write: (session: unknown) => Promise<void>
    }
    readonly workspaceRegistry: {
      readonly archivedSessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
      list: () => readonly {
        readonly id: import('@deepseek-ai/dsh-workspace/types').WorkspaceId
        readonly title: string
        readonly path: string
        readonly sessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
      }[]
    }
    readonly sessionQuery: {
      listSessions: (signal?: AbortSignal) => Promise<readonly {
        readonly header: {
          readonly id: import('@deepseek-ai/dsh-session/types').SessionId
          readonly cwd?: string
          readonly origin?: 'subagent'
          readonly parentSession?: import('@deepseek-ai/dsh-session/types').SessionId
        }
      }[]>
      searchSessions: (request: {
        readonly query: string
        readonly sessionFilters: readonly { readonly kind: 'id'; readonly values: readonly import('@deepseek-ai/dsh-session/types').SessionId[] }[]
        readonly eventFilters: readonly { readonly kind: 'type'; readonly values: readonly string[] }[]
        readonly limit: number
        readonly cursor?: string
      }, exec?: { readonly signal?: AbortSignal }) => Promise<{
        readonly items: readonly {
          readonly header: {
            readonly id: import('@deepseek-ai/dsh-session/types').SessionId
            readonly cwd?: string
            readonly origin?: 'subagent'
          }
        }[]
        readonly nextCursor?: string
      }>
      readTitle: (sessionId: import('@deepseek-ai/dsh-session/types').SessionId, signal?: AbortSignal) => Promise<{ readonly title: string } | undefined>
    }
  }
}
