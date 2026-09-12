/** PROTOTYPE: deterministic demo answers through the real DSH agent loop. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const name = 'research-workbench-acceptance-fixture'
export const inject = ['appReady', 'llm', 'sessionController', 'agents', 'workspaceRegistry', 'sessionGraphTopics', 'sessionGraphHistory', 'sessionGraphKnowledge', 'sessionGraphReuse', 'sessionGraphMerge', 'agentDefaultModel']

export function apply(ctx) {
  const root = process.env.RESEARCH_PROTOTYPE_ROOT
  if (!root) throw new Error('Run this fixture with pnpm preview:dsh')
  const provider = 'research-prototype'
  const model = 'demo'
  const answers = [
    `## 先看用户实际感受到的速度

**缓存命中率是线索，端到端延迟才是结果。** 即使命中率提高，序列化、网络传输和失效维护也可能抵消收益。

### 把观察项分开

| 观察项 | 需要回答的问题 |
| --- | --- |
| 端到端 P95 | 用户实际等待是否缩短？ |
| 未命中路径 | 没有缓存时，是否增加额外开销？ |
| 维护成本 | 失效和更新是否抵消收益？ |

1. 先记录同一负载下的基线。
2. 分别观察命中与未命中请求。
3. 加入失效事件，再检查性能和一致性。

> 适用条件：读多写少、重复访问较多，且允许短暂的数据延迟。权限数据需要单独设计。

### 留下可以复用的判断

不要只保留一个“缓存有效”的结论。把**指标、适用条件和待验证问题**放在一起，后续研究才知道什么时候可以沿用。

仍需验证：收益能否覆盖维护开销，以及权限撤销时是否及时生效。`,
    '权限相关数据需要独立的失效机制。通用缓存的过期时间可能无法满足撤销权限后立即生效的要求。\n\n可以按风险分层：普通展示数据容许短暂过期；权限判断保留权威校验，或使用带版本的失效通知。不要把较高的缓存命中率当作安全性证据。\n\n待验证：通知丢失、不同节点的版本不同步、权限服务暂时不可用时，系统应怎样处理请求？',
    '两种观点可以组合为按数据风险分层的缓存策略：展示数据优先优化延迟，权限数据优先保持一致性。\n\n下一步可以做一个小实验：保持相同请求负载，分别测量命中与失效路径的延迟，并加入权限撤销事件，检查是否仍能访问。两个维度分别判定，不合成一个模糊的“缓存效果”。\n\n新的问题：当权限校验服务不可用时，哪些请求应该暂停，哪些可以返回降级结果？这需要结合业务风险继续讨论。',
  ]
  class DemoAdapter extends LlmAdapter {
    async *stream(options) {
      options.signal?.throwIfAborted()
      const userText = options.messages.filter(message => message.role === 'user').flatMap(message => message.content)
        .filter(part => part.type === 'text').map(part => part.text).join('\n')
      if (options.system?.startsWith('Create a concise title')) {
        yield { type: 'text-delta', index: 0, text: userText.includes('反例') ? '缓存策略的反例验证' : '分层缓存策略的研究' }
      } else if (options.system?.startsWith('Create a concise digest')) {
        yield { type: 'text-delta', index: 0, text: JSON.stringify({
          overview: '演示摘要：讨论如何分别评估缓存的性能收益与权限一致性，保留适用条件后继续验证。',
          keyOutcomes: ['把命中率、端到端延迟和失效维护成本分开观察。', '权限相关数据需要独立的一致性约束。'],
          openItems: ['用相同负载验证收益，并检查权限撤销后的行为。'],
        }) }
      } else if (options.system?.startsWith('Extract up to five')) {
        const material = JSON.parse(options.messages[0].content[0].text)
        const turn = material.turns[0]
        yield { type: 'text-delta', index: 0, text: JSON.stringify({ cards: [{
          title: '把性能收益与一致性风险分别验证', question: '怎样判断缓存方案是否适用？',
          conclusion: '评估缓存时，同时保留用户可感知的性能指标与敏感数据的一致性约束。不能用命中率替代这两项验证。',
          rationale: '演示整理：根据所选讨论梳理，仍需人工核对原文与适用条件。',
          openQuestions: '失效通知丢失或权威校验不可用时，哪些业务行为可以接受？', kind: 'hypothesis',
          citations: [{ startSeq: turn.startSeq, endSeq: turn.endSeq }],
        }] }) }
      } else {
        const researchQuestion = userText.match(/# Research question \/ 研究问题\n([^\n]+)/)?.[1]
        const content = userText.includes('跨工作区汇聚：') ? '把两个工作区的讨论放在一起，可以同时看到性能收益与权限一致性这两个维度。先保留各自的适用条件，再用相同负载和权限撤销事件验证组合方案。\n\n来源讨论继续保留在各自工作区；后续实验使用这个新会话所属工作区的文件与执行环境。' : researchQuestion?.includes('反例') ? '可以先构造一个反例：缓存命中率很高，但权限撤销通知没有及时到达某个节点。此时性能表现很好，一致性要求却没有满足。\n\n把“请求耗时”和“权限撤销后是否仍能访问”作为两个独立观察项，再讨论是否接受这个风险。\n\n这是用于体验研究流程的固定示例，没有执行实验。'
          : researchQuestion ? answers[2] : userText.includes('体验种子：低延迟') ? answers[0]
          : userText.includes('体验种子：权限') ? answers[1] : answers[2]
        for (const paragraph of content.split('\n\n')) {
          options.signal?.throwIfAborted()
          yield { type: 'text-delta', index: 0, text: `${paragraph}\n\n` }
          await setTimeout(80)
        }
        yield { type: 'text-delta', index: 0, text: '— 演示回答 · 用于体验知识与讨论的连接，不代表真实模型推理或实验结果。' }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter([provider], new DemoAdapter())
  async function completed(sessionId) {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const agent = ctx.agents.get(sessionId)
      if (agent?.status === 'idle' && agent.session.snapshotEvents().some(event => event.type === 'turn/end')) return
      await setTimeout(50)
    }
    throw new Error(`Demo discussion did not finish: ${sessionId}`)
  }
  async function prepare() {
    await ctx.agentDefaultModel.saveSelection({ provider, model })
    let fixture
    try { fixture = JSON.parse(await readFile(join(root, 'baseline.json'), 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const cwd = join(root, 'workspace')
      await mkdir(cwd, { recursive: true })
      const workspace = await ctx.workspaceRegistry.create(cwd, '研究体验空间')
      const signal = AbortSignal.timeout(120000)
      const topicId = randomUUID()
      await ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: '缓存设计：速度与一致性' }, signal)
      const sources = []
      const cards = []
      for (const [index, title] of ['方案 A：让响应更快', '方案 B：让权限保持一致'].entries()) {
        const { sessionId } = await ctx.sessionController.create({ workspaceId: workspace.id })
        await ctx.sessionController.selectModel({ sessionId, provider, model })
        await ctx.sessionController.prompt({ requestId: randomUUID(), sessionId, mode: 'queue', content: [{ type: 'text', text: index === 0
          ? '体验种子：低延迟。我们想通过缓存改善响应速度，应当观察什么，哪些条件会影响结论？'
          : '体验种子：权限。缓存用户权限时，撤销权限后如何及时生效？这与普通展示数据有什么不同？' }] }, signal)
        await completed(sessionId)
        await ctx.sessionController.rename({ sessionId, title })
        await ctx.sessionGraphTopics.write({ kind: 'add', topicId, sessionIds: [sessionId] }, signal)
        const history = await ctx.sessionGraphHistory.read({ sessionId }, signal)
        const turn = history.turns[0]
        const card = await ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(), topicId,
          content: { title: index === 0 ? '缓存收益，要回到用户感受到的延迟' : '权限变更，需要独立的失效机制',
            question: index === 0 ? '高命中率是否就意味着更快？' : '撤销权限后，怎样避免缓存继续放行？',
            conclusion: index === 0 ? '命中率不能独立证明响应更快。应同时观察端到端延迟、未命中路径和缓存维护开销。' : '普通缓存的过期策略不能直接套用到权限判断。敏感数据需要权威校验，或可靠的版本与失效机制。',
            rationale: index === 0 ? '读多写少、重复访问较多时更值得尝试；序列化与网络开销也要纳入测量。' : '按业务风险分层，明确哪些数据允许短暂过期，哪些必须及时生效。',
            openQuestions: index === 0 ? 'P95 延迟改善是否能覆盖失效维护的成本？' : '通知丢失或校验服务不可用时，允许怎样的降级？',
            kind: index === 0 ? 'method' : 'hypothesis', status: 'draft' },
          sources: [{ kind: 'discussion', sessionId, startSeq: turn.startSeq, endSeq: turn.endSeq }],
        }, signal)
        sources.push({ sessionId, title })
        cards.push(card)
      }
      const prepared = await ctx.sessionGraphReuse.prepare({ operationId: randomUUID(), workspaceId: String(workspace.id),
        question: '能否按数据风险组合两种缓存策略？', materials: cards.map(card => ({ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0].revisionId })) }, signal)
      const sent = await ctx.sessionGraphReuse.submit({ operationId: prepared.operationId }, signal)
      if (sent.stage !== 'accepted') throw new Error(sent.error ?? `Unexpected reuse stage: ${sent.stage}`)
      await completed(sent.targetSessionId)
      await ctx.sessionController.rename({ sessionId: sent.targetSessionId, title: '新的方向：按风险组合缓存策略' })
      await ctx.sessionGraphTopics.write({ kind: 'add', topicId, sessionIds: [sent.targetSessionId] }, signal)
      fixture = { topicId, workspaceId: String(workspace.id), sources, cardIds: cards.map(card => card.cardId), targetSessionId: sent.targetSessionId }
      await writeFile(join(root, 'baseline.json'), JSON.stringify(fixture, null, 2))
    }
    let crossWorkspace
    try { crossWorkspace = JSON.parse(await readFile(join(root, 'cross-workspace.json'), 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const signal = AbortSignal.timeout(120000)
      const spaces = []
      for (const [directory, title] of [['research-a', '工作区 A · 响应性能'], ['research-b', '工作区 B · 权限一致性'], ['research-hub', '研究汇聚空间']]) {
        const path = join(root, directory)
        await mkdir(path, { recursive: true })
        const workspace = await ctx.workspaceRegistry.create(path, title)
        spaces.push(workspace)
      }
      const topicId = randomUUID()
      await ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: '跨工作区：缓存方案对照' }, signal)
      const sources = []
      for (const [index, workspace] of spaces.slice(0, 2).entries()) {
        const { sessionId } = await ctx.sessionController.create({ workspaceId: workspace.id })
        await ctx.sessionController.selectModel({ sessionId, provider, model })
        await ctx.sessionController.prompt({ requestId: randomUUID(), sessionId, mode: 'queue', content: [{ type: 'text', text: index === 0
          ? '体验种子：低延迟。工作区 A 正在研究缓存怎样改善响应速度，应该观察什么？'
          : '体验种子：权限。工作区 B 正在研究权限撤销后的缓存失效，应该保持哪些约束？' }] }, signal)
        await completed(sessionId)
        const title = index === 0 ? 'A 的发现：响应速度与缓存收益' : 'B 的发现：权限撤销与一致性'
        await ctx.sessionController.rename({ sessionId, title })
        sources.push({ sessionId, title, workspaceId: String(workspace.id), beforeEvents: (await ctx.sessionController.inspect(sessionId)).events.length })
      }
      const targetWorkspace = spaces[2]
      const { sessionId: targetSessionId } = await ctx.sessionController.create({ workspaceId: targetWorkspace.id })
      await ctx.sessionController.selectModel({ sessionId: targetSessionId, provider, model })
      const projection = await ctx.sessionGraphMerge.submit({ operationId: randomUUID(), sourceIds: sources.map(source => source.sessionId),
        targetSessionId, targetWorkspaceId: String(targetWorkspace.id), instruction: '跨工作区汇聚：对照缓存性能与权限一致性，保留条件差异，提出一个组合方案。' }, signal)
      await completed(targetSessionId)
      await ctx.sessionController.rename({ sessionId: targetSessionId, title: '汇聚：缓存性能与权限边界' })
      const target = await ctx.sessionController.inspect(targetSessionId)
      if (target.meta.cwd !== targetWorkspace.path || target.meta.parentSession !== undefined) throw new Error('Cross-workspace Merge target has an unexpected location or parent')
      for (const source of sources) if ((await ctx.sessionController.inspect(source.sessionId)).events.length !== source.beforeEvents) throw new Error('Cross-workspace Merge modified a source')
      if (projection.sources.map(source => source.sessionId).join(',') !== sources.map(source => source.sessionId).join(',')) throw new Error('Cross-workspace capture did not match the selected sources')
      await ctx.sessionGraphTopics.write({ kind: 'add', topicId, sessionIds: [...sources.map(source => source.sessionId), targetSessionId] }, signal)
      crossWorkspace = { topicId, sources, targetSessionId, targetWorkspaceId: String(targetWorkspace.id), targetPath: targetWorkspace.path, projection }
      await writeFile(join(root, 'cross-workspace.json'), JSON.stringify(crossWorkspace, null, 2))
    }
    await writeFile(join(root, 'fixture-ready.json'), JSON.stringify({ ...fixture, crossWorkspace }))
  }
  ctx.effect(() => ctx.appReady.onReady(() => {
    void prepare().catch(async error => { await writeFile(join(root, 'fixture-error.txt'), error.stack ?? String(error)) })
  }))
}
