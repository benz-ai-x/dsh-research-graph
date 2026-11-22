import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import { LocalAttachmentStore } from '@deepseek-ai/dsh-attachment-local'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { readSessionLogText, sessionLogZipEntries } from '@deepseek-ai/dsh-session-log-export'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { importSessionBackup } from '../src/session-backup-import.ts'
import { SessionGraphBackupService } from '../src/session-backup-host.ts'
import { writeColdHistory } from './fixtures/sessions.ts'

const ROOT = SessionId('session-11111111-1111-4111-8111-111111111111')
const CHILD = SessionId('session-22222222-2222-4222-8222-222222222222')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const FILE = new TextEncoder().encode('backup file contents')

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function host(root: string) {
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'data') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions'), compression: 'none' })
  await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:', openAt: 'never' })
  await ctx.plugin(WorkspaceRegistry)
  await ctx.plugin(LocalAttachmentStore, { dshHome: join(root, 'home') })
  return { ctx, attachments: ctx.attachments }
}

async function persist(ctx: Context, session: Session): Promise<void> {
  const handle = await ctx.sessionPersistence.create(session.header)
  try {
    await handle.append(session.snapshotEvents())
    await handle.flush()
  } finally {
    await handle.close()
  }
}

async function sourceArchive(ctx: Context, imageRef: Awaited<ReturnType<LocalAttachmentStore['saveImage']>>, fileRef: Awaited<ReturnType<LocalAttachmentStore['saveFile']>>) {
  const root = ctx.sessions.prepare(ROOT, { meta: { cwd: '/source' } })
  await writeColdHistory(ctx, root, () => {
    root.append('turn/start', { turn: 1 })
    root.append('step/start', { turn: 1, step: 1 })
    root.append('user/message', createUserMessage({
      source: { kind: 'user' },
      content: [
        { type: 'text', text: 'complete context' },
        { type: 'image', attachment: imageRef },
        { type: 'file', attachment: fileRef },
      ],
    }), { surfaceOp: 'append' })
    root.append('step/end', { turn: 1, step: 1 })
    root.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  })
  await persist(ctx, root)
  const child = ctx.sessions.prepare(CHILD, {
    meta: { cwd: '/source', parentSession: ROOT, origin: 'subagent', delegationDepth: 1 },
  })
  await writeColdHistory(ctx, child, () => {
    child.append('turn/start', { turn: 1 })
    child.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  })
  await persist(ctx, child)
  const rootContent = await readSessionLogText(ctx.sessionPersistence, ROOT)
  if (rootContent === undefined) throw new Error('source root was not stored')
  const entries: Record<string, Uint8Array> = {}
  for await (const entry of sessionLogZipEntries({
    sessionQuery: ctx.sessionQuery,
    sessionPersistence: ctx.sessionPersistence,
    attachments: ctx.attachments,
    sessions: ctx.sessions,
  }, rootContent, ROOT, true)) {
    if ('content' in entry) entries[entry.path] = new TextEncoder().encode(entry.content)
    else if ('data' in entry) entries[entry.path] = entry.data
    else {
      const chunks: Uint8Array[] = []
      for await (const chunk of entry.chunks) chunks.push(chunk)
      entries[entry.path] = Buffer.concat(chunks)
    }
  }
  return zipSync(entries)
}

