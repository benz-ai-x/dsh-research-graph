import { unzip } from 'fflate'
import type { UnzipFileInfo, Unzipped } from 'fflate'
import { sessionFormatCatalog } from '@deepseek-ai/dsh-session-format-catalog'
import type { SessionEvent, SessionHeader, SessionLogOffset } from '@deepseek-ai/dsh-session/types'
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { SessionBackupError } from './session-backup.ts'

export interface SessionBackupArtifact {
  readonly path: string
  readonly header: SessionHeader
  readonly inheritedEventCount: SessionLogOffset
  readonly events: readonly SessionEvent[]
}

export interface SessionBackupArchive {
  has(path: string): boolean
  read(path: string, signal: AbortSignal): Promise<Uint8Array>
  readonly paths: readonly string[]
}

export async function openSessionBackupArchive(
  bytes: Uint8Array,
  maxEntryBytes: number,
  signal: AbortSignal,
): Promise<SessionBackupArchive> {
  const directory = new Map<string, UnzipFileInfo>()
  try {
    await unzipAsync(bytes, file => {
      if (directory.has(file.name)) throw new SessionBackupError('unreadable-archive', `duplicate ZIP entry: ${file.name}`)
      if (file.originalSize > maxEntryBytes || file.size > maxEntryBytes) {
        throw new SessionBackupError('too-large', `ZIP entry exceeds ${maxEntryBytes} bytes: ${file.name}`)
      }
      if (file.compression === 0 && file.size !== file.originalSize) {
        throw new SessionBackupError('unreadable-archive', `stored ZIP entry has inconsistent sizes: ${file.name}`)
      }
      validateEntryPath(file.name)
      directory.set(file.name, file)
      return false
    }, signal)
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof SessionBackupError) throw error
    throw new SessionBackupError('unreadable-archive', 'the uploaded file is not a readable ZIP archive', { cause: error })
  }
  if (!directory.has('session.v4.jsonl')) {
    throw new SessionBackupError('unsupported-archive', 'the archive has no root session.v4.jsonl')
  }
  return {
    paths: [...directory.keys()],
    has: path => directory.has(path),
    read: async (path, readSignal) => {
      const info = directory.get(path)
      if (info === undefined) throw new SessionBackupError('unsupported-archive', `ZIP entry is absent: ${path}`)
      try {
        const files = await unzipAsync(bytes, file => file.name === path, readSignal)
        const data = files[path]
        if (data === undefined) throw new SessionBackupError('unreadable-archive', `ZIP entry cannot be read: ${path}`)
        if (data.byteLength !== info.originalSize) {
          throw new SessionBackupError('unreadable-archive', `ZIP entry size differs from its directory: ${path}`)
        }
        return data
      } catch (error) {
        readSignal.throwIfAborted()
        if (error instanceof SessionBackupError) throw error
        throw new SessionBackupError('unreadable-archive', `ZIP entry cannot be decompressed: ${path}`, { cause: error })
      }
    },
  }
}

function validateEntryPath(path: string): void {
  const valid = path === 'session.v4.jsonl'
    || path === 'attachments-missing.txt'
    || /^subagents\/[A-Za-z0-9_-]+\/session\.v4\.jsonl$/u.test(path)
    || /^media\/(?:[A-Za-z0-9_-]+|sha256:[a-f0-9]{64})\.(?:png|jpg|webp|gif)$/u.test(path)
    || /^files\/[a-f0-9]{2}\/[a-f0-9]{64}\/[^/\\]+$/u.test(path)
  if (!valid) throw new SessionBackupError('unsupported-archive', `unsupported ZIP entry: ${path}`)
}

