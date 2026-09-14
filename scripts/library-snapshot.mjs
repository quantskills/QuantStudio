/** Portable asset backup. Never reads settings, credentials, sessions or data caches. */
import { readdir, readFile, writeFile, mkdir, lstat, copyFile } from 'node:fs/promises'
import { resolve, join, dirname, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const roots = ['versions', 'authored']
const documents = ['agents.json', 'agent-teams.json', 'library-sources.json']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const safe = (root, path) => {
  if (!path || isAbsolute(path) || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Unsafe snapshot path')
  return join(root, ...path.split('/'))
}
async function files(root, prefix = '') {
  const result = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? prefix + '/' + entry.name : entry.name
    if (entry.isSymbolicLink()) throw new Error('Symlink refused: ' + path)
    if (entry.isDirectory()) result.push(...await files(root, path))
    else if (entry.isFile()) result.push(path)
    else throw new Error('Non-file refused: ' + path)
  }
  return result.sort()
}
async function absent(path) {
  try { await lstat(path); return false } catch (error) { if (error.code === 'ENOENT') return true; throw error }
}
export async function verifySnapshot(directory) {
  const index = JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8'))
  if (index.schemaVersion !== 1 || !Array.isArray(index.files)) throw new Error('Unsupported snapshot')
  const seen = new Set()
  for (const file of index.files) {
    if (seen.has(file.path)) throw new Error('Duplicate path: ' + file.path)
    seen.add(file.path)
    if (!documents.includes(file.path) && !roots.some(root => file.path.startsWith(root + '/'))) throw new Error('Not an asset path: ' + file.path)
    const path = safe(join(directory, 'quantskills'), file.path)
    if (!(await lstat(path)).isFile()) throw new Error('Not a regular file: ' + file.path)
    const bytes = await readFile(path)
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error('Checksum mismatch: ' + file.path)
  }
  const actual = await files(join(directory, 'quantskills'))
  if (actual.length !== seen.size || actual.some(path => !seen.has(path))) throw new Error('Unlisted files in snapshot')
  const versions = new Map(index.assets.map(asset => [asset.versionId, asset]))
  const agents = JSON.parse(await readFile(join(directory, 'quantskills/agents.json'), 'utf8')).agents
  const teams = JSON.parse(await readFile(join(directory, 'quantskills/agent-teams.json'), 'utf8')).teams
  for (const agent of [...agents, ...teams.flatMap(team => [team.lead, ...team.members.map(member => member.agent)])]) {
    for (const binding of agent.skills) {
      const version = versions.get(binding.versionId)
      if (!version || version.treeDigest !== binding.treeDigest) throw new Error('Unresolved skill binding: ' + binding.versionId)
    }
    if (agent.sourceVersionId && !versions.has(agent.sourceVersionId)) throw new Error('Unresolved agent source: ' + agent.sourceVersionId)
  }
  return index
}
export async function exportSnapshot(home, directory) {
  if (!(await absent(directory))) throw new Error('Output already exists; use a new snapshot directory')
  const source = join(home, 'quantskills')
  const index = { schemaVersion: 1, createdAt: new Date().toISOString(), assets: [], experts: [], teams: [], files: [] }
  const selected = [...documents]
  for (const root of roots) {
    const paths = await files(join(source, root))
    selected.push(...paths.map(path => root + '/' + path))
    for (const path of paths.filter(path => /^[^/]+\/[^/]+\/manifest\.json$/.test(path))) {
      const manifest = JSON.parse(await readFile(join(source, root, path), 'utf8'))
      const tree = dirname(path).replaceAll('\\', '/') + '/source/'
      const content = paths.filter(file => file.startsWith(tree))
      let bytes = 0
      for (const file of content) bytes += (await lstat(join(source, root, file))).size
      if (content.length !== manifest.fileCount || bytes !== manifest.totalBytes) throw new Error('Source changed after installation: ' + manifest.versionId)
      index.assets.push({ ...manifest, path: root + '/' + dirname(path).replaceAll('\\', '/') })
    }
  }
  for (const path of selected.sort()) {
    const bytes = await readFile(safe(source, path))
    const destination = safe(join(directory, 'quantskills'), path)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
    index.files.push({ path, bytes: bytes.length, sha256: hash(bytes) })
  }
  const agents = JSON.parse(await readFile(join(directory, 'quantskills/agents.json'), 'utf8')).agents
  const teams = JSON.parse(await readFile(join(directory, 'quantskills/agent-teams.json'), 'utf8')).teams
  index.experts = agents.map(({ agentId, revision, name }) => ({ agentId, revision, name }))
  index.teams = teams.map(({ teamId, revision, name }) => ({ teamId, revision, name }))
  await writeFile(join(directory, 'snapshot.json'), JSON.stringify(index, null, 2) + '\n')
  await verifySnapshot(directory)
  return index
}
export async function restoreSnapshot(directory, home) {
  const index = await verifySnapshot(directory)
  const destination = join(home, 'quantskills')
  // Refuse to overwrite a live or populated library. Restoration is explicit and offline.
  for (const path of [...roots, ...documents]) if (!(await absent(join(destination, path)))) throw new Error('Target library is not empty: ' + path)
  for (const file of index.files) {
    const path = safe(destination, file.path)
    await mkdir(dirname(path), { recursive: true })
    await copyFile(safe(join(directory, 'quantskills'), file.path), path)
  }
  return index
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, first, second] = process.argv.slice(2)
  if (!first || !['export', 'verify', 'restore'].includes(action) || (action !== 'verify' && !second)) throw new Error('Usage: node scripts/library-snapshot.mjs export DSH_HOME SNAPSHOT_DIR | verify SNAPSHOT_DIR | restore SNAPSHOT_DIR EMPTY_DSH_HOME')
  const index = action === 'export' ? await exportSnapshot(resolve(first), resolve(second)) : action === 'restore' ? await restoreSnapshot(resolve(first), resolve(second)) : await verifySnapshot(resolve(first))
  console.log(JSON.stringify({ assets: index.assets.length, experts: index.experts.length, teams: index.teams.length, files: index.files.length, bytes: index.files.reduce((sum, file) => sum + file.bytes, 0) }))
}
