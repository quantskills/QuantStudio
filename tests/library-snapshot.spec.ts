import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { verifySnapshot, restoreSnapshot } from '../scripts/library-snapshot.mjs'
import { QuantSkillsAgentStore } from '../packages/quantskills-session/src/agent-store.ts'
import { QuantSkillsAgentTeamStore } from '../packages/quantskills-session/src/team-store.ts'

async function cleanTestHome(home: string) {
  if (dirname(resolve(home)) !== resolve(tmpdir()) || !basename(home).startsWith('qs-library-')) throw new Error('Unsafe test cleanup')
  await rm(home, { recursive: true, force: true })
}

it('restores every pinned asset into an empty home that the real Host stores can read', async () => {
  const snapshot = resolve('assets/library-v2')
  const index = await verifySnapshot(snapshot)
  expect(index.assets.filter(asset => asset.kind === 'skill')).toHaveLength(15)
  const home = await mkdtemp(join(tmpdir(), 'qs-library-v2-'))
  try {
    await restoreSnapshot(snapshot, home)
    expect(await new QuantSkillsAgentStore(home).list()).toHaveLength(44)
    expect(await new QuantSkillsAgentTeamStore(home).list()).toHaveLength(14)
    await expect(restoreSnapshot(snapshot, home)).rejects.toThrow('not empty')
    const before = await readFile(join(home, 'quantskills/agents.json'), 'utf8')
    expect(JSON.parse(before).agents).toHaveLength(44)
  } finally { await cleanTestHome(home) }
})

it('rejects altered files before restoring anything', async () => {
  const home = await mkdtemp(join(tmpdir(), 'qs-library-integrity-'))
  try {
    const { cp } = await import('node:fs/promises')
    await cp(resolve('assets/library-v2'), home, { recursive: true })
    await writeFile(join(home, 'quantskills/agents.json'), '{}')
    await expect(verifySnapshot(home)).rejects.toThrow('Checksum mismatch')
  } finally { await cleanTestHome(home) }
})
