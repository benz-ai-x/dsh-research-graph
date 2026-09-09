/** Keep the package, direct DSH packages, and optional release tag on one version. */
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
for (const group of ['dependencies', 'peerDependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(manifest[group] ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh-') && version !== manifest.version) {
      throw new Error(`${group}.${name} must match plugin/DSH version ${manifest.version}, got ${version}`)
    }
  }
}
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== `v${manifest.version}`) {
  throw new Error(`Release tag ${process.env.RELEASE_TAG} must be v${manifest.version}`)
}
console.log(`Plugin and DSH package versions agree: ${manifest.version}`)
