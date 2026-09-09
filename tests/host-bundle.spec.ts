import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('Host bundle', () => {
  it('loads in ordinary Node with the declared runtime dependencies', () => {
    execFileSync(process.execPath, ['--input-type=module', '-e', [
      'const host = await import("./lib/index.js")',
      'if (typeof host.apply !== "function") throw new Error("Missing Host entry")',
      'await import("./lib/invariant.js")',
    ].join('\n')], { stdio: 'pipe' })
  })

  it('ships a runnable offline history recovery command', () => {
    const help = execFileSync(process.execPath, ['lib/migrate-merge-history.js', '--help'], { encoding: 'utf8' })
    expect(help).toContain('Without --output, validates only.')
  })

  it('lowers the Remote decorator while keeping Harness runtime packages external', () => {
    const code = readFileSync('lib/index.js', 'utf8')

    expect(code).not.toContain('@Remote')
    expect(code).toContain('Remote("generate")')
    expect(code).toContain('Remote("submit")')
    expect(code).toContain('from "@deepseek-ai/dsh-llm"')
    expect(code).toContain('from "@deepseek-ai/dsh-typert-protocol"')
    expect(code).not.toMatch(/import\s*\{[^}]*\bTypertRemoteFailure\b[^}]*\}\s*from/u)
  })
})
