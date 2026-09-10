import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SessionHistoryRequest, SessionHistoryResult,
} from './session-history.ts'
import { sessionHistoryRequestSchema } from './session-history-codec.ts'
import { discussionTurns } from './session-discussion.ts'

function unavailable(request: SessionHistoryRequest): SessionHistoryResult {
  return {
    kind: request.source === undefined ? 'unavailable' : 'excerpt',
    sessionId: request.sessionId,
    turns: request.source?.turns ?? [],
    hasEarlier: false, hasLater: false,
  }
}

/** Public read-only Host boundary; Session Controller remains the source authority. */
export class SessionGraphHistoryService extends TypertRemoteService {
  private readonly lifecycle = new AbortController()
  private readonly activeReads = new Set<Promise<SessionHistoryResult>>()
  private disposal: Promise<void> | undefined

  constructor(ctx: Context) {
    super(ctx, 'sessionGraphHistory')
    ctx.effect(() => async () => { await this.dispose() }, 'session-graph.history-quiescence')
  }

  @Remote('read')
  read(request: SessionHistoryRequest, signal: AbortSignal): Promise<SessionHistoryResult> {
    const readSignal = AbortSignal.any([signal, this.lifecycle.signal])
    const operation = this.readHistory(request, readSignal)
    this.activeReads.add(operation)
    const release = (): void => { this.activeReads.delete(operation) }
    void operation.then(release, release)
    return operation
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.lifecycle.abort(new Error('Session History service is disposed'))
    this.disposal = Promise.allSettled([...this.activeReads]).then(() => {})
    return this.disposal
  }

  private async readHistory(request: SessionHistoryRequest, signal: AbortSignal): Promise<SessionHistoryResult> {
    signal.throwIfAborted()
    try {
      request = sessionHistoryRequestSchema.parse(request)
    } catch {
      throw new TypeError('Invalid Session History request')
    }
    let source: Awaited<ReturnType<Context['sessionController']['inspect']>>
    try {
      source = await this.ctx.sessionController.inspect(request.sessionId as SessionId, signal)
    } catch {
      signal.throwIfAborted()
      return unavailable(request)
    }
    signal.throwIfAborted()
    const turns = discussionTurns(source.events)
    const limit = request.limit ?? 10
    const { beforeSeq, afterSeq, anchorSeq } = request
    const selectedRange = request.source ?? request.range
    let end = turns.length
    let start = Math.max(0, end - limit)
    if (selectedRange !== undefined) {
      start = turns.findIndex(turn => turn.startSeq === selectedRange.startSeq)
      end = turns.findIndex(turn => turn.endSeq === selectedRange.endSeq) + 1
      if (start < 0 || end <= start || turns.slice(start, end).some(turn => turn.endSeq === null)) {
        return unavailable(request)
      }
    } else if (beforeSeq !== undefined) {
      const boundary = turns.findIndex(turn => turn.startSeq >= beforeSeq)
      end = boundary < 0 ? turns.length : boundary
      start = Math.max(0, end - limit)
    } else if (afterSeq !== undefined) {
      const boundary = turns.findIndex(turn => turn.startSeq > afterSeq)
      start = boundary < 0 ? turns.length : boundary
      end = Math.min(turns.length, start + limit)
    } else if (anchorSeq !== undefined) {
      start = turns.findIndex(turn => turn.startSeq === anchorSeq)
      if (start < 0) return unavailable(request)
      end = Math.min(turns.length, start + limit)
    }
    return {
      kind: 'original',
      sessionId: source.meta.id,
      turns: turns.slice(start, end).map(turn => turn.endSeq === null ? { ...turn, messages: [] } : turn),
      hasEarlier: start > 0,
      hasLater: end < turns.length,
    }
  }
}
