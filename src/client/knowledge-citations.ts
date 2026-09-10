import type { ExtractionPreparation } from '../knowledge-extraction.ts'
import type { KnowledgeExtractionAddress, KnowledgeRevision, KnowledgeSourceAddress } from '../knowledge.ts'

/** Recover the exact frozen citations for another edit, retaining all unrelated saved sources. */
export function editableKnowledgeSources(cardId: string, revision: KnowledgeRevision, preparation?: ExtractionPreparation): readonly KnowledgeSourceAddress[] {
  return revision.sources.map((source, sourceIndex) => {
    const { startSeq, endSeq } = source.source
    const included = preparation?.included
    const turns = included?.source.turns.filter(turn => turn.startSeq >= startSeq && turn.endSeq! <= endSeq)
    if (preparation !== undefined && included?.sessionId === source.sessionId && JSON.stringify(turns) === JSON.stringify(source.source.turns)) {
      return { kind: 'extraction', preparationId: preparation.preparationId, startSeq, endSeq }
    }
    return { kind: 'revision', cardId, revisionId: revision.revisionId, sourceIndex }
  })
}

/** Change one checkbox without dropping retained sources or expanding a long range into many citations. */
export function changeExtractionCitation(preparation: ExtractionPreparation, sources: readonly KnowledgeSourceAddress[], startSeq: number, checked: boolean): readonly KnowledgeSourceAddress[] {
  const editable = (address: KnowledgeSourceAddress): address is KnowledgeExtractionAddress => address.kind === 'extraction' && address.preparationId === preparation.preparationId
  const citations = sources.filter(editable)
  const turns = preparation.included.source.turns
  const selected = new Set(turns.filter(turn => citations.some(address => turn.startSeq >= address.startSeq && turn.endSeq! <= address.endSeq)).map(turn => turn.startSeq))
  if (checked) selected.add(startSeq)
  else selected.delete(startSeq)
  const ranges: KnowledgeExtractionAddress[] = []
  turns.forEach((turn, index) => {
    if (!selected.has(turn.startSeq)) return
    const last = ranges.at(-1)
    if (last !== undefined && turns[index - 1]?.endSeq === last.endSeq) ranges[ranges.length - 1] = { ...last, endSeq: turn.endSeq! }
    else ranges.push({ kind: 'extraction', preparationId: preparation.preparationId, startSeq: turn.startSeq, endSeq: turn.endSeq! })
  })
  return [...sources.filter(address => !editable(address)), ...ranges]
}
