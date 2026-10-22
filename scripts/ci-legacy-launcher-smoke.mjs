/** Verify protocol-2 launcher compatibility with the exact old QS baseline in a fresh home. */
import { fork, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishBootstrapVersion, writeAtomic, assertIsolatedFixture, artifactDigest, candidateArtifact } from './runtime-protocol.mjs'
import { randomBytes } from 'node:crypto'
import { smokeDiagnostics } from './smoke-diagnostics.mjs'
import { stopSmokeProcess } from './smoke-process.mjs'
import { zstdCompressSync } from 'node:zlib'
import { migrateHomeCopy } from './home-migration.mjs'
import { preserveAndRestoreCopy, inventoryOfflineTree } from './offline-recovery.mjs'
import { verifyLegacySessionCopy } from './verify-legacy-session-copy.mjs'

const sourceArg = process.argv.slice(2).filter(arg => arg !== '--')[0]
if (!sourceArg) throw new Error('Supply an independently installed old QS checkout.')
const root = path.resolve(sourceArg), pnpmCli = process.env.npm_execpath
const baseline = '8312624953d62a9aec5cde2c0c2f1175342482fe'
const checkout = spawnSync('git', ['rev-parse', 'HEAD^{commit}'], { cwd:root, encoding:'utf8', windowsHide:true })
const dirty = spawnSync('git', ['diff', '--quiet', 'HEAD'], { cwd:root, windowsHide:true })
if (checkout.status !== 0 || checkout.stdout.trim() !== baseline || dirty.status !== 0) throw new Error('Legacy checkout is not the unchanged baseline.')
if (!pnpmCli) throw new Error('Run with the pinned pnpm CLI.')
const fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), 'quantskills-ci-')))
const restore = process.argv.includes('--restore')
const recovery = path.join(fixtureRoot, 'recovery')
const home = restore ? path.join(recovery, 'restored-baseline') : path.join(fixtureRoot, 'dsh-home')
if (restore) {
  const original = path.join(fixtureRoot, 'original')
  const converted = path.join(fixtureRoot, 'converted')
  await mkdir(path.join(original, 'sessions/_no-cwd/restored-parent'), { recursive: true })
  await mkdir(path.join(original, 'attachments'))
  await writeFile(path.join(original, 'sessions/_no-cwd/restored-parent/session.jsonl.zstd'),
    zstdCompressSync(Buffer.from(JSON.stringify({ type: 'session', version: 0, id: 'restored-parent', createdAt: 1,
      delegationDepth: 0, agentPreset: 'code', seedLength: 0 }) + '\n')))
  await writeFile(path.join(original, 'attachments/retained.dat'), 'old attachment')
  const options = { consistency: 'verified-offline-snapshot', backupId: 'constructed-old-core-recovery' }
  await migrateHomeCopy(original, converted, options)
  await writeFile(path.join(converted, 'home/attachments/new.dat'), 'post-upgrade increment')
  await preserveAndRestoreCopy(original, path.join(converted, 'home'), recovery, options)
  console.log(JSON.stringify({ restoredOldReader: await verifyLegacySessionCopy(root, recovery) }))
} else await mkdir(home)
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
await publishBootstrapVersion(base, path.resolve('scripts'), config)
await writeAtomic(path.join(base, 'config.json'), config)
await writeFile(path.join(base, 'launcher.mjs'), await readFile(path.resolve('scripts/bootstrap-dispatcher.mjs')))
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
    const core = JSON.parse(await readFile(path.join(root, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'))
    if (core.version !== '0.1.2-alpha.2') throw new Error('Wrong baseline core')
    const deadline = Date.now() + 120000
    let reachable = false
    while (Date.now() < deadline && host.exitCode === null) {
      try { const r = await fetch(`http://127.0.0.1:${port}/`, {signal:AbortSignal.timeout(1000)}); if (r.ok && (await r.text()).includes('<html')) { reachable=true;break } } catch {}
      await new Promise(yes=>setTimeout(yes,250))
    }
    if (!reachable) throw new Error('Legacy launch failed')
    await new Promise(yes=>setTimeout(yes,2000))
    if(host.exitCode !== null) throw new Error('Legacy process exited')
    const proof = { runtime:core.version, commit:baseline, generation:restore ? 'restored-legacy-fixture' : 'fresh-legacy-fixture', artifact:await candidateArtifact(root) }
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) })
    const html = await response.text()
    if (!response.ok || !html.includes('<html')) throw new Error('Frontend entry did not expose its built module roster')
    await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli }, generated)
    if (restore) {
      if (await readFile(path.join(home, 'attachments/retained.dat'), 'utf8') !== 'old attachment'
        || await readFile(path.join(recovery, 'preserved-candidate/attachments/new.dat'), 'utf8') !== 'post-upgrade increment') throw new Error('Recovery lost an attachment or candidate increment.')
      const journal = JSON.parse(await readFile(path.join(recovery, 'migration.json'), 'utf8'))
      if ((await inventoryOfflineTree(path.join(fixtureRoot, 'original'))).generation !== journal.baselineGeneration) throw new Error('Old snapshot was modified.')
      console.log(JSON.stringify({ restoredOldHost: 'passed', candidateIncrementsPreserved: true }))
    }
    console.log(JSON.stringify({ legacyLaunch: 'passed', runtime: proof.runtime, commit: proof.commit, generation: proof.generation, artifact: proof.artifact, port }))
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
