import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, readdir, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { zstdCompressSync } from 'node:zlib'
import { QuantSkillsApplicationUpdater } from '../packages/quantskills-host/lib/types/application-update.js'

// Opt-in network integration check: real release discovery, install, validation and activation.
const source = process.argv[2] ?? 'github'
if (!['github', 'gitee'].includes(source)) throw new Error('Expected github or gitee')
const pnpmCli = process.env.npm_execpath
if (!pnpmCli) throw new Error('Run with pnpm run verify:update-live [github|gitee]')
const root = await mkdtemp(join(tmpdir(), 'qs-update-e2e-'))
const home = join(root, 'home'), current = join(root, 'old-application')
await mkdir(current, { recursive: true })
await writeFile(join(current, 'package.json'), JSON.stringify({ version: '0.1.19' }))
await mkdir(home, { recursive: true })
await cp(resolve('assets/library-v2/quantskills'), join(home, 'quantskills'), { recursive: true })
const extra = {
  'quantskills/authored/my-private-skill/source/SKILL.md': '# My own skill\nDo not replace.\n',
  'sessions/_no-cwd/private-test/history.jsonl': '{"role":"user","content":"isolated test conversation"}\n',
  'quantskills/database/private-cache.json': '{"test":true}',
  'my-model-settings.json': '{"apiKey":"test-only-placeholder","model":"my-custom-model"}',
}
for (const [path, content] of Object.entries(extra)) { await mkdir(join(home, path, '..'), { recursive: true }); await writeFile(join(home, path), content) }
async function hashes(dir, prefix = '') {
  const out = {}
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? prefix + '/' + entry.name : entry.name
    if (path === 'quantskills/application') continue
    if (entry.isDirectory()) Object.assign(out, await hashes(dir, path))
    else if (entry.isFile()) out[path] = createHash('sha256').update(await readFile(join(dir, path))).digest('hex')
  }
  return out
}
await writeFile(join(home, 'sessions/_no-cwd/private-test/session.jsonl.zstd'), zstdCompressSync(Buffer.from(JSON.stringify({ type: 'session', version: 0, id: 'private-test', createdAt: 1700000000000, delegationDepth: 0 }) + '\n')))
const before = await hashes(home)
const environment = { ...process.env, DSH_HOME: home, QUANTSKILLS_DISABLE_APPLICATION_UPDATE: '1', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', QUANTSKILLS_CI_PORT: '39159', CI: 'true' }
function run(command, args, cwd, signal, extra = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, signal, env: { ...environment, ...extra }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', error = ''
    child.stdout.on('data', data => { output += data.toString() })
    child.stderr.on('data', data => { error = (error + data.toString()).slice(-6000) })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolveRun(output) : reject(new Error(`${command} ${args.slice(0, 3).join(' ')} failed (${code}): ${error || output.slice(-6000)}`)))
  })
}
const applicationRoot = join(home, 'quantskills/application')
const updater = new QuantSkillsApplicationUpdater({ applicationRoot, repositoryRoot: current, commands: {
  runGit: async (args, cwd, signal) => { try { return await run('git', ['-c', 'credential.helper=', ...args], cwd, signal) } catch (error) { console.error(error.message); throw error } },
  runPnpm: async (args, cwd, signal, extra) => { console.log('RUN', args.join(' ')); await run(process.execPath, [pnpmCli, ...args], cwd, signal, extra) },
} })
await updater.initialize()
updater.check(source)
async function settle() {
  let previous = ''
  const deadline = Date.now() + 15 * 60 * 1000
  while (Date.now() < deadline) {
    const s = updater.getStatus(), label = s.state + (s.phase ? ':' + s.phase : '')
    if (label !== previous) { console.log(source, label, s.errorCode ?? ''); previous = label }
    if (!['checking', 'preparing'].includes(s.state)) return s
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Update timed out')
}
const checked = await settle()
if (checked.state !== 'available' || !checked.releaseNotes?.length) throw new Error('Expected a newer release with release notes: ' + JSON.stringify(checked))
updater.start()
const ready = await settle()
if (ready.state !== 'ready') throw new Error('Candidate preparation failed: ' + JSON.stringify(ready))
const candidate = join(applicationRoot, 'versions', ready.candidateCommit)
const bootstrap = join(applicationRoot, 'bootstrap')
await mkdir(bootstrap, { recursive: true })
await cp(join(candidate, 'scripts/application-bootstrap.mjs'), join(bootstrap, 'launcher.mjs'))
await writeFile(join(bootstrap, 'config.json'), JSON.stringify({ schemaVersion: 1, nodeExecutable: process.execPath, pnpmCli, fallbackSourceRoot: current, defaultPort: 39158, healthTimeoutMs: 90000 }))
const launched = spawn(process.execPath, [join(bootstrap, 'launcher.mjs'), '--port', '39158', '--no-open'], { env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let launchLog = ''
launched.stdout.on('data', data => { launchLog = (launchLog + data.toString()).slice(-6000) })
launched.stderr.on('data', data => { launchLog = (launchLog + data.toString()).slice(-6000) })
try {
  const deadline = Date.now() + 120000
  let activated = false
  while (Date.now() < deadline) {
    if (launched.exitCode !== null) throw new Error('Launcher exited: ' + launchLog)
    const state = JSON.parse(await readFile(join(applicationRoot, 'state.json'), 'utf8'))
    if (state.active === ready.candidateCommit && !state.pending) { activated = true; break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!activated) throw new Error('Candidate did not activate: ' + launchLog)
  const response = await fetch('http://127.0.0.1:39158/')
  if (!response.ok || !(await response.text()).includes('<html')) throw new Error('Activated host not healthy')
  const after = await hashes(home)
  for (const [path, hash] of Object.entries(before)) if (after[path] !== hash) throw new Error('Personal file changed: ' + path)
  const result = { source, version: ready.candidateVersion, commit: ready.candidateCommit, protectedFiles: Object.keys(before).length, stages: ['anonymous-discovery','download','locked-install','typecheck','smoke','bootstrap-activation','personal-data-preserved'], result: 'passed' }
  await writeFile(join(root, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result)); console.log('Evidence:', join(root, 'result.json'))
} finally {
  if (launched.exitCode === null) {
    if (process.platform === 'win32') await run('taskkill', ['/pid', String(launched.pid), '/T', '/F'], root)
    else launched.kill('SIGTERM')
  }
  await updater.dispose()
}
