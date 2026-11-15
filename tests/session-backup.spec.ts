import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { Session, SESSION_FORMAT_VERSION, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session/types'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { serializeSessionLog } from '@deepseek-ai/dsh-session-log-export'
import { strToU8, zipSync, Zip, ZipDeflate } from 'fflate'
import { openSessionBackupArchive, readSessionBackupArtifacts } from '../src/session-backup-archive.ts'
import {
  importSessionBackup,
  type SessionBackupAttachmentStore,
  type SessionBackupPersistence,
} from '../src/session-backup-import.ts'

const ROOT = SessionId('session-11111111-1111-4111-8111-111111111111')
const CHILD = SessionId('session-22222222-2222-4222-8222-222222222222')
const IMAGE = AttachmentId('image-1')

interface Stored {
  readonly header: SessionHeader
  readonly inheritedEventCount: SessionLogOffset
  readonly events: readonly SessionEvent[]
}

function turn(session: Session, text = 'context'): Session {
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text }],
  }), { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

function rootWithImage(): Session {
  const session = Session.create(ROOT, [], {
    version: SESSION_FORMAT_VERSION, id: ROOT, createdAt: 1, cwd: '/old', isSeeded: false,
  })
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' },
    content: [{ type: 'image', attachment: {
      attachmentId: IMAGE, mediaType: 'image/png', bytes: 4, width: 1, height: 1,
    } }],
  }), { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

function child(): Session {
  const session = Session.create(CHILD, [], {
    version: SESSION_FORMAT_VERSION, id: CHILD, createdAt: 2, cwd: '/old', isSeeded: false,
    parentSession: ROOT, origin: 'subagent', delegationDepth: 1,
  })
  return turn(session, 'child context')
}

function archive(sessions: readonly Session[], attachments: Record<string, Uint8Array> = {}): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  sessions.forEach((session, index) => {
    const path = index === 0 ? 'session.v4.jsonl' : `subagents/${String(session.id)}/session.v4.jsonl`
    entries[path] = strToU8(serializeSessionLog(session.header, session.snapshotEvents()))
  })
  return zipSync({ ...entries, ...attachments })
}

function duplicateArchive(): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    const zip = new Zip((error, data, final) => {
      if (error !== null) reject(error)
      chunks.push(data)
      if (final) resolve(Buffer.concat(chunks))
    })
    const text = strToU8(serializeSessionLog(rootWithImage().header, rootWithImage().snapshotEvents()))
    for (let index = 0; index < 2; index += 1) {
      const entry = new ZipDeflate('session.v4.jsonl')
      zip.add(entry)
      entry.push(text, true)
    }
    zip.end()
  })
}

class MemoryPersistence implements SessionBackupPersistence {
  readonly stored = new Map<string, Stored>()
  failOn: string | undefined

  async stat(id: SessionId): Promise<unknown | undefined> {
    return this.stored.get(String(id))
  }

  async open(id: SessionId) {
    const stored = this.stored.get(String(id))
    if (stored === undefined) throw new Error('not found')
    return this.handle(stored)
  }

  async create(header: SessionHeader, options: { readonly inheritedEventCount: SessionLogOffset }) {
    if (this.failOn === String(header.id)) throw new Error('simulated write failure')
    if (this.stored.has(String(header.id))) throw new Error('already exists')
    const stored: Stored = { header, inheritedEventCount: options.inheritedEventCount, events: [] }
    this.stored.set(String(header.id), stored)
    return this.handle(stored)
  }

  private handle(stored: Stored) {
    let current = stored.events
    return {
      header: stored.header,
      inheritedEventCount: stored.inheritedEventCount,
      read: async () => ({ events: current }),
      append: async (events: readonly SessionEvent[]) => {
        current = [...current, ...events]
        this.stored.set(String(stored.header.id), { ...stored, events: current })
      },
      flush: async () => {},
      close: async () => {},
    }
  }
}

function attachmentStore(): SessionBackupAttachmentStore & { readonly saveImage: ReturnType<typeof vi.fn> } {
  return {
    saveImage: vi.fn(async input => ({
      attachmentId: AttachmentId('normalized-image'), mediaType: input.mediaType,
      bytes: input.data.byteLength, width: 1, height: 1,
    })),
    saveFileStream: async input => {
      const chunks: Uint8Array[] = []
      for await (const chunk of input.data) chunks.push(chunk)
      const bytes = Buffer.concat(chunks)
      const digest = createHash('sha256').update(bytes).digest('hex')
      return {
        attachmentId: AttachmentId(`sha256:${digest}`), name: input.name ?? 'file', bytes: bytes.byteLength,
      }
    },
  }
}

const request = (bytes: Uint8Array, persistence: MemoryPersistence, attachments = attachmentStore()) => [{
  persistence,
  attachments,
}, {
  archive: bytes,
  maxEntryBytes: 1024 * 1024,
  workspace: { id: 'workspace', path: '/new', attachSession: vi.fn(async () => {}) },
}] as const

