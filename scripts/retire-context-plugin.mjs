/** Retire the former bundled context dashboard before reconciling profile plugins. */
import { readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

export async function retireContextPlugin(home) {
  const file = join(home, 'profiles', 'web', 'package.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
  const original = JSON.stringify(manifest)
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (manifest[key]) delete manifest[key]['dsh-context']
  }
  const profile = manifest.dsh?.profile
  if (Array.isArray(profile?.bundles)) {
    profile.bundles = profile.bundles.filter(name => name !== 'dsh-context')
  }
  if (JSON.stringify(manifest) === original) return false
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, file)
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await retireContextPlugin(resolve(process.env.DSH_HOME || join(homedir(), '.dsh')))
}