function unzipAsync(
  archive: Uint8Array,
  filter: (file: UnzipFileInfo) => boolean,
  signal: AbortSignal,
): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const onAbort = (): void => {
      terminate()
      reject(signal.reason)
    }
    const terminate = unzip(archive, { filter }, (error, files) => {
      signal.removeEventListener('abort', onAbort)
      if (error === null) resolve(files)
      else reject(error)
    })
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function readSessionBackupArtifacts(
  archive: SessionBackupArchive,
  signal: AbortSignal,
): Promise<readonly SessionBackupArtifact[]> {
  const paths = ['session.v4.jsonl', ...archive.paths.filter(path => path.startsWith('subagents/')).sort()]
  const artifacts: SessionBackupArtifact[] = []
  const ids = new Set<string>()
  for (const path of paths) {
    signal.throwIfAborted()
    const artifact = decodeArtifact(await archive.read(path, signal))
    const id = String(artifact.header.id)
    if (ids.has(id)) throw new SessionBackupError('unsupported-archive', `duplicate Session id: ${id}`)
    ids.add(id)
    if (path !== 'session.v4.jsonl') {
      const match = /^subagents\/([A-Za-z0-9_-]+)\/session\.v4\.jsonl$/u.exec(path)
      if (match?.[1] !== safeSessionId(id)) {
        throw new SessionBackupError('unsupported-archive', `Session path does not match its header id: ${path}`)
      }
    }
    artifacts.push({ path, ...artifact })
  }
  return artifacts
}

