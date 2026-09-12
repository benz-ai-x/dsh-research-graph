import { useId, useLayoutEffect, useRef, useState, type ClassAttributes, type CSSProperties, type HTMLAttributes, type RefObject } from 'react'
import type { SessionGraphKey } from './locales.ts'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

type Size = { readonly width: number; readonly height: number }
type Mode = 'wide' | 'compact' | 'overlay'
type Translate = (key: SessionGraphKey, params?: Record<string, unknown>) => string

/** One responsive policy supplies both the rendered panel and its geometry consumers. */
export function readingLayout(containerWidth: number): {
  readonly mode: Mode
  readonly minimum: number
  readonly margin: number
  readonly defaultWidth: string
  readonly expandedWidth: string
} {
  if (containerWidth <= 760) return { mode: 'overlay', minimum: 0, margin: 16, defaultWidth: 'auto', expandedWidth: 'auto' }
  if (containerWidth <= 1000) return { mode: 'compact', minimum: 380, margin: 24,
    defaultWidth: 'min(500px, 56%)', expandedWidth: 'calc(100% - 24px)' }
  return { mode: 'wide', minimum: 440, margin: 32, defaultWidth: 'min(560px, 48%)',
    expandedWidth: 'min(max(880px, calc(var(--reading-width, 560px) + 320px)), calc(100% - 32px))' }
}

function containerWidth(surface: HTMLElement): number {
  return (surface.closest<HTMLElement>('[data-research-root]') ?? surface).getBoundingClientRect().width
}

function panelRoom(panel: HTMLElement): (ReturnType<typeof readingLayout> & { readonly min: number; readonly max: number; readonly now: number }) | undefined {
  const surface = panel.parentElement
  if (surface === null) return undefined
  const available = surface.getBoundingClientRect().width
  const now = panel.getBoundingClientRect().width
  if (available <= 0 || now <= 0) return undefined
  const layout = readingLayout(containerWidth(surface))
  const max = Math.max(0, Math.round(available - layout.margin))
  return { ...layout, min: Math.min(layout.minimum, max), max, now: Math.round(now) }
}

/** Observe mount/replacement as well as real sizes; zero-size policy belongs to the consumer. */
function observeRoom(surface: HTMLElement, notify: () => void): () => void {
  const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(notify)
  const root = surface.closest<HTMLElement>('[data-research-root]')
  let reader: HTMLElement | null = null
  resize?.observe(surface)
  if (root && root !== surface) resize?.observe(root)
  const update = (): void => {
    const next = surface.querySelector<HTMLElement>('[data-reading-panel]')
    if (next !== reader) {
      if (reader) resize?.unobserve(reader)
      reader = next
      if (reader) resize?.observe(reader)
    }
    notify()
  }
  const mutation = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update)
  mutation?.observe(surface, { childList: true, subtree: true, ...(resize ? {} : { attributes: true, attributeFilter: ['style', 'data-reading-expanded', 'data-reading-mode'] }) })
  window.addEventListener('resize', update)
  update()
  return () => { resize?.disconnect(); mutation?.disconnect(); window.removeEventListener('resize', update) }
}

interface ReadingPanelGeometry {
  readonly panel: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & {
    readonly 'data-reading-mode': Mode
    readonly 'data-reading-expanded': boolean
    readonly 'data-reading-resizing': boolean
    readonly 'data-reading-wide': boolean
  }
  readonly handle: ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>
  readonly expanded: boolean
  readonly toggle: () => void
}

