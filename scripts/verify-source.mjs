import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath decodes percent-encoding, so a repository path containing a space
// or non-ASCII character still resolves to the real directory. URL.pathname keeps
// the encoding and previously produced paths such as `.../with%20space/...`.
const root = fileURLToPath(new URL('..', import.meta.url))
const packageDirs = [
  'agent-team',
  'client-remotes-quantskills',
  'client-ui-chat',
  'client-ui-conversation',
  'client-ui-input-trigger',
  'client-ui-layout',
  'panda-connector',
  'panda-mcp',
  'quantskills-host',
  'quantskills-session',
  'tool-agent-team',
  'ui-quantskills',
]

const requiredRootFiles = [
  'cordis.patch.yml',
  'lib/index.js',
  'lib/invariant.js',
  'src/index.ts',
  'src/invariant.ts',
]

const bundledPackages = [
  ...packageDirs.map(directory => join(root, 'packages', directory)),
  join(root, 'node_modules', 'dsh-file-upload'),
]

for (const relative of requiredRootFiles) await access(join(root, relative))

for (const directory of packageDirs) {
  const base = join(root, 'packages', directory)
  const manifest = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    throw new Error(`${directory}: package name is missing`)
  }
  await access(join(base, 'src', 'index.ts'))
  await access(join(base, 'lib', 'index.js'))
}

for (const base of bundledPackages) {
  const manifest = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    throw new Error(`${base}: package name is missing`)
  }
}

console.log(`Verified QuantSkills source tree and ${bundledPackages.length} bundled packages.`)
