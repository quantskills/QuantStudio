/** Stable single-file dispatcher. All version-specific files live in one immutable directory. */
import { createHash } from 'node:crypto'
import { readFile, realpath, lstat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const base = dirname(fileURLToPath(import.meta.url))
const pointer = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'))
if (pointer.protocol !== 2 || !/^[a-f0-9]{64}$/.test(pointer.version ?? '')) throw new Error('Unsupported launcher pointer; startup stopped.')
const versionRoot = join(base, 'versions', pointer.version)
if (await realpath(versionRoot) !== resolve(versionRoot)) throw new Error('Linked launcher version refused.')
// Verify without importing any candidate module first.
const files = ['application-bootstrap.mjs', 'profile-state.mjs', 'runtime-protocol.mjs']
const contents = []
for (const file of [...files, 'config.json']) {
  const path = join(versionRoot, file), info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid launcher artifact.')
  contents.push(await readFile(path, 'utf8'))
}
const config = JSON.parse(contents.pop())
const digest = createHash('sha256').update(JSON.stringify([contents, config])).digest('hex')
if (config.protocol !== 2 || digest !== pointer.version) throw new Error('Launcher integrity failed; startup stopped.')
process.env.DSH_HOME ||= resolve(base, '../../..')
process.env.QUANTSKILLS_BOOTSTRAP_VERSION_ROOT = versionRoot
process.env.QUANTSKILLS_BOOTSTRAP_PROTOCOL = '2'
const { main } = await import(pathToFileURL(join(versionRoot, 'application-bootstrap.mjs')).href)
process.exitCode = await main()
