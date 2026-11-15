import type { Context } from '@deepseek-ai/cordis'
import { realpath } from 'node:fs/promises'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceMembershipRestoreRequest, WorkspaceMembershipRestoreResult } from './workspace-membership.ts'
import {
  workspaceMembershipRestoreRequestSchema,
  workspaceMembershipRestoreResultSchema,
} from './workspace-membership-codec.ts'
import { ServiceRequests } from './service-requests.ts'

/** Restores durable Workspace membership for Sessions in the same canonical directory. */
export class WorkspaceMembershipService extends TypertRemoteService {
  static inject = ['workspaceRegistry', 'sessionQuery']

  private readonly requests = new ServiceRequests('Workspace Membership service')

  constructor(ctx: Context) {
    super(ctx, 'sessionGraphWorkspaces')
    ctx.effect(() => () => this.dispose(), 'session-graph.workspace-membership-quiescence')
  }

  @Remote('restore')
  restore(request: WorkspaceMembershipRestoreRequest, signal: AbortSignal): Promise<WorkspaceMembershipRestoreResult> {
    return this.requests.run(signal, async (combined) => {
      const command = workspaceMembershipRestoreRequestSchema.parse(request)
      const workspaces = this.ctx.workspaceRegistry.list()
      const workspace = workspaces.find(item => String(item.id) === command.workspaceId)
      if (workspace === undefined) throw new Error('Workspace is unavailable')
      const accounted = new Set(workspaces.flatMap(item => item.sessionIds.map(String)))
      const listed = await this.ctx.sessionQuery.listSessions(combined)
      for (const record of [...listed].reverse()) {
        combined.throwIfAborted()
        const { id, cwd } = record.header
        if (accounted.has(String(id)) || cwd === undefined) continue
        let path: string
        try {
          path = await realpath(cwd)
        } catch {
          continue
        }
        if (path !== workspace.path) continue
        await workspace.attachSession(id)
        accounted.add(String(id))
      }
      combined.throwIfAborted()
      return workspaceMembershipRestoreResultSchema.parse({ sessionIds: workspace.sessionIds.map(String) })
    })
  }

  dispose(): Promise<void> {
    return this.requests.dispose(async () => {})
  }
}
