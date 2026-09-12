import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { ResolvedConfig } from './config.ts'
import { SessionDigestError } from './session-digest.ts'
import { sessionDigestInspectionFromHarness } from './session-digest-harness.ts'
import { callSessionInsightModel } from './session-insight-model.ts'
import { sessionInsightSource } from './session-insight-source.ts'
import { sessionTitleOutputSchema, sessionTitleRequestSchema, type SessionTitleRequest, type SessionTitleResult } from './session-title.ts'
import { remoteFailure } from './remote-failure.ts'
import { ServiceRequests } from './service-requests.ts'

/** Inspect and suggest without opening an Agent, changing a title, or writing discussion events. */
export class SessionGraphTitleService extends TypertRemoteService {
  private readonly requests = new ServiceRequests('Session title suggestions')

  constructor(ctx: Context, private readonly config: ResolvedConfig) {
    super(ctx, 'sessionGraphTitle')
    ctx.effect(() => () => this.dispose(), 'session-graph.title-quiescence')
  }

  @Remote('generate')
  async generate(request: SessionTitleRequest, signal: AbortSignal): Promise<SessionTitleResult> {
    try {
      return await this.requests.run(signal, async combined => {
        const { sessionId } = sessionTitleRequestSchema.parse(request)
        const inspection = sessionDigestInspectionFromHarness(await this.ctx.sessionController.inspect(sessionId as SessionId, combined), this.config.route)
        combined.throwIfAborted()
        const source = sessionInsightSource(inspection)
        if (!source) return { kind: 'empty' }
        const output = await callSessionInsightModel(this.ctx, this.config, { sessionId, title: inspection.title,
          ...(inspection.modelRoute ? { modelRoute: inspection.modelRoute } : {}), source }, combined, 'title')
        combined.throwIfAborted()
        let title: string
        try { title = sessionTitleOutputSchema.parse(JSON.parse(output)).title } catch {
          throw new SessionDigestError('invalid-model-output', 'The model returned an invalid Session title')
        }
        return { kind: 'ready', sessionId, title, sourceTitle: inspection.title, sourceRevision: String(inspection.events.at(-1)?.seq ?? -1) }
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw remoteFailure({ code: error instanceof SessionDigestError ? error.code : 'generation-failed',
        message: error instanceof Error ? error.message : 'Session title generation failed', details: {} })
    }
  }

  dispose(): Promise<void> { return this.requests.dispose(async () => {}) }
}
