import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { KnowledgeContent } from '../src/knowledge.ts'
import type { SynthesisClaim, SynthesisRequest } from '../src/knowledge-synthesis.ts'
import { discussionTurns } from '../src/session-discussion.ts'
import { topicHost } from './fixtures/research-topics-host.ts'

const cleanups: (() => Promise<void>)[] = []
const signal = (): AbortSignal => new AbortController().signal
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })
const content = (title: string, conclusion: string): KnowledgeContent => ({
  title, conclusion, question: '哪种策略适用？', rationale: '', openQuestions: '', kind: 'hypothesis', status: 'confirmed',
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'research-synthesis-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  const host = await topicHost(root, cleanups)
  const topicId = randomUUID()
  await host.ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: '冲突策略研究' }, signal())
  const source = host.ctx.sessions.prepare(undefined, { meta: { cwd: '/a' } })
  for (let turn = 1; turn <= 3; turn += 1) {
    source.append('turn/start', { turn })
    source.append('user/message', createUserMessage({ source: { kind: 'user' },
      content: [{ type: 'text', text: `原始证据 ${turn}：应核对负载条件。` }] }), { surfaceOp: 'append' })
    source.append('turn/end', { turn, reason: { kind: 'completed' } })
  }
  host.ctx.effect(() => host.ctx.sessions.enter(source))
  const turns = discussionTurns(source.snapshotEvents())
  const cards = await Promise.all(['主张默认启用缓存。依据：低负载时，策略 A 延迟更低。', '主张默认禁用缓存。依据：高负载时，策略 B 延迟更低。'].map((text, index) =>
    host.ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(), topicId,
      content: content(`观点 ${index + 1}`, text), sources: [] }, signal())))
  const request: SynthesisRequest = { operationId: randomUUID(), topicId, question: '在相同条件下如何比较 A 和 B？', materials: [
    ...cards.map(card => ({ kind: 'card' as const, cardId: card.cardId, revisionId: card.revisions[0]!.revisionId })),
    { kind: 'turn', sessionId: source.id, startSeq: turns[0]!.startSeq, endSeq: turns[1]!.endSeq! },
  ] }
  return { ...host, root, topicId, source, turns, cards, request }
}