/** Owns width preferences, transient gestures and live constraints without remounting the reader. */
export function useReadingPanelGeometry(workingKey: string | undefined, onClose: () => void, t: Translate): ReadingPanelGeometry {
  const [expanded, setExpanded] = useState(() => loadWorkingPosition(workingKey).inspectorExpanded ?? false)
  const [width, setWidth] = useState(() => loadWorkingPosition(workingKey).inspectorWidth)
  const panel = useRef<HTMLElement>(null)
  const handle = useRef<HTMLDivElement>(null)
  const id = useId()
  const [resizing, setResizing] = useState(false)
  const [room, setRoom] = useState({ ...readingLayout(1400), min: 440, max: 1368, now: width ?? 560 })
  const drag = useRef<{ pointerId: number; x: number; start: number; width: number | undefined; expanded: boolean; next?: number } | null>(null)
  const measure = (): ReturnType<typeof panelRoom> => panel.current === null ? undefined : panelRoom(panel.current)
  const update = (): void => {
    const next = measure()
    if (!next) return
    if (next.mode === 'overlay') finish(true)
    setRoom(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
  }
  useLayoutEffect(() => {
    const surface = panel.current?.parentElement
    if (surface) return observeRoom(surface, update)
  }, [])
  useLayoutEffect(update, [expanded, width])
  const resize = (next: number): number | undefined => {
    const bounds = measure()
    if (!bounds || bounds.mode === 'overlay') return undefined
    const clamped = Math.round(Math.max(bounds.min, Math.min(bounds.max, next)))
    setExpanded(false)
    setWidth(clamped)
    setRoom({ ...bounds, now: clamped })
    return clamped
  }
  const finish = (cancel: boolean): void => {
    const active = drag.current
    if (active === null) return
    drag.current = null
    setResizing(false)
    if (cancel) {
      setWidth(active.width)
      setExpanded(active.expanded)
    } else if (active.next !== undefined) {
      saveWorkingPosition(workingKey, { inspectorWidth: active.next, inspectorExpanded: false })
    }
    if (handle.current?.hasPointerCapture?.(active.pointerId)) handle.current.releasePointerCapture(active.pointerId)
  }
  const reset = (): void => {
    setWidth(undefined)
    setExpanded(false)
    saveWorkingPosition(workingKey, { inspectorWidth: undefined, inspectorExpanded: false })
  }
  const toggle = (): void => {
    setExpanded(!expanded)
    saveWorkingPosition(workingKey, { inspectorExpanded: !expanded })
  }
  return {
    expanded, toggle,
    panel: {
      ref: panel, id,
      style: { '--reading-width': width === undefined ? undefined : `${width}px`,
        '--reading-min-width': `${room.min}px`, '--reading-max-width': `${room.max}px`,
        '--reading-default-width': room.defaultWidth, '--reading-expanded-width': room.expandedWidth } as CSSProperties,
      'data-reading-mode': room.mode, 'data-reading-expanded': expanded,
      'data-reading-resizing': resizing, 'data-reading-wide': room.now >= room.max - 300,
      onKeyDown: event => {
        event.stopPropagation()
        if (event.key !== 'Escape') return
        event.preventDefault()
        if (drag.current !== null) finish(true)
        else if (expanded) toggle()
        else onClose()
      },
    },
    handle: {
      ref: handle, role: 'separator', tabIndex: room.mode === 'overlay' ? -1 : 0,
      'aria-label': t('reading.resize'), 'aria-description': t('reading.resizeHint'), title: t('reading.resizeHint'),
      'aria-controls': id, 'aria-orientation': 'vertical', 'aria-valuemin': room.min, 'aria-valuemax': room.max,
      'aria-valuenow': room.now, 'aria-valuetext': t('reading.width', { width: room.now }),
      onPointerDown: event => {
        event.stopPropagation()
        const bounds = measure()
        if (event.button !== 0 || drag.current !== null || !bounds || bounds.mode === 'overlay') return
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { pointerId: event.pointerId, x: event.clientX, start: bounds.now, width, expanded }
        setResizing(true)
      },
      onPointerMove: event => {
        event.stopPropagation()
        const active = drag.current
        if (active?.pointerId !== event.pointerId || (active.x === event.clientX && active.next === undefined)) return
        const next = resize(active.start + active.x - event.clientX)
        if (next !== undefined) active.next = next
        else finish(true)
      },
      onPointerUp: event => { event.stopPropagation(); if (drag.current?.pointerId === event.pointerId) finish(false) },
      onPointerCancel: event => { event.stopPropagation(); if (drag.current?.pointerId === event.pointerId) finish(true) },
      onLostPointerCapture: () => { finish(true) },
      onDoubleClick: reset,
      onKeyDown: event => {
        if (drag.current !== null) return
        const bounds = measure()
        if (!bounds || bounds.mode === 'overlay') return
        if (event.key === 'Enter') { event.preventDefault(); reset(); return }
        const step = event.shiftKey ? 80 : 20
        const next = event.key === 'ArrowLeft' ? bounds.now + step : event.key === 'ArrowRight' ? bounds.now - step
          : event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : undefined
        if (next === undefined) return
        event.preventDefault()
        const value = resize(next)
        if (value !== undefined) saveWorkingPosition(workingKey, { inspectorWidth: value, inspectorExpanded: false })
      },
    },
  }
}

export interface CanvasGeometry {
  readonly surface: Size
  readonly command: Size
  readonly previewRight: number
  readonly readerOpen: boolean
}

function measureCanvas(surface: HTMLElement | null): CanvasGeometry | undefined {
  if (surface === null) return undefined
  const { width, height } = surface.getBoundingClientRect()
  if (width <= 0 || height <= 0) return undefined
  const reader = surface.querySelector<HTMLElement>('[data-reading-panel]')
  const readerWidth = reader?.getBoundingClientRect().width ?? 0
  const right = readerWidth > 0 ? readerWidth + 24 : 0
  const overlay = readingLayout(containerWidth(surface)).mode === 'overlay'
  return { surface: { width, height }, command: { width: overlay ? width : Math.max(240, width - right), height },
    previewRight: right || 12, readerOpen: readerWidth > 0 }
}

/** Live commands bypass observer latency; snapshots notify only real surface resizes. */
export function useCanvasGeometry(surface: RefObject<HTMLElement>, onResize: (previous: Size, next: Size) => void): {
  readonly room: CanvasGeometry
  readonly read: () => CanvasGeometry | undefined
} {
  const [room, setRoom] = useState<CanvasGeometry>({ surface: { width: 0, height: 0 }, command: { width: 0, height: 0 }, previewRight: 12, readerOpen: false })
  const previous = useRef(room)
  const resize = useRef(onResize)
  resize.current = onResize
  useLayoutEffect(() => {
    if (surface.current === null) return
    return observeRoom(surface.current, () => {
      const next = measureCanvas(surface.current)
      if (!next || JSON.stringify(previous.current) === JSON.stringify(next)) return
      const last = previous.current.surface
      previous.current = next
      setRoom(next)
      if (last.width > 0 && last.height > 0 && (last.width !== next.surface.width || last.height !== next.surface.height)) resize.current(last, next.surface)
    })
  }, [surface])
  return { room, read: () => measureCanvas(surface.current) }
}
