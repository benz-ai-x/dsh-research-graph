export const DEFAULT_SESSION_BACKUP_MAX_UPLOAD_BYTES = 512 * 1024 * 1024
export const DEFAULT_SESSION_BACKUP_MAX_ENTRY_BYTES = 256 * 1024 * 1024

export interface SessionBackupLimits {
  readonly maxUploadBytes: number
  readonly maxEntryBytes: number
}

export type SessionBackupFailureReason =
  | 'too-large'
  | 'unreadable-archive'
  | 'unsupported-archive'
  | 'missing-attachment'
  | 'session-conflict'
  | 'attachment-failed'
  | 'workspace-not-found'
  | 'busy'
  | 'write-failed'

export class SessionBackupError extends Error {
  override readonly name = 'SessionBackupError'

  constructor(
    readonly reason: SessionBackupFailureReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export interface SessionBackupResult {
  readonly rootSessionId: string
  readonly importedSessionIds: readonly string[]
  readonly existingSessionIds: readonly string[]
  readonly attachmentCount: number
  readonly partial: boolean
  readonly failedSessionId?: string
  readonly error?: string
}

export type SessionBackupProgress =
  | { readonly phase: 'reading' }
  | { readonly phase: 'writing'; readonly done: number; readonly total: number }

export type SessionBackupImportLine =
  | { readonly type: 'progress'; readonly progress: SessionBackupProgress }
  | {
    readonly type: 'outcome'
    readonly outcome:
      | { readonly ok: true; readonly value: SessionBackupResult }
      | { readonly ok: false; readonly error: { readonly reason: SessionBackupFailureReason; readonly message: string } }
  }

export const SESSION_BACKUP_IMPORT_PATH = '/api/session-graph/backup-import'
export const SESSION_BACKUP_IMPORT_ROUTE = SESSION_BACKUP_IMPORT_PATH.slice(1)
