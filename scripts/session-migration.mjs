/** Offline-only migration. No Host, credentials, automation, tool or trading service is constructed. */
import { readFile, readdir, lstat, mkdir, writeFile, realpath, open, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { decodeSessionFrames } from './session-zstd.mjs'
import { join, relative, resolve, isAbsolute, dirname, basename } from 'node:path'
import { writeAtomic } from './runtime-protocol.mjs'
import { migrateTeamEvents } from './team-event-migration.mjs'
import { prepareQSEvents, restoreQSEvents } from './qs-event-migration.mjs'
import { sessionFormatCatalog, historicalSessionFormatCatalog, createSessionFormatCatalogWithChildren } from '@deepseek-ai/dsh-session-format-catalog'
import { historicalChildCatalogSource } from '@deepseek-ai/dsh-session-format-v3-to-v4'

const hash = value => createHash('sha256').update(value).digest('hex')
const inside = (root, path) => { const part = relative(root, path); return part !== '' && !part.startsWith('..') && !isAbsolute(part) }

export function restoreRows(rows, catalog = sessionFormatCatalog) {
  if (!rows.length) throw new Error('Empty session artifact.')
  // Released packed-chunk readers mutate their input while expanding it. Each pass owns its rows.
  const restore = catalog.createRestore(structuredClone(rows[0]), { recovery: 'strict', validation: 'current' })
  for (const row of rows.slice(1)) restore.decodeRow(structuredClone(row))
  return restore.finish()
}

/** Offline, restartable conversion. Its journal never certifies a runnable user home. */
export async function migrateSessionCopy(source, destination) {
  // Canonicalize the parent before checking disjoint roots; a linked parent must not evade isolation.
  destination = join(await realpath(dirname(resolve(destination))), basename(destination))
  const lockPath = join(dirname(destination), `.qs-migrate-${hash(destination)}.lock`)
  const lock = await open(lockPath, 'wx', 0o600)
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, destination })); await lock.sync()
    return await migrateLocked(source, destination)
  } finally { await lock.close(); await rm(lockPath) }
}

