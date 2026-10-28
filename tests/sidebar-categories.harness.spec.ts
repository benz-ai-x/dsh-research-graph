import type { Session } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RESEARCH_TOPIC_DOMAIN } from '../src/research-topics-host.ts'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const C = '3bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const TOPIC = '4bb797e8-16ad-4d78-8f41-c0a5efaf8451'

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

describe('Sidebar Categories public Host interface', () => {
  it('moves a Session between at most one category without changing Research Topics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidebar-categories-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invoke('write', { kind: 'create', topicId: TOPIC, title: '研究主题' })
    await host.invoke('write', { kind: 'add', topicId: TOPIC, sessionIds: [source.id] })
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: A, title: '缓存', sessionId: source.id })
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: B, title: '实验' })
    const moved = await host.invokeCategory('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, categoryId: B,
    })
    expect(moved.categories).toMatchObject([
      { categoryId: A, sessionIds: [] },
      { categoryId: B, sessionIds: [source.id] },
    ])
    expect((await host.invoke('list'))[0].references).toMatchObject([{ sessionId: source.id }])
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect((await restarted.invokeCategory('list'))[0].categories).toMatchObject([
      { categoryId: A, sessionIds: [] },
      { categoryId: B, sessionIds: [source.id] },
    ])
    expect((await restarted.invoke('list'))[0].references).toMatchObject([{ sessionId: source.id }])
  })

  it('creates and moves in one write and rejects cross-Workspace membership without partial writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidebar-categories-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    const foreign = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/b' } })
    addTurn(foreign)
    host.ctx.effect(() => host.ctx.sessions.enter(foreign))
    await host.workspaces[1]!.attachSession(foreign.id)
    await host.invokeCategory('write', {
      kind: 'create', workspaceId: 'a', categoryId: A, title: '缓存', sessionId: source.id,
    })
    await expect(host.invokeCategory('write', {
      kind: 'create', workspaceId: 'a', categoryId: B, title: '越界', sessionId: foreign.id,
    })).rejects.toThrow('Session does not belong to this Workspace')
    const records = await host.invokeCategory('list')
    expect(records).toHaveLength(1)
    expect(records[0].categories).toMatchObject([{ categoryId: A, sessionIds: [source.id] }])
    await expect(host.invokeCategory('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, categoryId: C,
    })).rejects.toThrow('Sidebar Category is unavailable')
    expect((await host.invokeCategory('list'))[0].categories[0].sessionIds).toEqual([source.id])
    const uncategorized = await host.invokeCategory('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id,
    })
    expect(uncategorized.categories).toMatchObject([{ categoryId: A, sessionIds: [] }])
  })

  it('keeps the original assignment when a move cannot be persisted and accepts a retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidebar-categories-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: A, title: '缓存', sessionId: source.id })
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: B, title: '实验' })
    await rename(join(root, 'data'), join(root, 'saved-data'))
    await writeFile(join(root, 'data'), 'Simulated unavailable storage directory')
    await expect(host.invokeCategory('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, categoryId: B,
    })).rejects.toThrow()
    await rm(join(root, 'data'))
    await rename(join(root, 'saved-data'), join(root, 'data'))
    expect((await host.invokeCategory('list'))[0].categories).toMatchObject([
      { categoryId: A, sessionIds: [source.id] },
      { categoryId: B, sessionIds: [] },
    ])
    expect(await host.invokeCategory('write', {
      kind: 'move', workspaceId: 'a', sessionId: source.id, categoryId: B,
    })).toMatchObject({ categories: [
      { categoryId: A, sessionIds: [] },
      { categoryId: B, sessionIds: [source.id] },
    ] })
  })

  it('deletes only the category and rejects duplicate titles without replacing existing names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidebar-categories-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const { host, source } = await fixture(root)
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: A, title: '缓存', sessionId: source.id })
    await host.invokeCategory('write', { kind: 'create', workspaceId: 'a', categoryId: B, title: '实验' })
    await expect(host.invokeCategory('write', {
      kind: 'create', workspaceId: 'a', categoryId: C, title: ' 缓存 ',
    })).rejects.toThrow('already exists')
    await expect(host.invokeCategory('write', {
      kind: 'rename', workspaceId: 'a', categoryId: B, title: '缓存',
    })).rejects.toThrow('already exists')
    expect((await host.invokeCategory('list'))[0].categories.map(category => category.title)).toEqual(['缓存', '实验'])
    const before = await host.ctx.sessionController.inspect(source.id)
    await host.invokeCategory('write', { kind: 'delete', workspaceId: 'a', categoryId: A })
    expect((await host.invokeCategory('list'))[0].categories).toMatchObject([
      { categoryId: B, sessionIds: [] },
    ])
    expect(await host.ctx.sessionController.inspect(source.id)).toEqual(before)
  })

  it('imports legacy Workspace Topics once without changing them or restoring renamed categories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidebar-categories-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups, async (ctx, workspaces) => {
      const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
      addTurn(source)
      ctx.effect(() => ctx.sessions.enter(source))
      await workspaces[0]!.attachSession(source.id)
      const legacy = await ctx.storageDomain.open(RESEARCH_TOPIC_DOMAIN)
      await legacy.table('topics').put(TOPIC, {
        topicId: TOPIC, title: '旧分类', workspaceId: 'a',
        references: [{ sessionId: source.id, title: '原会话' }],
        arrangement: { positions: {}, collapsed: [], offsets: {} },
      })
      await legacy.close()
    })
    expect((await host.invokeCategory('list'))[0].categories).toMatchObject([
      { categoryId: TOPIC, title: '旧分类', sessionIds: [expect.any(String)] },
    ])
    const legacyBefore = (await host.invoke('list'))[0]
    await host.invokeCategory('write', { kind: 'rename', workspaceId: 'a', categoryId: TOPIC, title: '新分类名' })
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect((await restarted.invokeCategory('list'))[0].categories).toMatchObject([
      { categoryId: TOPIC, title: '新分类名', sessionIds: [expect.any(String)] },
    ])
    expect((await restarted.invokeCategory('list'))[0].categories).toHaveLength(1)
    expect((await restarted.invoke('list'))[0]).toEqual(legacyBefore)
  })
})
