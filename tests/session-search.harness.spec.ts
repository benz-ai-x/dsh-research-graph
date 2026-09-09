import { Context } from '@deepseek-ai/cordis'
import SessionStore, { type Session } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { createSessionTestController } from 'harness-session-controller-test-support'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/index.ts'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function searchHost(openAt: 'first-search' | 'never' = 'first-search') {
  const root = await mkdtemp(join(tmpdir(), 'session-graph-search-'))
  const ctx = new Context()
  cleanups.push(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:', openAt })
  const workspaces = [
    { id: 'a', title: 'Research A', path: '/a', sessionIds: [] as string[] },
    { id: 'b', title: 'Research B', path: '/b', sessionIds: [] as string[] },
  ]
  const archivedSessionIds: string[] = []
  ctx.provide('workspaceRegistry', { list: () => workspaces, archivedSessionIds })
  ctx.provide('llm', { stream: vi.fn(() => { throw new Error('Search must not call a model') }) })
  await ctx.plugin({
    inject: ['sessions', 'sessionPersistence', 'llm', 'typert'],
    apply(controllerCtx) {
      createSessionTestController(controllerCtx, {
        cwd: '/a', defaultModelSelection: () => ({ provider: 'test', model: 'test' }),
      })
    },
  })
  await ctx.plugin({ apply, inject })
  await ctx.plugin(TypertGatewayService)
  return { ctx, workspaces, archivedSessionIds }
}

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

const request = { query: 'needle', scope: { kind: 'workspace' as const, workspaceId: 'a' }, includeArchived: false }

