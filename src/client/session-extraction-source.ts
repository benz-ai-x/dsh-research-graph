import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionDiscussionSource, SessionHistoryTurn } from '../session-history.ts'
import type { GraphViewInjected } from './GraphView.tsx'

export interface SessionExtractionSelection extends SessionDiscussionSource {
  readonly sessionId: SessionId
}

export function sessionExtractionSource(selection: SessionExtractionSelection): SessionDiscussionSource {
  return { startSeq: selection.startSeq, endSeq: selection.endSeq, turns: selection.turns }
}

export async function readSessionExtractionSelection(sessionId: SessionId, read: GraphViewInjected['readSessionHistory'], signal: AbortSignal): Promise<SessionExtractionSelection | undefined> {
  const completed = new Map<number, SessionHistoryTurn>()
  const pageStarts = new Set<number>()
  let result = await read({ sessionId }, signal)
  for (;;) {
    if (result.kind !== 'original') return undefined
    for (const turn of result.turns) {
      if (turn.endSeq !== null) completed.set(turn.startSeq, turn)
    }
    const first = result.turns[0]
    if (!result.hasEarlier || first === undefined || pageStarts.has(first.startSeq)) break
    pageStarts.add(first.startSeq)
    result = await read({ sessionId, beforeSeq: first.startSeq }, signal)
  }
  const turns = [...completed.values()].sort((left, right) => left.startSeq - right.startSeq)
  const first = turns[0]
  const last = turns.at(-1)
  if (first === undefined || last?.endSeq == null) return undefined
  return { sessionId, startSeq: first.startSeq, endSeq: last.endSeq, turns }
}
