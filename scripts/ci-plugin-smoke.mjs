/** Start the real stable launcher against a newly constructed, credential-free home. */
import { fork } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishBootstrapVersion, writeAtomic, migrationPath, assertIsolatedFixture, artifactDigest, TARGET_DSH } from './runtime-protocol.mjs'
import { randomBytes } from 'node:crypto'
import { smokeDiagnostics } from './smoke-diagnostics.mjs'
import { stopSmokeProcess } from './smoke-process.mjs'

const root = path.resolve('.'), pnpmCli = process.env.npm_execpath
if (!pnpmCli) throw new Error('Run with the pinned pnpm CLI.')
const fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), 'quantskills-ci-')))
const home = path.join(fixtureRoot, 'dsh-home')
await mkdir(home)
// Do not inherit account, model, proxy or trading credentials from the operator's shell.
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|ComSpec|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|ProgramFiles|ProgramFiles\(x86\)|OS|PATHEXT)$/i.test(key)))
Object.assign(environment, { CI: 'true', DSH_HOME: home, QUANTSKILLS_PROFILE: 'web',
  QUANTSKILLS_DISABLE_APPLICATION_UPDATE: '1', QUANTSKILLS_FIXTURE_ROOT: fixtureRoot, DSH_TELEMETRY_DISABLED: '1' })
// DSH_HOME does not redirect first-use Documents lookup or SDK user-home paths.
for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME']) {
  environment[key] = path.join(fixtureRoot, 'os-home', key.toLowerCase())
  await mkdir(environment[key], { recursive: true })
}
await writeFile(path.join(home, 'cordis.patch.yml'),
  ['workspace-controller', 'quantskills-session'].map(id =>
    `- id: ${id}\n  config:\n    documentsDirectory: ${JSON.stringify(path.join(home, 'documents'))}\n`).join(''))
const server = createServer()
await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes) })
const port = server.address().port
await new Promise(yes => server.close(yes))
const base = path.join(home, 'quantskills/application/bootstrap')
await mkdir(base, { recursive: true })
const config = { schemaVersion: 1, protocol: 2, nodeExecutable: process.execPath, pnpmCli,
  profile: 'web', fallbackSourceRoot: root, defaultPort: port, healthTimeoutMs: 120000 }
await publishBootstrapVersion(base, path.join(root, 'scripts'), config)
await writeAtomic(path.join(base, 'config.json'), config)
await writeFile(path.join(base, 'launcher.mjs'), await readFile(path.join(root, 'scripts/bootstrap-dispatcher.mjs')))
// This certifies only an empty constructed fixture, never a copied real home.
await writeAtomic(migrationPath(home), { schemaVersion: 1, sourceRuntime: 'empty-fixture', targetRuntime: TARGET_DSH,
  generation: 'empty-ci-fixture', backupId: 'no-original-user-data', phase: 'validated', oldReadable: 'yes' })
await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli })
// Seed the official browser-auth record with a new test-only secret. Its exact
// digest is held in this process, never inferred from a copied credential file.
const browserSecret = randomBytes(32).toString('base64url')
const generated = { browserSecretHash: artifactDigest(browserSecret) }
environment.QUANTSKILLS_FIXTURE_BROWSER_SECRET_HASH = generated.browserSecretHash
await writeFile(path.join(home, '.credentials.yaml'), JSON.stringify({ version: 1,
  records: { 'client-connection/browser-session': { kind: 'grant', payload: { version: 1, secret: browserSecret } } }, refs: {} }), { flag: 'wx', mode: 0o600 })
await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli }, generated)
let host, passed = false
try {
  host = fork(path.join(base, 'launcher.mjs'), ['--port', String(port), '--no-open'], {
    cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true, detached: process.platform !== 'win32',
  })
  // Retain diagnostics locally, but never publish authentication links printed by upstream.
  let output = ''
  host.stdout.on('data', value => { output += value.toString() })
  host.stderr.on('data', value => { output += value.toString() })
  try {
    const proof = await new Promise((yes, no) => {
      const timer = setTimeout(() => no(new Error('Launcher activation timed out')), 180000)
      host.on('message', message => { if (message?.type === 'quantskills:activated') { clearTimeout(timer); yes(message) } })
      host.once('exit', code => { clearTimeout(timer); no(new Error(`Launcher exited (${code})`)) })
      host.once('error', error => { clearTimeout(timer); no(error) })
    })
    if (proof.runtime !== TARGET_DSH || proof.generation !== 'empty-ci-fixture' || !/^[a-f0-9]{40}$/.test(proof.commit)) throw new Error('Wrong activation identity')
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) })
    const html = await response.text()
    if (!response.ok || !html.includes('__DSH_BOOT__')) throw new Error('Frontend entry did not expose its built module roster')
    await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli }, generated)
    console.log(JSON.stringify({ activation: 'passed', runtime: proof.runtime, commit: proof.commit, generation: proof.generation, artifact: proof.artifact, port }))
    // Explicit local browser verification only. CI never keeps the instance running.
    if (process.argv.includes('--browser')) {
      const stop = path.join(home, 'browser-test.complete')
      console.log(JSON.stringify({ browserTest: `http://127.0.0.1:${port}/`, stopFile: stop }))
      const deadline = Date.now() + 15 * 60_000
      while (Date.now() < deadline && host.exitCode === null) {
        try { await readFile(stop); break } catch (error) { if (error.code !== 'ENOENT') throw error }
        await new Promise(yes => setTimeout(yes, 500))
      }
    }
    await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli }, generated)
    passed = true
    console.log(JSON.stringify({ result: 'passed', runtime: proof.runtime, commit: proof.commit, generation: proof.generation, artifact: proof.artifact }))
  } catch(error) {
    await writeFile(path.join(home, 'smoke.log'), output, { mode: 0o600 })
    console.error(smokeDiagnostics(output, [browserSecret]))
    console.error(`Isolated evidence retained: ${home}`)
    throw error
  }
} finally {
  await stopSmokeProcess(host)
  if (passed) {
    if (path.dirname(fixtureRoot) !== await realpath(tmpdir()) || !path.basename(fixtureRoot).startsWith('quantskills-ci-')) throw new Error('Refused unsafe cleanup')
    await rm(fixtureRoot, { recursive: true, force: true })
  }
}
