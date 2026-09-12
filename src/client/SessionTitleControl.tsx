import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SESSION_TITLE_MAX_LENGTH, sessionTitleOutputSchema } from '../session-title.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

/** The suggestion stays editable; only Apply invokes the addressed native rename. */
export function SessionTitleControl({ sessionId, title, generate, rename, t }: {
  readonly sessionId: SessionId
  readonly title: string
  readonly generate: GraphViewInjected['generateSessionTitle']
  readonly rename: GraphViewInjected['renameSessionTitle']
  readonly t: (key: SessionGraphKey) => string
}): ReactElement {
  const [draft, setDraft] = useState<string>()
  const [baseTitle, setBaseTitle] = useState(title)
  const [busy, setBusy] = useState<'generate' | 'save'>()
  const [error, setError] = useState<SessionGraphKey>()
  const [saved, setSaved] = useState(false)
  const active = useRef<AbortController>()
  const alive = useRef(true)
  const attempted = useRef<string>()
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const focusTarget = useRef<'trigger' | 'input'>()
  const stale = draft !== undefined && baseTitle !== title
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort() } }, [])
  useEffect(() => {
    if (busy !== undefined || !focusTarget.current) return
    const element = focusTarget.current === 'input' ? input.current : trigger.current
    element?.focus({ preventScroll: true })
    focusTarget.current = undefined
  }, [busy, draft])
  useEffect(() => {
    // A lost rename reply can still be confirmed by the authoritative Session feed.
    if (busy === undefined && error === 'title.saveError' && attempted.current === title) {
      focusTarget.current = 'trigger'
      setDraft(undefined)
      setError(undefined)
      setSaved(true)
    }
  }, [busy, error, title])

  const suggest = async (): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    attempted.current = undefined
    setBusy('generate')
    setError(undefined)
    setSaved(false)
    try {
      const result = await generate(sessionId, controller.signal)
      if (controller.signal.aborted) return
      if (result.kind === 'empty') { setError('title.empty'); return }
      if (result.sessionId !== sessionId) throw new Error('Unexpected title target')
      focusTarget.current = 'input'
      setDraft(result.title)
      setBaseTitle(title)
    } catch (failure) {
      if (controller.signal.aborted) return
      const code = (failure as { code?: unknown } | null)?.code
      setError(code === 'model-route-unavailable' ? 'title.errorRoute'
        : code === 'output-limit' ? 'title.errorLimit' : 'title.error')
    } finally {
      if (active.current === controller && !controller.signal.aborted) setBusy(undefined)
    }
  }
  const cancel = (): void => {
    active.current?.abort()
    attempted.current = undefined
    focusTarget.current = 'trigger'
    setBusy(undefined)
    setError(undefined)
    setDraft(undefined)
  }
  const apply = async (): Promise<void> => {
    if (draft === undefined || busy || stale) return
    const checked = sessionTitleOutputSchema.safeParse({ title: draft })
    if (!checked.success || checked.data.title === title) return
    setBusy('save')
    setError(undefined)
    attempted.current = checked.data.title
    try {
      await rename(sessionId, checked.data.title, baseTitle)
      if (!alive.current) return
      focusTarget.current = 'trigger'
      setDraft(undefined)
      setSaved(true)
    } catch (failure) {
      if (alive.current) setError((failure as { code?: unknown } | null)?.code === 'title-changed' ? 'title.changed' : 'title.saveError')
    } finally { if (alive.current) setBusy(undefined) }
  }

  return <div className={styles.sessionTitleControl} data-editing={draft !== undefined}
    onKeyDown={event => {
      if (event.key === 'Escape' && (draft !== undefined || busy)) {
        event.preventDefault()
        event.stopPropagation()
        if (busy !== 'save') cancel()
      }
    }}>
    <div className={styles.titleControlActions}>
      <button type="button" ref={trigger} className={styles.titleGenerate} disabled={busy !== undefined}
        onClick={() => { void suggest() }}>
        {t(busy === 'generate' ? 'title.generating' : draft === undefined ? 'title.generate' : 'title.regenerate')}
      </button>
      {busy === 'generate' ? <button type="button" className={styles.titleGenerate} onClick={cancel}>{t('title.cancel')}</button> : null}
      {saved ? <span role="status">{t('title.saved')}</span> : null}
    </div>
    {draft === undefined ? null : <form className={styles.titleSuggestion} aria-label={t('title.review')} onSubmit={event => { event.preventDefault(); void apply() }}>
      <label><span>{t('title.review')}</span><input ref={input} value={draft} maxLength={SESSION_TITLE_MAX_LENGTH} disabled={busy !== undefined}
        onChange={event => { setDraft(event.target.value); setError(undefined) }} /></label>
      <div className={styles.titleSuggestionActions}><span>{t('title.hint')}</span>
        <button type="button" className={styles.digestAction} disabled={busy !== undefined} onClick={cancel}>{t('title.cancel')}</button>
        <button type="submit" className={styles.primaryButton} disabled={busy !== undefined || stale || draft.trim() === title || !sessionTitleOutputSchema.safeParse({ title: draft }).success}>
          {t(busy === 'save' ? 'title.saving' : 'title.apply')}
        </button>
      </div>
    </form>}
    {stale ? <p role="status" className={styles.titleNotice}>{t('title.changed')}</p> : null}
    {error ? <p role="alert" className={styles.titleNotice}>{t(error)}</p> : null}
  </div>
}
