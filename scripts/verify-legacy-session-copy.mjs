/** Read a restored offline snapshot with the actual old backend, without a Host. */
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { artifactDigest } from './runtime-protocol.mjs'
import { inventoryOfflineTree } from './offline-recovery.mjs'

export async function verifyLegacySessionCopy(sourceRoot, recovery) {
  const journal = JSON.parse(await readFile(join(recovery, 'migration.json'), 'utf8'))
  if (journal.kind !== 'offline-recovery-copy' || journal.phase !== 'validated'
    || journal.preserved !== true || journal.restored !== true) throw new Error('A complete copy-only recovery is required.')
  const home = join(recovery, 'restored-baseline')
  const before = await inventoryOfflineTree(home)
  if (before.generation !== journal.baselineGeneration) throw new Error('Restored snapshot changed before old-reader verification.')
  const logs = before.entries.filter(row => row.kind === 'file' && /^sessions\/.*\.jsonl(?:\.zstd)?$/.test(row.path))
  if (logs.some(row => !row.path.endsWith('/session.jsonl.zstd'))) throw new Error('Old-reader verification requires the original compressed alpha.2 layout.')
  const require = createRequire(join(resolve(sourceRoot), 'package.json'))
  const manifest = JSON.parse(await readFile(require.resolve('@deepseek-ai/dsh/package.json'), 'utf8'))
  if (manifest.version !== '0.1.2-alpha.2') throw new Error('The pinned old backend is required.')
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')))
  const { SessionStore } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session')))
  const { default: Jsonl } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-persistence-jsonl')))
  // Use the old application's own declarative extension catalog, without
  // mounting its runtime services, automations or trading workers.
  const { registerQuantSkillsSessionEventTypes } = await import(pathToFileURL(
    join(resolve(sourceRoot), 'packages/quantskills-session/lib/types/event-catalog.js')))
  registerQuantSkillsSessionEventTypes()
  const ctx = new Context(), rows = []
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(Jsonl, { root: join(home, 'sessions') })
    const headers = await ctx.sessionPersistence.list()
    if (headers.length !== logs.length || headers.length === 0) throw new Error('The old backend did not discover every restored session.')
    for (const header of headers) {
      const inspection = await ctx.sessionPersistence.inspect(header.id)
      if (inspection.meta.id !== header.id) throw new Error('Restored session identity mismatch.')
      const digest = artifactDigest(JSON.stringify(inspection))
      if (artifactDigest(JSON.stringify(await ctx.sessionPersistence.inspect(header.id))) !== digest) throw new Error('Restored session replay changed on repeat.')
      rows.push({ id: header.id, events: inspection.events.length, digest })
    }
  } finally { await ctx.fiber.dispose() }
  if ((await inventoryOfflineTree(home)).generation !== before.generation) throw new Error('Offline old-reader verification wrote to the restored snapshot.')
  return { runtime: manifest.version, sessions: rows.length, events: rows.reduce((sum, row) => sum + row.events, 0),
    semanticDigest: artifactDigest(JSON.stringify(rows.sort((a, b) => a.id.localeCompare(b.id)))),
    snapshotGeneration: before.generation, snapshotUnchanged: true, hostStarted: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [sourceRoot, recovery] = process.argv.slice(2)
  if (!sourceRoot || !recovery) throw new Error('Usage: verify-legacy-session-copy.mjs <old-checkout> <verified-recovery>')
  console.log(JSON.stringify(await verifyLegacySessionCopy(sourceRoot, recovery)))
}
