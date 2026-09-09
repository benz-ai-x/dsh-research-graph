/** Check Host and Client separately against the selected Harness's built public declarations. */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = process.env.DSH_HARNESS_ROOT
if (!root) throw new Error('DSH_HARNESS_ROOT must point to the matching Harness checkout')
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const harness = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
if (harness.version !== manifest.version) {
  throw new Error(`Plugin ${manifest.version} requires a Harness ${manifest.version} checkout, got ${harness.version}`)
}
const diagnosticsHost = {
  getCanonicalFileName: name => name,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => '\n',
}
function config(path) {
  const parsed = ts.getParsedCommandLineOfConfigFile(path, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: error => {
      throw new Error(ts.formatDiagnostics([error], diagnosticsHost))
    },
  })
  if (!parsed) throw new Error(`Cannot read ${path}`)
  return parsed
}
const upstream = config(resolve(root, 'tsconfig.base.json'))
const local = config(resolve('tsconfig.json'))
const harnessRequire = createRequire(resolve(root, 'apps/web/package.json'))
function declarationPath(path, specifier) {
  const absolute = resolve(root, path)
  if (!absolute.includes('/src')) return absolute
  const packageRoot = absolute.slice(0, absolute.indexOf('/src'))
  const packagePath = resolve(packageRoot, 'package.json')
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
    const subpath = `.${specifier.slice(pkg.name.length)}`
    const exported = pkg.exports?.[subpath]
    const types = typeof exported === 'object' ? exported.types : subpath === '.' ? pkg.types : undefined
    if (typeof types === 'string') return resolve(packageRoot, types)
  }
  const output = absolute.replace('/src', '/lib/types')
  if (output.includes('*')) return output.replace(/\.tsx?$/, '.d.ts')
  const file = /\.tsx?$/.test(output) ? output.replace(/\.tsx?$/, '.d.ts') : `${output}/index.d.ts`
  return file
}
for (const [face, entries] of [
  ['Host', ['src/index.ts', 'src/invariant.ts']],
  ['Client', ['src/client/index.ts', 'src/css-modules.d.ts', 'tests/harness-client-types.ts']],
  ['Published Host', ['lib/types/index.d.ts', 'lib/types/invariant.d.ts']],
  ['Published Client', ['tests/harness-package-client-types.ts']],
]) {
  const program = ts.createProgram(entries.map(path => resolve(path)), {
    ...upstream.options,
    ...local.options,
    module: upstream.options.module,
    moduleResolution: upstream.options.moduleResolution,
    paths: {
      ...Object.fromEntries(Object.entries(upstream.options.paths).map(([key, paths]) =>
        [key, paths.map(path => declarationPath(path, key))])),
      react: [harnessRequire.resolve('@types/react/package.json').replace('package.json', 'index.d.ts')],
      'react/*': [harnessRequire.resolve('@types/react/package.json').replace('package.json', '*')],
      'react-dom': [harnessRequire.resolve('@types/react-dom/package.json').replace('package.json', 'index.d.ts')],
      'react-dom/*': [harnessRequire.resolve('@types/react-dom/package.json').replace('package.json', '*')],
    },
    typeRoots: [resolve(root, 'node_modules/@types'), resolve(root, 'scripts/types')],
    types: ['node'],
    noEmit: true,
    incremental: false,
    composite: false,
  })
  const errors = ts.getPreEmitDiagnostics(program)
  if (errors.length) {
    console.error(ts.formatDiagnostics(errors, diagnosticsHost))
    process.exitCode = 1
  } else {
    console.log(`${face} types match Harness ${harness.version}`)
  }
}
