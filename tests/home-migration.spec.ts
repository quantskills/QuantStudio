import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, SessionStore } from '@deepseek-ai/dsh-session'
import * as Jsonl from '@deepseek-ai/dsh-session-persistence-jsonl'
import { migrateHomeCopy, certifyIsolatedHome } from '../scripts/home-migration.mjs'
import { inventoryOfflineTree, preserveAndRestoreCopy } from '../scripts/offline-recovery.mjs'
import { assertMigrationReady, assertRollbackSafe, publishBootstrapVersion } from '../scripts/runtime-protocol.mjs'

const roots: string[] = []
const options = { consistency: 'verified-offline-snapshot', backupId: 'constructed-closed-snapshot' }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'qs-whole-home-')); roots.push(root)
  const source = join(root, 'original'), output = join(root, 'converted')
  for (const dir of ['sessions/_no-cwd/parent', 'profiles/web', 'quantskills/authored', 'attachments', 'storages/session_projcache', 'quantskills/contest']) {
    await mkdir(join(source, dir), { recursive: true })
  }
  await writeFile(join(source, 'sessions/_no-cwd/parent/session.jsonl'),
    JSON.stringify({ type: 'session', version: 0, id: 'parent', createdAt: 1, delegationDepth: 0, agentPreset: 'code', seedLength: 0 }) + '\n')
  await writeFile(join(source, 'profiles/web/package.json'), JSON.stringify({ name: 'fixture-profile', dsh: { profile: { bundles: [] } } }))
  await writeFile(join(source, 'settings.yaml'), 'fontSize: 15\n')
  await writeFile(join(source, 'quantskills/authored/agent.json'), '{"id":"my-agent","instructions":"retained content"}')
  await writeFile(join(source, 'attachments/image.dat'), Buffer.from([1, 2, 0, 255]))
  await writeFile(join(source, 'quantskills/pending-session-deletions.json'), '[]')
  await writeFile(join(source, 'storages/session_projcache/parent.json'), '{"oldGeneration":true}')
  const db = new DatabaseSync(join(source, 'quantskills/contest/fills.sqlite'))
  db.exec('CREATE TABLE fills(id TEXT PRIMARY KEY, fee REAL, net REAL); INSERT INTO fills VALUES(\'one\', 2.5, 7.5)')
  db.close()
  return { root, source, output, home: join(output, 'home') }
}

it('retains every original byte, reconciles SQLite and exposes the converted generation to the real persistence backend', async () => {
  const { source, output, home } = await fixture(), before = await inventoryOfflineTree(source)
  const report = await migrateHomeCopy(source, output, options)
  expect(report).toMatchObject({ phase: 'validated', runnable: false, oldReadable: 'no' })
  const proof = JSON.parse(await readFile(join(output, 'proof.json'), 'utf8'))
  expect(proof).toMatchObject({ retainedExactly: true, automaticTasksRun: 0, messagesSent: 0, tradesPlaced: 0 })
  expect(proof.evidence.databases[0].tables[0].rows).toBe(1)
  expect(proof.allowedChanges).toEqual(['sessions/_no-cwd/parent/session.v4.jsonl'])
  expect(await migrateHomeCopy(source, output, options)).toEqual(report)
  expect(await inventoryOfflineTree(source)).toEqual(before)
  const ctx = new Context()
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(Jsonl, { root: join(home, 'sessions'), compression: 'none' })
    expect((await ctx.sessionPersistence.list()).map(row => row.header.id)).toEqual(['parent'])
    const handle = await ctx.sessionPersistence.open(SessionId('parent'), 'read')
    try {
      expect(handle.header.id).toBe('parent')
      expect((await handle.read()).events).toEqual([{ type: 'session/end-seed', seq: 0, time: 1, data: { inherited: true } }])
    }
    finally { await handle.close() }
  } finally { await ctx.fiber.dispose() }
})

it('admits only an isolated verified home after the new launcher is installed, and refuses old-core fallback', async () => {
  const { root, source, output, home } = await fixture()
  await migrateHomeCopy(source, output, options)
  await expect(certifyIsolatedHome(output, { fixtureRoot: root })).rejects.toThrow(/launcher|启动器/i)
  await publishBootstrapVersion(join(home, 'quantskills/application/bootstrap'), resolve('scripts'), { protocol: 2 })
  const certificate = await certifyIsolatedHome(output, { fixtureRoot: root })
  expect(certificate).toMatchObject({ kind: 'isolated-whole-home', runnable: true })
  expect(await assertMigrationReady(home, '0.2.1-rc.2')).toMatchObject({ generation: certificate.generation })
  await expect(assertMigrationReady(home, '0.1.2-alpha.2')).rejects.toThrow(/rollback/)
  await expect(assertRollbackSafe(home)).rejects.toThrow(/compatibility/)
  await writeFile(join(home, 'quantskills/application/migration-proof.json'), '{}')
  await expect(assertMigrationReady(home, '0.2.1-rc.2')).rejects.toThrow(/proof/)
})

it.each([
  ['settings.yaml', 'workspaceRoot: C:/production/workspace'],
  ['settings.yaml', 'apiKey: copied-production-credential'],
  ['storages/schedule.json', '{"rrule":"FREQ=MINUTELY"}'],
  ['quantskills/pending-session-deletions.json', '["parent"]'],
])('keeps unsafe or pending execution evidence offline: %s', async (file, contents) => {
  const { root, source, output, home } = await fixture()
  await writeFile(join(source, file), contents)
  await migrateHomeCopy(source, output, options)
  await publishBootstrapVersion(join(home, 'quantskills/application/bootstrap'), resolve('scripts'), { protocol: 2 })
  await expect(certifyIsolatedHome(output, { fixtureRoot: root })).rejects.toThrow()
  await expect(assertMigrationReady(home, '0.2.1-rc.2')).rejects.toThrow(/validation/)
  expect(await readFile(join(home, file), 'utf8')).toBe(contents)
})

it('rejects changed sources, corrupted output, unknown phases and concurrent migration', async () => {
  const { source, output, home } = await fixture()
  const results = await Promise.allSettled([migrateHomeCopy(source, output, options), migrateHomeCopy(source, output, options)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const file = join(output, 'migration.json'), journal = JSON.parse(await readFile(file, 'utf8'))
  await writeFile(file, JSON.stringify({ ...journal, phase: 'future' }))
  await expect(migrateHomeCopy(source, output, options)).rejects.toThrow(/Unknown/)
  await writeFile(file, JSON.stringify(journal))
  await writeFile(join(home, 'attachments/image.dat'), 'corrupt')
  await expect(migrateHomeCopy(source, output, options)).rejects.toThrow(/changed/)
  await writeFile(join(source, 'settings.yaml'), 'fontSize: 16')
  await expect(migrateHomeCopy(source, output, options)).rejects.toThrow(/mismatched/)
})

it('restores the full old generation only after preserving candidate additions', async () => {
  const { root, source, output, home } = await fixture()
  await migrateHomeCopy(source, output, options)
  await writeFile(join(home, 'attachments/new.dat'), 'new increment')
  const recovery = join(root, 'recovery')
  const result = await preserveAndRestoreCopy(source, home, recovery, options)
  expect(result).toMatchObject({ preserved: true, restored: true, automaticallyActivated: false })
  expect((await inventoryOfflineTree(join(recovery, 'restored-baseline'))).entries).toEqual((await inventoryOfflineTree(source)).entries)
  expect(await readFile(join(recovery, 'preserved-candidate/attachments/new.dat'), 'utf8')).toBe('new increment')
})
