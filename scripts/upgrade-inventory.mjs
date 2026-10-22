/** Fetch exact npm artifacts for a reproducible upstream comparison. Never executes them. */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { gunzipSync } from 'node:zlib'

const target = '0.2.1-rc.2'
const packages = ['dsh', 'dsh-app-boot', 'dsh-client-ui-chat', 'dsh-client-ui-conversation',
  'dsh-client-ui-input-trigger', 'dsh-client-ui-layout', 'dsh-agent', 'dsh-session-persistence-jsonl',
  'dsh-session-projection-cache', 'dsh-session-query-sqlite', 'dsh-subprocess-local', 'dsh-workspace',
  'dsh-experimental-agent-team', 'dsh-client-ui-plugin-manager', 'dsh-plugin-manager']
const root = resolve(process.argv[2] ?? '../upstream-dsh-audit')
const inventory = []
for (const shortName of packages) {
  for (const version of (shortName.startsWith('dsh-client-ui-') && shortName !== 'dsh-client-ui-plugin-manager'
    ? ['0.1.2-alpha.2', target] : [target])) {
    const name = `@deepseek-ai/${shortName}`
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`)
    if (!response.ok) throw new Error(`${name}@${version}: registry ${response.status}`)
    const metadata = await response.json()
    const archive = await fetch(metadata.dist.tarball)
    if (!archive.ok) throw new Error(`${name}: archive ${archive.status}`)
    const compressed = Buffer.from(await archive.arrayBuffer())
    const integrity = `sha512-${createHash('sha512').update(compressed).digest('base64')}`
    if (integrity !== metadata.dist.integrity) throw new Error(`${name}: integrity mismatch`)
    const bytes = gunzipSync(compressed), destination = resolve(root, shortName, version)
    let count = 0
    for (let offset = 0; offset + 512 <= bytes.length;) {
      const header = bytes.subarray(offset, offset + 512)
      const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '')
      if (!name) break
      const size = Number.parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0
      const type = header[156]
      const path = resolve(destination, name.replace(/^package\//, ''))
      const child = relative(destination, path)
      if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Unsafe archive path')
      if (type === 0 || type === 48) {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, bytes.subarray(offset + 512, offset + 512 + size))
        count++
      }
      offset += 512 + Math.ceil(size / 512) * 512
    }
    inventory.push({ name, version, integrity, tarball: metadata.dist.tarball, files: count })
    console.log(`${name}@${version}: ${count} files, integrity verified`)
    await writeFile(resolve(root, 'artifacts.json'), JSON.stringify(inventory, null, 2) + '\n')
  }
}