describe('native Session Backup round trip', () => {
  it('allows owner limits and rejects a non-owner Remote caller', () => {
    const signal = new AbortController().signal
    const owner = Reflect.apply(SessionGraphBackupService.prototype.limits, {
      ctx: { invocation: undefined }, maxUploadBytes: 8, maxEntryBytes: 4,
    }, [signal])
    expect(owner).toEqual({ maxUploadBytes: 8, maxEntryBytes: 4 })
    expect(() => Reflect.apply(SessionGraphBackupService.prototype.limits, {
      ctx: { invocation: { peer: { principal: { kind: 'test-guest' } } } },
    }, [signal])).toThrow('only the owner may restore Session backups')
  })

  it('aborts and waits for an active import during disposal', async () => {
    const controller = new AbortController()
    let finish: () => void = () => {}
    const settled = new Promise<void>(resolve => { finish = resolve })
    const state = { active: { controller, settled }, disposal: undefined }
    const disposal = Reflect.apply(SessionGraphBackupService.prototype.dispose, state, []) as Promise<void>
    expect(controller.signal.aborted).toBe(true)
    let completed = false
    void disposal.then(() => { completed = true })
    await new Promise(resolve => setImmediate(resolve))
    expect(completed).toBe(false)
    finish()
    await disposal
    expect(completed).toBe(true)
  })

  it('restores native ZIP logs, descendants, and attachments into a separate durable Host', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'session-backup-roundtrip-')))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    const sourceDirectory = join(root, 'source')
    const targetDirectory = join(root, 'target')
    await mkdir(sourceDirectory)
    await mkdir(targetDirectory)
    const source = await host(join(root, 'source-host'))
    const imageRef = await source.attachments.saveImage({ data: PNG, mediaType: 'image/png', name: 'context.png' })
    const fileRef = await source.attachments.saveFile({ data: FILE, name: 'context.txt' })
    const bytes = await sourceArchive(source.ctx, imageRef, fileRef)

    const target = await host(join(root, 'target-host'))
    const workspace = await target.ctx.workspaceRegistry.create(targetDirectory, 'Restored')
    const result = await importSessionBackup({
      persistence: target.ctx.sessionPersistence,
      attachments: target.attachments,
    }, {
      archive: bytes,
      workspace,
      maxEntryBytes: 1024 * 1024,
    }, new AbortController().signal)
    expect(result).toMatchObject({ importedSessionIds: [ROOT, CHILD], attachmentCount: 2, partial: false })
    expect(workspace.sessionIds).toEqual([ROOT])

    const handle = await target.ctx.sessionPersistence.open(ROOT, 'read')
    try {
      const restored = await handle.read()
      const sourceEvents = (await source.ctx.sessionQuery.readSession(ROOT)).events
      expect(restored.events).toEqual(sourceEvents)
      expect(JSON.stringify(restored.events)).toContain('complete context')
      expect(handle.header.cwd).toBe(targetDirectory)
      const user = restored.events.find(event => event.type === 'user/message')
      const content = (user?.data as { content: readonly (
        | { readonly type: 'text'; readonly text: string }
        | { readonly type: 'image'; readonly attachment: ImageAttachmentRef }
        | { readonly type: 'file'; readonly attachment: FileAttachmentRef }
      )[] }).content
      const restoredImage = content.find(part => part.type === 'image')!.attachment
      const restoredFile = content.find(part => part.type === 'file')!.attachment
      expect((await target.attachments.readImage(restoredImage)).data).toEqual((await source.attachments.readImage(imageRef)).data)
      const chunks: Uint8Array[] = []
      for await (const chunk of target.attachments.readFileStream(restoredFile)) chunks.push(chunk)
      expect(new Uint8Array(Buffer.concat(chunks))).toEqual(FILE)
    } finally {
      await handle.close()
    }

    const retry = await importSessionBackup({
      persistence: target.ctx.sessionPersistence,
      attachments: target.attachments,
    }, { archive: bytes, workspace, maxEntryBytes: 1024 * 1024 }, new AbortController().signal)
    expect(retry).toMatchObject({ importedSessionIds: [], existingSessionIds: [ROOT, CHILD], partial: false })

    await target.ctx.fiber.dispose()
    const restarted = await host(join(root, 'target-host'))
    const reopened = await restarted.ctx.sessionPersistence.open(CHILD, 'read')
    try {
      expect((await reopened.read()).events.map(event => event.type)).toContain('turn/end')
      expect(reopened.header.parentSession).toBe(ROOT)
    } finally {
      await reopened.close()
    }
  })
})
