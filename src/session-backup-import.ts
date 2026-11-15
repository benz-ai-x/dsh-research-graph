import { createHash } from 'node:crypto'
import type { SessionEvent, SessionHeader, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session/types'
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import {
  openSessionBackupArchive,
  readSessionBackupArtifacts,
  remapSessionBackupAttachments,
  sessionBackupAttachmentPlans,
  type SessionBackupArchive,
  type SessionBackupArtifact,
} from './session-backup-archive.ts'
import { SessionBackupError, type SessionBackupResult } from './session-backup.ts'

interface SessionHandle {
  readonly header: SessionHeader
  readonly inheritedEventCount: SessionLogOffset
  read(): Promise<{ readonly events: readonly SessionEvent[] }>
  append(events: readonly SessionEvent[]): Promise<void>
  flush(): Promise<void>
  close(): Promise<void>
}

export interface SessionBackupPersistence {
  stat(id: SessionId): Promise<unknown | undefined>
  open(id: SessionId, access: 'read'): Promise<SessionHandle>
  create(header: SessionHeader, options: { readonly inheritedEventCount: SessionLogOffset }): Promise<SessionHandle>
}

export interface SessionBackupAttachmentStore {
  saveImage(input: {
    readonly data: Uint8Array
    readonly mediaType: ImageAttachmentRef['mediaType']
    readonly name?: string
  }): Promise<ImageAttachmentRef>
  saveFileStream(input: {
    readonly data: AsyncIterable<Uint8Array>
    readonly name?: string
    readonly signal?: AbortSignal
  }): Promise<FileAttachmentRef>
}

export interface SessionBackupWorkspace {
  readonly id: string
  readonly path: string
  attachSession(id: SessionId): Promise<void>
}

export interface SessionBackupImportDependencies {
  readonly persistence: SessionBackupPersistence
  readonly attachments: SessionBackupAttachmentStore
  readonly projectionCache?: {
    coldSnapshot(
      header: SessionHeader,
      inheritedEventCount: SessionLogOffset,
      events: readonly SessionEvent[],
    ): unknown
  }
}

export interface SessionBackupImportRequest {
  readonly archive: Uint8Array
  readonly maxEntryBytes: number
  readonly workspace: SessionBackupWorkspace
  readonly onProgress?: (done: number, total: number) => void
}

export async function importSessionBackup(
  deps: SessionBackupImportDependencies,
  request: SessionBackupImportRequest,
  signal: AbortSignal,
): Promise<SessionBackupResult> {
  const archive = await openSessionBackupArchive(request.archive, request.maxEntryBytes, signal)
  const parsed = await readSessionBackupArtifacts(archive, signal)
  const artifacts = parsed.map(artifact => ({
    ...artifact,
    header: { ...artifact.header, cwd: request.workspace.path },
  }))
  await assertAttachmentEntries(archive, artifacts, signal)
  await classifyExisting(deps.persistence, artifacts, signal, true)
  const restoredAttachments = await restoreAttachments(deps.attachments, archive, artifacts, signal)
  const remapped = remapSessionBackupAttachments(artifacts, restoredAttachments)
  const existing = await classifyExisting(deps.persistence, remapped, signal)
  const rootSessionId = String(remapped[0]!.header.id)
  const importedSessionIds: string[] = []
  const existingSessionIds: string[] = []
  const total = remapped.length
  let done = 0
  let activeSessionId: string | undefined
  try {
    for (const artifact of remapped) {
      signal.throwIfAborted()
      const id = artifact.header.id
      if (existing.get(id) === true) existingSessionIds.push(String(id))
      else {
        activeSessionId = String(id)
        await writeSession(deps, artifact, signal)
        importedSessionIds.push(String(id))
        activeSessionId = undefined
      }
      done += 1
      request.onProgress?.(done, total)
    }
    activeSessionId = rootSessionId
    signal.throwIfAborted()
    await request.workspace.attachSession(rootSessionId as SessionId)
    return {
      rootSessionId,
      importedSessionIds,
      existingSessionIds,
      attachmentCount: restoredAttachments.size,
      partial: false,
    }
  } catch (error) {
    return {
      rootSessionId,
      importedSessionIds,
      existingSessionIds,
      attachmentCount: restoredAttachments.size,
      partial: true,
      ...(activeSessionId === undefined ? {} : { failedSessionId: activeSessionId }),
      error: publicErrorMessage(error),
    }
  }
}

async function assertAttachmentEntries(
  archive: SessionBackupArchive,
  artifacts: readonly SessionBackupArtifact[],
  signal: AbortSignal,
): Promise<void> {
  if (archive.has('attachments-missing.txt')) {
    const missing = new TextDecoder().decode(await archive.read('attachments-missing.txt', signal)).trim()
    if (missing !== '') throw new SessionBackupError('missing-attachment', 'the export records missing attachments')
  }
  for (const plan of sessionBackupAttachmentPlans(artifacts).values()) {
    if (!archive.has(plan.path)) throw new SessionBackupError('missing-attachment', `attachment is absent: ${plan.path}`)
  }
}

async function restoreAttachments(
  store: SessionBackupAttachmentStore,
  archive: SessionBackupArchive,
  artifacts: readonly SessionBackupArtifact[],
  signal: AbortSignal,
): Promise<ReadonlyMap<string, ImageAttachmentRef | FileAttachmentRef>> {
  const restored = new Map<string, ImageAttachmentRef | FileAttachmentRef>()
  for (const plan of sessionBackupAttachmentPlans(artifacts).values()) {
    signal.throwIfAborted()
    try {
      const data = await archive.read(plan.path, signal)
      assertSourceAttachmentBytes(plan.ref, data, plan.path)
      if ('mediaType' in plan.ref) {
        const ref = await store.saveImage({
          data,
          mediaType: plan.ref.mediaType,
          ...(plan.ref.name === undefined ? {} : { name: plan.ref.name }),
        })
        restored.set(plan.key, ref)
      } else {
        const ref = await store.saveFileStream({
          data: (async function* () {
            yield data
          })(),
          signal,
          ...(plan.ref.name === undefined ? {} : { name: plan.ref.name }),
        })
        if (String(ref.attachmentId) !== String(plan.ref.attachmentId) || ref.bytes !== plan.ref.bytes) {
          throw new SessionBackupError('attachment-failed', `restored file identity differs from its reference: ${plan.path}`)
        }
        restored.set(plan.key, ref)
      }
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof SessionBackupError) throw error
      throw new SessionBackupError('attachment-failed', `cannot restore attachment ${plan.path}`, { cause: error })
    }
  }
  return restored
}

