/** Whole-home, copy-only migration. No Host or trading/automation service is constructed. */
import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { copyVerified, inventoryOfflineTree } from './offline-recovery.mjs'
import { migrateSessionCopy } from './session-migration.mjs'
import { assertBootstrapInstalled, assertIsolatedFixture, migrationPath, TARGET_DSH, writeAtomic } from './runtime-protocol.mjs'
import { sessionFormatLogFilename, parseSessionFormatLogFilename } from '@deepseek-ai/dsh-session-format'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const inside = (root, path) => { const r = relative(root, path); return !isAbsolute(r) && r !== '..' && !r.startsWith(`..${sep}`) }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const absent = async file => { try { await lstat(file); return false } catch (e) { if (e.code === 'ENOENT') return true; throw e } }

/** Evidence is aggregate/digests only; record contents and credentials never leave the copied tree. */
export async function inspectHomeData(home, inventory) {
  const counts = {}, databases = []
  if (inventory.entries.some(entry => entry.kind === 'file' && /\.(sqlite3?|db)-wal$/.test(entry.path) && entry.bytes)) {
    throw new Error('Uncheckpointed SQLite WAL: supply a consistent backup.')
  }
  for (const entry of inventory.entries) {
    const group = entry.path.split('/').slice(0, entry.path.startsWith('quantskills/') ? 2 : 1).join('/')
    counts[group] = (counts[group] ?? 0) + 1
    if (entry.kind !== 'file') continue
    const file = join(home, ...entry.path.split('/'))
    if (!/\.(sqlite3?|db)$/.test(entry.path)) continue
    const header = Buffer.alloc(16), input = await open(file, 'r')
    try { await input.read(header, 0, 16, 0) } finally { await input.close() }
    const signature = header.toString()
    if (signature !== 'SQLite format 3\0') throw new Error('Unrecognized database format; migration stopped.')
    // SQLite readOnly can still create WAL/SHM siblings. Open a disposable
    // verified copy, never even a readOnly connection against the snapshot.
    const audit = await mkdtemp(join(tmpdir(), 'qs-sqlite-audit-'))
    let database
    try {
      const copy = join(audit, 'snapshot.sqlite')
      await copyFile(file, copy)
      if (sha(await readFile(copy)) !== entry.sha256) throw new Error('SQLite source changed before verification.')
      database = new DatabaseSync(copy, { readOnly: true })
      if (!equal(database.prepare('PRAGMA integrity_check').all(), [{ integrity_check: 'ok' }])) throw new Error('SQLite integrity check failed.')
      const tables = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all()
      const summary = tables.map(({ name, sql }) => {
        const statement = database.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`)
        statement.setReadBigInts(true)
        // BLOBs must not expand to enormous numeric JSON objects. Hold only
        // fixed-size row digests, independent of table order, preserving types.
        const rows = []
        for (const row of statement.iterate()) {
          const digest = createHash('sha256')
          for (const [column, value] of Object.entries(row)) {
            digest.update(JSON.stringify(column))
            const bytes = value instanceof Uint8Array ? value : Buffer.from(String(value))
            digest.update(`${value instanceof Uint8Array ? 'blob' : typeof value}:${bytes.length}:`)
            digest.update(bytes)
          }
          rows.push(digest.digest('hex'))
        }
        const digest = createHash('sha256')
        for (const row of rows.sort()) digest.update(row)
        return { nameHash: sha(name), schemaHash: sha(sql ?? ''), rows: rows.length, rowsHash: digest.digest('hex') }
      })
      databases.push({ path: entry.path, tables: summary, integrity: 'ok' })
    } finally { database?.close(); await rm(audit, { recursive: true, force: true }) }
  }
  return { counts, databases }
}

/** All non-session bytes, including Profiles, secrets, Trade and deletion journals, must match exactly. */
function verifyRetained(input, output, additions) {
  const actual = new Map(output.entries.map(entry => [entry.path, entry]))
  for (const entry of input.entries) if (!equal(entry, actual.get(entry.path))) throw new Error('Original home content was changed or lost in the candidate copy.')
  for (const entry of output.entries) if (!input.entries.some(old => old.path === entry.path) && !additions.has(entry.path)) {
    throw new Error('Unexpected output appeared during home migration.')
  }
}

/**
 * source must be an already-consistent offline snapshot, not the running daily home.
 * Original generation files remain intact; v4 is published beside them. Cache
 * records are preserved: the official cache validates against the new generation.
 * No certificate here authorizes running a copied real account.
 */
export async function migrateHomeCopy(source, output, options) {
  if (options?.consistency !== 'verified-offline-snapshot' || !options.backupId?.trim()) throw new Error('Verified offline snapshot identity required.')
  source = await realpath(source)
  output = join(await realpath(dirname(resolve(output))), basename(output))
  if (inside(source, output) || inside(output, source)) throw new Error('Home migration roots must be disjoint.')
  const lockPath = join(dirname(output), `.qs-home-${sha(output)}.lock`), handle = await open(lockPath, 'wx', 0o600)
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.sync()
    const original = await inventoryOfflineTree(source)
    const identity = { schemaVersion: 1, kind: 'whole-home-copy', sourceRuntime: '0.1.2-alpha.2', targetRuntime: TARGET_DSH,
      source, generation: original.generation, backupId: options.backupId, oldReadable: 'no', runnable: false }
    const journalFile = join(output, 'migration.json'), home = join(output, 'home')
    let existing
    if (!await absent(output)) {
      if ((await lstat(output)).isSymbolicLink()) throw new Error('Linked migration output refused.')
      existing = JSON.parse(await readFile(journalFile, 'utf8'))
      if (Object.entries(identity).some(([key, value]) => !equal(existing[key], value))
        || !['prepared', 'migrating', 'validated', 'failed'].includes(existing.phase)) throw new Error('Unknown or mismatched whole-home migration journal.')
      if (existing.phase === 'validated') {
        const proof = JSON.parse(await readFile(join(output, 'proof.json'), 'utf8'))
        if (sha(JSON.stringify(proof)) !== existing.proofHash
          || (await inventoryOfflineTree(home)).generation !== proof.targetGeneration) throw new Error('Certified home copy or proof was changed.')
        return existing
      }
    } else await mkdir(output, { mode: 0o700 })
    const journal = { ...identity, phase: 'prepared' }
    await writeAtomic(journalFile, journal)
    try {
      const evidence = await inspectHomeData(source, original)
      // A retry after conversion may contain precisely the previously journaled
      // additions. Verify those below rather than overwriting them.
      const copiedMarker = join(output, 'copied.json')
      if (await absent(copiedMarker)) {
        await copyVerified(source, home, original)
        await writeAtomic(copiedMarker, { generation: original.generation })
      } else if (JSON.parse(await readFile(copiedMarker, 'utf8')).generation !== original.generation) throw new Error('Unknown copy checkpoint.')
      journal.phase = 'migrating'; await writeAtomic(journalFile, journal)
      const logs = original.entries.filter(entry => entry.kind === 'file' && entry.path.startsWith('sessions/') && /\.jsonl(?:\.zstd)?$/.test(entry.path))
      const report = logs.length ? await migrateSessionCopy(join(source, 'sessions'), join(output, 'sessions')) : { sessions: [] }
      const additions = new Set(), converted = []
      for (const session of report.sessions) {
        const oldFile = join(home, 'sessions', session.source), compressed = oldFile.endsWith('.zstd')
        const oldName = basename(oldFile).replace(/\.zstd$/, '')
        if (parseSessionFormatLogFilename(oldName) !== session.sourceVersion) throw new Error('Noncanonical session generation layout; automatic activation refused.')
        const file = join(dirname(oldFile), sessionFormatLogFilename(4) + (compressed ? '.zstd' : ''))
        if (!inside(home, file) || (await lstat(dirname(file))).isSymbolicLink()) throw new Error('Session output escaped its home.')
        const bytes = await readFile(join(output, 'sessions', session.directory, 'session.v4.jsonl'))
        const content = compressed ? zstdCompressSync(bytes) : bytes
        if (await absent(file)) await writeFile(file, content, { flag: 'wx', mode: 0o600 })
        else if (sha(await readFile(file)) !== sha(content)) throw new Error('Conflicting current session generation; preserve it for inspection.')
        const path = relative(home, file).split(sep).join('/')
        additions.add(path); converted.push({ id: session.id, parentSession: session.parentSession, path, events: session.events, sourceHash: session.sourceHash, targetHash: sha(content) })
      }
      const result = await inventoryOfflineTree(home)
      verifyRetained(original, result, additions)
      if ((await inventoryOfflineTree(source)).generation !== original.generation) throw new Error('Offline snapshot changed during migration.')
      const after = await inspectHomeData(home, result)
      if (!equal(evidence.databases, after.databases)) throw new Error('Database semantic reconciliation failed.')
      const proof = { schemaVersion: 1, sourceGeneration: original.generation, targetGeneration: result.generation,
        backupId: options.backupId, originalFiles: original.entries.filter(entry => entry.kind === 'file').length,
        retainedExactly: true, allowedChanges: [...additions].sort(), sessions: converted, evidence,
        automaticTasksRun: 0, messagesSent: 0, tradesPlaced: 0 }
      await writeAtomic(join(output, 'inventories.json'), { original, target: result })
      await writeAtomic(join(output, 'proof.json'), proof)
      journal.phase = 'validated'; journal.proofHash = sha(JSON.stringify(proof))
      await writeAtomic(journalFile, journal)
      return journal
    } catch (error) {
      journal.phase = 'failed'; await writeAtomic(journalFile, journal); throw error
    }
  } finally { await handle.close(); await rm(lockPath) }
}

/**
 * Explicit constructed-fixture admission, never a shortcut for a real data copy.
 * The launcher is installed/verified first, then paths, credentials, schedules,
 * executable references and complete home proof are checked before a certificate.
 */
export async function certifyIsolatedHome(output, options) {
  const journal = JSON.parse(await readFile(join(output, 'migration.json'), 'utf8'))
  const proof = JSON.parse(await readFile(join(output, 'proof.json'), 'utf8'))
  if (journal.kind !== 'whole-home-copy' || journal.phase !== 'validated'
    || sha(JSON.stringify(proof)) !== journal.proofHash) throw new Error('Incomplete whole-home proof.')
  const home = join(output, 'home')
  await assertBootstrapInstalled(home, { QUANTSKILLS_BOOTSTRAP_PROTOCOL: '2' })
  // Launcher files are the only deliberate changes permitted between copy proof and admission.
  const target = JSON.parse(await readFile(join(output, 'inventories.json'), 'utf8')).target
  const current = await inventoryOfflineTree(home)
  const launcherPath = 'quantskills/application/bootstrap'
  const visible = entries => entries.filter(entry => entry.path !== 'quantskills' && entry.path !== 'quantskills/application'
    && entry.path !== launcherPath && !entry.path.startsWith(launcherPath + '/'))
  if (!equal(visible(current.entries), visible(target.entries))) throw new Error('Home changed before fixture admission.')
  await assertIsolatedFixture(home, options.fixtureRoot, options.runtime)
  // A deletion journal is never replayed just to validate migration.
  const deletion = join(home, 'quantskills/pending-session-deletions.json')
  if (!await absent(deletion) && !equal(JSON.parse(await readFile(deletion, 'utf8')), [])) throw new Error('Pending deletion requires a separate constructed recovery test.')
  const admission = { ...proof, certificate: 'isolated-whole-home', runnable: true, certifiedHome: await realpath(home) }
  await writeAtomic(join(home, 'quantskills/application/migration-proof.json'), admission)
  const certificate = { ...journal, kind: 'isolated-whole-home', runnable: true,
    proofHash: sha(JSON.stringify(admission)) }
  await writeAtomic(migrationPath(home), certificate)
  return certificate
}
