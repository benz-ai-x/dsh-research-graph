import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { zstdCompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { logPath } from '@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts'
import { sessionFormatCatalog } from '@deepseek-ai/dsh-session-format-catalog'
import { describe, expect, it } from 'vitest'
import { migrateMergeHistory } from '../scripts/migrate-merge-history.mjs'
import { projectSessionMerge } from '../src/session-merge-projection.ts'

function history(version: number, extraSource = {}) {
  const header = {
    type: 'session', version, id: 'old-merge', createdAt: 1, cwd: '/test', delegationDepth: 0,
    ...(version < 2 ? {} : { isSeeded: false }),
  }
  const events = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'user/message', surfaceOp: 'append', data: {
      id: 'marker', role: 'user', content: [{ type: 'text', text: 'Session Merge source snapshot request.' }],
      source: { kind: 'session-graph-merge', form: 'notice', version: 1, operationId: 'old-operation', sourceIds: ['a', 'b'], ...extraSource },
    } },
    { type: 'user/message', surfaceOp: 'append', data: {
      id: 'references', role: 'user', content: [{ type: 'text', text: 'Captured sources.' }],
      source: { kind: 'session-reference', form: 'recall', version: 1,
        references: ['a', 'b'].map((sessionId, inputIndex) => ({
          sessionId, label: sessionId, capturedThroughSeq: 10 + inputIndex, compacted: false,
          originalMessages: 1, retainedMessages: 1, omittedMessages: 0, omittedBytes: 0,
          truncated: false, inputIndex,
        })),
      },
    } },
    { type: 'step/end', data: { turn: 1, step: 1 } },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  return [header, ...events.map((event, seq) => ({ ...event, seq, time: 1 }))]
    .map(row => JSON.stringify(row)).join('\n') + '\n'
}

describe('offline legacy Merge recovery', () => {
  it.each([0, 1, 2].flatMap(version => ['none', 'zstd'].map(compression => ({ version, compression }))))(
    'recovers V$version $compression for the real JSONL reader and preserves the original bytes',
    async ({ version, compression }) => {
      const root = await mkdtemp(join(tmpdir(), 'session-graph-history-'))
      const ctx = new Context()
      try {
        const source = join(root, `historical.jsonl${compression === 'zstd' ? '.zst' : ''}`)
        const bytes = Buffer.from(history(version))
        expect(() => {
          const [header, ...events] = history(version).trimEnd().split('\n').map(line => JSON.parse(line))
          const restore = sessionFormatCatalog.createRestore(header, { recovery: 'strict', validation: 'current' })
          events.forEach(event => restore.decodeRow(event))
          restore.finish()
        }).toThrow('unclassified message source')
        const original = compression === 'zstd' ? zstdCompressSync(bytes) : bytes
        await writeFile(source, original)
        const checked = await migrateMergeHistory(source)
        expect(checked).toMatchObject({ mode: 'check', repairedMessages: 1, sourceVersion: version, targetVersion: 3 })
        const bundled = JSON.parse(execFileSync(process.execPath, ['lib/migrate-merge-history.js', '--input', source], { encoding: 'utf8' }))
        expect(bundled).toEqual(checked)
        expect(await readdir(root)).toEqual([source.slice(root.length + 1)])
        const output = logPath(join(root, 'recovered'), '/test', 'old-merge' as never, compression as 'none' | 'zstd')
        await mkdir(dirname(output), { recursive: true })
        expect(await migrateMergeHistory(source, { output })).toMatchObject({
          mode: 'written', repairedMessages: 1, sourceSha256: checked.sourceSha256,
        })
        expect(await readFile(source)).toEqual(original)
        await ctx.plugin(SessionStore)
        await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'recovered'), compression })
        const reader = await ctx.sessionPersistence.open('old-merge' as never, 'read')
        try {
          const inspected = await reader.read()
          expect(projectSessionMerge(inspected.events)).toMatchObject({
            operationId: 'old-operation', sources: [
              { sessionId: 'a', capturedThroughSeq: 10 }, { sessionId: 'b', capturedThroughSeq: 11 },
            ],
          })
          expect(inspected.events.filter(event => event.type === 'user/message').map(event => event.data.id))
            .toEqual(['marker', 'references'])
        } finally {
          await reader.close()
        }
        const existing = await readFile(output)
        await expect(migrateMergeHistory(source, { output })).rejects.toThrow()
        expect(await readFile(output)).toEqual(existing)
        expect((await readdir(dirname(output))).some(name => name.endsWith('.tmp'))).toBe(false)
      } finally {
        await ctx.fiber.dispose()
        await rm(root, { recursive: true, force: true })
      }
    },
  )

  it('refuses unaudited marker fields, truncated input, input replacement, and oversize reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'session-graph-history-refusal-'))
    try {
      const source = join(root, 'old.jsonl')
      const output = join(root, 'session.v3.jsonl')
      await writeFile(source, history(2, { unexpectedCoordinate: 1 }))
      await expect(migrateMergeHistory(source, { output })).rejects.toThrow('unrecognized legacy')
      await writeFile(source, history(2).trimEnd())
      await expect(migrateMergeHistory(source, { output })).rejects.toThrow('complete final JSONL line')
      await writeFile(source, history(2))
      await expect(migrateMergeHistory(source, { output: source })).rejects.toThrow('differ')
      await expect(migrateMergeHistory(source, { output, maxBytes: 1 })).rejects.toThrow('maxBytes')
      expect(await readdir(root)).toEqual(['old.jsonl'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
