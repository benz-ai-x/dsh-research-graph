/** Real profile acceptance: replace only model transport, retain the complete Host. */
import assert from 'node:assert/strict'
import { writeFile, rename, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const name = 'session-graph-profile-smoke'
export const inject = ['appReady', 'llm', 'sessionController', 'agents', 'sessionGraphDigest', 'sessionGraphHistory', 'sessionGraphSearch', 'sessionGraphMerge', 'sessionGraphTopics', 'sessionGraphKnowledge', 'sessionGraphReuse', 'sessionPersistence', 'typertGateway', 'agentDefaultModel', 'workspaceRegistry']

export function apply(ctx) {
  let calls = 0
  const modelRequests = []
  class FixtureAdapter extends LlmAdapter {
    async *stream(options) {
      options.signal?.throwIfAborted()
      calls += 1
      modelRequests.push({ sessionId: options.sessionId, messages: options.messages })
      if (options.system?.startsWith('Extract up to five')) {
        const material = JSON.parse(options.messages[0].content[0].text)
        yield { type: 'text-delta', index: 0, text: JSON.stringify({ cards: [{ title: 'Packed AI draft', question: 'What is supported?',
          conclusion: 'Only included discussion is supported.', rationale: '', openQuestions: 'Verify the claim.', kind: 'hypothesis',
          citations: [{ startSeq: material.turns[0].startSeq, endSeq: material.turns[0].endSeq }] }] }) }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      }
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
    const secondPrompt = '通过知识卡片整理研究资料。 Café uses foo-bar. 修复 foo-bar 设置。'
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
    const restoredRange = await ctx.typertGateway.invoke({
      namespace: 'sessionGraphHistory', method: 'read',
      args: { request: { sessionId: sourceIds[1], range: {
        startSeq: history.turns[0].startSeq, endSeq: history.turns[0].endSeq,
      } } }, signal,
    })
    assert.deepEqual(restoredRange, history)
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
    const topicId = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
    const topics = (method, request) => ctx.typertGateway.invoke({
      namespace: 'sessionGraphTopics', method, args: request === undefined ? {} : { request }, signal,
    })
    await topics('write', { kind: 'create', topicId, title: 'Packed Research Topic' })
    const collected = await topics('write', { kind: 'add', topicId, sessionIds: sourceIds })
    assert.deepEqual(collected.references.map(source => source.sessionId), sourceIds)
    const arrangement = { positions: { [sourceIds[0]]: { x: 100, y: 200 } }, collapsed: [], offsets: {} }
    await topics('write', { kind: 'arrange', topicId, arrangement })
    const snapshot = await topics('read', { topicId })
    assert.deepEqual(snapshot.topic.arrangement, arrangement)
    assert.ok(snapshot.sources.every(source => source.status === 'listed'))
    await topics('write', { kind: 'remove', topicId, sessionId: sourceIds[0] })
    assert.deepEqual((await topics('list')).find(topic => topic.topicId === topicId).references.map(source => source.sessionId), [sourceIds[1]])
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
    const knowledge = (method, request) => ctx.typertGateway.invoke({ namespace: 'sessionGraphKnowledge', method, args: { request }, signal })
    const reuse = (method, request) => ctx.typertGateway.invoke({ namespace: 'sessionGraphReuse', method, args: { request }, signal })
    const cardRequest = { cardId: randomUUID(), revisionId: randomUUID(), topicId,
      content: { title: 'Packed card', question: '', conclusion: 'Fixed original card revision.', rationale: '', openQuestions: '', kind: 'method', status: 'confirmed' },
      sources: [{ kind: 'discussion', sessionId: sourceIds[1], startSeq: history.turns[0].startSeq, endSeq: history.turns[0].endSeq }] }
    const callsBeforeCard = calls
    const card = await knowledge('save', cardRequest)
    assert.equal(calls, callsBeforeCard)
    const exportPreview = await knowledge('prepareExport', { cardIds: [card.cardId] })
    assert.ok(exportPreview.markdown.includes('Fixed original card revision.'))
    assert.ok(exportPreview.markdown.includes(secondPrompt))
    assert.equal(calls, callsBeforeCard)
    const extractedSource = await knowledge('prepareExtraction', { source: cardRequest.sources[0], budgetChars: 20_000 })
    const drafts = await knowledge('extract', { preparationId: extractedSource.preparationId, provider: 'graph-fixture', model: 'fixture' })
    assert.equal(drafts.drafts[0].content.status, 'draft')
    assert.equal(drafts.drafts[0].invalidCitations, 0)
    assert.equal(drafts.drafts[0].sources.length, 1)
    const targetPath = join(process.cwd(), 'research-target')
    await mkdir(targetPath, { recursive: true })
    const targetWorkspace = await ctx.workspaceRegistry.create(targetPath, 'Reuse target')
    await ctx.agentDefaultModel.saveSelection({ provider: 'graph-fixture', model: 'fixture' })
    const firstHistory = await ctx.sessionGraphHistory.read({ sessionId: sourceIds[0] }, signal)
    const preview = await reuse('prepare', { operationId: randomUUID(), workspaceId: targetWorkspace.id, question: 'Continue using these explicit materials.', materials: [
      { kind: 'card', cardId: card.cardId, revisionId: card.revisions[0].revisionId },
      { kind: 'turn', sessionId: sourceIds[0], startSeq: firstHistory.turns[0].startSeq, endSeq: firstHistory.turns[0].endSeq },
    ] })
    assert.equal(preview.stage, 'prepared')
    assert.deepEqual(await reuse('read', { operationId: preview.operationId }), preview)
    assert.deepEqual(await reuse('forSession', { sessionId: preview.targetSessionId }), [])
    await knowledge('save', { ...cardRequest, revisionId: randomUUID(), content: { ...cardRequest.content, conclusion: 'Later card revision must not replace the preview.' } })
    assert.ok(!exportPreview.markdown.includes('Later card revision'))
    assert.ok((await knowledge('prepareExport', { cardIds: [card.cardId] })).markdown.includes('Later card revision'))
    const sent = await reuse('submit', { operationId: preview.operationId })
    assert.equal(sent.stage, 'accepted', sent.error)
    const reused = await waitForTurn(sent.targetSessionId)
    assert.equal(reused.header.cwd, targetWorkspace.path)
    assert.equal(reused.header.parentSession, undefined)
    const exact = modelRequests.filter(request => request.sessionId === sent.targetSessionId)
    assert.ok(exact.length > 0)
    assert.ok(exact.some(request => request.messages.some(message => message.role === 'user'
      && message.content.some(part => part.type === 'text' && part.text === preview.promptText))))
    assert.ok(!preview.promptText.includes(secondPrompt), 'card selection must not add its original discussion')
    assert.ok(!preview.promptText.includes('Later card revision'))
    await reuse('submit', { operationId: preview.operationId })
    assert.equal(reused.snapshotEvents().filter(event => event.type === 'user/message' && event.data.source.rpcId === sent.requestId).length, 1)
    assert.equal((await reuse('forSession', { sessionId: sent.targetSessionId }))[0].promptText, preview.promptText)
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
    return { ok: true, sources: sourceIds.length, durableTopics: true, durableMerge: true, durableKnowledge: true, reviewedExtraction: true,
      acceptedReuse: true, frozenMarkdown: true, readonlyDigest: true, readonlyHistory: true, exactHistoryRange: true, readonlySearch: true, fixtureModelCalls: calls }
  }
  ctx.effect(() => ctx.appReady.onReady(() => {
    void verify().catch(error => ({ ok: false, error: error.stack ?? String(error) })).then(async report => {
      const path = process.env.SESSION_GRAPH_SMOKE_REPORT
      await writeFile(`${path}.tmp`, JSON.stringify(report))
      await rename(`${path}.tmp`, path)
    })
  }), 'session-graph.profile-smoke')
}
