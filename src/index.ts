/** Host loader entry for Session Graph, Session Digest, and durable Session Merge. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { remoteFailure } from './remote-failure.ts'
import {
  Remote,
  TypertRemoteService,
} from '@deepseek-ai/dsh-typert-protocol'
import {
  createSessionDigestModule,
  SessionDigestError,
  type SessionDigestModule,
  type SessionDigestRequest,
  type SessionDigestResult,
} from './session-digest.ts'
import {
  sessionDigestInspectionFromHarness,
} from './session-digest-harness.ts'
import {
  resolveConfig,
  type Config,
  type ResolvedConfig,
} from './config.ts'
import { callSessionInsightModel } from './session-insight-model.ts'
import { SessionGraphTitleService } from './session-title-host.ts'
import { SESSION_MERGE_PROJECTION_DEFINITION } from './session-merge-projection.ts'
import {
  SessionMergeHostError,
  type SessionMergeHostModule,
  type SessionMergeHostStage,
} from './session-merge-host.ts'
import { createSessionMergeHarnessModule } from './session-merge-harness.ts'
import type { SessionMergeSubmission } from './session-merge.ts'
import type { SessionMergeProjection } from './session-merge-projection.ts'
import { SessionGraphHistoryService } from './session-history-host.ts'
import { SessionGraphSearchService } from './session-search-host.ts'
import { ResearchTopicsService, RESEARCH_TOPIC_DOMAIN } from './research-topics-host.ts'
import { KnowledgeService, KNOWLEDGE_DOMAIN } from './knowledge-host.ts'
import { HistoryBranchService, HISTORY_BRANCH_DOMAIN } from './history-branch-host.ts'
import { ResearchReuseService, RESEARCH_REUSE_DOMAIN } from './research-reuse-host.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionGraphDigest: SessionGraphDigestService
    sessionGraphTitle: SessionGraphTitleService
    sessionGraphMerge: SessionGraphMergeService
    sessionGraphHistory: SessionGraphHistoryService
    sessionGraphSearch: SessionGraphSearchService
    sessionGraphTopics: ResearchTopicsService
    sessionGraphKnowledge: KnowledgeService
    sessionGraphReuse: ResearchReuseService
    sessionGraphBranch: HistoryBranchService
  }
}

export { Config, resolveConfig } from './config.ts'

/** Eager Host services required by the read-only digest capability. */
export const inject = ['sessionController', 'llm']

interface QuiescentRemoteService {
  dispose(): Promise<void>
}

/** Publish one Remote whose work reaches quiescence before its registration disappears. */
function provideQuiescentRemoteService<Service extends QuiescentRemoteService>(
  ctx: Context,
  create: (serviceCtx: Context) => Service,
  label: string,
): Promise<void> {
  let readiness: Promise<void> | undefined
  ctx.effect(function* () {
    let service: Service | undefined
    const fiber = ctx.plugin({
      name: label,
      apply(serviceCtx: Context) {
        service = create(serviceCtx)
      },
    })
    readiness = Promise.resolve(fiber).then(() => {})
    // Cordis disposes one effect's yielded resources serially in reverse order.
    // Collect the provider Fiber first so quiescence runs while it remains active.
    yield fiber.dispose
    yield async () => {
      try {
        await fiber
      } catch {
        // Startup errors already reject readiness; cleanup must still reach the Fiber.
      }
      await service?.dispose()
    }
  }, label)
  if (readiness === undefined) throw new Error(`Failed to install ${label}`)
  return readiness
}

/** Package-owned Host service addressed by the browser contribution. */
export class SessionGraphDigestService extends TypertRemoteService implements QuiescentRemoteService {
  private readonly digests: SessionDigestModule

  constructor(ctx: Context, config: ResolvedConfig) {
    super(ctx, 'sessionGraphDigest')
    this.digests = createSessionDigestModule({
      inspect: async (sessionId, signal) => {
        const source = await ctx.sessionController.inspect(sessionId as SessionId, signal)
        return sessionDigestInspectionFromHarness(source, config.route)
      },
      generate: async (request, signal) => await callSessionInsightModel(ctx, config, request, signal),
      now: Date.now,
    })
    ctx.effect(
      () => async () => { await this.dispose() },
      'session-graph.digest-quiescence',
    )
  }

  @Remote('generate')
  async generate(
    request: SessionDigestRequest,
    signal: AbortSignal,
  ): Promise<SessionDigestResult> {
    try {
      return await this.digests.generate(request, signal)
    } catch (error) {
      if (signal.aborted) throw error
      const code = error instanceof SessionDigestError ? error.code : 'generation-failed'
      const message = error instanceof Error ? error.message : 'Session Digest generation failed'
      throw remoteFailure({ code, message, details: {} })
    }
  }

  dispose(): Promise<void> {
    return this.digests.dispose()
  }
}

/** Package-owned Host service that submits one durable Session Merge capture. */
export class SessionGraphMergeService extends TypertRemoteService implements QuiescentRemoteService {
  private readonly merges: SessionMergeHostModule
  private readonly lifecycle = new AbortController()
  private readonly activeCalls = new Set<Promise<SessionMergeProjection>>()
  private disposed = false
  private disposal: Promise<void> | undefined

  constructor(ctx: Context) {
    super(ctx, 'sessionGraphMerge')
    this.merges = createSessionMergeHarnessModule(ctx)
    ctx.effect(
      () => async () => { await this.dispose() },
      'session-graph.merge-quiescence',
    )
  }

