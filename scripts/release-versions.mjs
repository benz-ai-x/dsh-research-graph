/** Resolve the plugin release and its exact, independently pinned DSH target. */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

function isExactVersion(value) {
  if (typeof value !== 'string') return false
  const match = SEMVER.exec(value)
  if (match === null || match[0] !== value) return false
  return match[4]?.split('.').every(part => !/^\d+$/.test(part) || !/^0\d/.test(part)) ?? true
}

export function releaseVersions(manifest, releaseTag) {
  const version = manifest.version
  const dshVersion = manifest.peerDependencies?.['@deepseek-ai/dsh-llm']
  if (!isExactVersion(dshVersion)) {
    throw new Error('peerDependencies.@deepseek-ai/dsh-llm must pin an exact DSH version without build metadata')
  }
  if (!isExactVersion(version)) throw new Error('Plugin version must be exact SemVer without build metadata')
  const revision = version.startsWith(`${dshVersion}.`) ? version.slice(dshVersion.length + 1) : ''
  if (version !== dshVersion && !(dshVersion.includes('-') && /^[1-9]\d*$/.test(revision))) {
    throw new Error(`Plugin ${version} must equal DSH ${dshVersion} or append one positive prerelease revision number`)
  }
  for (const group of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, dependencyVersion] of Object.entries(manifest[group] ?? {})) {
      if (name.startsWith('@deepseek-ai/dsh-') && dependencyVersion !== dshVersion) {
        throw new Error(`${group}.${name} must match target DSH ${dshVersion}, got ${dependencyVersion}`)
      }
    }
  }
  if (releaseTag !== undefined && releaseTag !== `v${version}`) {
    throw new Error(`Release tag ${releaseTag} must be v${version}`)
  }
  return { version, dshVersion }
}
