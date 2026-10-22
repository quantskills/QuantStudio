import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { inventoryOfflineTree, preserveAndRestoreCopy } from '../scripts/offline-recovery.mjs'
import { assertMigrationReady } from '../scripts/runtime-protocol.mjs'

const roots: string[] = []
const options = { consistency: 'verified-offline-snapshot', backupId: 'constructed-consistent-backup' }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'qs-offline-recovery-')); roots.push(root)
  const backup = join(root, 'backup'), candidate = join(root, 'candidate'), output = join(root, 'recovery')
  for (const home of [backup, candidate]) {
    for (const path of ['sessions', 'profiles/web', 'quantskills/attachments/v1/objects', 'quantskills/contest', 'library', 'empty']) {
      await mkdir(join(home, path), { recursive: true })
    }
    await writeFile(join(home, 'profiles/web/settings.json'), JSON.stringify({ defaultModel: 'fixture', route: 'local', trading: false }))
    await writeFile(join(home, 'quantskills/attachments/v1/objects/attachment'), 'retained attachment')
    await writeFile(join(home, 'library/own-agent.json'), JSON.stringify({ id: 'custom-agent', instructions: 'fixture' }))
    await writeFile(join(home, 'sessions/parent.json'), JSON.stringify({ id: 'parent', messages: ['old message'] }))
    await writeFile(join(home, 'sessions/child.json'), JSON.stringify({ id: 'child', parentSession: 'parent' }))
    await writeFile(join(home, 'quantskills/contest/trades.json'), JSON.stringify([{ id: 'fill-1', fee: 2, netProfit: 8 }]))
  }
  await writeFile(join(candidate, 'sessions/new.json'), JSON.stringify({ id: 'new', messages: ['post-migration message'] }))
  await writeFile(join(candidate, 'quantskills/contest/trades.json'), JSON.stringify([{ id: 'fill-1', fee: 2, netProfit: 8 }, { id: 'fill-2', fee: 3, netProfit: 7 }]))
  return { root, backup, candidate, output }
}

it('preserves the whole candidate before restoring the old snapshot to a separate directory', async () => {
  const { backup, candidate, output } = await fixture()
  const baseline = await inventoryOfflineTree(backup), before = await inventoryOfflineTree(candidate)
  const result = await preserveAndRestoreCopy(backup, candidate, output, options)
  expect(result).toMatchObject({ phase: 'validated', preserved: true, restored: true, runnable: false, originalHomesModified: false, automaticallyActivated: false })
  const preserved = join(output, 'preserved-candidate'), restored = join(output, 'restored-baseline')
  expect((await inventoryOfflineTree(preserved)).entries).toEqual(before.entries)
  expect((await inventoryOfflineTree(restored)).entries).toEqual(baseline.entries)
  expect(JSON.parse(await readFile(join(preserved, 'sessions/new.json'), 'utf8'))).toEqual({ id: 'new', messages: ['post-migration message'] })
  expect(JSON.parse(await readFile(join(preserved, 'quantskills/contest/trades.json'), 'utf8'))).toHaveLength(2)
  expect(JSON.parse(await readFile(join(restored, 'sessions/child.json'), 'utf8')).parentSession).toBe('parent')
  expect(await readFile(join(restored, 'quantskills/attachments/v1/objects/attachment'), 'utf8')).toBe('retained attachment')
  expect(await inventoryOfflineTree(backup)).toEqual(baseline)
  expect(await inventoryOfflineTree(candidate)).toEqual(before)
  expect(await preserveAndRestoreCopy(backup, candidate, output, options)).toEqual(result)
  // Copy-only recovery is never a startup certificate, including when its journal is relocated.
  await mkdir(join(candidate, 'quantskills/application'), { recursive: true })
  await writeFile(join(candidate, 'quantskills/application/migration.json'), JSON.stringify(result))
  await expect(assertMigrationReady(candidate, '0.1.2-alpha.2')).rejects.toThrow(/offline/i)
})

