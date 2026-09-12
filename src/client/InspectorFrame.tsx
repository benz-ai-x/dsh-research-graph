import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { SessionGraphKey } from './locales.ts'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'
import styles from './GraphView.module.css'

/** A stable reading seat: identity and actions stay visible while the document scrolls. */
export function InspectorFrame({ label, title, meta, tabs, actions, children, onClose, closeLabel, workingKey, testId, t }: {
  readonly label: string
  readonly title?: ReactNode
  readonly meta?: ReactNode
  readonly tabs?: ReactNode
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly onClose: () => void
  readonly closeLabel?: string
  readonly workingKey?: string | undefined
  readonly testId?: string
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const [expanded, setExpanded] = useState(() => loadWorkingPosition(workingKey).inspectorExpanded ?? false)
  const [width, setWidth] = useState(() => loadWorkingPosition(workingKey).inspectorWidth)
  const panelRef = useRef<HTMLElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const [resizing, setResizing] = useState(false)
  const [size, setSize] = useState({ min: 440, max: 880, now: width ?? 560 })
  const drag = useRef<{ pointerId: number; x: number; start: number; width: number | undefined; expanded: boolean; next?: number } | null>(null)
  const measure = (): typeof size => {
    const available = panelRef.current?.parentElement?.getBoundingClientRect().width ?? 0
    const now = panelRef.current?.getBoundingClientRect().width ?? 0
    if (available <= 0 || now <= 0) return size
    const min = available > 1000 ? 440 : 380
    const max = Math.max(min, available - (available > 1000 ? 32 : 24))
    return { min, max: Math.round(max), now: Math.round(now) }
  }
  useLayoutEffect(() => {
    const update = (): void => {
      const next = measure()
      setSize(previous => previous.min === next.min && previous.max === next.max && previous.now === next.now ? previous : next)
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    if (panelRef.current) observer?.observe(panelRef.current)
    if (panelRef.current?.parentElement) observer?.observe(panelRef.current.parentElement)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  const resize = (next: number): number => {
    const bounds = measure()
    const clamped = Math.round(Math.max(bounds.min, Math.min(bounds.max, next)))
    setExpanded(false)
    setWidth(clamped)
    setSize({ ...bounds, now: clamped })
    return clamped
  }
  const finishDrag = (cancel: boolean): void => {
    const active = drag.current
    if (active === null) return
    drag.current = null
    setResizing(false)
    if (cancel) {
      setWidth(active.width)
      setExpanded(active.expanded)
      setSize(previous => ({ ...previous, now: active.start }))
    } else if (active.next !== undefined) {
      saveWorkingPosition(workingKey, { inspectorWidth: active.next, inspectorExpanded: false })
    }
    if (handleRef.current?.hasPointerCapture?.(active.pointerId)) handleRef.current.releasePointerCapture(active.pointerId)
  }
  const resetWidth = (): void => {
    setWidth(undefined)
    setExpanded(false)
    saveWorkingPosition(workingKey, { inspectorWidth: undefined, inspectorExpanded: false })
  }
  const toggle = (): void => {
    const next = !expanded
    setExpanded(next)
    saveWorkingPosition(workingKey, { inspectorExpanded: next })
  }
  return <aside ref={panelRef} id={panelId} className={`${styles.panel} ${styles.readingPanel}`} role="complementary" aria-label={label}
    style={{ '--reading-width': width === undefined ? undefined : `${width}px` } as CSSProperties}
    data-reading-resizing={resizing}
    data-reading-wide={size.now >= size.max - 300}
    data-canvas-overlay="" data-reading-panel="" data-reading-expanded={expanded} data-testid={testId}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        if (drag.current !== null) finishDrag(true)
        else if (expanded) toggle()
        else onClose()
      }
    }}>
    <div ref={handleRef} className={styles.readingResize} role="separator" tabIndex={0}
      aria-label={t('reading.resize')} aria-description={t('reading.resizeHint')} title={t('reading.resizeHint')}
      aria-controls={panelId} aria-orientation="vertical" aria-valuemin={size.min} aria-valuemax={size.max}
      aria-valuenow={size.now} aria-valuetext={t('reading.width', { width: size.now })}
      onPointerDown={event => {
        event.stopPropagation()
        if (event.button !== 0 || drag.current !== null) return
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { pointerId: event.pointerId, x: event.clientX, start: measure().now, width, expanded }
        setResizing(true)
      }}
      onPointerMove={event => {
        event.stopPropagation()
        const active = drag.current
        if (active?.pointerId !== event.pointerId || (active.x === event.clientX && active.next === undefined)) return
        active.next = resize(active.start + active.x - event.clientX)
      }}
      onPointerUp={event => { event.stopPropagation(); if (drag.current?.pointerId === event.pointerId) finishDrag(false) }}
      onPointerCancel={event => { event.stopPropagation(); if (drag.current?.pointerId === event.pointerId) finishDrag(true) }}
      onLostPointerCapture={() => finishDrag(true)}
      onDoubleClick={resetWidth}
      onKeyDown={event => {
        if (drag.current !== null) return
        if (event.key === 'Enter') { event.preventDefault(); resetWidth(); return }
        const bounds = measure()
        const step = event.shiftKey ? 80 : 20
        const next = event.key === 'ArrowLeft' ? bounds.now + step : event.key === 'ArrowRight' ? bounds.now - step
          : event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : undefined
        if (next === undefined) return
        event.preventDefault()
        saveWorkingPosition(workingKey, { inspectorWidth: resize(next), inspectorExpanded: false })
      }} />
    <header className={styles.readingPanelHeader}>
      <div className={styles.panelHeader}>
        <span className={styles.panelHeading}>{label}</span>
        <div className={styles.readingPanelTools}>
          <button type="button" aria-expanded={expanded} onClick={toggle}>{t(expanded ? 'reading.collapse' : 'reading.expand')}</button>
          <button type="button" className={styles.panelClose} aria-label={closeLabel ?? t('panel.close')} onClick={onClose}>×</button>
        </div>
      </div>
      {title === undefined ? null : <h2 className={styles.panelTitle}>{title}</h2>}
      {meta}
      {tabs}
    </header>
    <div className={styles.readingPanelBody} data-working-scroll="" data-testid={testId === undefined ? undefined : `${testId}-scroll`}>
      {children}
    </div>
    {actions === undefined ? null : <footer className={styles.readingPanelFooter}>{actions}</footer>}
  </aside>
}