describe('DSH Session Backup archive', () => {
  it('reads native root and descendant V4 logs', async () => {
    const bytes = archive([rootWithImage(), child()], { 'media/image-1.png': new Uint8Array([1, 2, 3, 4]) })
    const opened = await openSessionBackupArchive(bytes, 1024 * 1024, new AbortController().signal)
    const artifacts = await readSessionBackupArtifacts(opened, new AbortController().signal)
    expect(artifacts.map(item => String(item.header.id))).toEqual([ROOT, CHILD])
    expect(artifacts[1]?.header.parentSession).toBe(ROOT)
    expect(artifacts[1]?.events.map(event => event.type)).toEqual(child().snapshotEvents().map(event => event.type))
  })

  it('rejects duplicate entries, unsupported paths, and damaged ZIP bytes', async () => {
    await expect(openSessionBackupArchive(await duplicateArchive(), 1024 * 1024, new AbortController().signal))
      .rejects.toMatchObject({ reason: 'unreadable-archive' })
    await expect(openSessionBackupArchive(zipSync({ '../session.v4.jsonl': new Uint8Array() }), 1024 * 1024, new AbortController().signal))
      .rejects.toMatchObject({ reason: 'unsupported-archive' })
    await expect(openSessionBackupArchive(new Uint8Array([1, 2, 3]), 1024 * 1024, new AbortController().signal))
      .rejects.toMatchObject({ reason: 'unreadable-archive' })
  })

  it('restores descendants and remaps normalized attachment references without overwriting on retry', async () => {
    const bytes = archive([rootWithImage(), child()], { 'media/image-1.png': new Uint8Array([1, 2, 3, 4]) })
    const persistence = new MemoryPersistence()
    const attachments = attachmentStore()
    const first = await importSessionBackup(...request(bytes, persistence, attachments), new AbortController().signal)
    expect(first).toMatchObject({ importedSessionIds: [ROOT, CHILD], existingSessionIds: [], attachmentCount: 1, partial: false })
    const stored = persistence.stored.get(ROOT)!
    const message = stored.events.find(event => event.type === 'user/message')
    expect(JSON.stringify(message)).toContain('normalized-image')
    expect(stored.header.cwd).toBe('/new')
    const second = await importSessionBackup(...request(bytes, persistence, attachments), new AbortController().signal)
    expect(second).toMatchObject({ importedSessionIds: [], existingSessionIds: [ROOT, CHILD], partial: false })
  })

  it('rejects a missing attachment and an existing conflicting Session before Session writes', async () => {
    const bytes = archive([rootWithImage()])
    const persistence = new MemoryPersistence()
    await expect(importSessionBackup(...request(bytes, persistence), new AbortController().signal))
      .rejects.toMatchObject({ reason: 'missing-attachment' })
    expect(persistence.stored.size).toBe(0)

    const complete = archive([rootWithImage()], { 'media/image-1.png': new Uint8Array([1, 2, 3, 4]) })
    const attachments = attachmentStore()
    await importSessionBackup(...request(complete, persistence, attachments), new AbortController().signal)
    const before = persistence.stored.get(ROOT)!
    persistence.stored.set(ROOT, { ...before, events: before.events.slice(1) })
    attachments.saveImage.mockClear()
    await expect(importSessionBackup(...request(complete, persistence, attachments), new AbortController().signal))
      .rejects.toMatchObject({ reason: 'session-conflict' })
    expect(attachments.saveImage).not.toHaveBeenCalled()
  })

  it('preserves a seeded Session inherited cut even when its parent is outside the archive', async () => {
    const parent = turn(Session.create(ROOT, [], {
      version: SESSION_FORMAT_VERSION, id: ROOT, createdAt: 1, cwd: '/old', isSeeded: false,
    }))
    const inherited = parent.snapshotEvents()
    const seeded = Session.create(CHILD, inherited, {
      version: SESSION_FORMAT_VERSION, id: CHILD, createdAt: 2, cwd: '/old', isSeeded: true, parentSession: ROOT,
    }, SessionLogOffset(inherited.length))
    const bytes = archive([seeded])
    const opened = await openSessionBackupArchive(bytes, 1024 * 1024, new AbortController().signal)
    const artifacts = await readSessionBackupArtifacts(opened, new AbortController().signal)
    expect(artifacts[0]?.inheritedEventCount).toBe(inherited.length)
    const persistence = new MemoryPersistence()
    const result = await importSessionBackup(...request(bytes, persistence), new AbortController().signal)
    expect(result.partial).toBe(false)
    expect(persistence.stored.get(CHILD)?.inheritedEventCount).toBe(inherited.length)
    expect(persistence.stored.get(CHILD)?.header.parentSession).toBe(ROOT)
  })

  it('reports partial recovery when a later descendant cannot be written', async () => {
    const bytes = archive([rootWithImage(), child()], { 'media/image-1.png': new Uint8Array([1, 2, 3, 4]) })
    const persistence = new MemoryPersistence()
    persistence.failOn = CHILD
    const result = await importSessionBackup(...request(bytes, persistence), new AbortController().signal)
    expect(result).toMatchObject({ importedSessionIds: [ROOT], partial: true })
    expect(result.error).toContain('simulated write failure')
  })
})
