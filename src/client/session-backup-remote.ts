import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionBackupLimits } from '../session-backup.ts'

const limitsSchema = {
  parse(value: unknown): SessionBackupLimits {
    if (typeof value !== 'object' || value === null) throw new Error('Invalid Session Backup limits')
    const limits = value as Record<string, unknown>
    if (typeof limits['maxUploadBytes'] !== 'number' || typeof limits['maxEntryBytes'] !== 'number') {
      throw new Error('Invalid Session Backup limits')
    }
    return { maxUploadBytes: limits['maxUploadBytes'], maxEntryBytes: limits['maxEntryBytes'] }
  },
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphBackup/limits': (signal?: AbortSignal) => Promise<RemoteResult<SessionBackupLimits>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphBackup: {
      limits: TypertRemoteMap['sessionGraphBackup/limits']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const SESSION_BACKUP_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: `${PACKAGE_NAME}#sessionGraphBackup/limits`,
    service: 'sessionGraphBackup', namespace: 'sessionGraphBackup', method: 'limits',
    invocation: { kind: 'direct' },
    parameters: [],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SessionBackupLimits`, create: () => limitsSchema,
    },
  }],
}
