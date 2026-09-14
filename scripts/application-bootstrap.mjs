/** Stable QuantSkills launcher with pending activation and rollback. */

import { spawn, spawnSync } from 'node:child_process'
import { open, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SHA_PATTERN = /^[a-f0-9]{40}$/
const STATE_SCHEMA_VERSION = 1
const BOOTSTRAP_SCHEMA_VERSION = 1

/** @returns the default DSH home without consulting a source checkout. */
export function resolveDshHome(environment = process.env) {
  return resolve(environment.DSH_HOME || join(homedir(), '.dsh'))
}

/**
 * Parse and validate durable launcher state.
 * @param {unknown} value - parsed JSON value.
 * @returns {{schemaVersion: 1, active?: string, pending?: string, previous?: string, failedCandidates: Array<{commit: string, failedAt: number, errorCode: string}>}}
 */
export function parseApplicationState(value) {
  if (!isRecord(value) || value.schemaVersion !== STATE_SCHEMA_VERSION) {
    throw new Error('QuantSkills application state has an unsupported schema.')
  }
  for (const key of ['active', 'pending', 'previous']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !SHA_PATTERN.test(value[key]))) {
      throw new Error(`QuantSkills application state has an invalid ${key} commit.`)
    }
  }
  if (!Array.isArray(value.failedCandidates) || value.failedCandidates.length > 20) {
    throw new Error('QuantSkills application state has invalid failed candidates.')
  }
  const failedCandidates = value.failedCandidates.map((candidate) => {
    if (!isRecord(candidate) || typeof candidate.commit !== 'string' || !SHA_PATTERN.test(candidate.commit)
      || !Number.isInteger(candidate.failedAt) || candidate.failedAt < 0
      || typeof candidate.errorCode !== 'string') {
      throw new Error('QuantSkills application state has an invalid failed candidate.')
    }
    return { commit: candidate.commit, failedAt: candidate.failedAt, errorCode: candidate.errorCode }
  })
  return {
    schemaVersion: 1,
    ...(value.active === undefined ? {} : { active: value.active }),
    ...(value.pending === undefined ? {} : { pending: value.pending }),
    ...(value.previous === undefined ? {} : { previous: value.previous }),
    failedCandidates,
  }
}

/**
 * Resolve one commit only inside the managed versions directory.
 * @param {string} versionsRoot - absolute managed versions directory.
 * @param {string} commit - exact lowercase Git SHA.
 * @returns {string} validated absolute path.
 */
export function managedVersionPath(versionsRoot, commit) {
  if (!SHA_PATTERN.test(commit)) throw new Error('QuantSkills refused an invalid application commit path.')
  const path = resolve(versionsRoot, commit)
  if (!isOwnedPath(path, versionsRoot)) throw new Error('QuantSkills refused an application path escape.')
  return path
}

/**
 * Commit a healthy pending version while retaining one rollback version.
 * @param {ReturnType<typeof parseApplicationState>} state - current durable state.
 * @returns {ReturnType<typeof parseApplicationState>} next durable state.
 */
export function commitPendingState(state) {
  if (state.pending === undefined) return state
  return {
    schemaVersion: 1,
    active: state.pending,
    ...(state.active === undefined || state.active === state.pending ? {} : { previous: state.active }),
    failedCandidates: state.failedCandidates.filter(candidate => candidate.commit !== state.pending),
  }
}

/**
 * Record a failed candidate and restore the prior active version.
 * @param {ReturnType<typeof parseApplicationState>} state - current durable state.
 * @param {string} errorCode - stable launcher failure category.
 * @param {number} failedAt - failure timestamp.
 * @returns {ReturnType<typeof parseApplicationState>} next durable state.
 */
export function rejectPendingState(state, errorCode, failedAt) {
  if (state.pending === undefined) return state
  return {
    schemaVersion: 1,
    ...(state.active === undefined ? {} : { active: state.active }),
    ...(state.previous === undefined ? {} : { previous: state.previous }),
    failedCandidates: [
      ...state.failedCandidates.filter(candidate => candidate.commit !== state.pending).slice(-18),
      { commit: state.pending, failedAt, errorCode },
    ],
  }
}

