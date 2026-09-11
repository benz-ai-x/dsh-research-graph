/** Validate the release policy; expose the exact DSH target to CI before install. */
import { readFileSync } from 'node:fs'
import { releaseVersions } from './release-versions.mjs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { version, dshVersion } = releaseVersions(manifest, process.env.RELEASE_TAG)
console.log(process.argv.includes('--dsh-version') ? dshVersion : `Plugin ${version} targets DSH ${dshVersion}`)
