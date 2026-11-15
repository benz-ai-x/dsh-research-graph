import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceWithRestoredMembership } from '../src/client/workspace/create-workspace.ts'

const workspace = {
  workspaceId: 'workspace-1', path: '/workspace', title: 'Workspace', sessionIds: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
} as WorkspaceView

describe('Workspace creation membership restoration', () => {
  it('creates the native Workspace before restoring its membership', async () => {
    const calls: string[] = []
    const create = vi.fn(async () => {
      calls.push('create')
      return workspace
    })
    const restore = vi.fn(async (request: { workspaceId: string }) => {
      calls.push(`restore:${request.workspaceId}`)
      return { ok: true as const, value: { sessionIds: ['session-1'] } }
    })
    const createWorkspace = createWorkspaceWithRestoredMembership({ create }, { restore })

    await expect(createWorkspace({ path: '/workspace' })).resolves.toBe(workspace)
    expect(create).toHaveBeenCalledWith({ path: '/workspace' })
    expect(restore).toHaveBeenCalledWith({ workspaceId: 'workspace-1' })
    expect(calls).toEqual(['create', 'restore:workspace-1'])
  })

  it('does not call restoration when native creation fails', async () => {
    const create = vi.fn(async () => { throw new Error('Create failed') })
    const restore = vi.fn()
    const createWorkspace = createWorkspaceWithRestoredMembership({ create }, { restore })

    await expect(createWorkspace({ path: '/workspace' })).rejects.toThrow('Create failed')
    expect(restore).not.toHaveBeenCalled()
  })

  it('reports a Host restoration failure after native creation succeeds', async () => {
    const create = vi.fn(async () => workspace)
    const restore = vi.fn(async () => ({
      ok: false as const,
      error: new RemoteError('workspace/not-found', 'Restore failed', { workspaceId: 'workspace-1' }),
    }))
    const createWorkspace = createWorkspaceWithRestoredMembership({ create }, { restore })

    await expect(createWorkspace({ path: '/workspace' })).rejects.toThrow('Restore failed')
    expect(create).toHaveBeenCalledOnce()
    expect(restore).toHaveBeenCalledOnce()
  })
})
