declare module '@deepseek-ai/dsh-session/types' {
  export interface SessionHeader { readonly id: SessionId; readonly cwd?: string; readonly parentSession?: SessionId; readonly isSeeded?: boolean; readonly delegationDepth?: number }
  export interface SessionEvent { readonly type: string; readonly seq: number; readonly time: number; readonly data: unknown }
  const logOffsetBrand: unique symbol
  export type SessionLogOffset = number & { readonly [logOffsetBrand]: true }
  export type SessionId = NonNullable<import('@deepseek-ai/dsh-llm').GenerateOptions['sessionId']>
}

// Standalone builds use structural adapters for Host services and browser-only
// packages. scripts/check-harness-types.mjs excludes this file and checks both
// compiler faces against the matching Harness's public declarations instead.
declare module '@deepseek-ai/dsh-api-session-controller' {
  const requestIdBrand: unique symbol
  export type SessionRequestId = string & { readonly [requestIdBrand]: true }
}
declare module '@deepseek-ai/dsh-session-query' {}
declare module '@deepseek-ai/dsh-session-persistence' {}
declare module '@deepseek-ai/dsh-session-reference' {}
declare module '@deepseek-ai/dsh-session-projection' {}
declare module '@deepseek-ai/dsh-session-projection-cache' {}
declare module '@deepseek-ai/dsh-workspace' {}
declare module '@deepseek-ai/dsh-workspace/types' {
  const workspaceIdBrand: unique symbol
  export type WorkspaceId = string & { readonly [workspaceIdBrand]: true }
}
declare module '@deepseek-ai/dsh-agent' {
  export interface Agent {
    readonly id: import('@deepseek-ai/dsh-session/types').SessionId
    readonly session: {
      readonly header: {
        readonly cwd?: string
        readonly parentSession?: import('@deepseek-ai/dsh-session/types').SessionId
        readonly origin?: 'subagent'
      }
      snapshotEvents(): readonly { readonly type: string; readonly data: unknown }[]
    }
    inject(message: import('@deepseek-ai/dsh-llm').UserMessage): void
    steer(message: import('@deepseek-ai/dsh-llm').UserMessage): void
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  export interface SessionProjectionStateMap {}
  export interface SessionProjectionMap {}
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  export interface SessionSummary {
    readonly id: import('@deepseek-ai/dsh-session/types').SessionId
    readonly displayTitle: string
    readonly cwd?: string
    readonly parentId?: import('@deepseek-ai/dsh-session/types').SessionId
    readonly origin?: 'subagent'
    readonly running: boolean
    readonly retainedBy: Readonly<Partial<Record<string, number>>>
    readonly blank: boolean
    readonly updatedAt: number
    readonly projectionValues?: Readonly<{
      readonly sessionGraphMerge?: import('../src/session-merge-projection.ts').SessionMergeProjection | null
    }>
  }

  export interface SessionListState {
    readonly ids: import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly byId: Record<import('@deepseek-ai/dsh-session/types').SessionId, SessionSummary>
    readonly current: import('@deepseek-ai/dsh-session/types').SessionId | undefined
    readonly phase: string
    readonly subagentsByParent: Readonly<Record<string, {
      readonly state: 'idle' | 'loading' | 'ready' | 'error'
      readonly entries: readonly (
        | { readonly id: import('@deepseek-ai/dsh-session/types').SessionId; readonly kind: 'child'; readonly mode: 'one-shot' | 'continuable' }
        | { readonly id: import('@deepseek-ai/dsh-session/types').SessionId; readonly kind: 'diagnostic' }
      )[]
    }>>
    readonly jobsBySession: Readonly<Record<string, unknown>>
    readonly currentAddress: unknown
  }
}

declare module '@deepseek-ai/dsh-api-remotes/client' {}

declare module '@deepseek-ai/dsh-api-workspace-controller/client' {
  export interface WorkspaceView {
    readonly workspaceId: string
    readonly path: string
    readonly title: string
    readonly sessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly createdAt: string
    readonly updatedAt: string
  }

  export interface WorkspaceSnapshot {
    readonly items: readonly WorkspaceView[]
    readonly archivedSessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly state: 'idle' | 'loading' | 'error'
    readonly phase: 'pending' | 'ready'
    readonly error: unknown
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  export interface LocaleNamespaceMap {}
  export type InjectFace<T extends object> = T
  export type PropsLocale<N extends keyof LocaleNamespaceMap & string> = {
    readonly t: (key: LocaleNamespaceMap[N] & string, params?: Record<string, unknown>) => string
  }
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export function MarkdownText(props: {
    readonly text: string
    readonly labels: { readonly code: { readonly copyLabel: string; readonly copiedLabel: string }; readonly footnotes: string }
  }): import('react').ReactElement
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId
  type SessionListState = import('@deepseek-ai/dsh-api-session-controller/client').SessionListState
  type SessionStatusSnapshot = import('@deepseek-ai/dsh-client-ui-session/client').SessionStatusSnapshot
  type WorkspaceSnapshot = import('@deepseek-ai/dsh-api-workspace-controller/client').WorkspaceSnapshot

  export interface ConvViewProps {
    readonly sessionId: SessionId
    readonly useSessions: <T>(selector: (state: SessionListState) => T) => T
    readonly useSessionStatus: <T>(selector: (state: SessionStatusSnapshot) => T) => T
    readonly useWorkspaces: <T>(selector: (state: WorkspaceSnapshot) => T) => T
  }
}

declare module '@deepseek-ai/dsh-client-locale/client' {}
declare module '@deepseek-ai/dsh-client-ui-renderer/client' {}
declare module '@deepseek-ai/dsh-client-ui-session/client' {
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId

  export interface SessionStatus {
    readonly running: boolean | undefined
    readonly pendingInteraction: unknown
    readonly completionUnread: boolean
  }
  export type SessionStatusSnapshot = ReadonlyMap<SessionId, SessionStatus>
}
declare module '@deepseek-ai/dsh-client-ui-workspace/client' {}


declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantInstaller = (ctx: import('@deepseek-ai/cordis').Context) => void
}
