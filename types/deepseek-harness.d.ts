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

// Standalone adapter for the Host `session` Remote namespace faces used by the
// Merge model selection; the Harness compiler face checks the same calls
// against the generated declarations in the matching checkout.
declare module '@deepseek-ai/dsh-api-session-controller/remote' {
  type ModelSelection = import('@deepseek-ai/dsh-api-session-controller/client').ModelSelection
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId

  export interface SessionSelectModelRequest extends ModelSelection {
    readonly sessionId: SessionId
  }
  export interface SessionSelectModelValue {
    readonly selected: ModelSelection
  }
  export interface SessionRenameRequest {
    readonly sessionId: SessionId
    readonly title: string
  }
  export interface SessionRenameValue {
    readonly title: string
    readonly seq: number
  }
  export interface ModelCatalogModel {
    readonly id: string
    readonly name: string
  }
  export interface ModelProviderGroup {
    readonly id: string
    readonly name: string
    readonly models: readonly ModelCatalogModel[]
  }
  export interface ModelCatalog {
    readonly default: ModelSelection
    readonly groups: readonly ModelProviderGroup[]
  }
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

declare module '@deepseek-ai/dsh-session-stats/client' {
  export interface SessionStatsProjection {
    turns: number
    steps: number
    llmMs: number
    toolMs: number
    ttftMs: number
    ttftSteps: number
    decodeMs: number
    decodeTokens: number
  }
}

declare module '@deepseek-ai/dsh-session-turn-outline/client' {
  export interface TurnOutlineEntry {
    readonly turn: number
    readonly seq: number
    readonly prompt: string
    readonly response: string
  }
}

declare module '@deepseek-ai/dsh-token-meter/client' {
  export interface TokenUsageProjection {
    uncachedInputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }
  export interface ContextPressureProjection {
    pressureTokens?: number
    projectedTokens?: number
    contextWindow?: number
  }
}

declare module '@deepseek-ai/dsh-goal/client' {
  const goalIdBrand: unique symbol
  export type GoalId = string & { readonly [goalIdBrand]: true }
  export type GoalPhase = 'active' | 'paused' | 'blocked' | 'complete'
  export interface GoalBlockReason {
    readonly code: string
    readonly message: string
  }
  export interface GoalSnapshot {
    readonly id: GoalId
    readonly revision: number
    readonly objective: string
    readonly phase: GoalPhase
    readonly blockedReason?: GoalBlockReason
    readonly maxGoalRounds: number
  }
  export interface GoalProjection {
    readonly goal: GoalSnapshot
    readonly roundsStarted: number
    readonly createdAt: number
    readonly updatedAt: number
  }
}

declare module '@deepseek-ai/dsh-tool-todo/client' {
  export interface TodoItem {
    content: string
    status: 'pending' | 'in_progress' | 'completed'
  }
}

declare module '@deepseek-ai/dsh-agent-preset-registry/types' {}

declare module '@deepseek-ai/dsh-subagent/projection-types' {
  export type SubagentCatalogEntry =
    & {
      readonly id: import('@deepseek-ai/dsh-session/types').SessionId
      readonly createdAt: number
    }
    & (
      | { readonly mode: 'one-shot'; readonly label?: string }
      | { readonly mode: 'external'; readonly label?: string }
      | { readonly mode: 'continuable'; readonly label: string }
      | { readonly mode: 'unknown'; readonly label?: string }
    )
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  export interface SessionProjectionStateMap {}
  export interface SessionProjectionMap {
    title: string | null
    modelSelection: import('@deepseek-ai/dsh-api-session-controller/client').ModelSelectionProjection
    sessionStats: import('@deepseek-ai/dsh-session-stats/client').SessionStatsProjection
    turnOutline: readonly import('@deepseek-ai/dsh-session-turn-outline/client').TurnOutlineEntry[]
    tokenUsage: import('@deepseek-ai/dsh-token-meter/client').TokenUsageProjection
    contextPressure: import('@deepseek-ai/dsh-token-meter/client').ContextPressureProjection
    goal: import('@deepseek-ai/dsh-goal/client').GoalProjection | null
    todos: import('@deepseek-ai/dsh-tool-todo/client').TodoItem[] | null
    agentPreset: string | null
    subagentCatalog: import('@deepseek-ai/dsh-subagent/projection-types').SubagentCatalogEntry[]
  }
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  /** Persisted facts used to summarize a Session without activating it. */
  export interface SessionListMetadata {
    readonly blank: boolean
    readonly lastPromptAt: number | null
  }

  /** Complete model selection for one Session. */
  export interface ModelSelection {
    readonly provider: string
    readonly model: string
    readonly reasoningEffort?: string
  }

  /** Client view of the durable model-selection fold. */
  export interface ModelSelectionProjection {
    readonly lastUsed: ModelSelection | null
    readonly next: ModelSelection | null
  }

