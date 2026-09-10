import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { KnowledgeExportResult } from '../knowledge-export.ts'
import type { KnowledgeApi } from './knowledge-remote.ts'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

export interface ExportChoice { readonly cardId: string; readonly title: string }

/** Holds the exact preview bytes independently of subsequent card changes. */
export function KnowledgeExport({ cards, api, t }: {
  readonly cards: readonly ExportChoice[]
  readonly api: KnowledgeApi
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const [selected, setSelected] = useState(() => cards.map(card => card.cardId))
  const [preview, setPreview] = useState<KnowledgeExportResult>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const active = useRef<AbortController>()
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => () => {
    active.current?.abort()
    for (const [url, timer] of urls.current) { clearTimeout(timer); URL.revokeObjectURL(url) }
    urls.current.clear()
  }, [])
  const prepare = async (): Promise<void> => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError(undefined)
    try {
      const value = await api.prepareExport({ cardIds: selected }, controller.signal)
      if (!controller.signal.aborted) setPreview(value)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : t('export.error'))
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  const download = (): void => {
    if (preview === undefined) return
    setError(undefined)
    let link: HTMLAnchorElement | undefined
    try {
      const url = URL.createObjectURL(new Blob([preview.markdown], { type: 'text/markdown;charset=utf-8' }))
      urls.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 1_000))
      link = document.createElement('a')
      link.href = url
      link.download = preview.filename
      document.body.append(link)
      link.click()
    } catch (error) { setError(error instanceof Error ? error.message : t('export.error')) } finally { link?.remove() }
  }
  return <div className={styles.knowledgeBody}>
    <p>{t('export.hint')}</p>
    <fieldset disabled={busy} className={styles.exportChoices}><legend>{t('export.choose')}</legend>
      {cards.map(card => <label key={card.cardId}><input type="checkbox" checked={selected.includes(card.cardId)} onChange={event => {
        setSelected(current => event.target.checked ? cards.filter(item => item.cardId === card.cardId || current.includes(item.cardId)).map(item => item.cardId) : current.filter(id => id !== card.cardId))
        setPreview(undefined)
        setError(undefined)
      }} />{card.title}</label>)}
    </fieldset>
    <div className={styles.topicControls}>
      <button type="button" disabled={busy || selected.length === 0 || selected.length > 50} onClick={() => { void prepare() }}>{t('export.preview')}</button>
      <button type="button" disabled={busy || preview === undefined} onClick={download}>{t('export.download')}</button>
      {busy ? <><span role="status">{t('export.loading')}</span><button type="button" onClick={() => {
        active.current?.abort()
        setBusy(false)
      }}>{t('topic.cancel')}</button></> : null}
    </div>
    {error === undefined ? null : <div role="alert"><p>{t('export.error')}</p><p>{error}</p></div>}
    {preview === undefined ? null : <>
      <p>{preview.filename} · {t('export.frozen')}</p>
      <ul>{preview.cards.map(card => <li key={card.cardId}>{card.title} · {t('knowledge.versionNumber', { number: card.number })}</li>)}</ul>
      <label>{t('export.markdown')}<textarea className={styles.exportPreview} readOnly value={preview.markdown} rows={22} /></label>
    </>}
  </div>
}
