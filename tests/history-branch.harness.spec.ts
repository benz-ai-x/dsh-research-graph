import { randomUUID } from 'node:crypto'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { topicHost } from './fixtures/research-topics-host.ts'
import { discussionTurns } from '../src/session-discussion.ts'

const cleanups: (() => Promise<void>)[] = []
const signal = (): AbortSignal => new AbortController().signal
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'research-history-branch-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const host = await topicHost(root, cleanups)
  const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
  for (let turn = 1; turn <= 5; turn += 1) {
    source.append('turn/start', { turn })
    source.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: `Question ${turn}` }] }), { surfaceOp: 'append' })
    source.append('turn/end', { turn, reason: { kind: 'completed' } })
  }
  const writer = await host.ctx.sessionPersistence.create(source.header)
  try { await writer.append(source.snapshotEvents()); await writer.flush() } finally { await writer.close() }
  const topicId = randomUUID()
  await host.ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: 'Branch research' }, signal())
  await host.ctx.sessionGraphTopics.write({ kind: 'add', topicId, sessionIds: [source.id] }, signal())
  const turn = discussionTurns(source.snapshotEvents())[1]!
  const request = { operationId: randomUUID(), sessionId: source.id, startSeq: turn.startSeq, endSeq: turn.endSeq!, topicId }
  return { ...host, root, source, request }
}

