import type { Session } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const C = '3bb797e8-16ad-4d78-8f41-c0a5efaf8451'

function addTurn(session: Session): void {
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text: 'Original discussion.' }],
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn: 1, step: 1, stream: [],
    message: createAssistantMessage({
      source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: 'Recorded conclusion.' }],
    }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
}

async function fixture(root: string) {
  const host = await topicHost(root, cleanups)
  const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
  addTurn(source)
  host.ctx.effect(() => host.ctx.sessions.enter(source))
  await host.workspaces[0]!.attachSession(source.id)
  return { host, source }
}

describe('Workspace Folders public Host interface', () => {
  it('moves a Session between at most one folder and survives a Host restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-folders-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: A, title: '研究', sessionId: source.id })
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: B, title: '运维' })
    const moved = await host.invokeFolders('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, folderId: B,
    })
    expect(moved.folders).toMatchObject([
      { folderId: A, sessionIds: [] },
      { folderId: B, sessionIds: [source.id] },
    ])
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect((await restarted.invokeFolders('list'))[0].folders).toMatchObject([
      { folderId: A, sessionIds: [] },
      { folderId: B, sessionIds: [source.id] },
    ])
  })

  it('creates and moves in one write and rejects cross-Workspace membership without partial writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-folders-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    const foreign = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/b' } })
    addTurn(foreign)
    host.ctx.effect(() => host.ctx.sessions.enter(foreign))
    await host.workspaces[1]!.attachSession(foreign.id)
    await host.invokeFolders('write', {
      kind: 'create', workspaceId: 'a', folderId: A, title: '研究', sessionId: source.id,
    })
    await expect(host.invokeFolders('write', {
      kind: 'create', workspaceId: 'a', folderId: B, title: '越界', sessionId: foreign.id,
    })).rejects.toThrow('Session does not belong to this Workspace')
    const records = await host.invokeFolders('list')
    expect(records).toHaveLength(1)
    expect(records[0].folders).toMatchObject([{ folderId: A, sessionIds: [source.id] }])
    await expect(host.invokeFolders('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, folderId: C,
    })).rejects.toThrow('Workspace Folder is unavailable')
    expect((await host.invokeFolders('list'))[0].folders[0].sessionIds).toEqual([source.id])
    const ungrouped = await host.invokeFolders('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id,
    })
    expect(ungrouped.folders).toMatchObject([{ folderId: A, sessionIds: [] }])
  })

  it('keeps the original assignment when a move cannot be persisted and accepts a retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-folders-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: A, title: '研究', sessionId: source.id })
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: B, title: '运维' })
    await rename(join(root, 'data'), join(root, 'saved-data'))
    await writeFile(join(root, 'data'), 'Simulated unavailable storage directory')
    await expect(host.invokeFolders('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, folderId: B,
    })).rejects.toThrow()
    await rm(join(root, 'data'))
    await rename(join(root, 'saved-data'), join(root, 'data'))
    expect((await host.invokeFolders('list'))[0].folders).toMatchObject([
      { folderId: A, sessionIds: [source.id] },
      { folderId: B, sessionIds: [] },
    ])
    expect(await host.invokeFolders('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, folderId: B,
    })).toMatchObject({ folders: [
      { folderId: A, sessionIds: [] },
      { folderId: B, sessionIds: [source.id] },
    ] })
  })

  it('deletes only the folder and rejects duplicate titles without renaming existing ones', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-folders-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: A, title: '研究', sessionId: source.id })
    await host.invokeFolders('write', { kind: 'create', workspaceId: 'a', folderId: B, title: '运维' })
    await expect(host.invokeFolders('write', {
      kind: 'create', workspaceId: 'a', folderId: C, title: ' 研究 ',
    })).rejects.toThrow('already exists')
    await expect(host.invokeFolders('write', {
      kind: 'rename', workspaceId: 'a', folderId: B, title: '研究',
    })).rejects.toThrow('already exists')
    expect((await host.invokeFolders('list'))[0].folders.map(folder => folder.title)).toEqual(['研究', '运维'])
    const before = await host.ctx.sessionController.inspect(source.id)
    await host.invokeFolders('write', { kind: 'delete', workspaceId: 'a', folderId: A })
    expect((await host.invokeFolders('list'))[0].folders).toMatchObject([
      { folderId: B, sessionIds: [] },
    ])
    // Deleting a folder never touches the Session log.
    expect(await host.ctx.sessionController.inspect(source.id)).toEqual(before)
  })
})
