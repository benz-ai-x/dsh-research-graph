import { createWirePrimitives } from './wire-primitives.ts'

export interface HistoryBranchRequest {
  readonly operationId: string
  readonly sessionId: string
  readonly startSeq: number
  readonly endSeq: number
  readonly topicId?: string
}
export interface HistoryBranchRecord extends HistoryBranchRequest {
  readonly targetSessionId: string
  readonly title: string
  readonly sourceTitle: string
  readonly firstTurn: number
  readonly lastTurn: number
  readonly inheritedEventCount: number
  readonly stage: 'prepared' | 'created' | 'ready'
  readonly error?: string
}
const { invalid, object, text, identity, uuid, count } = createWirePrimitives('Invalid historical branch data', 32_000)
const REQUEST_KEYS = ['operationId', 'sessionId', 'startSeq', 'endSeq', 'topicId']
function request(item: Record<string, unknown>): HistoryBranchRequest {
  const startSeq = count(item.startSeq)
  const endSeq = count(item.endSeq)
  if (endSeq <= startSeq) return invalid()
  return { operationId: uuid(item.operationId), sessionId: identity(item.sessionId), startSeq, endSeq,
    ...(item.topicId === undefined ? {} : { topicId: uuid(item.topicId) }) }
}
export const historyBranchRequestSchema = { parse(value: unknown): HistoryBranchRequest { return request(object(value, REQUEST_KEYS)) } }
export const historyBranchIdentitySchema = { parse(value: unknown): { readonly operationId: string } {
  return { operationId: uuid(object(value, ['operationId']).operationId) }
} }
export const historyBranchRecordSchema = { parse(value: unknown): HistoryBranchRecord {
  const item = object(value, [...REQUEST_KEYS, 'targetSessionId', 'title', 'sourceTitle', 'firstTurn', 'lastTurn', 'inheritedEventCount', 'stage', 'error'])
  const firstTurn = count(item.firstTurn)
  const lastTurn = count(item.lastTurn)
  const inheritedEventCount = count(item.inheritedEventCount)
  if (firstTurn < 1 || lastTurn < firstTurn || inheritedEventCount <= count(item.endSeq)
    || (item.stage !== 'prepared' && item.stage !== 'created' && item.stage !== 'ready')) return invalid()
  return { ...request(item), targetSessionId: identity(item.targetSessionId), title: text(item.title, 120), sourceTitle: text(item.sourceTitle),
    firstTurn, lastTurn, inheritedEventCount, stage: item.stage, ...(item.error === undefined ? {} : { error: text(item.error) }) }
} }
export const historyBranchNullableSchema = { parse(value: unknown): HistoryBranchRecord | null {
  return value === null ? null : historyBranchRecordSchema.parse(value)
} }

/** A preview owns one target; re-opening and retrying never mint another target. */
export interface HistoryBranchApi {
  readonly prepare: (request: HistoryBranchRequest, signal: AbortSignal) => Promise<HistoryBranchRecord>
  readonly submit: (request: { readonly operationId: string }, signal: AbortSignal) => Promise<HistoryBranchRecord>
  readonly read: (request: { readonly operationId: string }, signal: AbortSignal) => Promise<HistoryBranchRecord | null>
}
