/** Start the real stable launcher against a newly constructed, credential-free home. */
import { fork } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath, symlink } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishBootstrapVersion, writeAtomic, migrationPath, assertIsolatedFixture, artifactDigest, TARGET_DSH } from './runtime-protocol.mjs'
import { randomBytes } from 'node:crypto'
import { zstdCompressSync } from 'node:zlib'
import { smokeDiagnostics } from './smoke-diagnostics.mjs'
import { stopSmokeProcess } from './smoke-process.mjs'
import { migrateHomeCopy, certifyIsolatedHome } from './home-migration.mjs'
import { inventoryOfflineTree } from './offline-recovery.mjs'
import { OPTIONAL_BUNDLES } from '@deepseek-ai/dsh-app-boot'

const root = path.resolve('.'), pnpmCli = process.env.npm_execpath
if (!pnpmCli) throw new Error('Run with the pinned pnpm CLI.')
const fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), 'quantskills-ci-')))
const wholeHome = process.argv.includes('--whole-home')
const legacyMarket = process.argv.includes('--legacy-market')
const allOptional = process.argv.includes('--all-optional')
if (allOptional && !wholeHome) throw new Error('Optional bundle composition requires the isolated whole-home fixture.')
if (legacyMarket && !wholeHome) throw new Error('Legacy market validation requires a migrated whole-home fixture.')
const migrationOutput = path.join(fixtureRoot, 'migration')
const home = wholeHome ? path.join(migrationOutput, 'home') : path.join(fixtureRoot, 'dsh-home')
let original, originalGeneration
if (wholeHome) {
  original = path.join(fixtureRoot, 'original')
  for (const directory of ['sessions/_no-cwd/migrated-parent', 'profiles/web', 'attachments', 'quantskills/contest']) {
    await mkdir(path.join(original, directory), { recursive: true })
  }
  await writeFile(path.join(original, 'sessions/_no-cwd/migrated-parent/session.jsonl.zstd'),
    zstdCompressSync(Buffer.from(JSON.stringify({ type: 'session', version: 0, id: 'migrated-parent', createdAt: 1, delegationDepth: 0, agentPreset: 'code', seedLength: 0 }) + '\n')))
  await writeFile(path.join(original, 'profiles/web/package.json'), JSON.stringify({
    name: 'dsh-profile-web', packageManager: 'pnpm@11.7.0', quantskills: { managedProfile: true },
    dependencies: legacyMarket ? { dshmarket: `link:${path.join(root, 'node_modules/dshmarket').replaceAll('\\', '/')}` } : {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...(legacyMarket ? ['dshmarket'] : []), ...(allOptional ? OPTIONAL_BUNDLES : [])] } },
  }))
  if (legacyMarket) {
    await mkdir(path.join(original, 'profiles/web/node_modules'))
    await symlink(await realpath(path.join(root, 'node_modules/dshmarket')),
      path.join(original, 'profiles/web/node_modules/dshmarket'), process.platform === 'win32' ? 'junction' : 'dir')
  }
  await writeFile(path.join(original, 'attachments/retained.dat'), 'fixture attachment')
  await writeFile(path.join(original, 'quantskills/contest/retained-fill.json'), '{"id":"fixture-fill","fee":2.5,"net":7.5}')
  await writeFile(path.join(original, 'quantskills/pending-session-deletions.json'), '[]')
  await writeFile(path.join(original, 'cordis.patch.yml'),
    ['workspace-controller', 'quantskills-session'].map(id =>
      `- id: ${id}\n  config:\n    documentsDirectory: ${JSON.stringify(path.join(fixtureRoot, 'documents'))}\n`).join(''))
  originalGeneration = (await inventoryOfflineTree(original)).generation
  await migrateHomeCopy(original, migrationOutput, { consistency: 'verified-offline-snapshot', backupId: 'constructed-ci-whole-home' })
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
if (!wholeHome) await writeFile(path.join(home, 'cordis.patch.yml'),
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
const expectedGeneration = wholeHome ? (await certifyIsolatedHome(migrationOutput, {
  fixtureRoot, runtime: { source: root, pnpm: pnpmCli },
})).generation : 'empty-ci-fixture'
if (!wholeHome) await writeAtomic(migrationPath(home), { schemaVersion: 1, sourceRuntime: 'empty-fixture', targetRuntime: TARGET_DSH,
  generation: expectedGeneration, backupId: 'no-original-user-data', phase: 'validated', oldReadable: 'yes' })
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
    if (proof.runtime !== TARGET_DSH || proof.generation !== expectedGeneration || !/^[a-f0-9]{40}$/.test(proof.commit)) throw new Error('Wrong activation identity')
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) })
    const html = await response.text()
    if (!response.ok || !html.includes('__DSH_BOOT__')) throw new Error('Frontend entry did not expose its built module roster')
    await assertIsolatedFixture(home, fixtureRoot, { source: root, pnpm: pnpmCli }, generated)
    if (wholeHome) {
      if ((await inventoryOfflineTree(original)).generation !== originalGeneration) throw new Error('Original fixture generation was modified.')
      if (await readFile(path.join(home, 'attachments/retained.dat'), 'utf8') !== 'fixture attachment') throw new Error('Attachment missing after activation.')
      const fill = JSON.parse(await readFile(path.join(home, 'quantskills/contest/retained-fill.json'), 'utf8'))
      if (fill.net !== 7.5 || fill.fee !== 2.5) throw new Error('Trade data changed after activation.')
      console.log(JSON.stringify({ wholeHomeActivation: 'passed', originalsPreserved: true, attachmentsAndTradePreserved: true }))
    }
    if (legacyMarket) {
      const installed = JSON.parse(await readFile(path.join(home, 'profiles/web/package.json'), 'utf8'))
      const before = JSON.parse(await readFile(path.join(original, 'profiles/web/package.json'), 'utf8'))
      if (installed.dependencies.dshmarket !== before.dependencies.dshmarket
        || installed.dsh.profile.bundles.includes('dshmarket')
        || !installed.dsh.profile.bundles.includes('@deepseek-ai/dsh-experimental-plugin-market-bundle')) throw new Error('Legacy market migration did not retain its source and select only official Discover.')
      console.log(JSON.stringify({ legacyMarketMigration: 'passed', oldSourcePreserved: true, officialDiscoverSelected: true }))
    }
    console.log(JSON.stringify({ activation: 'passed', runtime: proof.runtime, commit: proof.commit, generation: proof.generation, artifact: proof.artifact, port }))
    if (allOptional) console.log(JSON.stringify({ optionalComposition: 'passed', explicitlySelected: OPTIONAL_BUNDLES, defaultSelectionChanged: false }))
    if (process.argv.includes('--browser-e2e')) {
      const { verifyBrowser } = await import('./browser-acceptance.mjs')
      // The process-generated link is an isolated test credential; never log it.
      const token = output.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/\?token=([A-Za-z0-9_-]+)/)?.[1]
      await verifyBrowser({ url: `http://127.0.0.1:${port}/${token ? '?token=' + token : ''}`, fixtureRoot,
        workspaceRoot: path.join(wholeHome ? fixtureRoot : home, 'documents', 'QuantSkills'), proof })
    }
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
    await rm(fixtureRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
}
