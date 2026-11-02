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

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export function MarkdownText(props: {
    readonly text: string
    readonly labels: { readonly code: { readonly copyLabel: string; readonly copiedLabel: string }; readonly footnotes: string }
  }): import('react').ReactElement

  /** Structural stand-ins for the shipped icon set (size in px, color currentColor). */
  interface SidebarIconProps {
    readonly size?: number | undefined
    readonly className?: string | undefined | undefined
  }
  export function IconTriangleRightFillRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPlusOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconNewChatOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconNewChatOutlineMedium(props: SidebarIconProps): import('react').ReactElement
  export function IconEditOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconCloseOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconCloseFillRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconFlatListOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconFolderCloseRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconFolderOpenRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconEllipsisOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconSearchOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconSlidersTwoOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconArchiveOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconArchiveOffOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconArchiveCheckOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconBranchOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconChevronsUpDownOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconClockOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconCopyOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPanelLeftOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPinOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconPinFillRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconProjectAddOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconQueueOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconTrashOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconUnarchiveOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconWarningOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconWorkspaceTreeOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function IconAppsAddOutlineRegular(props: SidebarIconProps): import('react').ReactElement
  export function FishLogo(props: SidebarIconProps): import('react').ReactElement
  export type StateDotState = 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
  export function StateDot(props: { readonly state: StateDotState }): import('react').ReactElement

  export function Button(props: {
    readonly variant?: 'primary' | 'outline' | 'ghost'
    readonly className?: string | undefined
    readonly disabled?: boolean | undefined
    readonly onClick?: () => void | undefined
    readonly children?: import('react').ReactNode | undefined
  }): import('react').ReactElement

  export function Modal(props: {
    readonly open: boolean
    readonly onClose: () => void
    readonly closeLabel?: string
    readonly title?: import('react').ReactNode
    readonly description?: import('react').ReactNode
    readonly footer?: import('react').ReactNode
    readonly children?: import('react').ReactNode | undefined
  }): import('react').ReactElement

  export function Toast(props: {
    readonly text: string
    readonly tone?: 'success' | 'warning' | undefined
    readonly icon?: import('react').ReactNode | undefined
    readonly holdMs?: number | undefined
    readonly actions?: readonly {
      readonly label: string
      readonly prefix?: string | undefined
      readonly onClick: () => void
    }[] | undefined
    readonly onDone?: (() => void) | undefined
  }): import('react').ReactElement

  export function HoverCard(props: {
    readonly anchor: import('react').ReactElement
    readonly content: import('react').ReactNode
    readonly openDelayMs?: number | undefined
    readonly grouped?: boolean | undefined
    readonly disabled?: boolean | undefined
    readonly copyText?: string | undefined | undefined
    readonly copyLabel?: string
    readonly copiedLabel?: string
  }): import('react').ReactElement

  export function HoverCardGroup(props: {
    readonly className?: string | undefined
    readonly children?: import('react').ReactNode | undefined
  }): import('react').ReactElement

  export function ShortcutKeys(props: { readonly keys?: readonly string[] }): import('react').ReactElement

  /** Structural stand-ins for the shipped menu, tooltip, clipboard, and platform helpers. */
  export interface MenuItemEntry {
    readonly id: string
    readonly label: import('react').ReactNode
    readonly disabled?: boolean | undefined
    readonly icon?: import('react').ReactNode | undefined
    readonly danger?: boolean
    readonly submenu?: readonly MenuItemEntry[] | undefined
  }
  export interface MenuSeparatorEntry { readonly type: 'separator'; readonly id: string }
  export interface MenuLabelEntry { readonly type: 'label'; readonly id: string; readonly text: string }
  export type MenuEntry = MenuItemEntry | MenuSeparatorEntry | MenuLabelEntry
  export function Menu(props: {
    readonly open: boolean
    readonly autoFocus?: boolean | undefined
    readonly className?: string | undefined
    readonly children?: import('react').ReactNode | undefined
    readonly anchor: import('react').ReactElement | null | undefined
    readonly items?: readonly MenuEntry[] | undefined
    readonly footer?: readonly MenuEntry[] | undefined
    readonly selectedId?: string | undefined
    readonly selectedIds?: readonly string[] | undefined
    readonly getAnchorRect?: (() => DOMRect | null) | undefined
    readonly onSelect?: (id: string) => void | undefined
    readonly onClose: () => void
    readonly align?: 'start' | 'end' | undefined
    readonly side?: 'bottom' | 'top' | 'right' | undefined
    readonly portal?: boolean | undefined
    readonly closeOnPointerLeave?: boolean | undefined
    readonly dense?: boolean | undefined
    readonly minWidthFromAnchor?: boolean | undefined
    readonly listClassName?: string | undefined
  }): import('react').ReactElement
  export function MenuItemButton(props: {
    readonly children: import('react').ReactNode
    readonly icon?: import('react').ReactNode | undefined
    readonly disabled?: boolean | undefined
    readonly danger?: boolean
    readonly current?: boolean | undefined
    readonly separatorBefore?: boolean | undefined
    readonly shortcut?: import('@deepseek-ai/dsh-client-shortcuts/client').ShortcutCatalogEntry | undefined
    readonly onSelect: () => void
  }): import('react').ReactElement
  export function Tooltip(props: {
    readonly portal?: boolean | undefined
    readonly label: string
    readonly shortcutKeys?: readonly string[] | undefined
    readonly side?: 'top' | 'bottom' | 'left' | 'right' | undefined
    readonly align?: 'center' | 'end' | undefined
    readonly delayMs?: number | undefined
    readonly disabled?: boolean | undefined
    readonly children: import('react').ReactElement
  }): import('react').ReactElement
  export interface RelativeTime { readonly unit: 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'; readonly n: number }
  export function relativeTime(at: number, now: number): RelativeTime
  export function writeClipboard(text: string): Promise<boolean>
  export function isDarwinDesktop(): boolean
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
    readonly pendingInteraction: { readonly kind?: string } | undefined
    readonly completionUnread: boolean
  }
  export type SessionStatusSnapshot = ReadonlyMap<SessionId, SessionStatus>
}