function decodeArtifact(bytes: Uint8Array): Omit<SessionBackupArtifact, 'path'> {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const lines = text.split('\n')
    if (lines.at(-1) !== '') throw new Error('Session log must end with a newline')
    lines.pop()
    if (lines.length < 1 || lines[0] === undefined) throw new Error('Session log has no header')
    const restore = sessionFormatCatalog.createRestore(JSON.parse(lines[0]), {
      recovery: 'strict', validation: 'current',
    })
    for (const line of lines.slice(1)) {
      if (line === '') throw new Error('Session log contains an empty row')
      restore.decodeRow(JSON.parse(line))
    }
    const artifact = restore.finish()
    return {
      header: artifact.header as unknown as SessionHeader,
      inheritedEventCount: artifact.inheritedEventCount as SessionLogOffset,
      events: artifact.events as unknown as readonly SessionEvent[],
    }
  } catch (error) {
    if (error instanceof SessionBackupError) throw error
    throw new SessionBackupError('unsupported-archive', `invalid Session log: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

function safeSessionId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/gu, '_')
}

export interface AttachmentPlan {
  readonly key: string
  readonly path: string
  readonly ref: ImageAttachmentRef | FileAttachmentRef
}

export function sessionBackupAttachmentPlans(
  artifacts: readonly Pick<SessionBackupArtifact, 'events'>[],
): ReadonlyMap<string, AttachmentPlan> {
  const plans = new Map<string, AttachmentPlan>()
  for (const artifact of artifacts) {
    for (const event of artifact.events) collectEventPlans(event, plans)
  }
  return plans
}

function imagePath(ref: ImageAttachmentRef): string {
  const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const
  return `media/${String(ref.attachmentId)}.${extensions[ref.mediaType]}`
}

function filePath(ref: FileAttachmentRef): string {
  const digest = String(ref.attachmentId).replace(/^sha256:/u, '')
  const name = ref.name.replace(/[\\/\u0000-\u001f\u007f]/gu, '_')
  const safeName = name === '.' || name === '..' || name === '' ? 'file' : name
  return `files/${digest.slice(0, 2)}/${digest}/${safeName}`
}

function planFor(ref: ImageAttachmentRef | FileAttachmentRef): AttachmentPlan {
  if ('mediaType' in ref) {
    const path = imagePath(ref)
    return { key: `image\u0000${path}`, path, ref }
  }
  const path = filePath(ref)
  return { key: `file\u0000${path}`, path, ref }
}

function collectContentPlans(content: unknown, plans: Map<string, AttachmentPlan>): void {
  if (!Array.isArray(content)) return
  for (const block of content) {
    if (typeof block !== 'object' || block === null || Array.isArray(block)) continue
    const value = block as { type?: unknown; attachment?: unknown }
    if ((value.type !== 'image' && value.type !== 'file') || typeof value.attachment !== 'object' || value.attachment === null) continue
    const plan = planFor(value.attachment as ImageAttachmentRef | FileAttachmentRef)
    plans.set(plan.key, plan)
  }
}

function collectEventPlans(event: SessionEvent, plans: Map<string, AttachmentPlan>): void {
  if (typeof event.data !== 'object' || event.data === null) return
  const carrier = event.data as {
    content?: unknown
    message?: { content?: unknown }
    inserted?: unknown
    summary?: unknown
    rawOutput?: unknown
    stream?: Array<{ type?: unknown; chunk?: { type?: unknown; block?: unknown } }>
  }
  const eventType: string = event.type
  switch (eventType) {
    case 'user/message': case 'tool/ptc-dispatch':
      collectContentPlans(carrier.content, plans)
      return
    case 'system/message': case 'developer/message': case 'tool/result': case 'team/message/queued':
      collectContentPlans(carrier.message?.content, plans)
      return
    case 'agent/inbox/spliced':
      if (Array.isArray(carrier.inserted)) {
        for (const message of carrier.inserted) {
          if (typeof message === 'object' && message !== null) collectContentPlans((message as { content?: unknown }).content, plans)
        }
      }
      return
    case 'compaction/summary':
      collectContentPlans(carrier.summary, plans)
      collectContentPlans(carrier.rawOutput, plans)
      return
    case 'assistant/message':
      collectContentPlans(carrier.message?.content, plans)
      break
    default: return
  }
  for (const record of carrier.stream ?? []) {
    if (record.type === 'chunk' && record.chunk?.type === 'block-end') collectContentPlans([record.chunk.block], plans)
  }
}

export function remapSessionBackupAttachments(
  artifacts: readonly SessionBackupArtifact[],
  restored: ReadonlyMap<string, ImageAttachmentRef | FileAttachmentRef>,
): readonly SessionBackupArtifact[] {
  return artifacts.map(artifact => ({
    ...artifact,
    events: artifact.events.map(event => remapEvent(event, restored)),
  }))
}

function remapContent(content: unknown, restored: ReadonlyMap<string, ImageAttachmentRef | FileAttachmentRef>): unknown {
  if (!Array.isArray(content)) return content
  return content.map(block => {
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return block
    const value = block as { type?: unknown; attachment?: unknown }
    if ((value.type !== 'image' && value.type !== 'file') || typeof value.attachment !== 'object' || value.attachment === null) return block
    const plan = planFor(value.attachment as ImageAttachmentRef | FileAttachmentRef)
    const attachment = restored.get(plan.key)
    if (attachment === undefined) throw new SessionBackupError('missing-attachment', `attachment was not restored: ${plan.path}`)
    return { ...value, attachment }
  })
}

function remapEvent(event: SessionEvent, restored: ReadonlyMap<string, ImageAttachmentRef | FileAttachmentRef>): SessionEvent {
  if (typeof event.data !== 'object' || event.data === null) return event
  const data = event.data as Record<string, unknown> & {
    message?: { content?: unknown }
    stream?: Array<{ type?: unknown; chunk?: { type?: unknown; block?: unknown } }>
  }
  const next: Record<string, unknown> = { ...data }
  const eventType: string = event.type
  switch (eventType) {
    case 'user/message': case 'tool/ptc-dispatch':
      next['content'] = remapContent(data['content'], restored)
      break
    case 'system/message': case 'developer/message': case 'tool/result': case 'team/message/queued':
      if (data.message !== undefined) next['message'] = { ...data.message, content: remapContent(data.message.content, restored) }
      break
    case 'agent/inbox/spliced':
      if (Array.isArray(data['inserted'])) next['inserted'] = data['inserted'].map(message => {
        if (typeof message !== 'object' || message === null) return message
        return { ...message, content: remapContent((message as { content?: unknown }).content, restored) }
      })
      break
    case 'compaction/summary':
      next['summary'] = remapContent(data['summary'], restored)
      next['rawOutput'] = remapContent(data['rawOutput'], restored)
      break
    case 'assistant/message':
      if (data.message !== undefined) next['message'] = { ...data.message, content: remapContent(data.message.content, restored) }
      if (Array.isArray(data.stream)) next['stream'] = data.stream.map(record => {
        if (record.type !== 'chunk' || record.chunk?.type !== 'block-end') return record
        return { ...record, chunk: { ...record.chunk, block: (remapContent([record.chunk.block], restored) as unknown[])[0] } }
      })
      break
    default: return event
  }
  return { ...event, data: next } as SessionEvent
}
