// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { SessionBackupAction, type SessionBackupActionProps, type SessionBackupInjected } from '../src/client/SessionBackup.tsx'
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

function mount(importArchive: SessionBackupInjected['importArchive']) {
  const openSession = vi.fn()
  const props = {
    wide: true,
    useRemoteAccess: () => true,
    useSessions: selector => selector({ byId: { current: { id: 'current', retainedBy: { mainView: 1 } } } }),
    useWorkspaces: selector => selector({ items: [{
      workspaceId: 'w1' as WorkspaceId, title: '研究', path: '/research', sessionIds: ['current'],
    }] }),
    renderFactorySlot: () => null,
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