describe('Historical branch public Host workflow', () => {
  it('previews without creating, inherits exactly two of five turns, and retries topic failure on the same child after restart', async () => {
    const host = await fixture()
    const before = host.source.snapshotEvents()
    const create = vi.spyOn(host.ctx.sessionController, 'create').mockImplementation(async request => ({ sessionId: request.sessionId! }))
    const rename = vi.spyOn(host.ctx.sessionController, 'rename').mockResolvedValue({ title: 'branch', seq: 7 })
    const record = await host.ctx.sessionGraphBranch.prepare(host.request, signal())
    expect(record).toMatchObject({ firstTurn: 1, lastTurn: 2, inheritedEventCount: 6, stage: 'prepared' })
    expect(create).not.toHaveBeenCalled()
    expect(rename).not.toHaveBeenCalled()
    expect(await host.ctx.sessionPersistence.stat(record.targetSessionId as SessionId)).toBeUndefined()
    const membership = vi.spyOn(host.ctx.sessionGraphTopics, 'write').mockRejectedValueOnce(new Error('Topic storage offline'))
    const failed = await host.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())
    expect(failed).toMatchObject({ stage: 'created', targetSessionId: record.targetSessionId, error: 'Topic storage offline' })
    const child = await host.ctx.sessionController.inspect(record.targetSessionId as SessionId)
    expect(child.meta).toMatchObject({ parentSession: host.source.id, cwd: '/a', isSeeded: true })
    expect(child.inheritedEventCount).toBe(6)
    expect(discussionTurns(child.events).map(turn => turn.turn)).toEqual([1, 2])
    expect((await host.ctx.sessionController.inspect(host.source.id)).events).toEqual(before)
    expect(membership).toHaveBeenCalledOnce()
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(host.root, cleanups)
    vi.spyOn(restarted.ctx.sessionController, 'create').mockImplementation(async request => ({ sessionId: request.sessionId! }))
    vi.spyOn(restarted.ctx.sessionController, 'rename').mockResolvedValue({ title: 'branch', seq: 7 })
    expect(await restarted.ctx.sessionGraphBranch.read({ operationId: record.operationId }, signal())).toEqual(failed)
    const ready = await restarted.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())
    expect(ready).toMatchObject({ stage: 'ready', targetSessionId: record.targetSessionId })
    expect(ready.error).toBeUndefined()
    expect(await restarted.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())).toEqual(ready)
    const topic = await restarted.ctx.sessionGraphTopics.read({ topicId: host.request.topicId }, signal())
    expect(topic.sources.find(item => item.sessionId === record.targetSessionId)).toMatchObject({ parentSessionId: host.source.id })
    expect((await restarted.ctx.sessionPersistence.list()).filter(item => item.header.parentSession === host.source.id)).toHaveLength(1)
  })

  it('refuses invalid, past-end and stale boundaries before creating a target', async () => {
    const host = await fixture()
    const create = vi.spyOn(host.ctx.sessionController, 'create')
    await expect(host.ctx.sessionGraphBranch.prepare({ ...host.request, endSeq: 999 }, signal())).rejects.toThrow('unavailable')
    await expect(host.ctx.sessionGraphBranch.prepare({ ...host.request, startSeq: 4 }, signal())).rejects.toThrow('unavailable')
    const record = await host.ctx.sessionGraphBranch.prepare(host.request, signal())
    vi.spyOn(host.ctx.sessionController, 'inspect').mockImplementation(async () => { throw new Error('Source unavailable') })
    expect(await host.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())).toMatchObject({ stage: 'prepared', error: 'Source unavailable' })
    expect(create).not.toHaveBeenCalled()
    await expect(host.ctx.sessionGraphBranch.prepare({ ...host.request, endSeq: 8 }, signal())).rejects.toThrow('another source')
  })

  it('retries failed naming without creating a second identity', async () => {
    const host = await fixture()
    const record = await host.ctx.sessionGraphBranch.prepare(host.request, signal())
    vi.spyOn(host.ctx.sessionController, 'create').mockImplementation(async request => ({ sessionId: request.sessionId! }))
    vi.spyOn(host.ctx.sessionController, 'rename').mockRejectedValueOnce(new Error('Rename failed')).mockResolvedValue({ title: 'branch', seq: 7 })
    expect(await host.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())).toMatchObject({ stage: 'created', error: 'Rename failed' })
    const ready = await host.ctx.sessionGraphBranch.submit({ operationId: record.operationId }, signal())
    expect(ready.stage).toBe('ready')
    expect((await host.ctx.sessionPersistence.list()).filter(item => item.header.parentSession === host.source.id)).toHaveLength(1)
  })

  it('recovers the already persisted seed when the independent operation journal becomes unwritable', async () => {
    const host = await fixture()
    const preview = await host.ctx.sessionGraphBranch.prepare(host.request, signal())
    const create = host.ctx.sessionPersistence.create.bind(host.ctx.sessionPersistence)
    const created = vi.spyOn(host.ctx.sessionPersistence, 'create').mockImplementationOnce(async (...args) => {
      const handle = await create(...args)
      const flush = handle.flush.bind(handle)
      vi.spyOn(handle, 'flush').mockImplementationOnce(async () => {
        await flush()
        await rename(join(host.root, 'data'), join(host.root, 'saved-data'))
        await writeFile(join(host.root, 'data'), 'journal unavailable')
      })
      return handle
    })
    try {
      await expect(host.ctx.sessionGraphBranch.submit({ operationId: preview.operationId }, signal())).rejects.toThrow()
      expect((await host.ctx.sessionController.inspect(preview.targetSessionId as SessionId)).inheritedEventCount).toBe(6)
    } finally {
      await rm(join(host.root, 'data'))
      await rename(join(host.root, 'saved-data'), join(host.root, 'data'))
    }
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(host.root, cleanups)
    vi.spyOn(restarted.ctx.sessionController, 'create').mockImplementation(async request => ({ sessionId: request.sessionId! }))
    vi.spyOn(restarted.ctx.sessionController, 'rename').mockResolvedValue({ title: 'branch', seq: 7 })
    const persistedChild = await restarted.ctx.sessionPersistence.open(preview.targetSessionId as SessionId, 'read')
    try { expect(persistedChild.header).toEqual({ ...created.mock.calls[0]![0], delegationDepth: 0 }) } finally { await persistedChild.close() }
    const recovered = await restarted.ctx.sessionGraphBranch.submit({ operationId: preview.operationId }, signal())
    expect(recovered.stage, recovered.error).toBe('ready')
    expect(recovered).toMatchObject({ stage: 'ready', targetSessionId: preview.targetSessionId })
    expect((await restarted.ctx.sessionPersistence.list()).filter(item => item.header.parentSession === host.source.id)).toHaveLength(1)
  })

  it('rejects a changed inherited prefix even when the requested turn boundaries still exist', async () => {
    const host = await fixture()
    const preview = await host.ctx.sessionGraphBranch.prepare(host.request, signal())
    const original = await host.ctx.sessionController.inspect(host.source.id)
    vi.spyOn(host.ctx.sessionController, 'inspect').mockResolvedValue({ ...original, events: original.events.map(event => event.type === 'user/message'
      ? { ...event, data: { ...event.data, content: [{ type: 'text', text: 'Changed historical evidence' }] } } : event) })
    expect(await host.ctx.sessionGraphBranch.submit({ operationId: preview.operationId }, signal())).toMatchObject({ stage: 'prepared', error: expect.stringContaining('history changed') })
    expect(await host.ctx.sessionPersistence.stat(preview.targetSessionId as SessionId)).toBeUndefined()
  })
})