// ---------------------------------------------------------------------------
// Standalone adapters for the vendored sidebar + workspace browsing halves
// (copied from ui-sidebar / ui-workspace at dsh-v0.2.1-rc.5). The Harness
// compiler faces check the same call sites against the upstream packages'
// public declarations instead; these blocks only sketch the members the
// vendored sources touch.
// ---------------------------------------------------------------------------

declare module '@deepseek-ai/dsh-subagent/client' {
  import type { SessionId } from '@deepseek-ai/dsh-session/types'
  /** Direct-child address retained by the Session catalog. */
  export interface SubagentAddress {
    readonly parentSessionId: SessionId
    readonly childSessionId: SessionId
    readonly mode: 'one-shot' | 'continuable' | 'unknown'
  }
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
  import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId
  type SubagentAddress = import('@deepseek-ai/dsh-subagent/client').SubagentAddress

  export interface SessionRetainOptions { readonly source: string; readonly signal?: AbortSignal }
  export interface SessionBinding {
    readonly session: {
      readonly rename: (title: string) => Promise<RemoteResult<{ readonly title: string; readonly seq: number }>>
    }
  }
  export interface SessionReference {
    readonly sessionId: SessionId
    readonly ready: Promise<unknown>
    readonly binding: SessionBinding
    release(): void
  }
  export type SessionTarget = string | SubagentAddress
  export interface SessionSearchResultItem { readonly sessionId: SessionId; readonly snippet: string }
  export interface SessionRetainInfo { readonly sources: Readonly<Record<string, number>> }
  interface SessionRpcError { readonly code: string; readonly message: string; readonly details?: unknown }
  export class SessionForkError extends Error { readonly rpcError: SessionRpcError }
  export class SessionCreateError extends Error { readonly rpcError: SessionRpcError }
  export interface ISessions {
    readonly list: ObservableSnapshot<SessionListState>
    retain(target: SessionTarget, options: SessionRetainOptions): SessionReference
    using<T>(target: SessionTarget, options: SessionRetainOptions, operation: (reference: SessionReference) => T | Promise<T>): Promise<RemoteResult<T>>
    readonly searchResultLimit: number
    create(opts?: {
      readonly workspaceId?: string | undefined
      readonly cwd?: string | undefined
      readonly sessionId?: SessionId | undefined
      readonly agentPreset?: string | undefined
    }): Promise<SessionId>
    subagentAddress(id: SessionId): SubagentAddress | undefined
    refreshProjections(sessionId: SessionId): Promise<void>
    search(query: string, signal: AbortSignal): Promise<RemoteResult<{ readonly items: readonly SessionSearchResultItem[]; readonly hasMore: boolean }>>
    fork(opts: {
      readonly sessionId: SessionId
      readonly throughSeq?: number
      readonly increaseTitle?: boolean
      readonly onCreated?: (childId: SessionId) => void
      readonly allowMigration?: boolean
    }): Promise<SessionId>
    binding(sessionId: SessionId): SessionBinding | undefined
  }
}