  export interface SessionSummary {
    readonly id: import('@deepseek-ai/dsh-session/types').SessionId
    /** Latest durable log-backed title, absent until the host projects one. */
    readonly title?: string
    readonly displayTitle: string
    readonly cwd?: string
    readonly parentId?: import('@deepseek-ai/dsh-session/types').SessionId
    readonly origin?: 'subagent'
    readonly running: boolean
    readonly retainedBy: Readonly<Partial<Record<string, number>>>
    readonly blank: boolean
    readonly updatedAt: number
    readonly projectionValues?: Readonly<
      Partial<import('@deepseek-ai/dsh-session-projection/types').SessionProjectionMap>
    >
  }

  export interface SessionProjectionSnapshot {
    readonly values: Readonly<
      Partial<import('@deepseek-ai/dsh-session-projection/types').SessionProjectionMap>
    >
    readonly state: 'idle' | 'loading' | 'ready' | 'migration-required' | 'error'
    readonly error: unknown
  }

  export interface SessionListState {
    readonly ids: import('@deepseek-ai/dsh-session/types').SessionId[]
    readonly byId: Record<import('@deepseek-ai/dsh-session/types').SessionId, SessionSummary>
    readonly current: import('@deepseek-ai/dsh-session/types').SessionId | undefined
    readonly phase: string
    readonly projectionsBySession: Readonly<Record<string, SessionProjectionSnapshot>>
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
    readonly pinnedSessionIds: readonly import('@deepseek-ai/dsh-session/types').SessionId[]
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

  /** Structural stand-ins for the shipped icon set (size in px, color currentColor). */
  interface SidebarIconProps {
    readonly size?: number | undefined
    readonly className?: string | undefined
  }
  export function IconTriangleRightFillRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPlusOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconNewChatOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconEditOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconCloseOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconFlatListOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconEllipsisOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconSearchOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconArchiveOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPinOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function StateDot(props: { readonly state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle' }): import('react').ReactElement

  /** Structural stand-ins for the shipped menu, tooltip, and time primitives. */
  export interface MenuItemEntry {
    readonly id: string
    readonly label: import('react').ReactNode
    readonly disabled?: boolean
    readonly icon?: import('react').ReactNode
    readonly danger?: boolean
    readonly submenu?: readonly MenuItemEntry[]
  }
  export interface MenuSeparatorEntry { readonly type: 'separator'; readonly id: string }
  export interface MenuLabelEntry { readonly type: 'label'; readonly id: string; readonly text: string }
  export type MenuEntry = MenuItemEntry | MenuSeparatorEntry | MenuLabelEntry
  export function Menu(props: {
    readonly open: boolean
    readonly anchor: import('react').ReactElement
    readonly items?: readonly MenuEntry[]
    readonly onSelect?: (id: string) => void
    readonly onClose: () => void
    readonly align?: 'start' | 'end'
    readonly side?: 'bottom' | 'top' | 'right'
    readonly dense?: boolean
    readonly minWidthFromAnchor?: boolean
  }): import('react').ReactElement
  export function MenuItemButton(props: {
    readonly children: import('react').ReactNode
    readonly icon?: import('react').ReactNode
    readonly disabled?: boolean
    readonly danger?: boolean
    readonly current?: boolean
    readonly separatorBefore?: boolean
    readonly onSelect: () => void
  }): import('react').ReactElement
  export function Tooltip(props: {
    readonly label: string
    readonly side?: 'top' | 'bottom' | 'left' | 'right'
    readonly align?: 'center' | 'end'
    readonly delayMs?: number
    readonly disabled?: boolean
    readonly children: import('react').ReactElement
  }): import('react').ReactElement
  export interface RelativeTime { readonly unit: 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'; readonly n: number }
  export function relativeTime(at: number, now: number): RelativeTime
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
declare module '@deepseek-ai/dsh-client-ui-renderer/client' {}declare module '@deepseek-ai/dsh-client-ui-session/client' {
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId

  export interface SessionStatus {
    readonly running: boolean | undefined
    readonly pendingInteraction: unknown
    readonly completionUnread: boolean
  }
  export type SessionStatusSnapshot = ReadonlyMap<SessionId, SessionStatus>
}
declare module '@deepseek-ai/dsh-client-ui-workspace/client' {}

// Standalone adapter for the sidebar shell's owner-share contracts; the
// Harness compiler face checks the same registrations against the sidebar
// package's public declarations instead.
declare module '@deepseek-ai/dsh-client-ui-sidebar/client' {
  /** Owner share of the sidebar browsing region (the shell's fold state). */
  export interface SidebarSectionOwnerProps {
    readonly wide: boolean
    readonly expandSidebar: () => void
  }
  /** Owner share of one sidebar-foot action row. */
  export interface SidebarFooterActionOwnerProps {
    readonly wide: boolean
  }
}