it('resumes an interrupted copy without overwriting preserved increments', async () => {
  const { backup, candidate, output } = await fixture()
  await preserveAndRestoreCopy(backup, candidate, output, options)
  const journalFile = join(output, 'migration.json'), journal = JSON.parse(await readFile(journalFile, 'utf8'))
  await writeFile(journalFile, JSON.stringify({ ...journal, phase: 'migrating', restored: false }))
  expect(await preserveAndRestoreCopy(backup, candidate, output, options)).toMatchObject({ phase: 'validated' })
  await writeFile(join(output, 'preserved-candidate/sessions/new.json'), 'changed by reviewer')
  await expect(preserveAndRestoreCopy(backup, candidate, output, options)).rejects.toThrow(/output changed/)
  expect(await readFile(join(output, 'preserved-candidate/sessions/new.json'), 'utf8')).toBe('changed by reviewer')
  expect(JSON.parse(await readFile(journalFile, 'utf8')).phase).toBe('failed')
})

it('rejects changed input generations and unknown journals without starting a restore', async () => {
  const { backup, candidate, output } = await fixture()
  await preserveAndRestoreCopy(backup, candidate, output, options)
  const journalFile = join(output, 'migration.json'), journal = JSON.parse(await readFile(journalFile, 'utf8'))
  await writeFile(journalFile, JSON.stringify({ ...journal, phase: 'future-format' }))
  await expect(preserveAndRestoreCopy(backup, candidate, output, options)).rejects.toThrow(/Unknown/)
  expect(JSON.parse(await readFile(journalFile, 'utf8')).phase).toBe('future-format')
  await writeFile(journalFile, JSON.stringify(journal))
  await writeFile(join(candidate, 'sessions/newer.json'), '{"id":"newer"}')
  await expect(preserveAndRestoreCopy(backup, candidate, output, options)).rejects.toThrow(/mismatched/)
})

it('rejects nested roots, unjournaled directories and unverified backup inputs', async () => {
  const { backup, candidate, output } = await fixture()
  await expect(preserveAndRestoreCopy(backup, candidate, output, {})).rejects.toThrow(/verified/)
  await expect(preserveAndRestoreCopy(backup, candidate, join(candidate, 'nested'), options)).rejects.toThrow(/disjoint/)
  await mkdir(output)
  await expect(preserveAndRestoreCopy(backup, candidate, output, options)).rejects.toMatchObject({ code: 'EEXIST' })
})

it('serializes independent recovery attempts', async () => {
  const { backup, candidate, output } = await fixture()
  const results = await Promise.allSettled([
    preserveAndRestoreCopy(backup, candidate, output, options), preserveAndRestoreCopy(backup, candidate, output, options),
  ])
  expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(item => item.status === 'rejected')).toHaveLength(1)
})

it('does not traverse external linked directories or change their contents', async () => {
  const { root, backup, candidate, output } = await fixture()
  const external = join(root, 'external'); await mkdir(external)
  await writeFile(join(external, 'keep'), 'external-content')
  const link = join(candidate, 'local-plugin')
  await symlink(external, link, process.platform === 'win32' ? 'junction' : 'dir')
  await preserveAndRestoreCopy(backup, candidate, output, options)
  expect(await readlink(join(output, 'preserved-candidate/local-plugin'))).toBe(await readlink(link))
  expect((await inventoryOfflineTree(candidate)).entries.some(row => row.path === 'local-plugin/keep')).toBe(false)
  expect(await readFile(join(external, 'keep'), 'utf8')).toBe('external-content')
})

it('restores a closed SQLite snapshot and separately retains post-migration records', async () => {
  const { backup, candidate, output } = await fixture()
  for (const [home, count] of [[backup, 1], [candidate, 2]] as const) {
    const database = new DatabaseSync(join(home, 'quantskills/contest/receipts.sqlite'))
    try {
      database.exec('PRAGMA journal_mode=WAL; CREATE TABLE receipts(id TEXT PRIMARY KEY, fee REAL, net REAL)')
      const insert = database.prepare('INSERT INTO receipts VALUES(?,?,?)')
      insert.run('fill-1', 2, 8)
      if (count === 2) insert.run('fill-2', 3, 7)
      database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally { database.close() }
  }
  await preserveAndRestoreCopy(backup, candidate, output, options)
  for (const [copy, count, net] of [['restored-baseline', 1, 8], ['preserved-candidate', 2, 15]] as const) {
    const database = new DatabaseSync(join(output, copy, 'quantskills/contest/receipts.sqlite'), { readOnly: true })
    try {
      expect(database.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok')
      expect(database.prepare('SELECT count(*) AS count, sum(net) AS net FROM receipts').get()).toEqual({ count, net })
    } finally { database.close() }
  }
})
