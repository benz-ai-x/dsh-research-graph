#!/usr/bin/env node
/** Offline recovery of legacy Merge messages into a separately validated V3 artifact. */
import { createHash, randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { link, open, realpath, unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { constants, zstdCompress, zstdDecompress } from 'node:zlib'
import { sessionFormatCatalog } from '@deepseek-ai/dsh-session-format-catalog'

const compress = promisify(zstdCompress)
const decompress = promisify(zstdDecompress)
const DEFAULT_MAX_BYTES = 128 * 1024 * 1024
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isCompressed = path => /\.zstd?$/.test(path)

/** Rewrite only the historical message variant owned by this plugin. */
function repairMessage(message, report) {
  if (!object(message) || !object(message.source) || message.source.kind !== 'session-graph-merge') return message
  const source = message.source
  const allowed = ['kind', 'version', 'operationId', 'sourceIds', 'form']
  if (message.role !== 'user' || !Array.isArray(message.content)
    || source.version !== 1 || typeof source.operationId !== 'string' || source.operationId.trim() === ''
    || !Array.isArray(source.sourceIds) || source.sourceIds.length < 2 || source.sourceIds.length > 3
    || source.sourceIds.some(id => typeof id !== 'string' || id.trim() === '')
    || new Set(source.sourceIds).size !== source.sourceIds.length
    || Object.keys(source).some(key => !allowed.includes(key))
    || (source.form !== undefined && source.form !== 'notice')) {
    throw new Error('Refusing an unrecognized legacy Session Graph Merge marker')
  }
  report.repairedMessages += 1
  return {
    ...message,
    source: {
      kind: 'plugin', plugin: 'dsh-session-graph', form: 'notice',
      summary: 'Session Merge source snapshot request.',
    },
    content: [...message.content, {
      type: 'text',
      text: JSON.stringify({
        kind: 'session-graph-merge', version: 1,
        operationId: source.operationId, sourceIds: source.sourceIds,
      }),
    }],
  }
}

function repairRow(row, report) {
  if (!object(row) || !object(row.data)) return row
  switch (row.type) {
    case 'user/message':
      return { ...row, data: repairMessage(row.data, report) }
    case 'agent/inbox/spliced':
    case 'session/title-llm-request': {
      const field = row.type === 'agent/inbox/spliced' ? 'inserted' : 'messages'
      if (!Array.isArray(row.data[field])) return row
      return { ...row, data: { ...row.data, [field]: row.data[field].map(value => repairMessage(value, report)) } }
    }
    default:
      return row
  }
}

function restoreRows(rows, transform) {
  const restore = sessionFormatCatalog.createRestore(rows[0], { recovery: 'strict', validation: 'current' })
  for (const row of rows.slice(1)) restore.decodeRow(transform(row))
  return restore.finish()
}

async function readStableFile(path, maxBytes) {
  const source = await open(path, 'r')
  try {
    const before = await source.stat({ bigint: true })
    if (!before.isFile() || before.size > BigInt(maxBytes)) throw new Error('Input is not a file within maxBytes')
    // Read at most one byte beyond the admitted size, even if another writer grows the file.
    const bytes = Buffer.alloc(Number(before.size) + 1)
    let length = 0
    while (length < bytes.length) {
      const { bytesRead } = await source.read(bytes, length, bytes.length - length)
      if (bytesRead === 0) break
      length += bytesRead
    }
    const after = await source.stat({ bigint: true })
    if (BigInt(length) !== before.size || before.size !== after.size || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs) throw new Error('Source changed during the read; stop DSH and retry')
    return bytes.subarray(0, length)
  } finally {
    await source.close()
  }
}

/** Validate a legacy artifact; output is opt-in, exclusive, and never replaces the input. */
export async function migrateMergeHistory(input, { output, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('maxBytes must be a positive safe integer')
  const sourcePath = await realpath(input)
  const targetPath = output === undefined ? undefined : resolve(await realpath(dirname(resolve(output))), basename(output))
  if (targetPath === sourcePath) throw new Error('Output must differ from the source')
  const bytes = await readStableFile(sourcePath, maxBytes)
  const decoded = isCompressed(sourcePath) ? await decompress(bytes, { maxOutputLength: maxBytes }) : bytes
  const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded)
  if (!text.endsWith('\n')) throw new Error('Refusing a source without a complete final JSONL line')
  const rows = text.slice(0, -1).split('\n').map(line => JSON.parse(line))
  const version = rows[0]?.version ?? 0
  if (![0, 1, 2].includes(version)) throw new Error('Recovery requires a historical V0, V1, or V2 Session')
  const report = {
    sessionId: rows[0]?.id,
    sourceVersion: version,
    targetVersion: sessionFormatCatalog.currentVersion,
    repairedMessages: 0,
    sourceSha256: digest(bytes),
  }
  const artifact = restoreRows(rows, row => repairRow(row, report))
  if (report.repairedMessages === 0) throw new Error('No legacy Session Graph Merge marker found; use normal DSH migration')
  const header = sessionFormatCatalog.encodeCurrentHeader(artifact.header, artifact.inheritedEventCount)
  const events = artifact.events.map(event => sessionFormatCatalog.encodeCurrentEvent(event))
  // A second complete current-format restore validates exactly what will be published.
  restoreRows([header, ...events], row => row)
  const headerBytes = Buffer.from(`${JSON.stringify(header)}\n`)
  const bodyBytes = Buffer.from(events.map(event => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''))
  if (headerBytes.length + bodyBytes.length > maxBytes) throw new Error('Migrated output exceeds maxBytes')
  const compressed = isCompressed(targetPath ?? sourcePath)
  const options = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }
  const result = compressed
    ? Buffer.concat([await compress(headerBytes, options), await compress(bodyBytes, options)])
    : Buffer.concat([headerBytes, bodyBytes])
  const summary = { ...report, eventCount: artifact.events.length, outputSha256: digest(result), outputBytes: result.length }
  if (targetPath === undefined) return { ...summary, mode: 'check' }

  // Staging beside the destination allows atomic exclusive publication on the same filesystem.
  const stagedPath = resolve(dirname(targetPath), `.${basename(targetPath)}.${randomUUID()}.tmp`)
  const staged = await open(stagedPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600)
  try {
    await staged.writeFile(result)
    await staged.sync()
    await staged.close()
    if (digest(await readStableFile(sourcePath, maxBytes)) !== report.sourceSha256) {
      throw new Error('Source changed before publication; stop DSH and retry')
    }
    await link(stagedPath, targetPath)
  } finally {
    await staged.close()
    await unlink(stagedPath)
  }
  return { ...summary, mode: 'written', output: targetPath }
}

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: 'string' }, output: { type: 'string' }, 'max-bytes': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  } })
  if (values.help) {
    console.log('Usage: dsh-research-graph-migrate --input <historical.jsonl[.zstd]> [--output <session.v3.jsonl[.zstd]>] [--max-bytes <bytes>]\nWithout --output, validates only. Stop DSH before placing a recovered file in a Session directory. Existing files are never overwritten.')
    return
  }
  if (!values.input) throw new Error('--input is required; use --help for usage')
  const result = await migrateMergeHistory(values.input, {
    ...(values.output === undefined ? {} : { output: values.output }),
    ...(values['max-bytes'] === undefined ? {} : { maxBytes: Number(values['max-bytes']) }),
  })
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