/** Run the stable launcher. */
export async function main(argv = process.argv.slice(2), environment = process.env) {
  const dshHome = resolveDshHome(environment)
  const applicationRoot = join(dshHome, 'quantskills', 'application')
  const bootstrapRoot = join(applicationRoot, 'bootstrap')
  const versionsRoot = join(applicationRoot, 'versions')
  const statePath = join(applicationRoot, 'state.json')
  const config = await readBootstrapConfig(join(bootstrapRoot, 'config.json'))
  const parsed = parseArguments(argv)
  const hostArgs = parsed.hostArgs.length === 0
    ? ['--port', String(config.defaultPort), '--no-open']
    : parsed.hostArgs
  const port = readPort(hostArgs, config.defaultPort)
  const lock = await acquireLaunchLock(join(applicationRoot, 'launch.lock'), port)
  try {
    let state
    try {
      state = await readState(statePath)
    } catch (_corruptApplicationState) {
      state = await recoverApplicationState(versionsRoot)
      await writeState(statePath, state)
    }
    const repaired = await repairApplicationState(state, versionsRoot)
    if (JSON.stringify(repaired) !== JSON.stringify(state)) {
      state = repaired
      await writeState(statePath, state)
    }
    let selected = await selectVersion(state, versionsRoot, parsed.sourceRoot ?? config.fallbackSourceRoot)
    if (selected.pending) {
      let candidate
      try {
        candidate = await startSelected(selected.root, config, hostArgs, dshHome)
        await waitForHealthyHost(candidate, port, config.healthTimeoutMs)
        state = commitPendingState(state)
        await writeState(statePath, state)
        await cleanUnusedVersions(versionsRoot, state)
        return await waitForExit(candidate)
      } catch (error) {
        stopProcessTree(candidate)
        state = rejectPendingState(state, 'APPLICATION_STARTUP_HEALTH_FAILED', Date.now())
        await writeState(statePath, state)
        selected = await selectVersion(state, versionsRoot, parsed.sourceRoot ?? config.fallbackSourceRoot)
        if (selected.pending) throw new Error('QuantSkills rollback selected another pending version.', { cause: error })
      }
    }
    const host = await startSelected(selected.root, config, hostArgs, dshHome)
    return await waitForExit(host)
  } finally {
    await lock.close()
    await unlink(join(applicationRoot, 'launch.lock')).catch(() => undefined)
  }
}

async function selectVersion(state, versionsRoot, fallbackSourceRoot) {
  if (state.pending !== undefined) {
    const root = managedVersionPath(versionsRoot, state.pending)
    if (await validApplicationRoot(root)) return { root, pending: true }
  }
  if (state.active !== undefined) {
    const root = managedVersionPath(versionsRoot, state.active)
    if (await validApplicationRoot(root)) return { root, pending: false }
  }
  if (fallbackSourceRoot !== undefined && await validApplicationRoot(fallbackSourceRoot)) {
    return { root: await realpath(fallbackSourceRoot), pending: false }
  }
  throw new Error('No healthy QuantSkills application version is available. Reinstall from the official README.')
}

/**
 * Rebuild pointers from verified version directories after unreadable durable state.
 * @param {string} versionsRoot - managed immutable versions directory.
 * @returns {Promise<ReturnType<typeof parseApplicationState>>} recovered state.
 */
export async function recoverApplicationState(versionsRoot) {
  const candidates = []
  for (const entry of await readdir(versionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !SHA_PATTERN.test(entry.name)) continue
    const root = managedVersionPath(versionsRoot, entry.name)
    if (!await validApplicationRoot(root)) continue
    candidates.push({ commit: entry.name, modifiedAt: (await stat(root)).mtimeMs })
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt || left.commit.localeCompare(right.commit))
  return parseApplicationState({
    schemaVersion: 1,
    ...(candidates[0] === undefined ? {} : { active: candidates[0].commit }),
    ...(candidates[1] === undefined ? {} : { previous: candidates[1].commit }),
    failedCandidates: [],
  })
}

/**
 * Clear invalid pending pointers and restore a valid rollback version before launch.
 * @param {ReturnType<typeof parseApplicationState>} state - parsed durable state.
 * @param {string} versionsRoot - managed immutable versions directory.
 * @returns {Promise<ReturnType<typeof parseApplicationState>>} launchable state.
 */
