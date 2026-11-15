import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import RemoteAccessService from '@deepseek-ai/dsh-api-remote-access'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceMembershipService } from '../src/workspace-membership-host.ts'
import { ownerPeer } from './fixtures/owner-peer.ts'
import { inspectSession, writeColdHistory } from './fixtures/sessions.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function workspaceHost(root: string) {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'data') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions'), compression: 'none' })
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:', openAt: 'never' })
  await ctx.plugin(WorkspaceRegistry)
  await ctx.plugin(WorkspaceMembershipService)
  await ctx.plugin(RemoteAccessService)
  await ctx.plugin(TypertGatewayService)
  const invoke = (method: string, request: unknown, signal = new AbortController().signal) => ctx.typertGateway.invoke({
    namespace: 'sessionGraphWorkspaces', method, args: { request }, peer: ownerPeer(ctx), signal,
  })
  return { ctx, invoke }
}

async function durableSession(ctx: Context, id: SessionId, cwd: string, createdAt: number) {
  const session = ctx.sessions.prepare(id, { meta: { cwd, createdAt } })
  await writeColdHistory(ctx, session, () => {
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  })
  const writer = await ctx.sessionPersistence.create(session.header)
  try {
    await writer.append(session.snapshotEvents())
    await writer.flush()
  } finally {
    await writer.close()
  }
  return session
}

describe('Workspace Membership public Host interface', () => {
  it('restores multiple Sessions after deleting and recreating their Workspace at the same directory', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-membership-')))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const directory = join(root, 'project')
    await mkdir(directory)
    const host = await workspaceHost(root)
    const older = await durableSession(host.ctx, SessionId('session-older'), directory, 1)
    const newer = await durableSession(host.ctx, SessionId('session-newer'), directory, 2)
    const original = await host.ctx.workspaceRegistry.create(directory)
    await original.attachSession(older.id)
    await original.attachSession(newer.id)
    const before = [older.snapshotEvents(), newer.snapshotEvents()]

    await host.ctx.workspaceRegistry.delete(original.id)
    const recreated = await host.ctx.workspaceRegistry.create(directory)
    expect(recreated.id).not.toBe(original.id)
    expect(recreated.sessionIds).toEqual([])

    await expect(host.invoke('restore', { workspaceId: recreated.id })).resolves.toEqual({
      sessionIds: [newer.id, older.id],
    })
    expect(recreated.sessionIds).toEqual([newer.id, older.id])
    expect([older.snapshotEvents(), newer.snapshotEvents()]).toEqual(before)

    await expect(host.invoke('restore', { workspaceId: recreated.id })).resolves.toEqual({
      sessionIds: [newer.id, older.id],
    })
    await host.ctx.fiber.dispose()
    const restarted = await workspaceHost(root)
    expect(restarted.ctx.workspaceRegistry.get(recreated.id)?.sessionIds).toEqual([newer.id, older.id])
    expect((await inspectSession(restarted.ctx, older.id)).events).toEqual(before[0])
    expect((await inspectSession(restarted.ctx, newer.id)).events).toEqual(before[1])
  })

  it('matches canonical directories without moving unrelated or already-accounted Sessions', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-membership-')))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const directory = join(root, 'project')
    const otherDirectory = join(root, 'other')
    await Promise.all([mkdir(directory), mkdir(otherDirectory)])
    const alias = join(root, 'project-alias')
    await symlink(directory, alias, 'dir')
    const host = await workspaceHost(root)
    const matching = host.ctx.sessions.create(SessionId('session-matching'), { meta: { cwd: alias, createdAt: 1 } })
    const loose = host.ctx.sessions.create(SessionId('session-loose'), { meta: { cwd: otherDirectory, createdAt: 2 } })
    const owned = host.ctx.sessions.create(SessionId('session-owned'), { meta: { cwd: otherDirectory, createdAt: 3 } })
    host.ctx.sessions.create(SessionId('session-missing'), { meta: { cwd: join(root, 'missing'), createdAt: 4 } })
    host.ctx.sessions.create(SessionId('session-no-cwd'), { meta: { createdAt: 5 } })
    const other = await host.ctx.workspaceRegistry.create(otherDirectory)
    await other.attachSession(owned.id)
    const workspace = await host.ctx.workspaceRegistry.create(directory)

    await expect(host.invoke('restore', { workspaceId: workspace.id })).resolves.toEqual({
      sessionIds: [matching.id],
    })
    expect(workspace.sessionIds).toEqual([matching.id])
    expect(other.sessionIds).toEqual([owned.id])
    const accounted = new Set(host.ctx.workspaceRegistry.list().flatMap(item => item.sessionIds.map(String)))
    expect(accounted).not.toContain(loose.id)
    expect(accounted).not.toContain('session-missing')
    expect(accounted).not.toContain('session-no-cwd')
  })

  it('reports an interrupted restore and idempotently resumes it after the failure', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'workspace-membership-')))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const directory = join(root, 'project')
    await mkdir(directory)
    const host = await workspaceHost(root)
    const first = host.ctx.sessions.create(SessionId('session-first'), { meta: { cwd: directory, createdAt: 1 } })
    const second = host.ctx.sessions.create(SessionId('session-second'), { meta: { cwd: directory, createdAt: 2 } })
    const third = host.ctx.sessions.create(SessionId('session-third'), { meta: { cwd: directory, createdAt: 3 } })
    const workspace = await host.ctx.workspaceRegistry.create(directory)
    const attach = workspace.attachSession.bind(workspace)
    let failed = false
    vi.spyOn(workspace, 'attachSession').mockImplementation(async (sessionId) => {
      if (sessionId === second.id && !failed) {
        failed = true
        throw new Error('Selected attach failure')
      }
      await attach(sessionId)
    })

    await expect(host.invoke('restore', { workspaceId: workspace.id })).rejects.toThrow('Selected attach failure')
    expect(workspace.sessionIds).toEqual([first.id])
    await expect(host.invoke('restore', { workspaceId: workspace.id })).resolves.toEqual({
      sessionIds: [third.id, second.id, first.id],
    })
    expect(failed).toBe(true)
  })
})