describe('Knowledge synthesis public Host workflow', () => {
  it('freezes mixed sources, retains both conflicting premises and saves a reviewed independent card after sources change and Host restarts', async () => {
    const original = await fixture()
    const before = original.source.snapshotEvents()
    const preview = await original.ctx.sessionGraphKnowledge.prepareSynthesis(original.request, signal())
    expect(preview.materials[2]).toMatchObject({ kind: 'turn', source: { source: { turns: [{ turn: 1 }, { turn: 2 }] } } })
    expect(preview.materialText).not.toContain('原始证据 3')
    expect(original.ctx.llm.stream).not.toHaveBeenCalled()
    const first = original.cards[0]!
    await original.ctx.sessionGraphKnowledge.save({ cardId: first.cardId, revisionId: randomUUID(), topicId: original.topicId,
      content: content('已更新观点', '新观点不能替换冻结修订'), sources: [] }, signal())
    await original.ctx.fiber.dispose()
    const host = await topicHost(original.root, cleanups)
    await expect(host.ctx.sessionController.inspect(original.source.id)).rejects.toThrow('not found')
    expect(await host.ctx.sessionGraphKnowledge.prepareSynthesis(original.request, signal())).toEqual(preview)
    const claims: readonly SynthesisClaim[] = [
      { category: 'disagreement', text: '主张默认启用缓存，A 在低负载下占优。', citations: [{ materialIndex: 0, quote: '主张默认启用缓存。依据：低负载时，策略 A 延迟更低。' }] },
      { category: 'disagreement', text: '主张默认禁用缓存，B 在高负载下占优。', citations: [{ materialIndex: 1, quote: '主张默认禁用缓存。依据：高负载时，策略 B 延迟更低。' }] },
      { category: 'condition', text: '应核对负载，不能当作同条件排名。', citations: [{ materialIndex: 2, quote: '原始证据 2：应核对负载条件。' }] },
      { category: 'agreement', text: '幻觉引用也必须保留为待验证观点。', citations: [{ materialIndex: 0, quote: '高负载时，策略 B 延迟更低。' }, { materialIndex: 9, quote: '未知材料' }] },
      { category: 'question', text: '同负载实验结果如何？', citations: [] },
    ]
    vi.mocked(host.ctx.llm.stream).mockImplementation(async function* (options) {
      expect(options.system).toContain('Retain mutually exclusive views')
      expect(JSON.stringify(options.messages)).not.toContain('新观点不能替换')
      yield { type: 'text-delta', index: 0, text: JSON.stringify({ title: '条件化比较', question: original.request.question, kind: 'hypothesis',
        claims: claims.map((claim, index) => index === 3 ? { ...claim, citations: [...claim.citations, null, { materialIndex: -1, quote: '无效索引' }] } : claim) }) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    const draft = await host.ctx.sessionGraphKnowledge.synthesize({ preparationId: preview.preparationId, provider: 'fixture', model: 'fixed-v1' }, signal())
    expect(draft.content.status).toBe('draft')
    expect(draft.invalidCitations).toBe(4)
    expect(draft.synthesis.claims[3]!.citations).toEqual([])
    expect(await host.ctx.sessionGraphKnowledge.search({ query: '条件化比较' }, signal())).toEqual([])
    const save = { cardId: draft.cardId, revisionId: draft.revisionId, topicId: original.topicId, content: { ...draft.content, status: 'confirmed' as const }, sources: [],
      synthesis: { ...draft.synthesis, claims: draft.synthesis.claims.map((claim, index) => index === 2 ? { ...claim, text: '人工核对：需在同一负载下复测。' } : claim) } }
    const saved = await host.ctx.sessionGraphKnowledge.save(save, signal())
    expect(await host.ctx.sessionGraphKnowledge.save(save, signal())).toEqual(saved)
    expect(saved.revisions).toHaveLength(1)
    expect(saved.topicIds).toEqual([original.topicId])
    const revision = saved.revisions[0]!
    expect(revision.synthesis?.materials).toEqual(preview.materials)
    expect(revision.sources[0]!.source.turns).toHaveLength(2)
    expect(revision.content.rationale).toContain('人工核对')
    expect((await host.ctx.sessionGraphKnowledge.search({ query: '人工核对' }, signal()))[0]?.cardId).toBe(saved.cardId)
    const exported = await host.ctx.sessionGraphKnowledge.prepareExport({ cardIds: [saved.cardId] }, signal())
    expect(exported.markdown).toContain('综合自')
    expect(exported.markdown).toContain(first.revisions[0]!.revisionId)
    expect(exported.markdown).toContain('原始证据 2')
    expect(exported.markdown).not.toContain('原始证据 3')
    expect(exported.markdown).toContain('原文缺失或无法读取')
    const reused = await host.ctx.sessionGraphReuse.prepare({ operationId: randomUUID(), workspaceId: 'a', question: '验证比较结果',
      materials: [{ kind: 'card', cardId: saved.cardId, revisionId: revision.revisionId }] }, signal())
    expect(reused.promptText).toContain('人工核对')
    expect(reused.stage).toBe('prepared')
    expect(original.source.snapshotEvents()).toEqual(before)
    await expect(host.ctx.sessionGraphKnowledge.save({ ...save, cardId: first.cardId, revisionId: randomUUID() }, signal())).rejects.toThrow('independent')
    await expect(host.ctx.sessionGraphKnowledge.save({ ...save, revisionId: randomUUID(), synthesis: {
      source: { kind: 'revision', cardId: saved.cardId, revisionId: revision.revisionId }, claims: [{ ...claims[0]!, citations: [{ materialIndex: 0, quote: '新观点不能替换冻结修订' }] }],
    } }, signal())).rejects.toThrow('outside the frozen material')
    const second = await host.ctx.sessionGraphKnowledge.save({ ...save, revisionId: randomUUID(), synthesis: {
      source: { kind: 'revision', cardId: saved.cardId, revisionId: revision.revisionId }, claims: draft.synthesis.claims,
    } }, signal())
    expect(second.revisions).toHaveLength(2)
    expect(second.revisions[1]!.synthesis?.materials).toEqual(preview.materials)
    await host.ctx.fiber.dispose()
    const restarted = await topicHost(original.root, cleanups)
    expect(await restarted.ctx.sessionGraphKnowledge.read({ cardId: saved.cardId }, signal())).toEqual(second)
  })

  it('rejects duplicate, overlapping, incomplete and over-budget materials without silently trimming or invoking a model', async () => {
    const host = await fixture()
    const prepare = (materials: SynthesisRequest['materials']) => host.ctx.sessionGraphKnowledge.prepareSynthesis({ ...host.request, operationId: randomUUID(), materials }, signal())
    await expect(prepare(host.request.materials.slice(0, 1))).rejects.toThrow()
    await expect(prepare([...host.request.materials, host.request.materials[0]!])).rejects.toThrow()
    await expect(prepare([host.request.materials[0]!, host.request.materials[0]!])).rejects.toThrow('Duplicate')
    await expect(prepare([host.request.materials[2]!, { kind: 'turn', sessionId: host.source.id, startSeq: host.turns[1]!.startSeq, endSeq: host.turns[2]!.endSeq! }])).rejects.toThrow('overlapping')
    await expect(prepare([host.request.materials[0]!, { kind: 'turn', sessionId: host.source.id, startSeq: 1, endSeq: 5 }])).rejects.toThrow()
    host.source.append('turn/start', { turn: 4 })
    await expect(prepare([host.request.materials[0]!, { kind: 'turn', sessionId: host.source.id, startSeq: 9, endSeq: 10 }])).rejects.toThrow()
    const large = await host.ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(), topicId: host.topicId,
      content: { ...content('大材料', 'x'.repeat(24_000)), rationale: 'y'.repeat(24_000) }, sources: [] }, signal())
    await expect(prepare([host.request.materials[0]!, { kind: 'card', cardId: large.cardId, revisionId: large.revisions[0]!.revisionId }])).rejects.toThrow('budget')
    expect(host.ctx.llm.stream).not.toHaveBeenCalled()
    expect(await host.ctx.sessionPersistence.list()).toEqual([])
  })

  it('cancels generation while retaining the frozen preview and does not save incomplete model output', async () => {
    const host = await fixture()
    const preview = await host.ctx.sessionGraphKnowledge.prepareSynthesis({ ...host.request, materials: host.request.materials.slice(0, 2) }, signal())
    let release!: () => void
    let entered!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { entered = resolve })
    let modelSignal: AbortSignal | undefined
    vi.mocked(host.ctx.llm.stream).mockImplementationOnce(async function* (options) {
      modelSignal = options.signal
      entered()
      await waiting
      yield { type: 'text-delta', index: 0, text: '{}' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    const controller = new AbortController()
    const request = { preparationId: preview.preparationId, provider: 'fixture', model: 'fixed-v1' }
    const canceled = expect(host.ctx.sessionGraphKnowledge.synthesize(request, controller.signal)).rejects.toThrow()
    await started
    controller.abort(new Error('User canceled'))
    expect(modelSignal?.aborted).toBe(true)
    release()
    await canceled
    vi.mocked(host.ctx.llm.stream).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', index: 0, text: '{}' }
      yield { type: 'finish', reason: { kind: 'length' } }
    })
    await expect(host.ctx.sessionGraphKnowledge.synthesize(request, signal())).rejects.toThrow('did not finish')
    expect(await host.ctx.sessionGraphKnowledge.search({ query: '' }, signal())).toHaveLength(2)
    expect(await host.ctx.sessionGraphKnowledge.prepareSynthesis({ ...host.request, materials: host.request.materials.slice(0, 2) }, signal())).toEqual(preview)
  })
})
