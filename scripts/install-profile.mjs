/** Install through the pinned CLI in staging; never invoke pnpm from PATH. */
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveDshHome, resolveProfile, prepareProfileStage, activateProfileStage,
  discardProfileStage, restoreProfileTransaction } from './profile-state.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagePaths = ['.', 'packages/agent-team', 'packages/tool-agent-team', 'packages/quantskills-host',
  'packages/quantskills-session', 'packages/panda-mcp', 'packages/client-ui-layout', 'packages/client-ui-input-trigger',
  'packages/client-ui-conversation', 'packages/client-ui-chat', 'packages/client-remotes-quantskills',
  'node_modules/dsh-file-upload', 'packages/ui-quantskills', 'node_modules/dshmarket']

function installationSignature(value) {
  return createHash('sha256').update(JSON.stringify({ dependencies: value.dependencies,
    devDependencies: value.devDependencies, optionalDependencies: value.optionalDependencies,
    dsh: value.dsh, packageManager: value.packageManager })).digest('hex')
}

export async function installProfile(environment = process.env, remove = false) {
  const home = resolveDshHome(environment), profile = resolveProfile(environment)
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const cli = environment.QUANTSKILLS_PNPM_CLI || environment.npm_execpath
  if (!cli || !/\.[cm]?js$/.test(cli)) throw new Error('Run this command with the project-pinned pnpm: pnpm run install:plugin.')
  const version = spawnSync(process.execPath, [cli, '--version'], { cwd: root, env: environment, encoding: 'utf8', windowsHide: true })
  if (version.status !== 0 || `pnpm@${version.stdout.trim()}` !== manifest.packageManager) {
    throw new Error(`QuantStudio requires ${manifest.packageManager}; the selected CLI did not match.`)
  }
  const target = join(home, 'profiles', profile), targetManifest = join(target, 'package.json')
  const previous = existsSync(targetManifest) ? JSON.parse(await readFile(targetManifest, 'utf8')) : undefined
  if (previous && !previous.quantskills?.managedProfile && !previous.dependencies?.['@quantskills/dsh-plugin']) {
    throw new Error(`Profile "${profile}" belongs to another installation. Choose a different QUANTSKILLS_PROFILE; its files were not changed.`)
  }
  if (remove && !previous) return
  const packages = await Promise.all(packagePaths.map(async p => {
    const directory = resolve(root, p)
    return { directory, manifest: JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) }
  }))
  if (!remove && previous?.quantskills?.managedProfile && previous.packageManager === manifest.packageManager
    && previous.quantskills.installationSignature === installationSignature(previous)
    && !previous.dependencies?.['dsh-context'] && packages.every(p => previous.dependencies?.[p.manifest.name] === `link:${p.directory.replaceAll('\\', '/')}`)) {
    const linked = await Promise.all(packages.map(async p => {
      try { return await realpath(join(target, 'node_modules', p.manifest.name)) === await realpath(p.directory) } catch { return false }
    }))
    if (linked.every(Boolean)) return
  }
  const transaction = await prepareProfileStage(home, profile)
  let activated
  try {
    const require = createRequire(join(root, 'package.json'))
    const { initProfile, PROFILE_TEMPLATES, readProfileManifest, resolveBundleDir } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')))
    initProfile(transaction.stage, PROFILE_TEMPLATES.web.bundles, PROFILE_TEMPLATES.web.patchReload)
    const file = join(transaction.stage, 'package.json')
    const value = JSON.parse(await readFile(file, 'utf8'))
    value.name = `dsh-profile-${profile}`
    value.packageManager = manifest.packageManager
    value.quantskills = { ...value.quantskills, managedProfile: true }
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      if (!value[key]) continue
      delete value[key]['dsh-context']
      // A staging directory must not become the permanent target of a user's local link.
      for (const [name, spec] of Object.entries(value[key])) {
        const local = /^(file:|link:)(\.{1,2}(?:[/\\].*)?)$/.exec(spec)
        if (local) value[key][name] = `${local[1]}${resolve(target, local[2]).replaceAll('\\', '/')}`
      }
    }
    value.dsh.profile.bundles = value.dsh.profile.bundles.filter(name => name !== 'dsh-context')
    await writeFile(file, JSON.stringify(value, null, 2) + '\n')
    const args = remove ? ['remove', ...packages.map(p => p.manifest.name).filter(name => value.dependencies?.[name])]
      : ['add', ...packages.map(p => p.directory)]
    if (args.length > 1) {
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: transaction.stage, env: { ...environment, DSH_HOME: home }, stdio: 'inherit', windowsHide: true,
      })
      if (result.error) throw result.error
      if (result.status !== 0) throw new Error(`Pinned pnpm failed (${result.status}); the original profile was preserved.`)
    }
    const after = JSON.parse(await readFile(file, 'utf8'))
    const beforeDeps = new Set(Object.keys(previous?.dependencies ?? {}))
    const deps = Object.keys(after.dependencies ?? {})
    const bundled = new Set()
    for (const name of deps) {
      try {
        const dir = resolveBundleDir('dsh', name, require.resolve('@deepseek-ai/dsh/package.json'), transaction.stage)
        if (readProfileManifest('dsh', dir).dsh?.bundle?.patch) bundled.add(name)
      } catch { /* Plain dependencies are not profile layers. */ }
    }
    after.dsh.profile.bundles = [...new Set([
      ...after.dsh.profile.bundles.filter(name => (!beforeDeps.has(name) && !deps.includes(name)) || bundled.has(name)), ...bundled,
    ])]
    after.quantskills.installationSignature = installationSignature(after)
    await writeFile(file, JSON.stringify(after, null, 2) + '\n')
    activated = await activateProfileStage(transaction)
    if (environment.QUANTSKILLS_PROFILE_RECEIPT) await writeFile(environment.QUANTSKILLS_PROFILE_RECEIPT, JSON.stringify(activated), { flag: 'wx', mode: 0o600 })
    if (activated.backup) console.log(`[QuantStudio] Previous profile saved at ${activated.backup}`)
    console.log(`[QuantStudio] Profile: ${profile}; data: ${home}`)
  } catch (error) {
    if (activated) await restoreProfileTransaction(activated)
    throw error
  } finally { await discardProfileStage(transaction) }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await installProfile(process.env, process.argv.includes('--remove'))
}
