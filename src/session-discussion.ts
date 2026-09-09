import type { SessionHistoryTurn, SessionHistoryMessage } from './session-history.ts'

interface DiscussionEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data: unknown
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : undefined
}

function discussionText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.flatMap(block => {
    const item = record(block)
    return item?.type === 'text' && typeof item.text === 'string' ? [item.text] : []
  }).join('\n')
}

/** Project the same original discussion text for reading and search verification. */
export function discussionTurns(events: readonly DiscussionEvent[]): SessionHistoryTurn[] {
  const turns: SessionHistoryTurn[] = []
  let current: {
    turn: number
    startSeq: number
    endSeq: number | null
    startedAt: number
    messages: SessionHistoryMessage[]
  } | undefined
  for (const event of events) {
    const data = record(event.data)
    if (event.type === 'turn/start' && typeof data?.turn === 'number') {
      current = { turn: data.turn, startSeq: event.seq, endSeq: null, startedAt: event.time, messages: [] }
      turns.push(current)
    } else if (event.type === 'turn/end' && current !== undefined && data?.turn === current.turn) {
      current.endSeq = event.seq
      current = undefined
    } else if (current !== undefined) {
      const role = event.type === 'user/message' && record(data?.source)?.kind === 'user'
        ? 'user' : event.type === 'assistant/message' ? 'assistant' : undefined
      if (role === undefined) continue
      const text = discussionText(role === 'user' ? data?.content : record(data?.message)?.content)
      if (text !== '') current.messages.push({ role, seq: event.seq, text })
    }
  }
  return turns
}