export async function repairApplicationState(state, versionsRoot) {
  let repaired = state
  if (repaired.pending !== undefined
    && !await validApplicationRoot(managedVersionPath(versionsRoot, repaired.pending))) {
    repaired = rejectPendingState(repaired, 'APPLICATION_STARTUP_CANDIDATE_MISSING', Date.now())
  }
  if (repaired.active !== undefined
    && await validApplicationRoot(managedVersionPath(versionsRoot, repaired.active))) return repaired
  if (repaired.previous !== undefined
    && await validApplicationRoot(managedVersionPath(versionsRoot, repaired.previous))) {
    return parseApplicationState({
      schemaVersion: 1,
      active: repaired.previous,
      failedCandidates: repaired.failedCandidates,
    })
  }
  return parseApplicationState({
    schemaVersion: 1,
    ...(repaired.pending === undefined ? {} : { pending: repaired.pending }),
    failedCandidates: repaired.failedCandidates,
  })
}

async function startSelected(root, config, hostArgs, dshHome) {
  await runPnpm(config, ['run', 'install:plugin'], root, dshHome)
  return spawn(config.nodeExecutable, [config.pnpmCli, 'exec', 'dsh', '--profile', 'web', ...hostArgs], {
    cwd: root,
    env: { ...process.env, DSH_HOME: dshHome },
    stdio: 'inherit',
    windowsHide: true,
  })
}

async function runPnpm(config, args, cwd, dshHome) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(config.nodeExecutable, [config.pnpmCli, ...args], {
      cwd,
      env: { ...process.env, DSH_HOME: dshHome },
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0 && signal === null) resolvePromise()
      else rejectPromise(new Error(`pnpm ${args.join(' ')} failed with ${signal ?? String(code)}`))
    })
  })
}

async function waitForHealthyHost(child, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Candidate Host exited before the health check passed.')
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok && (await response.text()).toLowerCase().includes('<html')) return
    } catch (_hostNotReadyYet) {
      // Connection refusal and request timeouts are expected until DSH is listening.
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500))
  }
  throw new Error(`Candidate Host did not become healthy within ${String(timeoutMs)} ms.`)
}

async function waitForExit(child) {
  if (child.exitCode !== null) return child.exitCode
  return await new Promise((resolvePromise, rejectPromise) => {
    child.once('error', rejectPromise)
    child.once('exit', code => resolvePromise(code ?? 1))
  })
}

function stopProcessTree(child) {
  if (child === undefined || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

export async function acquireLaunchLock(path, port) {
  try {
    const handle = await open(path, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: Date.now(), port })}\n`)
    return handle
  } catch (error) {
    if (!isCode(error, 'EEXIST')) throw error
    const holder = await readJson(path).catch(() => undefined)
    if (isRecord(holder) && Number.isInteger(holder.pid) && processExists(holder.pid)) {
      throw new Error(`QuantSkills is already starting or running in process ${String(holder.pid)}.`)
    }
    await unlink(path)
    const handle = await open(path, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: Date.now(), port })}\n`)
    return handle
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return isCode(error, 'EPERM')
  }
}

