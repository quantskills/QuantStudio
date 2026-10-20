/** Launcher protocol v2. Imported by installation, activation and the child Host. */
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, mkdir, lstat, readdir, realpath } from 'node:fs/promises'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'

export const BOOTSTRAP_PROTOCOL = 2
export const TARGET_DSH = '0.2.1-rc.2'
export const REQUIRED_SERVICES = ['agents', 'sessions', 'sessionPersistence', 'quantSkillsHost', 'quantSkillsSessions']
export const migrationPath = home => join(home, 'quantskills/application/migration.json')

export async function writeAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  await rename(temporary, path)
}

export function parseMigration(value) {
  if (!value || value.schemaVersion !== 1 || !['prepared', 'migrating', 'validated', 'failed'].includes(value.phase)
    || typeof value.sourceRuntime !== 'string' || typeof value.targetRuntime !== 'string'
    || typeof value.generation !== 'string' || !value.generation || typeof value.backupId !== 'string' || !value.backupId
    || !['yes', 'no', 'unknown'].includes(value.oldReadable)) throw new Error('Unsupported or corrupt migration record; startup stopped.')
  return value
}

export async function readMigration(home) {
  try { return parseMigration(JSON.parse(await readFile(migrationPath(home), 'utf8'))) }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
}

export async function assertMigrationReady(home, runtime) {
  const migration = await readMigration(home)
  if (!migration) {
    if (runtime === TARGET_DSH) throw new Error('Migration validation is required before starting the candidate core.')
    return
  }
  if (migration.phase !== 'validated') throw new Error(`Migration ${migration.phase}; automatic startup and rollback stopped.`)
  if (migration.targetRuntime !== runtime && (migration.sourceRuntime !== runtime || migration.oldReadable !== 'yes')) {
    throw new Error('This data generation is not verified readable by the selected core; rollback stopped.')
  }
  return migration
}

export async function assertRollbackSafe(home) {
  const migration = await readMigration(home)
  if (migration && (migration.phase !== 'validated' || migration.oldReadable !== 'yes')) {
    throw new Error('Data compatibility is unknown or incompatible; automatic rollback stopped. Preserve new data before restoring a snapshot.')
  }
}

export async function assertBootstrapInstalled(home, environment) {
  const base = join(home, 'quantskills/application/bootstrap')
  let pointer
  try { pointer = JSON.parse(await readFile(join(base, 'current.json'), 'utf8')) } catch { /* Fail closed below. */ }
  if (pointer?.protocol !== BOOTSTRAP_PROTOCOL || !/^[a-f0-9]{64}$/.test(pointer.version ?? '')
    || environment.QUANTSKILLS_BOOTSTRAP_PROTOCOL !== String(BOOTSTRAP_PROTOCOL)) {
    throw new Error('Upgrade the QuantStudio launcher first, then start through pnpm run web. No Profile or data files were changed.')
  }
  const config = JSON.parse(await readFile(join(base, 'versions', pointer.version, 'config.json'), 'utf8'))
  if (config.protocol !== BOOTSTRAP_PROTOCOL) throw new Error('Invalid launcher protocol; installation stopped.')
}

export function validateReady(message, expected) {
  if (!message || message.type !== 'quantskills:ready' || message.protocol !== BOOTSTRAP_PROTOCOL) return false
  for (const key of ['nonce', 'commit', 'runtime', 'generation']) {
    if (typeof expected[key] !== 'string' || message[key] !== expected[key]) throw new Error(`Candidate readiness mismatch: ${key}`)
  }
  if (message.migrationPhase !== 'validated' || !REQUIRED_SERVICES.every(name => message.services?.[name] === true)) {
    throw new Error('Candidate services or migration are not ready.')
  }
  return true
}

export async function waitForReady(child, expected, timeoutMs) {
  await new Promise((accept, reject) => {
    const finish = error => { clearTimeout(timer); child.off('message', message); child.off('exit', exit); child.off('error', finish); error ? reject(error) : accept() }
    const message = value => { try { if (validateReady(value, expected)) finish() } catch (error) { finish(error) } }
    const exit = () => finish(new Error('Candidate exited before readiness handshake.'))
    const timer = setTimeout(() => finish(new Error('Candidate readiness handshake timed out.')), timeoutMs)
    child.on('message', message); child.once('exit', exit); child.once('error', finish)
    if (child.exitCode !== null || child.signalCode !== null) exit()
  })
}

/** Inspect a runnable fixture before any service constructor can replay deletion or automation. */
export async function assertIsolatedFixture(home, allowedRoot) {
  const root = await realpath(allowedRoot)
  const inside = path => { const child = relative(root, resolve(path)); return child === '' || (!child.startsWith('..') && !isAbsolute(child)) }
  if (!inside(await realpath(home))) throw new Error('Fixture home is outside the isolated root.')
  const inspect = (value, key = '') => {
    if (typeof value === 'string' && /(?:path|root|cwd|directory|workspace|target|file|command|args|script|home)/i.test(key)) {
      if ((isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) && !inside(value)) throw new Error(`Unsafe fixture path in ${key}`)
    } else if (Array.isArray(value)) value.forEach(item => inspect(item, key))
    else if (value && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) {
        if (/(?:api.?key|password|access.?token|refresh.?token|secret)/i.test(field) && item && item !== 'TEST_ONLY') throw new Error('Fixture contains credentials.')
        inspect(item, field)
      }
    }
  }
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), info = await lstat(path)
      if (info.isSymbolicLink()) { if (!inside(await realpath(path))) throw new Error('Fixture link escapes isolated root.'); continue }
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      if (info.isDirectory()) { await walk(path); continue }
      if (/\.(?:json|jsonl)$/.test(entry.name)) {
        const source = await readFile(path, 'utf8')
        const values = entry.name.endsWith('.jsonl') ? source.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [JSON.parse(source)]
        values.forEach(value => inspect(value))
      }
    }
  }
  await walk(home)
}

export const artifactDigest = value => createHash('sha256').update(value).digest('hex')
