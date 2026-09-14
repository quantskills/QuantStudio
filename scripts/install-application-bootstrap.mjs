/** Install the stable launcher and seed a managed application version when safe. */

import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { managedVersionPath, parseApplicationState, windowsLauncherSource } from './application-bootstrap.mjs'

const OFFICIAL_REPOSITORIES = [
  'https://github.com/quantskills/QuantStudio.git',
  'https://github.com/songshuquant/QuantStudio.git',
  'https://gitee.com/quantskills/QuantStudio.git',
]
const SHA_PATTERN = /^[a-f0-9]{40}$/
const scriptRoot = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(scriptRoot, '..')
const dshHome = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'))
const applicationRoot = join(dshHome, 'quantskills', 'application')
const bootstrapRoot = join(applicationRoot, 'bootstrap')
const versionsRoot = join(applicationRoot, 'versions')
const stagingRoot = join(applicationRoot, 'staging')
const statePath = join(applicationRoot, 'state.json')
const pnpmCli = process.env.npm_execpath

if (pnpmCli === undefined) {
  throw new Error('QuantSkills bootstrap installation requires the pinned pnpm CLI.')
}

await Promise.all([
  mkdir(bootstrapRoot, { recursive: true, mode: 0o700 }),
  mkdir(versionsRoot, { recursive: true, mode: 0o700 }),
  mkdir(stagingRoot, { recursive: true, mode: 0o700 }),
])
await copyFile(join(scriptRoot, 'application-bootstrap.mjs'), join(bootstrapRoot, 'launcher.mjs'))
await copyFile(join(sourceRoot, 'assets', 'quantskills.ico'), join(bootstrapRoot, 'quantskills.ico'))

const existingPort = process.platform === 'win32' ? await readExistingPort(dshHome) : undefined
const config = {
  schemaVersion: 1,
  nodeExecutable: process.execPath,
  pnpmCli: resolve(pnpmCli),
  fallbackSourceRoot: sourceRoot,
  defaultPort: existingPort ?? 3097,
  healthTimeoutMs: 120_000,
}
await writeAtomic(join(bootstrapRoot, 'config.json'), config)

let state = await readState(statePath)
if (state.active === undefined && process.env.QUANTSKILLS_SKIP_MANAGED_SEED !== '1') {
  const source = inspectCleanOfficialSource(sourceRoot)
  if (source !== undefined) {
    const target = managedVersionPath(versionsRoot, source.commit)
    if (!await isDirectory(target)) {
      run('git', ['clone', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', '--quiet', '--no-hardlinks', '--no-checkout', sourceRoot, target], applicationRoot)
      // A local seed clone must retain the official update source, not the checkout path.
      run('git', ['remote', 'set-url', 'origin', source.repository], target)
      run('git', ['checkout', '--quiet', '--detach', source.commit], target)
      run(process.execPath, [resolve(pnpmCli), 'install', '--frozen-lockfile'], target)
    }
    state = { ...state, active: source.commit }
    await writeAtomic(statePath, state)
  }
}

if (process.platform === 'win32' && process.env.QUANTSKILLS_SKIP_DESKTOP_SHORTCUT !== '1') {
  await installWindowsLauncher(dshHome, bootstrapRoot, config)
}

function inspectCleanOfficialSource(root) {
  try {
    const repositoryRoot = run('git', ['rev-parse', '--show-toplevel'], root).trim()
    const canonicalRoot = resolve(run('git', ['rev-parse', '--show-toplevel'], repositoryRoot).trim())
    if (canonicalRoot.toLowerCase() !== resolve(root).toLowerCase()) return undefined
    const origin = normalizeRepository(run('git', ['config', '--get', 'remote.origin.url'], root).trim())
    const branch = run('git', ['branch', '--show-current'], root).trim()
    const dirty = run('git', ['status', '--porcelain=v1', '--untracked-files=normal'], root).trim()
    const commit = run('git', ['rev-parse', 'HEAD^{commit}'], root).trim()
    const repository = OFFICIAL_REPOSITORIES.find(value => normalizeRepository(value) === origin)
    if (!repository || !['main', 'v2'].includes(branch) || dirty !== '' || !SHA_PATTERN.test(commit)) {
      return undefined
    }
    return { commit, repository }
  } catch (_nonGitOrBrokenSource) {
    return undefined
  }
}

function run(command, args, cwd) {
  const environment = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    ...(command === 'git' ? { GIT_ALLOW_PROTOCOL: 'file:https' } : {}),
  }
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} failed with ${String(result.status)}`)
  return result.stdout
}

async function readState(path) {
  try {
    return parseApplicationState(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { schemaVersion: 1, failedCandidates: [] }
    }
    throw error
  }
}

async function writeAtomic(path, value) {
  const temp = join(dirname(path), `.bootstrap-${randomUUID()}.tmp`)
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temp, path)
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

async function readExistingPort(home) {
  try {
    const source = await readFile(join(home, 'launch-quantskills.ps1'), 'utf8')
    const match = source.match(/\$appPort\s*=\s*(\d+)/u)
    const port = match === null ? undefined : Number.parseInt(match[1], 10)
    return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : undefined
  } catch (_missingLegacyLauncher) {
    return undefined
  }
}

async function installWindowsLauncher(home, bootstrap, launcherConfig) {
  const powerShell = windowsLauncherSource(bootstrap, launcherConfig)
  await writeFile(join(home, 'launch-quantskills.ps1'), powerShell, 'utf8')
  const shortcutScript = `$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'QuantSkills.lnk'))
$shortcut.TargetPath = "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${escapePowerShell(join(home, 'launch-quantskills.ps1'))}"'
$shortcut.WorkingDirectory = '${escapePowerShell(bootstrap)}'
$icon = '${escapePowerShell(join(bootstrap, 'quantskills.ico'))}'
$shortcut.IconLocation = "$icon,0"
$shortcut.Save()
`
  const encoded = Buffer.from(shortcutScript, 'utf16le').toString('base64')
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], bootstrap)
}

function normalizeRepository(value) {
  return value.trim().replace(/^git\+/u, '').replace(/\/$/u, '').replace(/\.git$/u, '')
}

function escapePowerShell(value) {
  return value.replaceAll("'", "''")
}
