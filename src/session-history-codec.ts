/** Small shared wire codecs; keep Host libraries out of the lazy browser bundle. */
import type {
  SessionDiscussionRange, SessionDiscussionSource, SessionHistoryMessage, SessionHistoryRequest, SessionHistoryResult, SessionHistoryTurn,
} from './session-history.ts'

function invalid(): never { throw new TypeError('Invalid Session History value') }

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function sequence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid()
  return value
}

function string(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  return value
}

function array<Item>(value: unknown, parse: (item: unknown) => Item): Item[] {
  if (!Array.isArray(value)) return invalid()
  return value.map(parse)
}

function message(value: unknown): SessionHistoryMessage {
  const item = object(value, ['role', 'seq', 'text'])
  if (item.role !== 'user' && item.role !== 'assistant') return invalid()
  return { role: item.role, seq: sequence(item.seq), text: string(item.text) }
}

function turn(value: unknown): SessionHistoryTurn {
  const item = object(value, ['turn', 'startSeq', 'endSeq', 'startedAt', 'messages'])
  if (typeof item.startedAt !== 'number' || !Number.isFinite(item.startedAt)) return invalid()
  return {
    turn: sequence(item.turn), startSeq: sequence(item.startSeq),
    endSeq: item.endSeq === null ? null : sequence(item.endSeq),
    startedAt: item.startedAt, messages: array(item.messages, message),
  }
}

function source(value: unknown): SessionDiscussionSource {
  const item = object(value, ['startSeq', 'endSeq', 'turns'])
  const result = { startSeq: sequence(item.startSeq), endSeq: sequence(item.endSeq), turns: array(item.turns, turn) }
  if (result.turns.length === 0 || result.turns[0]?.startSeq !== result.startSeq
    || result.turns.at(-1)?.endSeq !== result.endSeq) return invalid()
  let previousEnd = -1
  for (const entry of result.turns) {
    if (entry.endSeq === null || entry.endSeq <= entry.startSeq || entry.startSeq <= previousEnd) return invalid()
    if (entry.messages.some(item => item.seq <= entry.startSeq || item.seq >= entry.endSeq!)) return invalid()
    previousEnd = entry.endSeq
  }
  return result
}

function range(value: unknown): SessionDiscussionRange {
  const item = object(value, ['startSeq', 'endSeq'])
  const result = { startSeq: sequence(item.startSeq), endSeq: sequence(item.endSeq) }
  if (result.endSeq <= result.startSeq) return invalid()
  return result
}

function parseRequest(value: unknown): SessionHistoryRequest {
  const item = object(value, ['sessionId', 'anchorSeq', 'beforeSeq', 'afterSeq', 'limit', 'source', 'range'])
  const sessionId = string(item.sessionId)
  if (sessionId === '' || [item.anchorSeq, item.beforeSeq, item.afterSeq, item.source, item.range].filter(value => value !== undefined).length > 1) return invalid()
  const limit = item.limit === undefined ? undefined : sequence(item.limit)
  if (limit !== undefined && (limit < 1 || limit > 20)) return invalid()
  return {
    sessionId,
    ...(item.anchorSeq === undefined ? {} : { anchorSeq: sequence(item.anchorSeq) }),
    ...(item.beforeSeq === undefined ? {} : { beforeSeq: sequence(item.beforeSeq) }),
    ...(item.afterSeq === undefined ? {} : { afterSeq: sequence(item.afterSeq) }),
    ...(limit === undefined ? {} : { limit }),
    ...(item.source === undefined ? {} : { source: source(item.source) }),
    ...(item.range === undefined ? {} : { range: range(item.range) }),
  }
}

function parseResult(value: unknown): SessionHistoryResult {
  const item = object(value, ['kind', 'sessionId', 'hasEarlier', 'hasLater', 'turns'])
  if (item.kind !== 'original' && item.kind !== 'excerpt' && item.kind !== 'unavailable') return invalid()
  if (typeof item.hasEarlier !== 'boolean' || typeof item.hasLater !== 'boolean') return invalid()
  const sessionId = string(item.sessionId)
  if (sessionId === '') return invalid()
  return { kind: item.kind, sessionId, hasEarlier: item.hasEarlier, hasLater: item.hasLater, turns: array(item.turns, turn) }
}

export const sessionHistoryRequestSchema = { parse: parseRequest }
export const sessionHistoryResultSchema = { parse: parseResult }