async function migrateLocked(source, destination) {
  source = await realpath(source)
  destination = resolve(destination)
  if (source === destination || inside(source, destination) || inside(destination, source)) throw new Error('Migration roots must be disjoint.')
  const inputs = [], seen = new Set()
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = join(directory, entry.name), info = await lstat(path)
      if (info.isSymbolicLink()) throw new Error('Offline migration refuses links.')
      if (info.isDirectory()) { await walk(path); continue }
      const compressed = entry.name.endsWith('.jsonl.zstd')
      if (!compressed && !entry.name.endsWith('.jsonl')) continue
      if (info.size > 512 * 1024 * 1024) throw new Error('Session artifact exceeds the offline reader limit.')
      const bytes = await readFile(path)
      const decodedBytes = compressed ? decodeSessionFrames(bytes) : bytes
      if (!decodedBytes.toString('utf8').endsWith('\n')) throw new Error('Truncated session input; no tail repair is allowed offline.')
      const rows = decodedBytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
      const header = sessionFormatCatalog.readHeader(rows[0])
      if (!['current', 'migration-required'].includes(header.status)) throw new Error(`Unsupported session header in ${relative(source, path)}`)
      if (seen.has(header.header.id)) throw new Error('Duplicate session identity; select one verified generation before migration.')
      seen.add(header.header.id)
      // Decode historical child evidence without executing the runtime or completing its inbox.
      const qs = prepareQSEvents(rows)
      const historical = header.storedVersion < 4 ? restoreRows(qs.migrationRows, historicalSessionFormatCatalog) : undefined
      inputs.push({ path, bytes, rows, header, historical, compressed, qs })
    }
  }
  await walk(source)
  if (!inputs.length) throw new Error('No session records found; an empty scan cannot certify migration.')
  const inventory = inputs.map(input => [relative(source, input.path).replaceAll('\\', '/'), hash(input.bytes)])
  const generation = hash(JSON.stringify(inventory))
  const journalPath = join(destination, 'migration.json')
  let previous
  try {
    const info = await lstat(destination)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe migration destination.')
    previous = JSON.parse(await readFile(journalPath, 'utf8'))
    if (previous.schemaVersion !== 1 || previous.kind !== 'offline-session-copy'
      || previous.generation !== generation || previous.source !== source || previous.targetRuntime !== '0.2.1-rc.2'
      || !['prepared', 'migrating', 'validated', 'failed'].includes(previous.phase)) throw new Error('Unknown or mismatched migration journal; preserve output for inspection.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    // mkdir is exclusive: an existing directory without a journal is never adopted.
    await mkdir(destination, { recursive: false, mode: 0o700 })
  }
  const journal = { schemaVersion: 1, kind: 'offline-session-copy', source, sourceRuntime: '0.1.2-alpha.2',
    targetRuntime: '0.2.1-rc.2', generation, backupId: `original-bytes-${generation}`, phase: 'prepared', oldReadable: 'no', runnable: false }
  await writeAtomic(journalPath, journal)
  try {
  const outputs = inputs.map(input => {
    const children = inputs.filter(child => child.historical?.header.parentSession === input.header.header.id && child.historical.header.origin === 'subagent')
      .map(child => historicalChildCatalogSource(child.historical))
    const core = restoreRows(input.qs.migrationRows, createSessionFormatCatalogWithChildren(children))
    const qs = restoreQSEvents(core, input.qs.originals)
    const decoded = qs.artifact
    const team = migrateTeamEvents(decoded.header, decoded.events)
    const artifact = { ...decoded, events: team.events }
    if (artifact.header.id !== input.header.header.id || artifact.header.parentSession !== input.header.header.parentSession) {
      throw new Error('Migration changed session identity or lineage.')
    }
    const rows = [sessionFormatCatalog.encodeCurrentHeader(artifact.header, artifact.inheritedEventCount),
      ...artifact.events.map(event => sessionFormatCatalog.encodeCurrentEvent(event))]
    // Round-trip through the strict target reader; comparing file counts is insufficient.
    const restored = restoreRows(rows)
    if (JSON.stringify(restored) !== JSON.stringify(artifact)) throw new Error('Migration round-trip changed semantic data.')
    return { input, artifact, team, qs, text: rows.map(row => JSON.stringify(row)).join('\n') + '\n' }
  })
  journal.phase = 'migrating'
  await writeAtomic(journalPath, journal)
  const report = { schemaVersion: 1, runtime: '0.2.1-rc.2', generation, runnable: false, oldReadable: 'no', sessions: [] }
  async function retain(path, bytes) {
    try {
      const info = await lstat(path)
      if (!info.isFile() || info.isSymbolicLink() || hash(await readFile(path)) !== hash(bytes)) throw new Error('Existing migration output differs; refusing replacement.')
    } catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }) }
  }
  for (const { input, artifact, team, qs, text } of outputs) {
    const key = hash(artifact.header.id), dir = join(destination, key)
    await mkdir(dir, { recursive: true })
    if ((await lstat(dir)).isSymbolicLink()) throw new Error('Linked migration output refused.')
    await retain(join(dir, input.compressed ? 'original.jsonl.zstd' : 'original.jsonl'), input.bytes)
    await retain(join(dir, 'session.v4.jsonl'), text)
    await retain(join(dir, 'team-history.json'), JSON.stringify({ originals: team.originals, mappings: team.mappings, unknown: team.unknown }, null, 2) + '\n')
    await retain(join(dir, 'qs-history.json'), JSON.stringify({ originals: qs.originals, mappings: qs.mappings }, null, 2) + '\n')
    report.sessions.push({ id: artifact.header.id, parentSession: artifact.header.parentSession,
      origin: artifact.header.origin, directory: key, source: relative(source, input.path),
      sourceHash: hash(input.bytes), targetHash: hash(text), sourceVersion: input.header.storedVersion,
      events: artifact.events.length, inheritedEventCount: artifact.inheritedEventCount, teamChanges: team.mappings,
      qsChanges: qs.mappings,
      unknownTeamEvents: team.unknown.map(event => ({ seq: event.seq, type: event.type })),
      unknown: artifact.events.filter(event => event.ignorable === true).map(event => ({ seq: event.seq, type: event.type })) })
  }
  // Detect additions, removal and changed bytes before publishing any success report.
  for (const { path, bytes } of inputs) if (hash(await readFile(path)) !== hash(bytes)) throw new Error('Source changed during offline migration; output is uncertified.')
  const originalCount = inputs.length
  inputs.length = 0; seen.clear()
  await walk(source)
  if (inputs.length !== originalCount || hash(JSON.stringify(inputs.map(input => [relative(source, input.path).replaceAll('\\', '/'), hash(input.bytes)]))) !== generation) {
    throw new Error('Source membership changed during migration; output is uncertified.')
  }
  await writeAtomic(join(destination, 'report.json'), report)
  journal.phase = 'validated'
  await writeAtomic(journalPath, journal)
  return report
  } catch (error) {
    journal.phase = 'failed'
    await writeAtomic(journalPath, journal)
    throw error
  }
}