function assertSourceAttachmentBytes(
  ref: ImageAttachmentRef | FileAttachmentRef,
  data: Uint8Array,
  path: string,
): void {
  if (data.byteLength !== ref.bytes) {
    throw new SessionBackupError('attachment-failed', `attachment byte length differs from its reference: ${path}`)
  }
  const id = String(ref.attachmentId)
  if (id.startsWith('sha256:')) {
    const digest = createHash('sha256').update(data).digest('hex')
    if (id !== `sha256:${digest}`) throw new SessionBackupError('attachment-failed', `attachment digest differs from its reference: ${path}`)
  }
}

async function classifyExisting(
  persistence: SessionBackupPersistence,
  artifacts: readonly SessionBackupArtifact[],
  signal: AbortSignal,
  attachmentAgnostic = false,
): Promise<ReadonlyMap<SessionId, boolean>> {
  const existing = new Map<SessionId, boolean>()
  for (const artifact of artifacts) {
    signal.throwIfAborted()
    const id = artifact.header.id
    const stat = await persistence.stat(id)
    if (stat === undefined) {
      existing.set(id, false)
      continue
    }
    const handle = await persistence.open(id, 'read')
    try {
      const saved = await handle.read()
      const matches = handle.inheritedEventCount === artifact.inheritedEventCount
        && hashHeader(handle.header) === hashHeader(artifact.header)
        && hash(saved.events, attachmentAgnostic) === hash(artifact.events, attachmentAgnostic)
      if (!matches) {
        throw new SessionBackupError('session-conflict', `Session ${String(id)} already exists with different stored content`)
      }
      existing.set(id, true)
    } finally {
      await handle.close()
    }
  }
  return existing
}

async function writeSession(
  deps: SessionBackupImportDependencies,
  artifact: SessionBackupArtifact,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()
  let handle: SessionHandle | undefined
  try {
    handle = await deps.persistence.create(artifact.header, { inheritedEventCount: artifact.inheritedEventCount })
    await handle.append(artifact.events)
    await handle.flush()
    deps.projectionCache?.coldSnapshot(artifact.header, artifact.inheritedEventCount, artifact.events)
  } catch (error) {
    throw new SessionBackupError('write-failed', `cannot store Session ${String(artifact.header.id)}`, { cause: error })
  } finally {
    if (handle !== undefined) await handle.close()
  }
}

function hashHeader(header: SessionHeader): string {
  return hash({ ...header, delegationDepth: header.delegationDepth ?? 0 })
}

function hash(value: unknown, attachmentAgnostic = false): string {
  return createHash('sha256').update(JSON.stringify(value, (key, item: unknown) => {
    // The first preflight permits only attachment-reference differences: the
    // target store may normalize an image before the final exact comparison.
    if (attachmentAgnostic && key === 'attachment') return '__attachment__'
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]]))
  })).digest('hex')
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof SessionBackupError) return error.message
  if (error instanceof Error && error.name === 'AbortError') return 'restore cancelled'
  return 'restore could not be completed; no existing Session was overwritten'
}
