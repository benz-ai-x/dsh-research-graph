import type { Context } from '@deepseek-ai/cordis'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { principalOf, Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { ResolvedConfig } from './config.ts'
import { remoteFailure } from './remote-failure.ts'
import {
  DEFAULT_SESSION_BACKUP_MAX_ENTRY_BYTES,
  DEFAULT_SESSION_BACKUP_MAX_UPLOAD_BYTES,
  SESSION_BACKUP_IMPORT_PATH,
  type SessionBackupLimits,
} from './session-backup.ts'
import { importSessionBackup, type SessionBackupWorkspace } from './session-backup-import.ts'
import { createSessionBackupUploadRoute, type SessionBackupImportClaim } from './session-backup-upload.ts'

interface SessionBackupConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ['POST']
      readonly requestBody: 'streaming'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionGraphBackup: SessionGraphBackupService
  }
}

export class SessionGraphBackupService extends TypertRemoteService {
  private readonly maxUploadBytes: number
  private readonly maxEntryBytes: number
  private active: { readonly controller: AbortController; readonly settled: Promise<void> } | undefined
  private disposal: Promise<void> | undefined

  constructor(ctx: Context, config: ResolvedConfig) {
    super(ctx, 'sessionGraphBackup')
    this.maxUploadBytes = config.backupMaxUploadBytes ?? DEFAULT_SESSION_BACKUP_MAX_UPLOAD_BYTES
    this.maxEntryBytes = config.backupMaxEntryBytes ?? DEFAULT_SESSION_BACKUP_MAX_ENTRY_BYTES
    const projectionCache = ctx.get('sessionProjectionCache')
    const route = createSessionBackupUploadRoute({
      maxUploadBytes: this.maxUploadBytes,
      claim: () => this.claim(),
      workspace: id => this.workspace(id),
      import: async (archive, workspace, onProgress, signal) => await importSessionBackup({
        persistence: ctx.sessionPersistence,
        attachments: ctx.get('attachments') as AttachmentStore,
        ...(projectionCache === undefined ? {} : { projectionCache }),
      }, {
        archive,
        workspace,
        maxEntryBytes: this.maxEntryBytes,
        onProgress,
      }, signal),
      failed: error => { ctx.logger.error('session backup import failed', error) },
    })
    ctx.effect(
      () => (Reflect.get(ctx, 'connection') as SessionBackupConnection).fetch.register({
        path: SESSION_BACKUP_IMPORT_PATH,
        methods: ['POST'],
        requestBody: 'streaming',
        fetch: route,
      }),
      'session-graph.backup-upload-route',
    )
  }

  @Remote('limits')
  limits(signal: AbortSignal): SessionBackupLimits {
    signal.throwIfAborted()
    if (principalOf(this.ctx.invocation) !== undefined) {
      throw remoteFailure({ code: 'sessionGraphBackup/owner-only', message: 'only the owner may restore Session backups', details: {} })
    }
    return { maxUploadBytes: this.maxUploadBytes, maxEntryBytes: this.maxEntryBytes }
  }

  private workspace(id: string): SessionBackupWorkspace | undefined {
    return this.ctx.workspaceRegistry.list().find(workspace => String(workspace.id) === id)
  }

  private claim(): SessionBackupImportClaim | undefined {
    if (this.active !== undefined) return undefined
    const controller = new AbortController()
    const { promise: settled, resolve: settle } = Promise.withResolvers<void>()
    const active = { controller, settled }
    this.active = active
    return {
      signal: controller.signal,
      release: () => {
        if (this.active === active) this.active = undefined
        settle()
      },
    }
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.active?.controller.abort(new Error('Session Backup service is disposed'))
    this.disposal = Promise.resolve(this.active?.settled).then(() => {})
    return this.disposal
  }
}
