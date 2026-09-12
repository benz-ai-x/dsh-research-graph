import type { Context } from '@deepseek-ai/cordis'
import { readKnowledgeDiscussion } from './knowledge-discussion.ts'
import type { ResearchMaterial, ResearchMaterialSelection } from './research-reuse.ts'

/** Freeze whole explicit revisions/ranges once; callers apply their own count and message budgets. */
export async function freezeResearchMaterials(ctx: Context, selections: readonly ResearchMaterialSelection[], signal: AbortSignal): Promise<readonly ResearchMaterial[]> {
  const materials: ResearchMaterial[] = []
  for (const selection of selections) {
    signal.throwIfAborted()
    if (selection.kind === 'card') {
      const card = await ctx.sessionGraphKnowledge.read({ cardId: selection.cardId }, signal)
      const revision = card?.revisions.find(item => item.revisionId === selection.revisionId)
      if (revision === undefined) throw new Error('Selected Card Revision is unavailable')
      materials.push({ kind: 'card', cardId: selection.cardId, revisionId: revision.revisionId, revisionNumber: revision.number,
        savedAt: revision.savedAt, content: revision.content, sources: revision.sources.map(source => ({
          sessionId: source.sessionId, title: source.title, startSeq: source.source.startSeq, endSeq: source.source.endSeq,
          startedAt: source.source.turns[0]!.startedAt,
        })) })
    } else {
      const source = await readKnowledgeDiscussion(ctx, { ...selection, kind: 'discussion' }, signal)
      materials.push({ kind: 'turn', source })
    }
  }
  return materials
}
