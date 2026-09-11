/** Install and run the throwaway UI inside a retained, isolated DSH web profile. */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'))
let harness = resolve(process.env.DSH_HARNESS_ROOT ?? join(repo, `../deepseek-harness-${manifest.version}`))
const artifacts = join(repo, '.artifacts/prototype-dsh')
const root = join(artifacts, 'profile')
const stateFile = join(artifacts, 'state.json')
let previous
try { previous = JSON.parse(await readFile(stateFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
let running = false
if (previous?.running) { try { process.kill(previous.managerPid, 0); running = true } catch {} }
if (process.argv.includes('--stop')) {
  if (running) { process.kill(previous.managerPid, 'SIGINT'); console.log('Stopping the prototype DSH. Its research data is retained.') }
  else console.log('The prototype DSH is not running.')
  process.exit(0)
}
if (running) {
  console.log(`Prototype DSH is already running: ${previous.url}\nStop it with: pnpm prototype:dsh --stop`)
  process.exit(0)
}
let upstream
try { upstream = JSON.parse(await readFile(join(harness, 'package.json'), 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
  harness = resolve(repo, `../deepseek-harness-${manifest.version}`)
  upstream = JSON.parse(await readFile(join(harness, 'package.json'), 'utf8'))
  console.log(`Configured DSH checkout was unavailable; using the matching sibling checkout: ${harness}`)
}
if (upstream.version !== manifest.version) throw new Error(`Use the matching DSH ${manifest.version} checkout (DSH_HARNESS_ROOT). Found ${upstream.version}`)
const harnessRequire = createRequire(join(harness, 'package.json'))
const launcher = ['--import', harnessRequire.resolve('tsx/esm'), join(harness, 'apps/cli/src/bin.ts')]
const env = { ...process.env, DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, 'agents'),
  DSH_TELEMETRY_DISABLED: '1', TSX_TSCONFIG_PATH: join(harness, 'tsconfig.base.json'),
  RESEARCH_PROTOTYPE_ROOT: root, DSH_RESEARCH_GRAPH_PROTOTYPE: '1' }
await mkdir(join(root, 'workspace'), { recursive: true })
await writeFile(join(root, 'PROTOTYPE.txt'), 'PROTOTYPE — isolated research experience. Data is retained between runs. Never point this launcher at a real DSH profile.\n')
const redact = output => output.replace(/https?:\/\/\S+/g, '[local URL]').slice(-5000)
function launch(binary, args, cwd) {
  const child = spawn(binary, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const capture = chunk => { output = (output + chunk).slice(-100000) }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })) })
  return { child, done, output: () => output }
}
async function command(binary, args, cwd = repo) {
  const task = launch(binary, args, cwd)
  const timeout = globalThis.setTimeout(() => task.child.kill('SIGKILL'), 180000)
  try {
    const result = await task.done
    if (result.code !== 0) throw new Error(`${binary} ${args.join(' ')} failed\n${redact(task.output())}`)
  } finally { clearTimeout(timeout) }
}
console.log('Building the prototype plugin…')
const pnpmCli = process.env.npm_execpath
const packageCommand = pnpmCli ? process.execPath : 'pnpm'
const packageArgs = pnpmCli ? [pnpmCli] : []
await command(packageCommand, [...packageArgs, 'run', 'build'])
await command(packageCommand, [...packageArgs, 'pack', '--pack-destination', artifacts])
const archive = join(artifacts, `benz-ai-x-dsh-research-graph-${manifest.version}.tgz`)
const cli = args => command(process.execPath, [...launcher, ...args], join(root, 'workspace'))
if (previous) await cli(['plugin', '--profile', 'web', 'remove', manifest.name])
await cli(['plugin', '--profile', 'web', 'add', archive])
const patch = join(root, 'prototype.patch.yml')
await writeFile(patch, `- id: storage-json\n  config:\n    root: ${JSON.stringify(join(root, 'storage'))}\n- id: session-query-sqlite\n  config:\n    path: ':memory:'\n    openAt: first-search\n- insert:\n    - id: research-prototype-fixture\n      name: ${JSON.stringify(join(repo, 'scripts/prototype/fixture.mjs'))}\n`)
await rm(join(root, 'fixture-ready.json'), { force: true })
await rm(join(root, 'fixture-error.txt'), { force: true })
console.log('Starting the isolated DSH and preparing example research…')
const port = previous?.url ? new URL(previous.url).port : '0'
const active = launch(process.execPath, [...launcher, '--profile', 'web', '--patch', patch, '--port', port, '--no-open'], join(root, 'workspace'))
let state, stopping = false
const stop = async () => {
  if (stopping) return
  stopping = true
  active.child.kill('SIGINT')
  const timeout = globalThis.setTimeout(() => active.child.kill('SIGKILL'), 15000)
  await active.done.finally(() => clearTimeout(timeout))
}
process.on('SIGINT', () => { void stop() })
process.on('SIGTERM', () => { void stop() })
try {
  for (let attempt = 0; attempt < 1500; attempt += 1) {
    if (active.child.exitCode !== null || active.child.signalCode !== null) throw new Error(`DSH stopped during startup\n${redact(active.output())}`)
    try { throw new Error(await readFile(join(root, 'fixture-error.txt'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    let fixture
    try { fixture = JSON.parse(await readFile(join(root, 'fixture-ready.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    const url = active.output().match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s)]+)/)?.[1]
    if (fixture && url) {
      state = { running: true, managerPid: process.pid, hostPid: active.child.pid, root, url, fixture }
      await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 })
      console.log(`\nPrototype DSH ready: ${url}\nOpen a sample discussion, then choose “研图 · 原型”.\nA 图谱工作台 / B 知识书桌 / C 研究路径. Use the bottom switcher or ?variant=A|B|C.\nReal DSH persistence; demo model, no paid model calls.\nData: ${root}\nStop: Ctrl+C or pnpm prototype:dsh --stop`)
      break
    }
    await setTimeout(100)
  }
  if (!state) throw new Error(`Prototype startup timed out\n${redact(active.output())}`)
  const result = await active.done
  if (!stopping && result.code !== 0) throw new Error(`DSH stopped\n${redact(active.output())}`)
} finally {
  await stop()
  if (state) await writeFile(stateFile, JSON.stringify({ ...state, running: false }, null, 2), { mode: 0o600 })
}
