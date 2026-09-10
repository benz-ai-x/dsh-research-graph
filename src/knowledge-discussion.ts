import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { KnowledgeDiscussionAddress, KnowledgeSource } from './knowledge.ts'
import { discussionTurns } from './session-discussion.ts'

/** Capture only exact completed direct discussion boundaries through Harness. */
export async function readKnowledgeDiscussion(ctx: Context, address: KnowledgeDiscussionAddress, signal: AbortSignal): Promise<KnowledgeSource> {
  const snapshot = await ctx.sessionController.inspect(address.sessionId as SessionId, signal)
  signal.throwIfAborted()
  if (snapshot.meta.origin === 'subagent') throw new Error('Select a direct discussion')
  const turns = discussionTurns(snapshot.events)
  const first = turns.findIndex(turn => turn.startSeq === address.startSeq)
  const last = turns.findIndex(turn => turn.endSeq === address.endSeq)
  if (first < 0 || last < first || turns.slice(first, last + 1).some(turn => turn.endSeq === null)) {
    throw new Error('The selected completed discussion is unavailable')
  }
  const title = (await ctx.sessionQuery.readTitle(address.sessionId as SessionId, signal))?.title.trim() || address.sessionId
  return { sessionId: address.sessionId, title, ...(snapshot.meta.cwd === undefined ? {} : { cwd: snapshot.meta.cwd }),
    source: { startSeq: address.startSeq, endSeq: address.endSeq, turns: turns.slice(first, last + 1) } }
}
