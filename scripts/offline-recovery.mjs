/** Copy-only recovery of quiescent, offline homes. Never activates or overwrites either generation. */
import { createHash } from 'node:crypto'
import { chmod, copyFile, lstat, mkdir, open, readFile, readdir, readlink, realpath, rm, symlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { writeAtomic } from './runtime-protocol.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
const childOf = (parent, child) => {
  const part = relative(parent, child)
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part))
}
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)

/** Includes empty directories and link text; links are recorded, never followed. */
export async function inventoryOfflineTree(directory) {
  if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) throw new Error('Offline home must be a real directory.')
  const root = await realpath(directory), entries = []
  async function walk(path) {
    for (const name of (await readdir(path)).sort()) {
      const file = join(path, name), info = await lstat(file)
      const key = relative(root, file).split(sep).join('/')
      if (info.isSymbolicLink()) {
        // Preserving a link is not authorization to execute its target.
        entries.push({ path: key, kind: 'link', target: await readlink(file) })
      } else if (info.isDirectory()) {
        entries.push({ path: key, kind: 'directory' })
        await walk(file)
      } else if (info.isFile()) {
        const bytes = await readFile(file), after = await lstat(file)
        if (!after.isFile() || after.isSymbolicLink() || info.size !== after.size || info.mtimeMs !== after.mtimeMs
          || info.ino !== after.ino || info.dev !== after.dev) throw new Error('Offline home changed while reading; stop writers first.')
        entries.push({ path: key, kind: 'file', bytes: bytes.length, sha256: digest(bytes), mode: info.mode & 0o777 })
      } else throw new Error('Unsupported special file in offline home.')
    }
  }
  await walk(root)
  return { root, generation: digest(JSON.stringify(entries)), entries }
}

export async function copyVerified(source, destination, inventory) {
  try { await mkdir(destination, { mode: 0o700 }) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  if (!(await lstat(destination)).isDirectory() || (await lstat(destination)).isSymbolicLink()) throw new Error('Unsafe recovery output.')
  for (const entry of inventory.entries) {
    const file = join(destination, ...entry.path.split('/')), original = join(source, ...entry.path.split('/'))
    let info
    try { info = await lstat(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (info) {
      const matches = entry.kind === 'directory' ? info.isDirectory() && !info.isSymbolicLink()
        : entry.kind === 'link' ? info.isSymbolicLink() && await readlink(file) === entry.target
        : info.isFile() && !info.isSymbolicLink() && digest(await readFile(file)) === entry.sha256
      if (!matches) throw new Error('Recovery output changed; preserve it for inspection.')
      continue
    }
    if (entry.kind === 'directory') await mkdir(file, { mode: 0o700 })
    else if (entry.kind === 'link') {
      // A copied tree remains offline; both relative and absolute link semantics are retained.
      // On Windows use the original target type when available; dangling links stay file links.
      let type = 'file'
      try { if ((await lstat(resolve(dirname(original), entry.target))).isDirectory()) type = 'dir' } catch { /* retain dangling link */ }
      await symlink(entry.target, file, type)
    } else {
      await copyFile(original, file, constants.COPYFILE_EXCL)
      // FlushFileBuffers requires a writable handle on Windows, including for read-only source files.
      await chmod(file, entry.mode | 0o200)
      const handle = await open(file, 'r+')
      try { await handle.sync() } finally { await handle.close(); await chmod(file, entry.mode) }
    }
  }
  const copied = await inventoryOfflineTree(destination)
  if (!equal(copied.entries, inventory.entries)) throw new Error('Recovery copy does not match its complete source inventory.')
  const unchanged = await inventoryOfflineTree(source)
  if (unchanged.generation !== inventory.generation) throw new Error('Offline home changed during recovery; no copy is certified.')
}

/**
 * Input homes must already be stopped/consistent offline copies. A stable read cannot prove
 * database transaction consistency; caller must supply the verified snapshot's identifier.
 * No returned journal is a runnable migration certificate, even after the copy is validated.
 */
export async function preserveAndRestoreCopy(backup, candidate, output, options) {
  if (options?.consistency !== 'verified-offline-snapshot' || typeof options.backupId !== 'string' || !options.backupId.trim()) {
    throw new Error('A verified consistent offline snapshot and backup identifier are required.')
  }
  backup = await realpath(backup); candidate = await realpath(candidate)
  output = join(await realpath(dirname(resolve(output))), basename(output))
  const roots = [backup, candidate, output]
  if (roots.some((root, index) => roots.some((other, otherIndex) => index !== otherIndex && childOf(root, other)))) {
    throw new Error('Backup, candidate and recovery output must be disjoint.')
  }
  const lockPath = join(dirname(output), `.qs-recovery-${digest(output)}.lock`)
  const lock = await open(lockPath, 'wx', 0o600)
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, output })); await lock.sync()
    const baseline = await inventoryOfflineTree(backup), increments = await inventoryOfflineTree(candidate)
    if (baseline.entries.length === 0) throw new Error('An empty backup cannot certify recovery.')
    const identity = { schemaVersion: 1, kind: 'offline-recovery-copy', sourceRuntime: '0.1.2-alpha.2', targetRuntime: '0.2.1-rc.2',
      backupId: options.backupId, backup, candidate, baselineGeneration: baseline.generation,
      generation: increments.generation, oldReadable: 'unknown', runnable: false }
    const journalPath = join(output, 'migration.json')
    let previous
    try {
      const info = await lstat(output)
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe recovery output.')
      previous = JSON.parse(await readFile(journalPath, 'utf8'))
      if (!['prepared', 'migrating', 'validated', 'failed'].includes(previous.phase)
        || Object.entries(identity).some(([key, value]) => !equal(previous[key], value))) throw new Error('Unknown or mismatched recovery journal.')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      // Never adopt an unjournaled existing directory.
      await mkdir(output, { mode: 0o700 })
    }
    const journal = { ...identity, phase: 'prepared', preserved: false, restored: false }
    await writeAtomic(journalPath, journal)
    try {
      journal.phase = 'migrating'; await writeAtomic(journalPath, journal)
      // Preserve every candidate byte first, including new data and changed/deleted-record evidence.
      await copyVerified(candidate, join(output, 'preserved-candidate'), increments)
      journal.preserved = true; await writeAtomic(journalPath, journal)
      await copyVerified(backup, join(output, 'restored-baseline'), baseline)
      journal.restored = true
      // Recheck both inputs after both copies, not merely after their individual copy pass.
      if ((await inventoryOfflineTree(candidate)).generation !== increments.generation
        || (await inventoryOfflineTree(backup)).generation !== baseline.generation) throw new Error('Offline inputs changed before final verification.')
      await writeAtomic(join(output, 'inventories.json'), { baseline, preservedCandidate: increments })
      journal.phase = 'validated'; await writeAtomic(journalPath, journal)
      return { ...journal, originalHomesModified: false, automaticallyActivated: false }
    } catch (error) {
      journal.phase = 'failed'; await writeAtomic(journalPath, journal)
      throw error
    }
  } finally { await lock.close(); await rm(lockPath) }
}
