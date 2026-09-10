import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { SessionGraphKey } from './locales.ts'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'

interface DraftState { readonly dirty: boolean; readonly busy: boolean }
interface DraftProtection {
  readonly register: (id: string, state: DraftState | undefined) => void
  readonly request: (action: () => void, id?: string) => void
}
const DraftContext = createContext<DraftProtection | undefined>(undefined)

/** Protect the mounted draft, including every unsaved card in an extraction batch. */
export function DraftGuard({ children, close, t }: {
  readonly children: (requestClose: () => void) => ReactNode
  readonly close: () => void
  readonly t: (key: SessionGraphKey) => string
}): ReactElement {
  const descriptionId = useId()
  const drafts = useRef(new Map<string, DraftState>())
  const [pending, setPending] = useState<{ readonly action: () => void; readonly trigger: HTMLElement | null }>()
  const [waiting, setWaiting] = useState(false)
  const keepButton = useRef<HTMLButtonElement>(null)
  const register = useCallback((id: string, state: DraftState | undefined): void => {
    if (state === undefined) drafts.current.delete(id)
    else {
      drafts.current.set(id, state)
      if (![...drafts.current.values()].some(draft => draft.busy)) setWaiting(false)
    }
  }, [])
  const request = useCallback((action: () => void, id?: string): void => {
    const states = id === undefined ? [...drafts.current.values()] : [drafts.current.get(id)]
    if (states.some(state => state?.busy)) { setWaiting(true); return }
    setWaiting(false)
    if (!states.some(state => state?.dirty)) { action(); return }
    setPending({ action, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null })
  }, [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (![...drafts.current.values()].some(state => state.dirty || state.busy)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn) }
  }, [])
  useEffect(() => { if (pending !== undefined) keepButton.current?.focus() }, [pending])
  const keep = (): void => {
    const trigger = pending?.trigger
    setPending(undefined)
    queueMicrotask(() => { trigger?.focus() })
  }
  return <DraftContext.Provider value={{ register, request }}>
    <div className={styles.draftContent} aria-hidden={pending !== undefined || undefined}
      ref={element => { if (element !== null) element.inert = pending !== undefined }}>
      {children(() => { request(close) })}
      {waiting ? <p className={styles.draftNotice} role="status">{t('knowledge.waitForSave')}</p> : null}
    </div>
    {pending === undefined ? null : <div className={styles.discardOverlay}>
      <section role="alertdialog" aria-modal="true" aria-label={t('knowledge.unsavedTitle')}
        aria-describedby={descriptionId} className={styles.discardDialog} onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); keep() }
          retainDialogFocus(event)
          event.stopPropagation()
        }}>
        <h3>{t('knowledge.unsavedTitle')}</h3><p id={descriptionId}>{t('knowledge.unsavedHint')}</p>
        <div className={styles.topicControls}>
          <button className={styles.primaryButton} type="button" ref={keepButton} onClick={keep}>{t('knowledge.keepEditing')}</button>
          <button className={styles.dangerButton} type="button" onClick={() => { const action = pending.action; setPending(undefined); action() }}>{t('knowledge.discard')}</button>
        </div>
      </section>
    </div>}
  </DraftContext.Provider>
}

export function useDraftProtection(dirty: boolean, busy: boolean): (action: () => void) => void {
  const protection = useContext(DraftContext)
  const id = useId()
  const register = protection?.register
  useLayoutEffect(() => {
    register?.(id, { dirty, busy })
    return () => { register?.(id, undefined) }
  }, [register, id, dirty, busy])
  return action => { if (protection === undefined) action(); else protection.request(action, id) }
}