declare module '@deepseek-ai/dsh-api-workspace-controller/client' {
  import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
  type SessionId = import('@deepseek-ai/dsh-session/types').SessionId
  export type WorkspaceId = string
  export interface SessionActivityItem { readonly id: string; readonly label?: string }
  export interface SessionActivity { readonly kind: string; readonly items?: readonly SessionActivityItem[] }
  interface WorkspaceRpcError {
    readonly code: string
    readonly message: string
    readonly details: { readonly activity?: readonly SessionActivity[] }
  }
  export class WorkspaceArchiveError extends Error { readonly rpcError: WorkspaceRpcError }
  export interface IWorkspaces {
    readonly list: ObservableSnapshot<WorkspaceSnapshot>
    create(input: { readonly path: string }): Promise<WorkspaceView>
    rename(workspaceId: WorkspaceId, title: string): Promise<void>
    delete(workspaceId: WorkspaceId): Promise<void>
    insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>
    pinSession(sessionId: SessionId): Promise<void>
    unpinSession(sessionId: SessionId): Promise<void>
    archiveSession(sessionId: SessionId, options?: { readonly stopActivity?: boolean }): Promise<void>
    unarchiveSession(sessionId: SessionId): Promise<void>
    initializeDefault(signal?: AbortSignal): Promise<WorkspaceView | undefined>
  }
}

declare module '@deepseek-ai/dsh-api-remotes/client' {
  import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
  export interface RemoteFailure { readonly code: string; readonly message: string; readonly details?: unknown }
  export interface RemoteHostFacts { readonly home?: string | undefined }
  export interface DirectoryEntry { readonly name: string; readonly kind: 'directory' | 'file' }
  export interface DirectoryListing { readonly path: string; readonly entries: readonly DirectoryEntry[] }
  export interface ClientRemote {
    readonly directoryPicker: {
      pick(): Promise<RemoteResult<string>>
      list(path?: string, signal?: AbortSignal): Promise<RemoteResult<DirectoryListing>>
      createDirectory(path: string, name: string): Promise<RemoteResult<string>>
    }
  }
}

declare module '@deepseek-ai/dsh-api-remote-access/client' {
  export type RemoteEndpoint = string
}

declare module '@deepseek-ai/dsh-client-shortcuts/client' {
  export type ShortcutCommandId = string
  interface ShortcutChord { readonly code: string; readonly modifiers: readonly ('primary' | 'alt' | 'shift')[] }
  export interface ShortcutCommand {
    readonly id: ShortcutCommandId
    readonly label: string | (() => string)
    readonly aliases: readonly string[]
    readonly defaults: Readonly<Record<string, ShortcutChord>>
    readonly regions: readonly string[]
    readonly modals: readonly string[]
    resolve(context: { readonly modal: string | null }): { readonly status: 'handled'; readonly run: () => void } | { readonly status: 'blocked'; readonly reason: string }
  }
  export interface ShortcutCatalogEntry { readonly id: string; readonly keys: readonly string[]; readonly aria?: string | undefined }
}

declare module '@deepseek-ai/dsh-client-ui-layout/client' {
  export type MainPanelId = string
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  export interface DraftInitializationOptions {
    readonly clearPreviousDraft?: boolean | undefined
    readonly agentPreset?: string | undefined
    readonly prompt?: string | undefined
    readonly whenDraftExists?: 'replace' | 'keep' | undefined
  }
}

declare module '@deepseek-ai/dsh-client-product-analytics/client' {
  export interface ProductEventMap { [event: string]: unknown }
}

declare module '@deepseek-ai/dsh-agent/types' {}
declare module '@deepseek-ai/dsh-jobs/view' {}
declare module '@deepseek-ai/dsh-schedule/client' {}
