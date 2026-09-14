import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { QuantSkillsLibraryStore } from '../src/library-store.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function home() {
  const root = await mkdtemp(join(tmpdir(), 'qs-library-source-'))
  roots.push(root)
  return root
}

it('starts legacy profiles empty and preserves concurrent writes across instances', async () => {
  const root = await home()
  const first = new QuantSkillsLibraryStore(root)
  expect(await first.list()).toEqual([])
  await Promise.all([
    first.put({ id: 'agent-one', kind: 'agent', source: 'personal', method: 'ai' }),
    new QuantSkillsLibraryStore(root).put({ id: 'team-two', kind: 'agent-team', source: 'personal', method: 'manual' }),
  ])
  expect((await new QuantSkillsLibraryStore(root).list()).map(entry => entry.id).sort()).toEqual(['agent-one', 'team-two'])
  await first.put({ id: 'agent-one', kind: 'agent', source: 'installed', method: 'installation' })
  expect(await first.list()).toHaveLength(2)
})

it('reports malformed metadata instead of silently resetting provenance', async () => {
  const root = await home()
  const store = new QuantSkillsLibraryStore(root)
  await store.list()
  await writeFile(join(root, 'quantskills', 'library-sources.json'), '{broken')
  await expect(store.list()).rejects.toThrow()
  await expect(store.put({ id: 'agent-new', kind: 'agent', source: 'personal', method: 'manual' })).rejects.toThrow()
})
