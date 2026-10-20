/** Application-owned Web profile; never resets a shipped template over user configuration. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv, loadProfileDirectory } from '@deepseek-ai/dsh-app-boot'
import { runProfile } from '@deepseek-ai/dsh/profile-boot'
import { resolveDshHome, resolveProfile } from './profile-state.mjs'
import { assertBootstrapInstalled, assertMigrationReady, assertIsolatedFixture, REQUIRED_SERVICES, candidateArtifact, TARGET_DSH, BOOTSTRAP_PROTOCOL } from './runtime-protocol.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url))), require = createRequire(join(root, 'package.json'))
const home = resolveDshHome(), profileName = resolveProfile()
await assertBootstrapInstalled(home, process.env)
const migration = await assertMigrationReady(home, TARGET_DSH)
if (process.env.QUANTSKILLS_FIXTURE_ROOT) await assertIsolatedFixture(home, process.env.QUANTSKILLS_FIXTURE_ROOT,
  { source: root, pnpm: process.env.QUANTSKILLS_PNPM_CLI },
  { browserSecretHash: process.env.QUANTSKILLS_FIXTURE_BROWSER_SECRET_HASH })
if (!process.send) throw new Error('Start the candidate through the QuantStudio launcher; IPC is required.')
const expected = JSON.parse(process.env.QUANTSKILLS_READY_EXPECTED ?? 'null')
if (!expected?.nonce) throw new Error('Missing launch identity.')
const anchor = require.resolve('@deepseek-ai/dsh/package.json')
const runtime = JSON.parse(await readFile(anchor, 'utf8')).version
if (runtime !== TARGET_DSH) throw new Error('Unexpected core version.')
const artifact = await candidateArtifact(root)
if (artifact !== expected.artifact) throw new Error('Candidate artifact does not match the launcher.')
const profile = loadProfileDirectory('QuantStudio', join(home, 'profiles', profileName), anchor)
const { ctx } = await runProfile({
  environment: loadLayeredEnv('QuantStudio'), profile: profileName,
  resolvedProfile: { profile, installAnchor: anchor }, patchFiles: [], args: process.argv.slice(2),
  packageManager: { command: process.execPath, args: [process.env.QUANTSKILLS_PNPM_CLI], env: {} },
})
const { stdout } = await promisify(execFile)('git', ['rev-parse', 'HEAD^{commit}'], { cwd: root, windowsHide: true })
const commit = stdout.trim()
if (commit !== expected.commit) throw new Error('Candidate checkout does not match launch identity.')
// A served page is not evidence that the requested composition activated.
const inactive = []
for (const entry of ctx.loader.entries()) {
  if (entry.disabled || entry.fiber?.state === 2) continue
  let cause = `state ${entry.fiber?.state ?? 'import failed'}`
  try { if (!entry.fiber) await entry.parent.tree.import(entry.options.name); else if (entry.fiber.state === 3) await entry.fiber.await() }
  catch (error) { cause = String(error) }
  inactive.push(`${entry.options.id}: ${cause}`)
}
if (inactive.length) throw new Error(`Candidate composition incomplete:\n${inactive.join('\n')}`)
const lifecycle = ctx.get('quantSkillsSessions')
if (typeof lifecycle?.whenLifecycleReady !== 'function') throw new Error('Lifecycle readiness service unavailable.')
await lifecycle.whenLifecycleReady()
const services = Object.fromEntries(REQUIRED_SERVICES.map(name => [name, ctx.get(name) !== undefined]))
process.send({ type: 'quantskills:ready', protocol: BOOTSTRAP_PROTOCOL, nonce: expected.nonce, commit, runtime, artifact,
  generation: migration.generation, migrationPhase: migration.phase, services })
