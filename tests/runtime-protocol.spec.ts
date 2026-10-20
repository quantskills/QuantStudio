import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fork } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { assertBootstrapInstalled, assertIsolatedFixture, assertMigrationReady, assertRollbackSafe,
  migrationPath, parseMigration, REQUIRED_SERVICES, validateReady, waitForReady, writeAtomic } from '../scripts/runtime-protocol.mjs'

const roots: string[] = []
async function temp() { const path = await mkdtemp(join(tmpdir(), 'qs-protocol-')); roots.push(path); return path }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const migration = { schemaVersion: 1, sourceRuntime: '0.1.2-alpha.2', targetRuntime: '0.2.1-rc.2',
  generation: 'fixture-generation', backupId: 'fixture-snapshot', phase: 'validated', oldReadable: 'unknown' }
const expected = { nonce: 'this-process-only', commit: 'a'.repeat(40), runtime: '0.2.1-rc.2', generation: migration.generation }
const ready = { ...expected, type: 'quantskills:ready', protocol: 2, migrationPhase: 'validated',
  services: Object.fromEntries(REQUIRED_SERVICES.map((name: string) => [name, true])) }

describe('core migration activation boundary', () => {
  it('rejects legacy launchers before any profile write', async () => {
    const home = await temp(), profile = join(home, 'profiles/web')
    await mkdir(profile, { recursive: true }); await writeFile(join(profile, 'package.json'), '{"user":"unchanged"}')
    await expect(assertBootstrapInstalled(home, {})).rejects.toThrow(/launcher first/)
    expect(await readFile(join(profile, 'package.json'), 'utf8')).toBe('{"user":"unchanged"}')
  })
  it.each(['prepared', 'migrating', 'failed'])('stops startup and rollback during %s', async phase => {
    const home = await temp(); await writeAtomic(migrationPath(home), { ...migration, phase })
    await expect(assertMigrationReady(home, expected.runtime)).rejects.toThrow(/stopped/)
    await expect(assertRollbackSafe(home)).rejects.toThrow(/rollback stopped/)
  })
  it('allows a validated new runtime but requires positive evidence for old runtime fallback', async () => {
    const home = await temp(); await writeAtomic(migrationPath(home), migration)
    await expect(assertMigrationReady(home, expected.runtime)).resolves.toEqual(migration)
    await expect(assertMigrationReady(home, migration.sourceRuntime)).rejects.toThrow(/rollback stopped/)
    await writeAtomic(migrationPath(home), { ...migration, oldReadable: 'yes' })
    await expect(assertRollbackSafe(home)).resolves.toBeUndefined()
    await expect(assertMigrationReady(home, migration.sourceRuntime)).resolves.toHaveProperty('oldReadable', 'yes')
  })
  it('does not accept unknown schemas, phases, truncated records or an absent migration for a new core', async () => {
    expect(() => parseMigration({ ...migration, phase: 'new-phase' })).toThrow()
    expect(() => parseMigration({ ...migration, schemaVersion: 99 })).toThrow()
    const home = await temp(); await expect(assertMigrationReady(home, expected.runtime)).rejects.toThrow(/required/)
    await mkdir(join(home, 'quantskills/application'), { recursive: true })
    await writeFile(migrationPath(home), '{')
    await expect(assertRollbackSafe(home)).rejects.toThrow()
  })
  it.each(['nonce', 'commit', 'runtime', 'generation'])('rejects a mismatched %s even with an HTTP healthy page', key => {
    expect(() => validateReady({ ...ready, [key]: 'wrong' }, expected)).toThrow(/mismatch/)
  })
  it('rejects incomplete services and migration', () => {
    expect(() => validateReady({ ...ready, services: {} }, expected)).toThrow()
    expect(() => validateReady({ ...ready, migrationPhase: 'migrating' }, expected)).toThrow()
    expect(validateReady(ready, expected)).toBe(true)
  })
  it('requires a real child IPC readiness message; an exited child cannot activate', async () => {
    const root = await temp(), file = join(root, 'child.cjs')
    await writeFile(file, `process.send(${JSON.stringify(ready)});setTimeout(()=>process.exit(),100)`)
    const child = fork(file, { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    await expect(waitForReady(child, expected, 2000)).resolves.toBeUndefined()
    child.kill()
    await writeFile(file, 'process.exit(0)')
    await expect(waitForReady(fork(file, { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }), expected, 2000)).rejects.toThrow(/exited/)
  })
  it('rejects copied deletion journals pointing outside the fixture without touching their target', async () => {
    const root = await temp(), original = await temp(), home = join(root, 'home')
    await mkdir(home); const protectedFile = join(original, 'report.txt'); await writeFile(protectedFile, 'keep')
    await writeFile(join(home, 'pending-session-deletions.json'), JSON.stringify({ files: [{ root: original, path: protectedFile }] }))
    await expect(assertIsolatedFixture(home, root)).rejects.toThrow(/Unsafe fixture path/)
    expect(await readFile(protectedFile, 'utf8')).toBe('keep')
  })
  it('rejects links escaping the fixture and embedded credentials', async () => {
    const home = await temp(), outside = await temp()
    await symlink(outside, join(home, 'workspace'), 'junction')
    await expect(assertIsolatedFixture(home, home)).rejects.toThrow(/escapes/)
    await rm(join(home, 'workspace'))
    await writeFile(join(home, 'settings.json'), '{"apiKey":"not-for-test"}')
    await expect(assertIsolatedFixture(home, home)).rejects.toThrow(/credentials/)
  })
})
