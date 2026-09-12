import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

/** Exercise the packed plugin with native Agents, persistence, workspace and topic services. */
export async function verifyExploration(ctx, signal, workspaceId) {
  const call = (namespace, method, request) => ctx.typertGateway.invoke({ namespace, method, args: { request }, signal })
  const knowledge = (method, request) => call('sessionGraphKnowledge', method, request)
  const { sessionId } = await ctx.sessionController.create({ workspaceId })
  const completed = async (id, expected) => {
    const deadline = Date.now() + 8000
    for (;;) {
      signal.throwIfAborted()
      const agent = ctx.agents.get(id)
      if (agent?.status === 'idle' && agent.session.snapshotEvents().filter(event => event.type === 'turn/end').length === expected) return
      if (Date.now() > deadline) throw new Error(`Exploration turn stalled: expected ${expected}, source ${id === sessionId}, status ${agent?.status}, ends ${agent?.session.snapshotEvents().filter(event => event.type === 'turn/end').length}, tail ${JSON.stringify(agent?.session.snapshotEvents().slice(-3))}`)
      await setTimeout(20, undefined, { signal })
    }
  }
  for (let turn = 1; turn <= 5; turn += 1) {
    await ctx.sessionController.prompt({ sessionId, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text: `Historical research ${turn}` }] }, signal)
    await completed(sessionId, turn)
  }
  const topicId = randomUUID()
  await ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: 'Exploration acceptance' }, signal)
  const history = await ctx.sessionGraphHistory.read({ sessionId }, signal)
  assert.equal(history.turns.length, 5)
  const before = (await ctx.sessionController.inspect(sessionId)).events
  const selected = history.turns[1]
  const request = { operationId: randomUUID(), sessionId, startSeq: selected.startSeq, endSeq: selected.endSeq, topicId }
  const preview = await call('sessionGraphBranch', 'prepare', request)
  assert.equal(ctx.agents.get(preview.targetSessionId), undefined)
  assert.equal(preview.lastTurn, 2)
  assert.equal(await ctx.sessionPersistence.stat(preview.targetSessionId), undefined)
  const ready = await call('sessionGraphBranch', 'submit', { operationId: preview.operationId })
  assert.equal(ready.stage, 'ready', ready.error)
  assert.deepEqual(await call('sessionGraphBranch', 'submit', { operationId: preview.operationId }), ready)
  const child = await ctx.sessionController.inspect(ready.targetSessionId)
  assert.equal(child.meta.parentSession, sessionId)
  assert.equal(child.events.filter(event => event.type === 'turn/end').length, 2)
  assert.deepEqual((await ctx.sessionController.inspect(sessionId)).events, before)
  assert.equal((await ctx.sessionGraphTopics.read({ topicId }, signal)).sources.find(item => item.sessionId === ready.targetSessionId).parentSessionId, sessionId)
  assert.ok(ctx.workspaceRegistry.list().find(item => item.id === workspaceId).sessionIds.includes(ready.targetSessionId))
  await ctx.sessionController.prompt({ sessionId: ready.targetSessionId, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text: 'Continue this retained branch.' }] }, signal)
  await completed(ready.targetSessionId, 3)
  assert.deepEqual((await ctx.sessionController.inspect(sessionId)).events, before)
  const cards = []
  for (const [index, conclusion] of ['Under low load, A is faster.', 'Under high load, B is faster.'].entries()) {
    cards.push(await knowledge('save', { cardId: randomUUID(), revisionId: randomUUID(), topicId, sources: [],
      content: { title: `Synthesis input ${index + 1}`, question: 'Which strategy?', conclusion, rationale: '', openQuestions: '', kind: 'hypothesis', status: 'confirmed' } }))
  }
  const synthesis = await knowledge('prepareSynthesis', { operationId: randomUUID(), topicId, question: 'Compare the conflicting conditions.', materials: [
    ...cards.map(card => ({ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0].revisionId })),
    { kind: 'turn', sessionId, startSeq: history.turns[0].startSeq, endSeq: selected.endSeq },
  ] })
  assert.equal(synthesis.materials[2].source.source.turns.length, 2)
  assert.ok(!synthesis.materialText.includes('Historical research 3'))
  const draft = await knowledge('synthesize', { preparationId: synthesis.preparationId, provider: 'graph-fixture', model: 'fixture' })
  assert.equal(draft.invalidCitations, 0)
  assert.equal(draft.content.status, 'draft')
  assert.equal(await knowledge('read', { cardId: draft.cardId }), null)
  const save = { cardId: draft.cardId, revisionId: draft.revisionId, topicId, content: draft.content, synthesis: draft.synthesis, sources: [] }
  const saved = await knowledge('save', save)
  assert.deepEqual(await knowledge('save', save), saved)
  assert.deepEqual(saved.revisions[0].synthesis.materials, synthesis.materials)
  const exported = await knowledge('prepareExport', { cardIds: [saved.cardId] })
  assert.ok(exported.markdown.includes(cards[0].revisions[0].revisionId))
  assert.ok(exported.markdown.includes('Synthesized from / 综合自'))
  return { nativeHistoricalBranch: true, fiveToTwoTurns: true, independentBranchContinuation: true, mixedSynthesis: true, reviewedSynthesis: true }
}
