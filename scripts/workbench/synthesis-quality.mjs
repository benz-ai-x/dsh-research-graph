import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Optional real-provider review on synthetic material only; generated drafts are never saved. */
export async function runSynthesisQuality(ctx, root) {
  const provider = process.env.RESEARCH_QUALITY_PROVIDER ?? 'deepseek-official'
  const model = process.env.RESEARCH_QUALITY_MODEL ?? 'deepseek-v4-flash'
  const signal = AbortSignal.timeout(120000)
  const topicId = randomUUID()
  const started = Date.now()
  try {
    await rm(join(root, 'synthesis-quality.json'), { force: true })
    await rm(join(root, 'synthesis-quality-error.txt'), { force: true })
    await ctx.sessionGraphTopics.write({ kind: 'create', topicId, title: '模型质量样例：互斥主张与前提' }, signal)
    const inputs = [
      { title: '甲：同一服务默认启用缓存', question: '同一读多写少服务是否默认启用缓存？',
        conclusion: '甲主张默认启用缓存，以降低端到端延迟。', rationale: '前提是普通展示数据允许最多五分钟过期。尚无同负载 P95 测量。',
        openQuestions: '收益能否覆盖失效维护开销？权限数据是否另有一致性约束？', kind: 'hypothesis', status: 'draft' },
      { title: '乙：同一服务默认禁用缓存', question: '同一读多写少服务是否默认启用缓存？',
        conclusion: '乙主张默认禁用缓存，以防止权限撤销后继续放行。', rationale: '前提是该服务返回权限判断，撤销必须即时生效。未验证版本化缓存或主动失效能否满足约束。',
        openQuestions: '普通展示数据与权限判断能否拆开？目前没有可用性或故障注入数据。', kind: 'hypothesis', status: 'draft' },
    ]
    const cards = []
    for (const content of inputs) cards.push(await ctx.sessionGraphKnowledge.save({ cardId: randomUUID(), revisionId: randomUUID(), topicId, content, sources: [] }, signal))
    const preparation = await ctx.sessionGraphKnowledge.prepareSynthesis({ operationId: randomUUID(), topicId,
      question: '对照默认启用与默认禁用的互斥主张，保留双方前提和证据缺口，不做不同条件下的性能排名。请形成待人工审核的综合草稿。',
      materials: cards.map(card => ({ kind: 'card', cardId: card.cardId, revisionId: card.revisions[0].revisionId })),
    }, signal)
    const draft = await ctx.sessionGraphKnowledge.synthesize({ preparationId: preparation.preparationId, provider, model }, signal)
    await writeFile(join(root, 'synthesis-quality.json'), JSON.stringify({ provider, model, elapsedMs: Date.now() - started, inputs, preparation, draft, generatedCardSaved: false }, null, 2))
  } catch (error) {
    await writeFile(join(root, 'synthesis-quality-error.txt'), error.stack ?? String(error))
  }
}
