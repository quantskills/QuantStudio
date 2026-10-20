/** Exercise the actual official manager with local-only registry, archive, Git and link fixtures. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { boot, initProfile, loadProfileDirectory, readProfilePatches } from '@deepseek-ai/dsh-app-boot'
import PluginManager from '@deepseek-ai/dsh-plugin-manager'
import { recoverPluginTransaction } from '@deepseek-ai/dsh-plugin-manager/operations'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { capturePluginSources, assertPluginSourcesPreserved } from './plugin-sources.mjs'

const cli = process.env.npm_execpath
if (!cli) throw new Error('Run with pnpm run ci:plugins')
const root = await realpath(await mkdtemp(join(tmpdir(), 'qs-plugin-sources-')))
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|ComSpec|TEMP|TMP|PATHEXT)$/i.test(key)))
for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'DSH_HOME']) {
  env[key] = join(root, 'environment', key); await mkdir(env[key], { recursive: true })
}
Object.assign(env, { CI: 'true', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'empty.gitconfig'),
  NPM_CONFIG_USERCONFIG: join(root, 'empty.npmrc'), npm_config_update_notifier: 'false' })
await writeFile(env.GIT_CONFIG_GLOBAL, '')
await writeFile(env.NPM_CONFIG_USERCONFIG, '')
function command(executable, args, cwd) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  if (result.status !== 0) throw new Error(`Fixture command failed: ${executable === process.execPath ? 'pnpm' : 'git'} (${result.status})`)
  return result.stdout.trim()
}
const artifacts = new Map(), metadata = new Map()
let base, ctx, server, passed = false
async function packageAt(directory, name, version) {
  await mkdir(directory, { recursive: true })
  const manifest = { name, version, packageManager: 'pnpm@11.7.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest))
  await writeFile(join(directory, 'cordis.patch.yml'), '[]\n')
  return manifest
}
async function archive(name, version, route) {
  const directory = join(root, 'packages', `${name}-${version}`)
  const manifest = await packageAt(directory, name, version)
  const packed = join(root, 'packed', `${name}-${version}`); await mkdir(packed, { recursive: true })
  command(process.execPath, [cli, 'pack', '--pack-destination', packed], directory)
  const file = (await readdir(packed)).find(file => file.endsWith('.tgz'))
  assert.ok(file)
  const bytes = await readFile(join(packed, file))
  artifacts.set(route, bytes)
  return { ...manifest, dist: { tarball: base + route, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` } }
}
function requireSaved(result, label) {
  if (!['restart-required', 'applied'].includes(result.application)) {
    // Fixture-only diagnostics stay local. Public proof below contains no directories or package-manager output.
    throw new Error(`${label}: ${JSON.stringify({ application: result.application, error: result.error, packageResult: result.packageResult })}`)
  }
}
try {
  server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname
    if (artifacts.has(path)) { response.setHeader('content-type', 'application/octet-stream'); response.end(artifacts.get(path)); return }
    const entry = metadata.get(decodeURIComponent(path.slice(1)))
    response.setHeader('content-type', 'application/json')
    if (entry) response.end(JSON.stringify(entry))
    else { response.statusCode = 404; response.end('{"error":"fixture not found"}') }
  })
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes) })
  base = `http://127.0.0.1:${server.address().port}`
  env.npm_config_registry = base
  const npmName = 'qs-fixture-npm'
  const v1 = await archive(npmName, '1.0.0', '/artifacts/npm-1.tgz')
  const v2 = await archive(npmName, '1.0.1', '/artifacts/npm-2.tgz')
  metadata.set(npmName, { name: npmName, 'dist-tags': { latest: '1.0.1' }, versions: { '1.0.0': v1, '1.0.1': v2 },
    time: { created: '2000-01-01T00:00:00Z', modified: '2000-01-02T00:00:00Z', '1.0.0': '2000-01-01T00:00:00Z', '1.0.1': '2000-01-02T00:00:00Z' } })
  const release = await archive('qs-fixture-release', '1.0.0', '/fixture/release/releases/download/v1/plugin.tgz')
  const releaseUpdated = await archive('qs-fixture-release', '1.0.1', '/fixture/release/releases/download/v2/plugin.tgz')
  const dir = join(root, 'profile'), anchor = join(root, 'package.json')
  await writeFile(anchor, JSON.stringify({ name: 'isolated-installation', dependencies: {} }))
  initProfile(dir, [])
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'dsh-profile-fixture', packageManager: 'pnpm@11.7.0', dependencies: {}, dsh: { profile: { bundles: [] } } }))
  await writeFile(join(dir, 'cordis.yml'), '- id: manager\n  name: cordis:manager\n  config:\n    lockWaitMs: 30000\n')
  await writeFile(join(dir, '.npmrc'), `registry=${base}\nstore-dir=${join(root, 'pnpm-store').replaceAll('\\', '/')}\nignore-scripts=true\nfetch-retries=0\n`)
  const profile = { name: 'fixture', dir, installAnchor: anchor, cwd: root, home: env.DSH_HOME,
    patchPath: join(dir, 'cordis.patch.yml'), overlays: [], telemetryDisabledEnv: undefined,
    startedBundles: loadProfileDirectory('fixture', dir, anchor).layers.map(layer => layer.packageName),
    packageManager: { command: process.execPath, args: [cli], env } }
  ctx = await boot('fixture', join(dir, 'cordis.yml'), readProfilePatches('fixture', profile), context => {
    context.provide('profileContext', profile); context.loader.builtins.manager = PluginManager
  })
  const manager = ctx.pluginManager
  requireSaved(await manager.installBundle(`${npmName}@1.0.0`, { registry: base, saveExact: true }), 'npm install')
  requireSaved(await manager.installBundle(`${npmName}@1.0.1`, { registry: base, saveExact: true }), 'npm update')
  const installs = await Promise.all([
    manager.installBundle(release.dist.tarball, { registry: base }),
    manager.installBundle(`qs-fixture-alias@npm:${npmName}@1.0.1`, { registry: base, saveExact: true }),
  ])
  installs.forEach(result => requireSaved(result, 'concurrent archive and npm alias installs'))
  requireSaved(await manager.installBundle(releaseUpdated.dist.tarball, { registry: base }), 'release archive update')
  const link = join(root, 'local-plugin'); await packageAt(link, 'qs-fixture-link', '1.0.0')
  requireSaved(await manager.installBundle(`link:${link}`, { registry: base }), 'local link')
  await packageAt(link, 'qs-fixture-link', '1.0.1')
  requireSaved(await manager.installBundle(`link:${link}`, { registry: base }), 'local link update')
  const repository = join(root, 'git-plugin'); await packageAt(repository, 'qs-fixture-git', '1.0.0')
  await packageAt(join(repository, 'plugins/nested'), 'qs-fixture-subdirectory', '1.0.0')
  command('git', ['init', '--quiet'], repository)
  command('git', ['add', '.'], repository)
  command('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Local plugin fixture'], repository)
  let commit = command('git', ['rev-parse', 'HEAD'], repository)
  const gitSource = `git+${pathToFileURL(repository).href}#${commit}`
  requireSaved(await manager.installBundle(gitSource, { registry: base }), 'Git commit')
  requireSaved(await manager.installBundle(`${gitSource}&path:plugins/nested`, { registry: base }), 'Git subdirectory')
  await packageAt(repository, 'qs-fixture-git', '1.0.1')
  await packageAt(join(repository, 'plugins/nested'), 'qs-fixture-subdirectory', '1.0.1')
  command('git', ['add', '.'], repository)
  command('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Updated local fixture'], repository)
  commit = command('git', ['rev-parse', 'HEAD'], repository)
  const updatedGitSource = `git+${pathToFileURL(repository).href}#${commit}`
  requireSaved(await manager.installBundle(updatedGitSource, { registry: base }), 'Git update')
  requireSaved(await manager.installBundle(`${updatedGitSource}&path:plugins/nested`, { registry: base }), 'Git subdirectory update')
  const sources = await capturePluginSources(dir)
  assert.equal(sources.find(row => row.name === npmName)?.integrity, v2.dist.integrity)
  assert.equal(sources.find(row => row.name === npmName)?.resolvedVersion, '1.0.1')
  assert.equal(sources.find(row => row.name === 'qs-fixture-alias')?.actualName, npmName)
  assert.equal(sources.find(row => row.name === 'qs-fixture-alias')?.integrity, v2.dist.integrity)
  assert.equal(sources.find(row => row.name === 'qs-fixture-release')?.integrity, releaseUpdated.dist.integrity)
  assert.equal(sources.find(row => row.name === 'qs-fixture-release')?.repository, base + '/fixture/release')
  assert.equal(sources.find(row => row.name === 'qs-fixture-link')?.target, await realpath(link))
  assert.equal(sources.find(row => row.name === 'qs-fixture-link')?.resolvedVersion, '1.0.1')
  assert.equal(sources.find(row => row.name === 'qs-fixture-git')?.commit, commit)
  assert.equal(sources.find(row => row.name === 'qs-fixture-subdirectory')?.subdirectory?.replace(/^\//, ''), 'plugins/nested')
  const savedManifest = await readFile(join(dir, 'package.json'), 'utf8'), savedLock = await readFile(join(dir, 'pnpm-lock.yaml'), 'utf8')
  const failed = await manager.installBundle(base + '/missing.tgz', { registry: base })
  assert.equal(failed.application, 'failed')
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), savedManifest)
  assert.equal(await readFile(join(dir, 'pnpm-lock.yaml'), 'utf8'), savedLock)
  assertPluginSourcesPreserved(sources, await capturePluginSources(dir))
  // Resolve unknown identities before touching the live profile: core names can
  // hide in a tarball, Git repository, or npm alias.
  const core = await archive('@quantskills/dsh-plugin', '99.0.0', '/artifacts/core-spoof.tgz')
  metadata.set(core.name, { name: core.name, 'dist-tags': { latest: core.version }, versions: { [core.version]: core } })
  const coreGit = join(root, 'core-spoof-git')
  await packageAt(coreGit, core.name, '99.0.0')
  command('git', ['init', '--quiet'], coreGit)
  command('git', ['add', '.'], coreGit)
  command('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Core identity fixture'], coreGit)
  const coreCommit = command('git', ['rev-parse', 'HEAD'], coreGit)
  for (const spec of [core.dist.tarball, `git+${pathToFileURL(coreGit).href}#${coreCommit}`, `qs-core-alias@npm:${core.name}@99.0.0`]) {
    const result = await manager.installBundle(spec, { registry: base })
    assert.equal(result.application, 'failed', 'remote or aliased application identity must be refused')
    assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), savedManifest)
    assert.equal(await readFile(join(dir, 'pnpm-lock.yaml'), 'utf8'), savedLock)
    assertPluginSourcesPreserved(sources, await capturePluginSources(dir))
  }
  const registryGit = await archive('qs-fixture-git', '1.0.2', '/artifacts/git-as-npm.tgz')
  metadata.set(registryGit.name, { name: registryGit.name, 'dist-tags': { latest: registryGit.version }, versions: { [registryGit.version]: registryGit } })
  assert.equal((await manager.installBundle('qs-fixture-git@1.0.2', { registry: base })).application, 'failed')
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), savedManifest)
  assert.equal(await readFile(join(dir, 'node_modules/qs-fixture-git/package.json'), 'utf8'),
    await readFile(join(repository, 'package.json'), 'utf8'), 'Git installation must survive a catalog npm substitution')
  const unknownManifest = JSON.parse(savedManifest), unknownLock = parseYaml(savedLock)
  unknownManifest.dependencies[npmName] = 'legacy-channel'
  unknownLock.importers['.'].dependencies[npmName].specifier = 'legacy-channel'
  const unknownManifestText = JSON.stringify(unknownManifest), unknownLockText = stringifyYaml(unknownLock)
  await writeFile(join(dir, 'package.json'), unknownManifestText)
  await writeFile(join(dir, 'pnpm-lock.yaml'), unknownLockText)
  assert.equal((await manager.installBundle(`${npmName}@1.0.1`, { registry: base })).application, 'failed')
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), unknownManifestText)
  assert.equal(await readFile(join(dir, 'pnpm-lock.yaml'), 'utf8'), unknownLockText)
  await writeFile(join(dir, 'package.json'), savedManifest)
  await writeFile(join(dir, 'pnpm-lock.yaml'), savedLock)
  const concurrent = await Promise.all([manager.setBundleEnabled(npmName, false), manager.setBundleEnabled('qs-fixture-release', false)])
  concurrent.forEach(result => requireSaved(result, 'serialized mutation'))
  assert.equal((await manager.listBundles()).find(row => row.name === npmName)?.enabled, false)
  assert.equal((await manager.listBundles()).find(row => row.name === 'qs-fixture-release')?.enabled, false)
  requireSaved(await manager.removeBundle(npmName), 'remove installed fixture')
  assert.equal((await capturePluginSources(dir)).some(row => row.name === npmName), false)
  // Simulate power loss between manifest publication and the frozen install.
  // Repair must run with both the Host stopped and the official Profile lock.
  await ctx.fiber.dispose(); ctx = undefined
  const originals = Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml']
    .map(async name => [name, await readFile(join(dir, name), 'utf8')])))
  const interrupted = { ...originals, 'package.json': JSON.stringify({ ...JSON.parse(originals['package.json']), description: 'interrupted publication' }) }
  const journal = { schemaVersion: 1, phase: 'publishing', original: originals,
    nextHashes: Object.fromEntries(Object.entries(interrupted).map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')])) }
  const marker = join(dir, 'quantskills-plugin-transaction.json')
  await writeFile(marker, JSON.stringify(journal))
  await writeFile(join(dir, 'package.json'), interrupted['package.json'])
  const launchLock = join(env.DSH_HOME, 'quantskills/application/launch.lock')
  await mkdir(join(env.DSH_HOME, 'quantskills/application'), { recursive: true })
  await writeFile(launchLock, '{}')
  const recoveryContext = { ...profile, profile: 'fixture' }
  const recoveryOptions = { command: process.execPath, args: [cli], env, outputBytes: 4096 }
  await assert.rejects(recoverPluginTransaction(recoveryContext, recoveryOptions), { code: 'EEXIST' })
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), interrupted['package.json'])
  await rm(launchLock)
  await writeFile(marker, JSON.stringify({ ...journal, schemaVersion: 99 }))
  await assert.rejects(recoverPluginTransaction(recoveryContext, recoveryOptions), /Unknown/)
  await writeFile(marker, JSON.stringify(journal))
  await writeFile(join(dir, 'package.json'), interrupted['package.json'] + '\n')
  await assert.rejects(recoverPluginTransaction(recoveryContext, recoveryOptions), /Profile changed/)
  await writeFile(join(dir, 'package.json'), interrupted['package.json'])
  assert.deepEqual(await recoverPluginTransaction(recoveryContext, recoveryOptions), { recovered: true, preserved: true })
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), originals['package.json'])
  assert.equal(await readFile(join(dir, 'pnpm-lock.yaml'), 'utf8'), originals['pnpm-lock.yaml'])
  assert.equal(JSON.parse(await readFile(join(dir, 'node_modules/qs-fixture-git/package.json'), 'utf8')).version, '1.0.1')
  assert.deepEqual(await recoverPluginTransaction(recoveryContext, recoveryOptions), { recovered: false })
  passed = true
  console.log(JSON.stringify({ result: 'passed', manager: '0.2.1-rc.2', sources: ['npm', 'release-archive', 'local-link', 'git-commit', 'git-subdirectory'],
    updatesForAllFiveSources: 'passed', npmAliasIntegrity: 'passed', failedInstallPreservedManifestAndLock: 'passed', concurrentInstallsAndProfileMutations: 'passed', removal: 'passed',
    coreIdentityBeforeMutation: 'passed', gitToNpmReplacementRefused: 'passed', unknownSourceReplacementRefused: 'passed',
    interruptedPublicationRecovery: 'passed', runningHostRecoveryRefused: 'passed', unknownJournalAndChangedProfileRefused: 'passed',
    publicNetwork: false, productionHomeUsed: false }))
} finally {
  await ctx?.fiber.dispose()
  server?.closeAllConnections()
  if (server) await new Promise(yes => server.close(yes))
  if (passed) await rm(root, { recursive: true, force: true })
  else console.error(`Private fixture retained for diagnosis: ${root}`)
}
