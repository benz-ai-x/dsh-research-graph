import type { KnowledgeContent, KnowledgeDiscussionAddress } from '../knowledge.ts'
import type { SessionHistoryResult } from '../session-history.ts'

/** Draft text comes from the exact completed range; the Host still captures provenance on save. */
export function knowledgePrefill(source: KnowledgeDiscussionAddress, result: SessionHistoryResult): {
  readonly content: Pick<KnowledgeContent, 'title' | 'question' | 'conclusion'>
  readonly first: number
  readonly last: number
  readonly truncated: boolean
} {
  const turns = result.turns
  if (result.kind !== 'original' || result.sessionId !== source.sessionId || turns.length === 0
    || turns[0]!.startSeq !== source.startSeq || turns.at(-1)!.endSeq !== source.endSeq
    || turns.some(turn => turn.endSeq === null || turn.startSeq < source.startSeq || turn.endSeq > source.endSeq)) {
    throw new Error('The selected discussion range is not fully available')
  }
  const questions = turns.flatMap(turn => turn.messages.filter(message => message.role === 'user').map(message => message.text)).join('\n\n')
  const answers = turns.flatMap(turn => turn.messages.filter(message => message.role === 'assistant').map(message => message.text)).join('\n\n')
  const body = answers || questions
  return { content: { title: (questions || body).replace(/\s+/gu, ' ').trim().slice(0, 120),
    question: questions.slice(0, 24_000), conclusion: body.slice(0, 24_000) },
    first: turns[0]!.turn, last: turns.at(-1)!.turn, truncated: questions.length > 24_000 || body.length > 24_000 }
}
