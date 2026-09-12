// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InspectorFrame } from '../src/client/InspectorFrame.tsx'
import { zh, type SessionGraphKey } from '../src/client/locales.ts'
import { loadWorkingPosition, saveWorkingPosition } from '../src/client/working-position.ts'

const t = (key: SessionGraphKey, params?: Record<string, unknown>): string =>
  Object.entries(params ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), zh[key] as string)
const rect = (width: number): DOMRect => ({ width, height: 700, x: 0, y: 0, left: 0, right: width, top: 0, bottom: 700, toJSON: () => ({}) })
let available = 1400

beforeEach(() => {
  localStorage.clear()
  available = 1400
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.hasAttribute('data-reading-panel')) return rect(available)
    const preferred = parseFloat(this.style.getPropertyValue('--reading-width')) || 560
    const expanded = this.dataset.readingExpanded === 'true'
    return rect(Math.min(available - 32, expanded ? Math.max(880, preferred + 320) : preferred))
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function mount() {
  const onCanvas = vi.fn()
  const onClose = vi.fn()
  const view = render(<div onPointerDown={onCanvas} onPointerMove={onCanvas} onKeyDown={onCanvas}>
    <InspectorFrame label="会话详情" workingKey="resize-test" testId="reader" onClose={onClose} t={t}>
      <p>同一段研究内容</p>
    </InspectorFrame>
  </div>)
  return { ...view, onCanvas, onClose, handle: screen.getByRole('separator', { name: '调整阅读面板宽度' }) }
}

describe('reading panel resize', () => {
  it('widens from the left edge without moving the canvas or remounting the document, then restores on reopen', () => {
    const view = mount()
    const scroller = screen.getByTestId('reader-scroll')
    scroller.scrollTop = 320
    fireEvent.pointerDown(view.handle, { pointerId: 1, button: 0, clientX: 840 })
    fireEvent.pointerMove(view.handle, { pointerId: 2, clientX: 100 })
    expect(view.handle.getAttribute('aria-valuenow')).toBe('560')
    fireEvent.pointerMove(view.handle, { pointerId: 1, clientX: 600 })
    expect(view.handle.getAttribute('aria-valuenow')).toBe('800')
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBeUndefined()
    fireEvent.pointerUp(view.handle, { pointerId: 1, clientX: 600 })
    expect(loadWorkingPosition('resize-test')).toMatchObject({ inspectorWidth: 800, inspectorExpanded: false })
    expect(screen.getByTestId('reader-scroll')).toBe(scroller)
    expect(scroller.scrollTop).toBe(320)
    expect(document.activeElement).toBe(view.handle)
    expect(view.onCanvas).not.toHaveBeenCalled()
    view.unmount()
    mount()
    expect(screen.getByTestId('reader').getBoundingClientRect().width).toBe(800)
    fireEvent.click(screen.getByRole('button', { name: '展开阅读' }))
    expect(screen.getByTestId('reader').getBoundingClientRect().width).toBe(1120)
    fireEvent.click(screen.getByRole('button', { name: '收起阅读' }))
    expect(screen.getByTestId('reader').getBoundingClientRect().width).toBe(800)
  })

  it.each(['Escape', 'pointercancel', 'lostpointercapture'])('cancels a drag with %s without closing or overwriting the saved width', cancel => {
    saveWorkingPosition('resize-test', { inspectorWidth: 640, inspectorExpanded: true })
    const view = mount()
    fireEvent.pointerDown(view.handle, { pointerId: 1, button: 0, clientX: 440 })
    fireEvent.pointerMove(view.handle, { pointerId: 1, clientX: 600 })
    expect(screen.getByTestId('reader').dataset.readingExpanded).toBe('false')
    if (cancel === 'Escape') fireEvent.keyDown(view.handle, { key: 'Escape' })
    else if (cancel === 'pointercancel') fireEvent.pointerCancel(view.handle, { pointerId: 1 })
    else fireEvent.lostPointerCapture(view.handle, { pointerId: 1 })
    expect(screen.getByTestId('reader').dataset.readingExpanded).toBe('true')
    expect(screen.getByTestId('reader').getBoundingClientRect().width).toBe(960)
    expect(loadWorkingPosition('resize-test')).toMatchObject({ inspectorWidth: 640, inspectorExpanded: true })
    expect(view.onClose).not.toHaveBeenCalled()
    expect(view.onCanvas).not.toHaveBeenCalled()
  })

  it('bounds dragging and keyboard resizing to the available width and resets without leaving stale preferences', () => {
    const view = mount()
    fireEvent.pointerDown(view.handle, { pointerId: 1, button: 0, clientX: 840 })
    fireEvent.pointerMove(view.handle, { pointerId: 1, clientX: 2000 })
    expect(view.handle.getAttribute('aria-valuenow')).toBe('440')
    fireEvent.pointerMove(view.handle, { pointerId: 1, clientX: -2000 })
    expect(view.handle.getAttribute('aria-valuenow')).toBe('1368')
    fireEvent.pointerUp(view.handle, { pointerId: 1 })
    fireEvent.keyDown(view.handle, { key: 'Home' })
    fireEvent.keyDown(view.handle, { key: 'ArrowLeft' })
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBe(460)
    fireEvent.keyDown(view.handle, { key: 'ArrowRight', shiftKey: true })
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBe(440)
    available = 900
    fireEvent.keyDown(view.handle, { key: 'End' })
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBe(876)
    fireEvent.keyDown(view.handle, { key: 'Enter' })
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBeUndefined()
    fireEvent.keyDown(view.handle, { key: 'ArrowLeft' })
    fireEvent.doubleClick(view.handle)
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBeUndefined()
    expect(view.onCanvas).not.toHaveBeenCalled()
  })

  it('keeps live resizing usable with unavailable storage and ignores invalid saved widths', () => {
    localStorage.setItem('dsh.session-graph.position.resize-test', JSON.stringify({ v: 1, inspectorWidth: '960px' }))
    expect(loadWorkingPosition('resize-test').inspectorWidth).toBeUndefined()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied') })
    const view = mount()
    fireEvent.keyDown(view.handle, { key: 'ArrowLeft' })
    expect(view.handle.getAttribute('aria-valuenow')).toBe('580')
    expect(view.onClose).not.toHaveBeenCalled()
  })
})
