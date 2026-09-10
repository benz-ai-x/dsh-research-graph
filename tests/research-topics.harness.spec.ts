import type { Session } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

function addTurn(session: Session, turn: number, prompt: string, answer = 'Recorded conclusion.'): void {
  session.append('turn/start', { turn })
  session.append('step/start', { turn, step: 1 })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text: prompt }],
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn, step: 1, stream: [],
    message: createAssistantMessage({
      source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: answer }],
    }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn, step: 1 })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
}

describe('Research Topics public Host interface', () => {
  it('lists archived and missing sources without reading original text or dropping membership', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/b' } })
    addTurn(source, 1, 'Original discussion.')
    host.ctx.effect(() => host.ctx.sessions.enter(source))
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    await host.invoke('write', { kind: 'create', topicId, title: '持续研究' })
    await host.invoke('write', { kind: 'add', topicId, sessionIds: [source.id] })
    host.archivedSessionIds.push(source.id)
    const inspect = vi.spyOn(host.ctx.sessionController, 'inspect')
    const original = vi.spyOn(host.ctx.sessionQuery, 'readSession')
    const snapshot = await host.invoke('read', { topicId })
    expect(snapshot.sources).toMatchObject([{ sessionId: source.id, status: 'listed', archived: true, workspace: { id: 'b' } }])
    expect(inspect).not.toHaveBeenCalled()
    expect(original).not.toHaveBeenCalled()
    await host.ctx.fiber.dispose()
    await rm(join(root, 'sessions'), { recursive: true, force: true })
    const restarted = await topicHost(root, cleanups)
    const missing = await restarted.invoke('read', { topicId })
    expect(missing.topic.references).toEqual(snapshot.topic.references)
    expect(missing.sources).toMatchObject([{ sessionId: source.id, status: 'unavailable', workspace: { id: 'b' } }])
  })

  it('keeps the last saved state when storage fails and accepts a retry after recovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    const saved = await host.invoke('write', { kind: 'create', topicId, title: '已保存' })
    await rename(join(root, 'data'), join(root, 'saved-data'))
    await writeFile(join(root, 'data'), 'Simulated unavailable storage directory')
    await expect(host.invoke('write', { kind: 'rename', topicId, title: '待重试' })).rejects.toThrow()
    expect(await host.invoke('list')).toEqual([saved])
    await rm(join(root, 'data'))
    await rename(join(root, 'saved-data'), join(root, 'data'))
    expect(await host.invoke('write', { kind: 'rename', topicId, title: '待重试' })).toMatchObject({ title: '待重试' })
  })

  it('persists independent arrangements and resets positions without removing references', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, 'Original discussion.')
    host.ctx.effect(() => host.ctx.sessions.enter(source))
    const a = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    const b = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    for (const topicId of [a, b]) {
      await host.invoke('write', { kind: 'create', topicId, title: topicId })
      await host.invoke('write', { kind: 'add', topicId, sessionIds: [source.id] })
    }
    const arrangement = { positions: { [source.id]: { x: 120, y: -80 } }, collapsed: [source.id], offsets: {} }
    await host.invoke('write', { kind: 'arrange', topicId: a, arrangement })
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    const topics = await restarted.invoke('list')
    expect(topics.find(topic => topic.topicId === a).arrangement).toEqual(arrangement)
    expect(topics.find(topic => topic.topicId === b).arrangement).toEqual({ positions: {}, collapsed: [], offsets: {} })
    const reset = await restarted.invoke('write', {
      kind: 'arrange', topicId: a, arrangement: { positions: {}, collapsed: [], offsets: {} },
    })
    expect(reset.references).toMatchObject([{ sessionId: source.id }])
    expect(reset.arrangement).toEqual({ positions: {}, collapsed: [], offsets: {} })
  })

  it('renames a topic and makes a repeated create preserve its saved references and title', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, 'Original discussion.')
    host.ctx.effect(() => host.ctx.sessions.enter(source))
    const request = { kind: 'create', topicId: '1bb797e8-16ad-4d78-8f41-c0a5efaf8451', title: '最初的标题' }
    await host.invoke('write', request)
    await host.invoke('write', { kind: 'add', topicId: request.topicId, sessionIds: [source.id] })
    const renamed = await host.invoke('write', { kind: 'rename', topicId: request.topicId, title: '修改后的标题' })
    expect(renamed).toMatchObject({ title: '修改后的标题', references: [{ sessionId: source.id }] })
    expect(await host.invoke('write', request)).toEqual(renamed)
    expect(await host.invoke('list')).toEqual([renamed])
  })

  it('creates a named topic and reopens it after restarting the Host', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const first = await topicHost(root, cleanups)
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    const created = await first.invoke('write', { kind: 'create', topicId, title: '跨会话研究' })
    expect(created).toMatchObject({ topicId, title: '跨会话研究', references: [] })
    await first.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    expect(await restarted.invoke('list')).toEqual([created])
    expect(restarted.ctx.llm.stream).not.toHaveBeenCalled()
  })
  it('keeps cross-Workspace references independent in two topics and retains them across restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-topics-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const host = await topicHost(root, cleanups)
    const sources = ['/a', '/b'].map(cwd => host.ctx.sessions.prepare(undefined, { meta: { cwd } }))
    for (const source of sources) {
      addTurn(source, 1, 'Original discussion.')
      host.ctx.effect(() => host.ctx.sessions.enter(source))
    }
    const before = await Promise.all(sources.map(source => host.ctx.sessionController.inspect(source.id)))
    const a = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    const b = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    await host.invoke('write', { kind: 'create', topicId: a, title: '研究 A' })
    await host.invoke('write', { kind: 'create', topicId: b, title: '研究 B' })
    await host.invoke('write', { kind: 'add', topicId: a, sessionIds: sources.map(source => source.id) })
    await host.invoke('write', { kind: 'add', topicId: b, sessionIds: [sources[0]!.id] })
    const crossWorkspace = (await host.invoke('list')).find(topic => topic.topicId === a)
    expect(crossWorkspace.references.map(reference => reference.workspace?.id)).toEqual(['a', 'b'])
    await host.invoke('write', { kind: 'remove', topicId: a, sessionId: sources[0]!.id })
    expect(await Promise.all(sources.map(source => host.ctx.sessionController.inspect(source.id)))).toEqual(before)
    expect(host.archivedSessionIds).toEqual([])
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(root, cleanups)
    const topics = await restarted.invoke('list')
    expect(topics.find(topic => topic.topicId === a).references.map(reference => reference.sessionId)).toEqual([sources[1]!.id])
    expect(topics.find(topic => topic.topicId === b).references.map(reference => reference.sessionId)).toEqual([sources[0]!.id])
    expect(restarted.ctx.llm.stream).not.toHaveBeenCalled()
  })
})
