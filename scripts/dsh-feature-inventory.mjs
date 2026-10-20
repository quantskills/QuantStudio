/** Generate the fixed upstream roster without executing a Host or reading user state. */
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { PROFILE_TEMPLATES, OPTIONAL_BUNDLES, OFFICIAL_ON_DEMAND_CATALOG } from '@deepseek-ai/dsh-app-boot'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { composeEntries } from '@deepseek-ai/dsh-app-boot'

const root = resolve('.'), require = createRequire(join(root, 'package.json'))
const core = JSON.parse(await readFile(require.resolve('@deepseek-ai/dsh/package.json'), 'utf8'))
if (core.version !== '0.2.1-rc.2') throw new Error('Inventory requires the pinned target runtime')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const files = [], layers = []
async function capture(file, label) {
  const bytes = await readFile(file)
  files.push({ file: label, sha256: sha(bytes) })
  return loadOverlayPatches('QuantStudio inventory', file)
}
for (const name of PROFILE_TEMPLATES.web.bundles) {
  const manifestFile = require.resolve(`${name}/package.json`)
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  for (const file of [manifest.dsh.bundle.patch].flat()) layers.push(await capture(join(dirname(manifestFile), file), `${name}/${file}`))
}
const upstreamRows = composeEntries(layers)
layers.push(await capture(join(root, 'cordis.patch.yml'), 'QuantStudio/cordis.patch.yml'))
const flatten = rows => rows.flatMap(row => [row, ...(Array.isArray(row.config) ? flatten(row.config) : [])])
const rows = flatten(composeEntries(layers)).map(row => ({ id: row.id, package: row.name,
  defaultState: row.disabled === true ? 'disabled' : row.disabled === undefined || row.disabled === false ? 'enabled' : 'conditional',
  entry: 'Web composition', acceptance: `boot:${row.id}`, result: 'see-current-artifact-evidence',
  evidence: 'ci-validation.json; feature-acceptance.md (boot readiness is not functional acceptance)' }))
const webDir = dirname(require.resolve('@deepseek-ai/dsh-web-app/package.json')), presets = []
for (const file of (await readdir(join(webDir, 'presets'))).filter(file => file.endsWith('.yml')).sort()) {
  const patches = await capture(join(webDir, 'presets', file), `@deepseek-ai/dsh-web-app/presets/${file}`)
  presets.push({ name: file.replace('.patch.yml', ''), rows: flatten(composeEntries([patches])).map(row => ({ id: row.id, package: row.name })),
    entry: 'Conversation mode picker', acceptance: `preset:${file}`, result: 'see-feature-acceptance',
    evidence: 'feature-acceptance.md#模式与创作' })
}
const optional = OPTIONAL_BUNDLES.map(name => ({ name, version: core.version, defaultState: 'disabled',
  entry: 'Plugins / Official', acceptance: `optional:${name}:enable-error-restart-disable`, result: 'see-current-artifact-evidence',
  evidence: 'ci-optional-bundles.mjs; feature-acceptance.md (external execution has separate conditions)' }))
const onDemand = OFFICIAL_ON_DEMAND_CATALOG.map(item => ({ ...item, defaultState: 'not-installed',
  version: core.version, installSpec: `${item.packageName}@${core.version}`,
  entry: 'Plugins / Official', acceptance: `catalog:${item.packageName}:fixed-target-and-default-off`,
  result: 'see-ci-optional-bundles; external delegation blocked without a separate test login' }))
const packages = []
for (const entry of (await readdir(join(root, 'packages'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
  const manifest = JSON.parse(await readFile(join(root, 'packages', entry, 'package.json'), 'utf8'))
  packages.push({ directory: `packages/${entry}`, name: manifest.name, version: manifest.version,
    dependencies: manifest.dependencies ?? {}, peers: manifest.peerDependencies ?? {}, engines: manifest.engines ?? {} })
}
const inventory = { schemaVersion: 1, target: core.version, upstreamCommit: '687f282e8625c6b8d11ff58211a90524be2e4317',
  lockSha256: sha(await readFile(join(root, 'pnpm-lock.yaml'))), templates: PROFILE_TEMPLATES,
  files, upstreamRows: flatten(upstreamRows).map(row => ({ id: row.id, package: row.name })), rows, presets, optional, onDemand, packages }
await mkdir(join(root, 'docs/dsh-upgrade'), { recursive: true })
await writeFile(join(root, 'docs/dsh-upgrade/feature-inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
console.log(JSON.stringify({ rows: rows.length, presets: presets.length, optional: optional.length, onDemand: onDemand.length, packages: packages.length }))
