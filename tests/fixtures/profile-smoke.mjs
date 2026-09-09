/** Real profile acceptance: replace only model transport, retain the complete Host. */
import assert from 'node:assert/strict'
import { writeFile, rename } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const name = 'session-graph-profile-smoke'
export const inject = ['appReady', 'llm', 'sessionController', 'agents', 'sessionGraphDigest', 'sessionGraphHistory', 'sessionGraphSearch', 'sessionGraphMerge', 'sessionPersistence', 'typertGateway']

export function apply(ctx) {
  let calls = 0
  class FixtureAdapter extends LlmAdapter {
    async *stream(options) {
      options.signal?.throwIfAborted()
      calls += 1
      const text = options.system?.startsWith('Create a concise digest')
        ? JSON.stringify({ overview: 'Fixture digest.', keyOutcomes: ['Fixture completed.'], openItems: [] })
        : 'Fixture response.'
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['graph-fixture'], new FixtureAdapter())
  const signal = AbortSignal.timeout(45_000)
  const waitForTurn = async id => {
    for (;;) {
      signal.throwIfAborted()
      const agent = ctx.agents.get(id)
      if (agent?.status === 'idle' && agent.session.snapshotEvents().some(event => event.type === 'turn/end')) return agent.session
      await setTimeout(20, undefined, { signal })
    }
  }
  const create = async text => {
    const { sessionId } = await ctx.sessionController.create({ cwd: process.cwd() })
    await ctx.sessionController.selectModel({ sessionId, provider: 'graph-fixture', model: 'fixture' })
    if (text) {
      await ctx.sessionController.prompt({
        requestId: `graph-${sessionId}`, sessionId, mode: 'queue', content: [{ type: 'text', text }],
      }, signal)
      await waitForTurn(sessionId)
    }
    return sessionId
  }
  async function verify() {
    const secondPrompt = 'Second fixture. 通过知识卡片整理研究资料。 Café notes use foo-bar labels. 修复 foo-bar 设置。'
    const sourceIds = [await create('First fixture.'), await create(secondPrompt)]
    const before = sourceIds.map(id => ctx.agents.get(id).session.snapshotEvents())
    const callsBeforeHistory = calls
    const history = await ctx.typertGateway.invoke({
      namespace: 'sessionGraphHistory', method: 'read',
      args: { request: { sessionId: sourceIds[1] } }, signal,
    })
    assert.equal(history.kind, 'original')
    assert.equal(history.sessionId, sourceIds[1])
    assert.equal(history.turns.length, 1)
    assert.deepEqual(history.turns[0].messages.map(message => [message.role, message.text]), [
      ['user', secondPrompt], ['assistant', 'Fixture response.'],
    ])
    for (const query of ['知识卡片', 'cafe', 'foo bar', '修复 foo bar']) {
      const search = await ctx.typertGateway.invoke({
        namespace: 'sessionGraphSearch', method: 'search',
        args: { request: { query, scope: { kind: 'directory', cwd: process.cwd() }, includeArchived: false } }, signal,
      })
      assert.equal(search.kind, 'results')
      assert.deepEqual(search.hits.map(hit => hit.sessionId), [sourceIds[1]])
      assert.equal(search.hits[0].turnStartSeq, history.turns[0].startSeq)
      assert.equal(search.hits[0].eventSeq, history.turns[0].messages[0].seq)
      assert.equal(search.hits[0].snippet, secondPrompt)
    }
    assert.equal(calls, callsBeforeHistory)
    const targetSessionId = await create()
    const merge = await ctx.sessionGraphMerge.submit({
      targetSessionId, sourceIds, operationId: 'profile-smoke', instruction: 'Compare the two fixtures.',
    }, signal)
    assert.deepEqual(merge.sources.map(source => source.sessionId), sourceIds)
    const target = await waitForTurn(targetSessionId)
    const marker = target.snapshotEvents().find(event => event.type === 'user/message'
      && event.data.source.kind === 'plugin' && event.data.source.plugin === 'dsh-session-graph')
    assert.ok(marker)
    const digest = await ctx.sessionGraphDigest.generate({ sessionId: sourceIds[0], refresh: true }, signal)
    assert.equal(digest.kind, 'ready')
    assert.equal(digest.digest.overview, 'Fixture digest.')
    sourceIds.forEach((id, index) => assert.deepEqual(ctx.agents.get(id).session.snapshotEvents(), before[index]))
    const reader = await ctx.sessionPersistence.open(targetSessionId, 'read')
    assert.ok(reader)
    try {
      const restored = await reader.read()
      assert.ok(restored.events.some(event => event.type === 'user/message' && event.data.id === marker.data.id))
    } finally {
      await reader.close()
    }
    assert.ok(calls >= 4)
    return { ok: true, sources: sourceIds.length, durableMerge: true, readonlyDigest: true, readonlyHistory: true, readonlySearch: true, fixtureModelCalls: calls }
  }
  ctx.effect(() => ctx.appReady.onReady(() => {
    void verify().catch(error => ({ ok: false, error: error.stack ?? String(error) })).then(async report => {
      const path = process.env.SESSION_GRAPH_SMOKE_REPORT
      await writeFile(`${path}.tmp`, JSON.stringify(report))
      await rename(`${path}.tmp`, path)
    })
  }), 'session-graph.profile-smoke')
}
