import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { retireContextPlugin } from '../scripts/retire-context-plugin.mjs'

const homes: string[] = []
afterEach(async () => {
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })))
})

it('retires only the context plugin, preserving custom plugins and profile settings', async () => {
  const home = await mkdtemp(join(tmpdir(), 'qs-retire-'))
  homes.push(home)
  const dir = join(home, 'profiles', 'web')
  await mkdir(dir, { recursive: true })
  const file = join(dir, 'package.json')
  const manifest = {
    name: 'custom-profile', private: true,
    dependencies: { 'dsh-context': '0.41.3', 'my-plugin': 'file:./custom' },
    dsh: { profile: { bundles: ['base', 'dsh-context', 'my-plugin'], patchReload: 'live' } },
  }
  await writeFile(file, JSON.stringify(manifest))
  await writeFile(join(dir, 'cordis.patch.yml'), '# user settings\n')
  expect(await retireContextPlugin(home)).toBe(true)
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    ...manifest,
    dependencies: { 'my-plugin': 'file:./custom' },
    dsh: { profile: { bundles: ['base', 'my-plugin'], patchReload: 'live' } },
  })
  expect(await readFile(join(dir, 'cordis.patch.yml'), 'utf8')).toBe('# user settings\n')
  const first = await readFile(file, 'utf8')
  expect(await retireContextPlugin(home)).toBe(false)
  expect(await readFile(file, 'utf8')).toBe(first)
})

it('does not create a profile on a fresh install', async () => {
  const home = await mkdtemp(join(tmpdir(), 'qs-retire-'))
  homes.push(home)
  expect(await retireContextPlugin(home)).toBe(false)
  await expect(readFile(join(home, 'profiles', 'web', 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('fails without overwriting an invalid existing profile', async () => {
  const home = await mkdtemp(join(tmpdir(), 'qs-retire-'))
  homes.push(home)
  const dir = join(home, 'profiles', 'web')
  await mkdir(dir, { recursive: true })
  const file = join(dir, 'package.json')
  await writeFile(file, '{broken')
  await expect(retireContextPlugin(home)).rejects.toThrow()
  expect(await readFile(file, 'utf8')).toBe('{broken')
})
