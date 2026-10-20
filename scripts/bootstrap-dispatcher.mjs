/** Stable single-file dispatcher. All version-specific files live in one immutable directory. */
import { readFile, realpath } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const base = dirname(fileURLToPath(import.meta.url))
const pointer = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'))
if (pointer.protocol !== 2 || !/^[a-f0-9]{64}$/.test(pointer.version ?? '')) throw new Error('Unsupported launcher pointer; startup stopped.')
const versionRoot = join(base, 'versions', pointer.version)
if (await realpath(versionRoot) !== resolve(versionRoot)) throw new Error('Linked launcher version refused.')
process.env.DSH_HOME ||= resolve(base, '../../..')
process.env.QUANTSKILLS_BOOTSTRAP_VERSION_ROOT = versionRoot
process.env.QUANTSKILLS_BOOTSTRAP_PROTOCOL = '2'
const { main } = await import(pathToFileURL(join(versionRoot, 'application-bootstrap.mjs')).href)
process.exitCode = await main()
