import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('..', import.meta.url))

it('verifies a source tree whose path contains a space', async () => {
  // The checker resolves its repository root from its own location, so stage a copy of it
  // inside a directory whose name contains a space. URL.pathname kept the `%20` encoding
  // there, which made the check look for `.../quantskills%20verify.../...` and fail with
  // ENOENT even though every inspected file was present.
  const stage = await mkdtemp(join(tmpdir(), 'quantskills verify '))
  expect(stage).toContain(' ')
  try {
    await mkdir(join(stage, 'scripts'), { recursive: true })
    await cp(join(sourceRoot, 'scripts', 'verify-source.mjs'), join(stage, 'scripts', 'verify-source.mjs'))

    const requiredRootFiles = ['cordis.patch.yml', 'lib/index.js', 'lib/invariant.js', 'src/index.ts', 'src/invariant.ts']
    for (const relative of requiredRootFiles) {
      const target = join(stage, relative)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, '')
    }

    // Mirror the real workspace so the staged tree stays in step with the checker's list.
    const packageDirs = (await readdir(join(sourceRoot, 'packages'), { withFileTypes: true }))
      .filter(entry => entry.isDirectory()).map(entry => entry.name)
    for (const directory of packageDirs) {
      const base = join(stage, 'packages', directory)
      await mkdir(join(base, 'src'), { recursive: true })
      await mkdir(join(base, 'lib'), { recursive: true })
      await cp(join(sourceRoot, 'packages', directory, 'package.json'), join(base, 'package.json'))
      await writeFile(join(base, 'src', 'index.ts'), '')
      await writeFile(join(base, 'lib', 'index.js'), '')
    }

    const bundled = join(stage, 'node_modules', 'dsh-file-upload')
    await mkdir(bundled, { recursive: true })
    await writeFile(join(bundled, 'package.json'), JSON.stringify({ name: 'dsh-file-upload' }))

    const result = spawnSync(process.execPath, [join(stage, 'scripts', 'verify-source.mjs')], { cwd: stage, encoding: 'utf8' })
    expect(result.stderr).not.toContain('%20')
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Verified QuantSkills source tree')
  } finally { await rm(stage, { recursive: true, force: true }) }
})
