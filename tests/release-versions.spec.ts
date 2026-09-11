import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { releaseVersions } from '../scripts/release-versions.mjs'

function manifest(version = '0.1.5-rc.2.1', dshVersion = '0.1.5-rc.2') {
  return {
    version,
    dependencies: { '@deepseek-ai/dsh-typert-protocol': dshVersion },
    peerDependencies: { '@deepseek-ai/dsh-llm': dshVersion },
    devDependencies: { '@deepseek-ai/dsh-attachment': dshVersion },
  }
}

describe('release version policy', () => {
  it('keeps the first adaptation and subsequent plugin revisions on one exact DSH target', () => {
    for (const version of ['0.1.5-rc.2', '0.1.5-rc.2.1', '0.1.5-rc.2.2']) {
      expect(releaseVersions(manifest(version))).toEqual({ version, dshVersion: '0.1.5-rc.2' })
    }
    expect(releaseVersions(manifest('1.0.0', '1.0.0'))).toEqual({ version: '1.0.0', dshVersion: '1.0.0' })
  })

  it('reads the whole pinned target instead of stripping its final numeric identifier', () => {
    for (const version of ['0.1.5-rc.2.1', '0.1.5-rc.2.1.1']) {
      expect(releaseVersions(manifest(version, '0.1.5-rc.2.1')).dshVersion).toBe('0.1.5-rc.2.1')
    }
  })

  it('rejects unrelated versions, malformed revisions, ranges, and build metadata', () => {
    for (const version of [
      '0.1.5-rc.3', '0.1.5-rc.20.1', '0.1.5-rc.2.0', '0.1.5-rc.2.01',
      '0.1.5-rc.2.1.1', '0.1.5-rc.2.beta', '^0.1.5-rc.2', '0.1.5-rc.2+local',
    ]) {
      expect(() => releaseVersions(manifest(version)), version).toThrow()
    }
    expect(() => releaseVersions(manifest('1.0.0.1', '1.0.0'))).toThrow()
  })

  it('requires an exact canonical DSH peer pin', () => {
    expect(() => releaseVersions({ version: '0.1.5-rc.2.1' })).toThrow(/must pin an exact DSH version/)
    for (const dshVersion of ['^0.1.5-rc.2', '0.1.5-rc.02', '0.1.5-rc.2+build', '0.1.5-rc.2\n']) {
      expect(() => releaseVersions(manifest(dshVersion, dshVersion))).toThrow(/must pin an exact DSH version/)
    }
  })

  it('rejects dependency drift in every direct dependency group', () => {
    for (const group of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'] as const) {
      const pkg = { ...manifest(), optionalDependencies: {} }
      const mismatch = { ...pkg, [group]: { ...pkg[group], '@deepseek-ai/dsh-session': '0.1.5-rc.2.1' } }
      expect(() => releaseVersions(mismatch)).toThrow(`${group}.@deepseek-ai/dsh-session must match target DSH`)
    }
  })

  it('tags the plugin revision while preserving the DSH target', () => {
    expect(releaseVersions(manifest(), 'v0.1.5-rc.2.1').dshVersion).toBe('0.1.5-rc.2')
    expect(() => releaseVersions(manifest(), 'v0.1.5-rc.2')).toThrow(/must be v0.1.5-rc.2.1/)
  })

  it('provides a validated DSH version to CI before dependency installation', () => {
    const cli = fileURLToPath(new URL('../scripts/check-version.mjs', import.meta.url))
    const env = { ...process.env }
    delete env.RELEASE_TAG
    expect(execFileSync(process.execPath, [cli, '--dsh-version'], { encoding: 'utf8', env })).toBe('0.1.5-rc.2\n')
    const rejected = spawnSync(process.execPath, [cli, '--dsh-version'], {
      encoding: 'utf8',
      env: { ...env, RELEASE_TAG: 'v0.0.0' },
    })
    expect(rejected.status).not.toBe(0)
    expect(rejected.stdout).toBe('')
    expect(rejected.stderr).toContain('Release tag v0.0.0 must be')
  })
})