  private disposedFailure(stage: SessionMergeHostStage): Error {
    return remoteFailure({
      code: 'disposed',
      message: 'Session Merge service is disposed',
      details: { stage },
    })
  }

  private async submitAdmitted(
    request: SessionMergeSubmission,
    callerSignal: AbortSignal,
    signal: AbortSignal,
  ): Promise<SessionMergeProjection> {
    try {
      return await this.merges.submit(request, signal)
    } catch (error) {
      const stage = error instanceof SessionMergeHostError ? error.stage : 'capturing'
      if (callerSignal.aborted && stage !== 'persisting') throw error
      if (this.lifecycle.signal.aborted && stage !== 'persisting') {
        throw this.disposedFailure(stage)
      }
      const code = error instanceof SessionMergeHostError ? error.code : 'merge-submit-failed'
      const message = error instanceof Error ? error.message : 'Session Merge submission failed'
      throw remoteFailure({ code, message, details: { stage } })
    }
  }

  @Remote('submit')
  submit(
    request: SessionMergeSubmission,
    signal: AbortSignal,
  ): Promise<SessionMergeProjection> {
    if (this.disposed) return Promise.reject(this.disposedFailure('resolving'))
    const combined = AbortSignal.any([signal, this.lifecycle.signal])
    const call = this.submitAdmitted(request, signal, combined)
    this.activeCalls.add(call)
    void call.then(
      () => { this.activeCalls.delete(call) },
      () => { this.activeCalls.delete(call) },
    )
    return call
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.disposed = true
    this.lifecycle.abort(new Error('Session Merge service is disposed'))
    const admitted = [...this.activeCalls]
    this.disposal = Promise.allSettled(admitted).then(() => {})
    return this.disposal
  }
}

/** Install read-only Search/History/Digest services, the Merge projection, and Merge submission. */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const resolvedConfig = resolveConfig(config)
  await ctx.inject(['storageDomain', 'sessionQuery', 'workspaceRegistry'], async topicsCtx => {
    const domain = await topicsCtx.storageDomain.open(RESEARCH_TOPIC_DOMAIN)
    try {
      await provideQuiescentRemoteService(
        topicsCtx,
        serviceCtx => new ResearchTopicsService(serviceCtx, domain),
        'session-graph.topics-service',
      )
    } catch (error) {
      await domain.close()
      throw error
    }
  })
  await ctx.inject(['storageDomain', 'sessionQuery', 'sessionGraphTopics'], async knowledgeCtx => {
    const domain = await knowledgeCtx.storageDomain.open(KNOWLEDGE_DOMAIN)
    try {
      await provideQuiescentRemoteService(knowledgeCtx, serviceCtx => new KnowledgeService(serviceCtx, domain, resolvedConfig), 'session-graph.knowledge-service')
    } catch (error) {
      await domain.close()
      throw error
    }
  })
  await ctx.inject(['storageDomain', 'sessionGraphKnowledge', 'workspaceRegistry', 'sessionQuery'], async reuseCtx => {
    const domain = await reuseCtx.storageDomain.open(RESEARCH_REUSE_DOMAIN)
    try {
      await provideQuiescentRemoteService(reuseCtx, serviceCtx => new ResearchReuseService(serviceCtx, domain), 'session-graph.reuse-service')
    } catch (error) {
      await domain.close()
      throw error
    }
  })
  await ctx.inject(['storageDomain', 'sessions', 'sessionPersistence', 'sessionGraphTopics', 'workspaceRegistry', 'sessionQuery'], async branchCtx => {
    const domain = await branchCtx.storageDomain.open(HISTORY_BRANCH_DOMAIN)
    try {
      await provideQuiescentRemoteService(branchCtx, serviceCtx => new HistoryBranchService(serviceCtx, domain), 'session-graph.branch-service')
    } catch (error) { await domain.close(); throw error }
  })
  void ctx.inject(['sessionQuery', 'workspaceRegistry'], async searchCtx => {
    await provideQuiescentRemoteService(
      searchCtx,
      serviceCtx => new SessionGraphSearchService(serviceCtx),
      'session-graph.search-service',
    )
  })
  await provideQuiescentRemoteService(
    ctx,
    serviceCtx => new SessionGraphHistoryService(serviceCtx),
    'session-graph.history-service',
  )
  const digestReady = provideQuiescentRemoteService(
    ctx,
    serviceCtx => new SessionGraphDigestService(serviceCtx, resolvedConfig),
    'session-graph.digest-service',
  )
  await provideQuiescentRemoteService(ctx, serviceCtx => new SessionGraphTitleService(serviceCtx, resolvedConfig), 'session-graph.title-service')
  void ctx.inject(['sessionProjections'], projectionCtx => {
    projectionCtx.sessionProjections.register(SESSION_MERGE_PROJECTION_DEFINITION)
  })
  void ctx.inject([
    'sessionController',
    'sessionReferenceResolver',
    'sessionProjections',
    'sessionProjectionCache',
    'workspaceRegistry',
  ], async mergeCtx => {
    await provideQuiescentRemoteService(
      mergeCtx,
      serviceCtx => new SessionGraphMergeService(serviceCtx),
      'session-graph.merge-service',
    )
  })
  await digestReady
}
