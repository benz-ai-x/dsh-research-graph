// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SessionBackupAction, type SessionBackupActionProps, type SessionBackupInjected, type SessionBackupOutcome } from '../src/client/SessionBackup.tsx'
import { sessionBackupZh, type SessionBackupKey } from '../src/client/session-backup-locales.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const icon = () => <span aria-hidden="true" />
  return {
    Button: ({ children, disabled, onClick }) => <button type="button" disabled={disabled} onClick={onClick}>{children}</button>,
    IconChevronDownOutlineRegular: icon,
    IconFolderCloseRegular: icon,
    IconUploadOutlineMedium: icon,
    IconUploadOutlineRegular: icon,
    Modal: ({ open, title, description, footer, children }) => open ? <div role="dialog">{title}{description}{children}{footer}</div> : null,
    Tooltip: ({ children }) => <>{children}</>,
    fileSizeText: (bytes: number) => `${bytes} B`,
  }
}, { virtual: true })

const ROOT = SessionId('session-11111111-1111-4111-8111-111111111111')

function t(key: SessionBackupKey, params: Record<string, unknown> = {}): string {
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), sessionBackupZh[key] as string)
}

function mount(
  importArchive: SessionBackupInjected['importArchive'],
  wide = true,
  renderFactorySlot: SessionBackupActionProps['renderFactorySlot'] = () => null,
) {
  const openSession = vi.fn()
  const props = {
    wide,
    useRemoteAccess: () => true,
    useSessions: selector => selector({ byId: { current: { id: 'current', retainedBy: { mainView: 1 } } } }),
    useWorkspaces: selector => selector({ items: [
      { workspaceId: 'w1' as WorkspaceId, title: '研究', path: '/research', sessionIds: ['current'] },
      { workspaceId: 'w2' as WorkspaceId, title: '恢复目标', path: '/restore', sessionIds: [] },
    ] }),
    renderFactorySlot,
    importArchive,
    openSession,
    t,
    children: <span>新会话</span>,
  } as unknown as SessionBackupActionProps
  render(<SessionBackupAction {...props} />)
  return { openSession }
}

function chooseFile(): void {
  fireEvent.click(screen.getByRole('button', { name: '恢复会话备份' }))
  fireEvent.change(screen.getByLabelText('备份文件'), { target: { files: [new File(['zip'], 'backup.zip', { type: 'application/zip' })] } })
}

afterEach(() => { cleanup() })

describe('Session Backup restore dialog', () => {
  it('uploads into the selected Workspace and opens the restored root explicitly', async () => {
    const importArchive: SessionBackupInjected['importArchive'] = vi.fn(async (_file, _workspace, onProgress) => {
      onProgress({ phase: 'reading' })
      onProgress({ phase: 'writing', done: 1, total: 1 })
      return { ok: true, result: {
        rootSessionId: ROOT, importedSessionIds: [ROOT], existingSessionIds: [], attachmentCount: 0, partial: false,
      } }
    })
    const { openSession } = mount(importArchive)
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: '开始恢复' }))
    await screen.findByText('已恢复 1 个 Session 到“研究”，包含 0 个附件。')
    expect(importArchive).toHaveBeenCalledWith(expect.any(File), 'w1', expect.any(Function), expect.any(AbortSignal))
    expect(screen.queryByText('新会话')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '打开已恢复会话' }))
    expect(openSession).toHaveBeenCalledWith(ROOT)
  })

  it('shows a conflict without claiming success', async () => {
    const importArchive: SessionBackupInjected['importArchive'] = async () => ({
      ok: false, reason: 'session-conflict', message: 'different stored content',
    })
    mount(importArchive)
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: '开始恢复' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('为避免覆盖') })
  })

  it('cancels the active upload when the dialog closes', async () => {
    let signal: AbortSignal | undefined
    const importArchive: SessionBackupInjected['importArchive'] = (_file, _workspace, _progress, requestSignal) => {
      signal = requestSignal
      return new Promise(() => {})
    }
    mount(importArchive)
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: '开始恢复' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(signal?.aborted).toBe(true)
  })

  it('selects a different Workspace through the picker factory', async () => {
    const importArchive: SessionBackupInjected['importArchive'] = vi.fn(async () => ({ ok: true, result: {
      rootSessionId: ROOT, importedSessionIds: [ROOT], existingSessionIds: [], attachmentCount: 0, partial: false,
    } }))
    const factory: SessionBackupActionProps['renderFactorySlot'] = (_name, props) => (
      <button type="button" onClick={() => { props.onPick('w2') }}>选择恢复目标</button>
    )
    mount(importArchive, true, factory)
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: '选择恢复目标' }))
    fireEvent.click(screen.getByRole('button', { name: '开始恢复' }))
    await screen.findByText('已恢复 1 个 Session 到“恢复目标”，包含 0 个附件。')
    expect(importArchive).toHaveBeenCalledWith(expect.any(File), 'w2', expect.any(Function), expect.any(AbortSignal))
  })

  it('renders write progress and a partial result with the failed Session id', async () => {
    let finish: ((outcome: SessionBackupOutcome) => void) | undefined
    const importArchive: SessionBackupInjected['importArchive'] = (_file, _workspace, onProgress) => {
      onProgress({ phase: 'writing', done: 1, total: 2 })
      return new Promise(resolve => { finish = resolve })
    }
    mount(importArchive)
    chooseFile()
    fireEvent.click(screen.getByRole('button', { name: '开始恢复' }))
    await screen.findByText('正在恢复 1/2')
    finish?.({
      ok: true,
      result: {
        rootSessionId: ROOT, importedSessionIds: [ROOT], existingSessionIds: [], attachmentCount: 1,
        partial: true, failedSessionId: 'session-child', error: 'restore cancelled',
      },
    })
    await screen.findByText(/仅部分恢复成功：restore cancelled。已完成的 Session 已保留，请修复问题后重试。/)
    await screen.findByText(/失败位置：session-child。/)
  })

  it('opens the restore dialog from the collapsed sidebar action', () => {
    const importArchive: SessionBackupInjected['importArchive'] = vi.fn()
    mount(importArchive, false)
    fireEvent.click(screen.getByRole('button', { name: '恢复会话备份' }))
    expect(screen.getByRole('dialog')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(importArchive).not.toHaveBeenCalled()
  })

  it('leaves the New Session action untouched for a Peer without import access', () => {
    const props = {
      wide: true,
      useRemoteAccess: () => false,
      t,
      children: <span>新会话</span>,
    } as unknown as SessionBackupActionProps
    render(<SessionBackupAction {...props} />)
    expect(screen.getByText('新会话')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '恢复会话备份' })).toBeNull()
  })
})
