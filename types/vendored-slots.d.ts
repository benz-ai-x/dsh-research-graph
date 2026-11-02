/**
 * Module augmentations (this file is a module, so `declare module` augments
 * the real `@deepseek-ai/dsh-client-ui-slots` package instead of shadowing
 * it). Standalone adapters for the surfaces the vendored sidebar/workspace
 * halves consume; the Harness compiler faces check the same call sites
 * against the upstream packages' public declarations instead.
 */
export {}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** The sidebar shell seat this package's vendored half fills (owner: ui-layout). */
    'sidebar': {
      kind: 'single'
      scope: 'root'
      owner: {
        readonly collapsed: boolean
        readonly width: number
        readonly expandSidebar: () => void
        readonly usePanelInfo: <T>(selector: (info: { readonly activePanelId: string | null }) => T) => T
      }
    }
    /** Window-chrome controls shown while macOS desktop hides the column (owner: ui-layout). */
    'shell.leading': { kind: 'single'; scope: 'root'; owner: Record<never, never> }
    /** Frame-wide overlay surfaces (dialogs, notices; owner: ui-layout). */
    'shell.overlay': { kind: 'list'; scope: 'root'; owner: Record<never, never> }
    /** Conversation-hero Workspace picker (owner: ui-conversation). */
    'conversation.hero.workspace': {
      kind: 'single'
      scope: 'root'
      owner: {
        readonly open: boolean
        readonly anchorRef?: import('react').RefObject<HTMLElement | null> | undefined
        readonly selectedId: string | undefined
        readonly onPick: (workspaceId: string) => void
        readonly onClose: () => void
      }
    }
  }

  interface GlobalStandardProps {
    /** Selector hook over the active panel state (declared by ui-layout). */
    usePanelInfo: <T>(selector: (info: { readonly activePanelId: string | null }) => T) => T
    /** Selector hook over the Session catalog (declared by ui-session). */
    useSessions: <T>(selector: (state: import('@deepseek-ai/dsh-api-session-controller/client').SessionListState) => T) => T
    /** Selector hook over the unified Session status map (declared by ui-session). */
    useSessionStatus: <T>(selector: (state: import('@deepseek-ai/dsh-client-ui-session/client').SessionStatusSnapshot) => T) => T
    /** Whether the current Peer may call one Session-scoped remote action (declared by ui-session). */
    useSessionAccess: (sessionId: string, action?: string) => boolean
  }

  interface LocaleNamespaceMap {
    /** Shared vocabulary owned by the locale plugin (subset the vendored halves read). */
    common: 'cancel' | 'close' | 'copy' | 'delete' | 'edit' | 'save' | 'search' | 'more'
      | 'collapse' | 'expand' | 'back' | 'skip' | 'unknown' | 'none' | 'truncated'
      | 'brand.localBuild' | 'workspace.defaultName' | 'json.label' | 'markdown.footnotes'
      | 'markdown.truncatedCharacters' | 'number.thousand' | 'number.million'
      | 'copy.failed' | 'copy.value' | 'copy.json' | 'copy.path' | 'copy.prettyJson'
      | 'copy.compactJson' | 'copy.optionsHint'
  }
}
