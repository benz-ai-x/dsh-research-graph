import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { downloadSessionBackup, sessionBackupFilename } from '../src/client/session-backup-download.ts'

const input = {
  workspaceTitle: '研图开发',
  sessionTitle: '备份功能设计',
  sessionId: SessionId('session-52a6b553-f045-49a8-b4c3-fe2e92be98'),
  date: new Date('2026-11-15T07:30:52.123Z'),
}

describe('Session Backup download', () => {
  it('names the archive with Workspace, Session, UTC time, and short id', () => {
    expect(sessionBackupFilename(input)).toBe('DSH_研图开发_备份功能设计_20261115T073052Z_52a6b553.zip')
  })

  it('sanitizes portable filenames and bounds UTF-8 segments', () => {
    const filename = sessionBackupFilename({
      ...input,
      workspaceTitle: `  ${'工作区/'.repeat(40)}`,
      sessionTitle: `a:b*c?d"e<f>g|${'会话'.repeat(100)}.`,
    })
    expect(filename).not.toMatch(/[\\/:*?"<>|]/u)
    expect(filename.startsWith('DSH_')).toBe(true)
    expect(new TextEncoder().encode(filename).byteLength).toBeLessThan(200)
    expect(filename.endsWith('_52a6b553.zip')).toBe(true)
  })

  it('preflights the native export route and saves the same route with the computed name', async () => {
    const response = new Response(null, { status: 200 })
    const fetcher = vi.fn(async () => response)
    const save = vi.fn()
    const filename = await downloadSessionBackup({ ...input, fetcher, save })
    const route = `api/session.export?sessionId=${encodeURIComponent(String(input.sessionId))}&includeDescendants=true`
    expect(fetcher).toHaveBeenNthCalledWith(1, route, { method: 'HEAD' })
    expect(fetcher).toHaveBeenNthCalledWith(2, route, { method: 'GET' })
    expect(save).toHaveBeenCalledWith(route, filename)
  })

  it('does not start a download after a failed preflight', async () => {
    const save = vi.fn()
    await expect(downloadSessionBackup({
      ...input,
      fetcher: async () => new Response('missing', { status: 404 }),
      save,
    })).rejects.toThrow('HTTP 404 missing')
    expect(save).not.toHaveBeenCalled()
  })
})
