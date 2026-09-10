/** Install, boot, exercise, and remove the actual archive in an isolated web profile. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const repo = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'))
if (!process.env.DSH_HARNESS_ROOT) throw new Error('DSH_HARNESS_ROOT must point to the matching built Harness checkout')
const harness = resolve(process.env.DSH_HARNESS_ROOT)
assert.equal(JSON.parse(await readFile(join(harness, 'package.json'), 'utf8')).version, manifest.version)
const archiveName = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`
const archive = resolve(process.argv[2] ?? join(repo, '.artifacts', archiveName))
await access(archive)
const harnessRequire = createRequire(join(harness, 'package.json'))
const launcher = ['--import', harnessRequire.resolve('tsx/esm'), join(harness, 'apps/cli/src/bin.ts')]
const root = await mkdtemp(join(tmpdir(), 'session-graph-profile-'))
const workspace = join(root, 'workspace')
await mkdir(workspace)
const reportPath = join(root, 'report.json')
const env = {
  ...process.env,
  DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, 'agents'),
  DSH_TELEMETRY_DISABLED: '1', TSX_TSCONFIG_PATH: join(harness, 'tsconfig.base.json'),
  SESSION_GRAPH_SMOKE_REPORT: reportPath,
}
// Boot output can contain a one-time browser credential; never print raw logs.
const redact = text => text.replace(/https?:\/\/\S+/g, '[URL omitted]').slice(-12_000)
function launch(args) {
  let output = ''
  const child = spawn(process.execPath, [...launcher, ...args], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const capture = chunk => { output = (output + chunk).slice(-64_000) }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  const done = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  return { child, done, output: () => output }
}
async function command(args) {
  const run = launch(args)
  const timeout = globalThis.setTimeout(() => run.child.kill('SIGKILL'), 120_000)
  try {
    const result = await run.done
    assert.equal(result.code, 0, `${args.join(' ')} failed: ${redact(run.output())}`)
    return run.output()
  } finally {
    clearTimeout(timeout)
  }
}
let app
try {
  await command(['plugin', '--profile', 'web', 'add', archive])
  assert.ok((await command(['--profile', 'web', '--dump-config'])).includes(`name: '${manifest.name}'`))
  assert.ok((await command(['plugin', '--profile', 'web', 'exec', 'dsh-research-graph-migrate', '--help']))
    .includes('Without --output, validates only.'))
  const patch = join(root, 'smoke.patch.yml')
  await writeFile(patch, `- id: session-query-sqlite\n  config:\n    path: ':memory:'\n    openAt: first-search\n- insert:\n    - id: session-graph-smoke\n      name: ${JSON.stringify(join(repo, 'tests/fixtures/profile-smoke.mjs'))}\n`)
  app = launch(['--profile', 'web', '--patch', patch, '--port', '0', '--no-open'])
  const signal = AbortSignal.timeout(90_000)
  let report
  for (;;) {
    signal.throwIfAborted()
    assert.equal(app.child.exitCode, null, `Profile exited: ${redact(app.output())}`)
    try {
      report = JSON.parse(await readFile(reportPath, 'utf8'))
      break
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await setTimeout(100, undefined, { signal })
  }
  assert.equal(report.ok, true, report.error)
  app.child.kill('SIGINT')
  const timeout = globalThis.setTimeout(() => app?.child.kill('SIGKILL'), 20_000)
  const stopped = await app.done.finally(() => clearTimeout(timeout))
  assert.equal(stopped.code, 130, `Profile did not complete its SIGINT shutdown: ${redact(app.output())}`)
  app = undefined
  await command(['plugin', '--profile', 'web', 'remove', manifest.name])
  assert.ok(!(await command(['--profile', 'web', '--dump-config'])).includes(manifest.name))
  const profile = JSON.parse(await readFile(join(env.DSH_HOME, 'profiles/web/package.json'), 'utf8'))
  assert.equal(profile.dependencies?.[manifest.name], undefined)
  console.log(JSON.stringify({ ...report, version: manifest.version, packedInstall: true, removed: true }))
} catch (error) {
  throw new Error(`${error.message}${app ? `\n${redact(app.output())}` : ''}`, { cause: error })
} finally {
  if (app) {
    app.child.kill('SIGKILL')
    await app.done
  }
  await rm(root, { recursive: true, force: true })
}
