/** Locate a matching Harness beside the repository or its containing project folder. */
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export async function resolveHarnessRoot(repo, dshVersion, configuredRoot) {
  const candidates = [
    ...(configuredRoot === undefined ? [] : [resolve(configuredRoot)]),
    resolve(repo, `../deepseek-harness-${dshVersion}`),
    resolve(repo, `../../deepseek-harness-${dshVersion}`),
  ]
  for (const candidate of new Set(candidates)) {
    let upstream
    try {
      upstream = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    if (upstream.version !== dshVersion) {
      throw new Error(`Use the matching DSH ${dshVersion} checkout (DSH_HARNESS_ROOT). Found ${upstream.version} at ${candidate}`)
    }
    return candidate
  }
  throw new Error(`Cannot find the matching DSH ${dshVersion} checkout. Set DSH_HARNESS_ROOT. Checked: ${[...new Set(candidates)].join(', ')}`)
}
