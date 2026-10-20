import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateSessionCopy } from '../scripts/session-migration.mjs'
import { decodeSessionFrames } from '../scripts/session-zstd.mjs'

const roots: string[] = []
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'qs-offline-migration-')); roots.push(root)
  const source = join(root, 'source'), destination = join(root, 'converted'); await mkdir(source)
  const bytes = JSON.stringify({ type: 'session', version: 1, id: 'root', createdAt: 1,
    delegationDepth: 0, agentPreset: 'code', seedLength: 0 }) + '\n'
  await writeFile(join(source, 'root.jsonl'), bytes)
  return { root, source, destination, bytes }
}
describe('offline session migration', () => {
  it('decodes all concatenated Zstd frames, rejects torn tails and enforces an output bound', () => {
    const bytes = Buffer.concat([zstdCompressSync(Buffer.from('header\n')), zstdCompressSync(Buffer.from('event one\nevent two\n'))])
    expect(decodeSessionFrames(bytes).toString()).toBe('header\nevent one\nevent two\n')
    expect(() => decodeSessionFrames(bytes.subarray(0, bytes.length - 1))).toThrow(/Incomplete/)
    expect(() => decodeSessionFrames(bytes, 8)).toThrow()
  })
  it('converts compressed history while retaining its exact original bytes, and rejects damaged compressed records', async () => {
    const { source, destination, bytes, root } = await fixture()
    await rm(join(source, 'root.jsonl'))
    const compressed = zstdCompressSync(Buffer.from(bytes))
    await writeFile(join(source, 'root.jsonl.zstd'), compressed)
    const report = await migrateSessionCopy(source, destination)
    expect(await readFile(join(destination, report.sessions[0].directory, 'original.jsonl.zstd'))).toEqual(compressed)
    expect(await migrateSessionCopy(source, destination)).toEqual(report)
    await writeFile(join(source, 'root.jsonl.zstd'), compressed.subarray(0, 5))
    await expect(migrateSessionCopy(source, join(root, 'broken'))).rejects.toThrow()
  })
  it('serializes conversion across independent callers without rewriting a running journal', async () => {
    const { source, destination } = await fixture()
    const results = await Promise.allSettled([migrateSessionCopy(source, destination), migrateSessionCopy(source, destination)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(JSON.parse(await readFile(join(destination, 'migration.json'), 'utf8')).phase).toBe('validated')
  })
  it('preserves identity and original bytes and is idempotent', async () => {
    const { source, destination, bytes } = await fixture()
    const first = await migrateSessionCopy(source, destination)
    expect(first.runnable).toBe(false)
    expect(first.sessions[0]).toMatchObject({ id: 'root', sourceVersion: 1 })
    expect(await readFile(join(destination, first.sessions[0].directory, 'original.jsonl'), 'utf8')).toBe(bytes)
    expect(await migrateSessionCopy(source, destination)).toEqual(first)
    expect(JSON.parse(await readFile(join(destination, 'migration.json'), 'utf8'))).toMatchObject({ phase: 'validated', oldReadable: 'no' })
  })
  it('resumes a matching interrupted journal without duplicate conversion', async () => {
    const { source, destination } = await fixture()
    const first = await migrateSessionCopy(source, destination)
    const file = join(destination, 'migration.json'), journal = JSON.parse(await readFile(file, 'utf8'))
    await writeFile(file, JSON.stringify({ ...journal, phase: 'migrating' }))
    expect(await migrateSessionCopy(source, destination)).toEqual(first)
  })
  it('refuses changed source generations and tampered targets', async () => {
    const { source, destination } = await fixture()
    const first = await migrateSessionCopy(source, destination)
    await writeFile(join(destination, first.sessions[0].directory, 'session.v4.jsonl'), 'damaged')
    await expect(migrateSessionCopy(source, destination)).rejects.toThrow(/differs/)
    expect(JSON.parse(await readFile(join(destination, 'migration.json'), 'utf8')).phase).toBe('failed')
    await writeFile(join(source, 'root.jsonl'), JSON.stringify({ type: 'session', version: 1, id: 'changed', createdAt: 1, delegationDepth: 0, agentPreset: 'code', seedLength: 0 }) + '\n')
    await expect(migrateSessionCopy(source, destination)).rejects.toThrow(/mismatched/)
  })
  it('rejects truncated input and foreign output directories', async () => {
    const { source, destination, bytes } = await fixture()
    await mkdir(destination)
    await expect(migrateSessionCopy(source, destination)).rejects.toMatchObject({ code: 'EEXIST' })
    await writeFile(join(source, 'root.jsonl'), bytes.trimEnd())
    await expect(migrateSessionCopy(source, destination)).rejects.toThrow(/Truncated/)
  })
})
