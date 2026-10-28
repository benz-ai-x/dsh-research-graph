/**
 * Browser-local preference for the category browsing region: enabled shadows
 * the native Workspace browser in the sidebar's `sidebar.workspaces` hole;
 * disabled restores it. The category header and native-mode foot entry write;
 * the registration effect follows the store so reloads and live flips agree.
 */
const STORAGE_KEY = 'sessionGraph.categoryView'

function readStored(): boolean | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
    return undefined
  } catch {
    return undefined
  }
}

const listeners = new Set<() => void>()
let enabled = readStored() ?? true

function publish(): void {
  for (const listener of listeners) listener()
}

/** Read-only observable for the category-view preference. */
export const categoryViewPreference = {
  getSnapshot(): boolean {
    return enabled
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
}

/** Flip the preference; persistence failures keep the in-memory choice. */
export function setCategoryView(next: boolean): void {
  if (next === enabled) return
  enabled = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    // A blocked localStorage (private mode) still honors the live choice.
  }
  publish()
}