async function cleanUnusedVersions(versionsRoot, state) {
  const retained = new Set([state.active, state.previous, state.pending].filter(Boolean))
  for (const entry of await readdir(versionsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !SHA_PATTERN.test(entry.name) || retained.has(entry.name)) continue
    const target = managedVersionPath(versionsRoot, entry.name)
    await rm(target, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function validApplicationRoot(path) {
  try {
    const canonical = await realpath(path)
    const manifest = await readJson(join(canonical, 'package.json'))
    const lock = await stat(join(canonical, 'pnpm-lock.yaml'))
    return isRecord(manifest) && manifest.name === '@quantskills/dsh-plugin' && lock.isFile()
  } catch (_invalidOrMissingApplicationRoot) {
    return false
  }
}

async function readState(path) {
  try {
    return parseApplicationState(await readJson(path))
  } catch (error) {
    if (isCode(error, 'ENOENT')) return { schemaVersion: 1, failedCandidates: [] }
    throw error
  }
}

async function writeState(path, state) {
  const temp = join(dirname(path), `.state-${randomUUID()}.tmp`)
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temp, path)
}

async function readBootstrapConfig(path) {
  const value = await readJson(path)
  if (!isRecord(value) || value.schemaVersion !== BOOTSTRAP_SCHEMA_VERSION
    || typeof value.nodeExecutable !== 'string' || !isAbsolute(value.nodeExecutable)
    || typeof value.pnpmCli !== 'string' || !isAbsolute(value.pnpmCli)
    || !Number.isInteger(value.defaultPort) || value.defaultPort < 1024 || value.defaultPort > 65535
    || !Number.isInteger(value.healthTimeoutMs) || value.healthTimeoutMs < 1) {
    throw new Error('QuantSkills bootstrap configuration is invalid.')
  }
  return value
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/**
 * Build the Windows launcher source that follows DSH Web's authenticated URL.
 * @param {string} bootstrap - stable launcher directory.
 * @param {{nodeExecutable: string, defaultPort: number}} launcherConfig - persisted launcher settings.
 * @returns {string} PowerShell source written under DSH Home.
 */
export function windowsLauncherSource(bootstrap, launcherConfig) {
  const launcher = join(bootstrap, 'launcher.mjs')
  return `param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$nodePath = '${escapePowerShell(launcherConfig.nodeExecutable)}'
$launcherPath = '${escapePowerShell(launcher)}'
$edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
$appPort = ${String(launcherConfig.defaultPort)}
$logDirectory = Join-Path $env:LOCALAPPDATA 'QuantSkills\\logs'
$stdoutPath = Join-Path $logDirectory 'web.stdout.log'
$stderrPath = Join-Path $logDirectory 'web.stderr.log'

function Get-QuantSkillsLaunchUrl {
  if (-not (Test-Path -LiteralPath $stdoutPath)) { return $null }
  try {
    $source = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction Stop
    $matches = [regex]::Matches($source, 'dsh web:\\s*(http://127\\.0\\.0\\.1:\\d+/(?:\\?token=[^\\s]+)?)')
    if ($matches.Count -gt 0) { return $matches[$matches.Count - 1].Groups[1].Value }
  } catch { }
  return $null
}

function Test-QuantSkillsReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$appPort/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.ToLowerInvariant().Contains('<html')
  } catch {
    if ($null -eq $_.Exception.Response) { return $false }
    try { return [int]$_.Exception.Response.StatusCode -eq 401 }
    catch { return $false }
  }
}

try {
  if (-not (Test-Path -LiteralPath $nodePath)) { throw "Node.js was not found at $nodePath" }
  if (-not (Test-Path -LiteralPath $launcherPath)) { throw "QuantSkills stable launcher was not found at $launcherPath" }
  $alreadyRunning = Test-QuantSkillsReady
  if (-not $alreadyRunning) {
    $listener = Get-NetTCPConnection -LocalPort $appPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $listener) { throw "Port $appPort is in use by process $($listener.OwningProcess)." }
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $process = Start-Process -FilePath $nodePath -ArgumentList @($launcherPath, '--', '--port', "$appPort", '--no-open') -WorkingDirectory '${escapePowerShell(bootstrap)}' -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
      if (Test-QuantSkillsReady) { break }
      if ($process.HasExited) { throw "QuantSkills stopped during startup. See $stderrPath" }
      Start-Sleep -Milliseconds 500
    }
    if (-not (Test-QuantSkillsReady)) { throw "QuantSkills did not become ready within 120 seconds. See $stderrPath" }
  }
  if (-not $NoOpen) {
    if ($alreadyRunning) { $launchUrl = "http://127.0.0.1:$appPort/" }
    else {
      $launchUrl = Get-QuantSkillsLaunchUrl
      if ([string]::IsNullOrWhiteSpace($launchUrl)) { throw "DSH Web did not provide a QuantSkills URL. See $stdoutPath" }
    }
    if (Test-Path -LiteralPath $edgePath) { Start-Process -FilePath $edgePath -ArgumentList "--app=$launchUrl" }
    else { Start-Process $launchUrl }
  }
} catch {
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.Popup($_.Exception.Message, 0, 'QuantSkills', 16)
  exit 1
}
`
}

function escapePowerShell(value) {
  return value.replaceAll("'", "''")
}

export function parseArguments(argv) {
  const separator = argv.indexOf('--')
  const launcherArgs = separator < 0 ? [] : argv.slice(0, separator)
  const hostArgs = separator < 0 ? argv : argv.slice(separator + 1)
  let sourceRoot
  for (let index = 0; index < launcherArgs.length; index += 1) {
    if (launcherArgs[index] === '--source-root') sourceRoot = launcherArgs[index + 1]
  }
  return { sourceRoot, hostArgs }
}

export function readPort(args, fallback) {
  const index = args.indexOf('--port')
  if (index < 0) return fallback
  const port = Number.parseInt(args[index + 1] ?? '', 10)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QuantSkills received an invalid port.')
  return port
}

function isOwnedPath(path, parent) {
  const child = relative(resolve(parent), resolve(path))
  return child !== '' && child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    && !isAbsolute(child)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href
if (invokedPath === import.meta.url) {
  process.exitCode = await main()
}