describe('Discussion Search public Host interface', () => {
  it('provides readable fallback labels for empty Harness session and Workspace titles', async () => {
    const { ctx, workspaces } = await searchHost()
    workspaces[0]!.title = ''
    const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, 'An indexed needle.')
    source.append('session/title', { title: '', messageSeqs: [], source: { kind: 'user' } })
    ctx.effect(() => ctx.sessions.enter(source))
    const result = await ctx.typertGateway.invoke({
      namespace: 'sessionGraphSearch', method: 'search', args: { request }, signal: new AbortController().signal,
    })
    expect(result.hits[0]).toMatchObject({ title: source.id, workspace: { id: 'a', title: '/a' } })
  })

  it.each(['initial', 'continuation'])('rejects a %s result when archive scope changes during awaited work', async phase => {
    const { ctx, archivedSessionIds } = await searchHost()
    const ids = []
    for (let index = 0; index < 3; index++) {
      const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
      addTurn(source, 1, '通过知识卡片整理研究资料。')
      ctx.effect(() => ctx.sessions.enter(source))
      ids.push(source.id)
    }
    const service = ctx.get('sessionGraphSearch')
    const search = { ...request, query: '知识卡片', limit: 1 }
    let cursor: string | undefined
    if (phase === 'initial') {
      const inspect = ctx.sessionController.inspect.bind(ctx.sessionController)
      vi.spyOn(ctx.sessionController, 'inspect').mockImplementationOnce(async (id, signal) => {
        const source = await inspect(id, signal)
        archivedSessionIds.push(id)
        return source
      })
    } else {
      const first = await service.search(search, new AbortController().signal)
      cursor = first.nextCursor
      const list = ctx.sessionQuery.listSessions.bind(ctx.sessionQuery)
      vi.spyOn(ctx.sessionQuery, 'listSessions').mockImplementationOnce(async signal => {
        const sources = await list(signal)
        archivedSessionIds.push(ids.find(id => id !== first.hits[0].sessionId)!)
        return sources
      })
    }
    expect(await service.search({ ...search, ...(cursor === undefined ? {} : { cursor }) }, new AbortController().signal))
      .toEqual({ kind: 'stale' })
  })

  it.each(['caller', 'Host disposal'])('abandons a late source read on %s and joins accepted work', async action => {
    const { ctx } = await searchHost()
    const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, 'A needle to find.')
    ctx.effect(() => ctx.sessions.enter(source))
    const snapshot = await ctx.sessionController.inspect(source.id)
    let started!: () => void
    const admitted = new Promise<void>(resolve => { started = resolve })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(ctx.sessionController, 'inspect').mockImplementationOnce(async () => {
      started()
      await gate
      return snapshot
    })
    const controller = new AbortController()
    const stream = ctx.llm.stream
    const pending = ctx.get('sessionGraphSearch').search(request, controller.signal)
    const rejected = expect(pending).rejects.toThrow(/cancel|disposed/iu)
    await admitted
    if (action === 'caller') controller.abort(new Error('Caller canceled'))
    let disposed = false
    const disposal = action === 'Host disposal' ? ctx.fiber.dispose().then(() => { disposed = true }) : undefined
    await new Promise(resolve => setImmediate(resolve))
    const disposedBeforeReadSettled = disposed
    release()
    await rejected
    await disposal
    if (disposal !== undefined) expect(disposedBeforeReadSettled).toBe(false)
    expect(stream).not.toHaveBeenCalled()
  })

  it('keeps a bounded snippet around the matched words in long discussion text', async () => {
    const { ctx } = await searchHost()
    const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, `${'前文'.repeat(200)} 知识卡片 ${'后文'.repeat(200)}`)
    ctx.effect(() => ctx.sessions.enter(source))
    const result = await ctx.get('sessionGraphSearch').search({ ...request, query: '知识卡片' }, new AbortController().signal)
    expect(result.hits[0].snippet).toContain('知识卡片')
    expect(Array.from(result.hits[0].snippet).length).toBeLessThanOrEqual(242)
  })

  it('reads archived cross-workspace matches only when included and preserves their archive state', async () => {
    const { ctx, archivedSessionIds } = await searchHost()
    const first = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    const archived = ctx.sessions.prepare(undefined, { meta: { cwd: '/b' } })
    for (const source of [first, archived]) {
      addTurn(source, 1, 'Original needle.')
      ctx.effect(() => ctx.sessions.enter(source))
    }
    archivedSessionIds.push(archived.id)
    const before = await ctx.sessionController.inspect(archived.id)
    const service = ctx.get('sessionGraphSearch')
    const all = { ...request, scope: { kind: 'all' as const } }
    expect((await service.search(all, new AbortController().signal)).hits.map(hit => hit.sessionId)).toEqual([first.id])
    const included = await service.search({ ...all, includeArchived: true }, new AbortController().signal)
    expect(included.hits).toHaveLength(2)
    expect(included.hits.find(hit => hit.sessionId === archived.id)).toMatchObject({
      archived: true, workspace: { id: 'b', title: 'Research B' },
    })
    expect(archivedSessionIds).toEqual([archived.id])
    expect(await ctx.sessionController.inspect(archived.id)).toEqual(before)
  })

  it('invalidates continuation when the query, scope, or archive membership changes', async () => {
    const { ctx, archivedSessionIds } = await searchHost()
    for (let index = 0; index < 3; index++) {
      const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
      addTurn(source, 1, 'A needle in original discussion.')
      ctx.effect(() => ctx.sessions.enter(source))
    }
    const service = ctx.get('sessionGraphSearch')
    const search = { ...request, limit: 1 }
    const first = await service.search(search, new AbortController().signal)
    expect(first.nextCursor).toEqual(expect.any(String))
    for (const change of [{ query: 'different' }, { scope: { kind: 'all' as const } }]) {
      expect(await service.search({ ...search, ...change, cursor: first.nextCursor }, new AbortController().signal))
        .toEqual({ kind: 'stale' })
    }
    archivedSessionIds.push(first.hits[0].sessionId)
    expect(await service.search({ ...search, cursor: first.nextCursor }, new AbortController().signal))
      .toEqual({ kind: 'stale' })
  })

  it.each([
    { query: '' }, { query: ' '.repeat(3) }, { query: 'x'.repeat(257) }, { query: 'x\0y' },
    { limit: 0 }, { limit: 21 }, { limit: 1.5 }, { includeArchived: 'yes' },
    { scope: { kind: 'workspace' } }, { scope: { kind: 'directory', cwd: '' } },
    { scope: { kind: 'unknown' } }, { cursor: 'broken' }, { extra: true },
  ])('rejects an invalid public query: %j', async options => {
    const { ctx } = await searchHost()
    await expect(ctx.get('sessionGraphSearch').search({ ...request, ...options } as never, new AbortController().signal))
      .rejects.toThrow('Invalid Discussion Search request')
  })

  it('reports a disabled index separately from an enabled search with no matches', async () => {
    const disabled = await searchHost('never')
    const enabled = await searchHost()
    expect(await disabled.ctx.get('sessionGraphSearch').search(request, new AbortController().signal))
      .toEqual({ kind: 'disabled' })
    expect(await enabled.ctx.get('sessionGraphSearch').search(request, new AbortController().signal))
      .toMatchObject({ kind: 'results', hits: [] })
  })

  it.each(['needle', '知识卡片'])('filters scope before paginating all readable matches for %s', async query => {
    const { ctx } = await searchHost()
    const expected: string[] = []
    for (let index = 0; index < 53; index++) {
      const source = ctx.sessions.prepare(undefined, { meta: { cwd: index < 3 ? '/a' : '/b' } })
      addTurn(source, 1, `保存知识卡片供后续使用 needle ${index}`)
      ctx.effect(() => ctx.sessions.enter(source))
      if (index < 3) expected.push(source.id)
    }
    const service = ctx.get('sessionGraphSearch')
    const search = { ...request, query, limit: 2 }
    const first = await service.search(search, new AbortController().signal)
    expect(first.hits).toHaveLength(2)
    expect(first.nextCursor).toEqual(expect.any(String))
    const second = await service.search({ ...search, cursor: first.nextCursor }, new AbortController().signal)
    expect(second.hits).toHaveLength(1)
    expect(second.nextCursor).toBeUndefined()
    expect([...first.hits, ...second.hits].map(hit => hit.sessionId).sort()).toEqual(expected.sort())
    expect([...first.hits, ...second.hits].every(hit => hit.workspace?.id === 'a')).toBe(true)
  })

  it('finds a Chinese substring in cold original discussion without activating or changing its source', async () => {
    const { ctx } = await searchHost()
    const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, '通过知识卡片整理研究资料。')
    const writer = await ctx.sessionPersistence.create(source.header)
    await writer.append(source.snapshotEvents())
    await writer.flush()
    await writer.close()
    const before = await ctx.sessionController.inspect(source.id)

    const result = await ctx.get('sessionGraphSearch').search({ ...request, query: '知识卡片' }, new AbortController().signal)

    expect(result).toMatchObject({ kind: 'results', hits: [{
      sessionId: source.id, eventSeq: 2, turnStartSeq: 0, snippet: '通过知识卡片整理研究资料。',
    }] })
    expect(ctx.sessions.get(source.id)).toBeUndefined()
    expect(await ctx.sessionController.inspect(source.id)).toEqual(before)
    expect(ctx.llm.stream).not.toHaveBeenCalled()
  })

  it('finds indexed discussion through the real Gateway and addresses its exact original turn', async () => {
    const { ctx, workspaces } = await searchHost()
    const source = ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
    addTurn(source, 1, 'Earlier discussion.')
    addTurn(source, 2, 'Find this needle in the discussion.')
    source.append('session/title', { title: 'Architecture', messageSeqs: [], source: { kind: 'user' } })
    ctx.effect(() => ctx.sessions.enter(source))
    workspaces[0]!.sessionIds.push(source.id)
    const before = await ctx.sessionController.inspect(source.id)

    const result = await ctx.typertGateway.invoke({
      namespace: 'sessionGraphSearch', method: 'search', args: { request },
      signal: new AbortController().signal,
    })

    expect(result).toMatchObject({ kind: 'results', hits: [{
      sessionId: source.id, title: 'Architecture', archived: false,
      workspace: { id: 'a', title: 'Research A' },
      eventSeq: 8, turnStartSeq: 6, snippet: 'Find this needle in the discussion.',
    }] })
    expect(result.hits).toHaveLength(1)
    expect(await ctx.get('sessionGraphHistory').read({
      sessionId: source.id, anchorSeq: result.hits[0].turnStartSeq,
    }, new AbortController().signal)).toMatchObject({
      kind: 'original', hasEarlier: true, turns: [{ turn: 2, startSeq: 6 }],
    })
    expect(await ctx.sessionController.inspect(source.id)).toEqual(before)
    expect(ctx.llm.stream).not.toHaveBeenCalled()
  })
})
