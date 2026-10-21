/** Verify the public parser from real archives, outside workspace resolution. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = process.env.npm_execpath
if (!cli) throw new Error('Run with pnpm run verify:packed-deliverables')
const temporary = await realpath(tmpdir())
const fixture = await realpath(await mkdtemp(path.join(temporary, 'qs-packed-deliverables-')))
const packageName = '@deepseek-ai/dsh-client-ui-chat'
const options = { windowsHide: true, timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }
const probe = `
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const specifier = '@deepseek-ai/dsh-client-ui-chat/deliverables'
const resolved = fileURLToPath(import.meta.resolve(specifier))
assert.equal(resolved, path.resolve(process.argv[2]), 'Import must resolve inside the extracted archive')
const { projectFinalDeliverables } = await import(specifier)
const manifest = { version: 1, items: [{ path: 'output/report.html', title: '报告', presentation: 'interactive' }] }
const source = '\`\`\`quantskills-deliverables\\n' + JSON.stringify(manifest) + '\\n\`\`\`'
const result = projectFinalDeliverables([{ kind: 'text', text: source }])
assert.deepEqual(result.items, manifest.items)
assert.equal(result.blocks[0].text, '')
const unsafe = source.replace('output/report.html', '../outside.html')
assert.equal(projectFinalDeliverables([{ kind: 'text', text: unsafe }]).items.length, 0)
console.log('Packed export resolved and parsed valid output; path traversal rejected.')
`

try {
  for (const [label, source, prefix] of [
    ['plugin', path.join(root, 'packages/client-ui-chat'), 'package'],
    ['application', root, `package/node_modules/${packageName}`],
  ]) {
    const destination = path.join(fixture, label)
    await mkdir(destination)
    await run(process.execPath, [cli, 'pack', '--pack-destination', destination], {
      ...options, cwd: source, env: { ...process.env, npm_config_ignore_scripts: 'true' },
    })
    const archives = (await readdir(destination)).filter(name => name.endsWith('.tgz'))
    assert.equal(archives.length, 1, `${label}: expected one packed archive`)
    const archive = path.join(destination, archives[0])
    await run('tar', ['-xf', archive, '-C', destination, prefix], options)
    const packaged = path.join(destination, prefix)
    const manifest = JSON.parse(await readFile(path.join(packaged, 'package.json'), 'utf8'))
    assert.equal(manifest.name, packageName)
    const exported = manifest.exports['./deliverables']
    assert.equal(typeof exported.default, 'string')
    assert.equal(typeof exported.types, 'string')
    await readFile(path.join(packaged, exported.types))
    const runner = path.join(destination, 'package', 'verify-deliverables.mjs')
    await writeFile(runner, probe)
    const result = await run(process.execPath, [runner, path.join(packaged, exported.default)], {
      ...options, cwd: destination, env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    })
    console.log(JSON.stringify({ label, archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
      result: result.stdout.trim() }))
  }
} finally {
  if (path.dirname(fixture) !== temporary || !path.basename(fixture).startsWith('qs-packed-deliverables-')) {
    throw new Error('Refused unsafe temporary archive cleanup')
  }
  await rm(fixture, { recursive: true, force: true })
}
