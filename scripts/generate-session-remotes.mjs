import { readFile, writeFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { WorkspaceAnalyzer, WorkspaceCaches, FaceModelEmitter } from '@deepseek-ai/dsh-typert-generator'

const root = process.cwd()
const caches = new WorkspaceCaches()
const analyzer = new WorkspaceAnalyzer({ root, caches, packages: ['@deepseek-ai/dsh-panda-mcp', '@deepseek-ai/dsh-quantskills-session', '@deepseek-ai/dsh-quantskills-host'], faces: ['host'] })
analyzer.discoverPackages()
// The upstream generator discovers only monorepo packages. Register the installed
// protocol declarations as well, so Remote decorators resolve in this plugin repo.
const protocolRoot = await realpath(join(root, 'node_modules/@deepseek-ai/dsh-typert-protocol'))
const protocolManifest = JSON.parse(await readFile(join(protocolRoot, 'package.json'), 'utf8'))
protocolManifest.exports = { '.': join(protocolRoot, 'lib/types/index.d.ts'), './types': join(protocolRoot, 'lib/types/types.d.ts') }
for (const registrations of caches.registrations.values()) registrations.push({
  face: 'host', name: '@deepseek-ai/dsh-typert-protocol', root: protocolRoot,
  manifest: protocolManifest,
  config: caches.config(join(root, 'packages/quantskills-session/tsconfig.json')),
})
const valuesRoot = await realpath(join(root, 'node_modules/@deepseek-ai/dsh-util-values'))
for (const registrations of caches.registrations.values()) registrations.push({
  face: 'host', name: '@deepseek-ai/dsh-util-values', root: valuesRoot,
  manifest: { name: '@deepseek-ai/dsh-util-values', exports: { '.': join(valuesRoot, 'lib/types/index.d.ts') } },
  config: caches.config(join(root, 'packages/quantskills-session/tsconfig.json')),
})
for (const face of analyzer.analyze().faces) for (const pkg of face.packages) {
  const artifact = { ...new FaceModelEmitter(face).emit(pkg.name), packageRoot: pkg.root }
  const base = join(artifact.packageRoot, 'lib')
  await writeFile(join(base, 'typert.host.js'), artifact.js)
  await writeFile(join(base, 'typert.host.d.ts'), artifact.dts)
  if (artifact.remote) {
    await writeFile(join(base, 'typert.remote-client.js'), artifact.remote.js)
    await writeFile(join(base, 'typert.remote-client.d.ts'), artifact.remote.dts)
    await writeFile(join(base, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap)
  }
  console.log(`Generated ${artifact.package} Host and client remotes`)
}
