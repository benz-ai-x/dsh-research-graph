// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionTitleControl } from '../src/client/SessionTitleControl.tsx'
import type { GraphViewInjected } from '../src/client/GraphView.tsx'
import { zh, type SessionGraphKey } from '../src/client/locales.ts'

afterEach(cleanup)
const t = (key: SessionGraphKey): string => zh[key]
const result = { kind: 'ready' as const, sessionId: 'selected', title: '缓存策略与权限一致性', sourceTitle: '旧标题', sourceRevision: '5' }
function fixture() {
  const generate = vi.fn<GraphViewInjected['generateSessionTitle']>(async () => result)
  const rename = vi.fn<GraphViewInjected['renameSessionTitle']>(async (_id, title) => title)
  const view = (title = '旧标题') => <SessionTitleControl sessionId={'selected' as SessionId} title={title} generate={generate} rename={rename} t={t} />
  return { generate, rename, view }
}

describe('review and apply a Session title', () => {
  it('keeps generation read-only, allows editing and applies exactly the chosen title', async () => {
    const b = fixture()
    render(b.view())
    expect(b.generate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    const input = await screen.findByRole('textbox', { name: '建议标题' })
    expect(b.rename).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(input))
    fireEvent.change(input, { target: { value: '权限缓存的失效策略' } })
    fireEvent.click(screen.getByRole('button', { name: '应用标题' }))
    await screen.findByText('标题已更新')
    expect(b.rename).toHaveBeenCalledExactlyOnceWith('selected', '权限缓存的失效策略', '旧标题')
  })

  it('keeps edits on save failure and permits a retry without generating again', async () => {
    const b = fixture()
    b.rename.mockRejectedValueOnce(new Error('Disconnected'))
    render(b.view())
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    const input = await screen.findByRole('textbox', { name: '建议标题' })
    fireEvent.change(input, { target: { value: '保留用户编辑' } })
    fireEvent.click(screen.getByRole('button', { name: '应用标题' }))
    await screen.findByRole('alert')
    expect((input as HTMLInputElement).value).toBe('保留用户编辑')
    fireEvent.click(screen.getByRole('button', { name: '应用标题' }))
    await screen.findByText('标题已更新')
    expect(b.generate).toHaveBeenCalledTimes(1)
    expect(b.rename.mock.calls[1]).toEqual(b.rename.mock.calls[0])
  })

  it.each(['cancel', 'unmount'] as const)('ignores late generation after %s and never renames', async action => {
    const b = fixture()
    const pending = Promise.withResolvers<typeof result>()
    b.generate.mockReturnValueOnce(pending.promise)
    const ui = render(b.view())
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: '取消' }))
    else ui.unmount()
    expect(b.generate.mock.calls[0]?.[1].aborted).toBe(true)
    await act(async () => { pending.resolve(result); await pending.promise })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(b.rename).not.toHaveBeenCalled()
  })

  it('does not overwrite a title changed elsewhere while the suggestion is under review', async () => {
    const b = fixture()
    const ui = render(b.view())
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    await screen.findByRole('textbox')
    ui.rerender(b.view('另一处修改的标题'))
    expect((screen.getByRole('button', { name: '应用标题' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('其他位置更新')
    expect(b.rename).not.toHaveBeenCalled()
  })

  it('recognizes an applied title from the Session feed after a lost rename reply', async () => {
    const b = fixture()
    b.rename.mockRejectedValueOnce(new Error('Reply lost'))
    const ui = render(b.view())
    fireEvent.click(screen.getByRole('button', { name: '生成标题' }))
    await screen.findByRole('textbox')
    fireEvent.click(screen.getByRole('button', { name: '应用标题' }))
    await screen.findByRole('alert')
    ui.rerender(b.view(result.title))
    await screen.findByText('标题已更新')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(b.rename).toHaveBeenCalledTimes(1)
  })
})
