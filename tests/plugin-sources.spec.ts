import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { assertPluginSourcesPreserved, classifyPluginSource } from '../scripts/plugin-sources.mjs'

const installed = { name: 'actual-plugin', version: '1.2.3' }, integrity = 'sha512-fixture-integrity'
const classify = (spec: string, locked?: string, resolution: object = {}) =>
  classifyPluginSource('plugin-alias', spec, locked, resolution, installed, '/isolated/plugin')

it('recovery help is read-only and omitted profile selection cannot target a default home', () => {
  const env = { ...process.env }
  delete env.DSH_HOME; delete env.QUANTSKILLS_PROFILE; delete env.npm_execpath
  const help = spawnSync(process.execPath, ['scripts/recover-plugin-transaction.mjs', '--help'], { env, encoding: 'utf8', windowsHide: true })
  expect(help.status).toBe(0)
  expect(help.stdout).toContain('Set DSH_HOME and QUANTSKILLS_PROFILE explicitly')
  const refused = spawnSync(process.execPath, ['scripts/recover-plugin-transaction.mjs'], { env, encoding: 'utf8', windowsHide: true })
  expect(refused.status).not.toBe(0)
  expect(refused.stderr).toContain('default home recovery is not allowed')
})

describe('plugin source migration', () => {
  it('uses actual npm identity and integrity instead of catalog naming', () => {
    expect(classify('npm:actual-plugin@^1.2.0', 'actual-plugin@1.2.3', { integrity }))
      .toMatchObject({ kind: 'npm', actualName: 'actual-plugin', resolvedVersion: '1.2.3', integrity, updateAllowed: true })
    expect(classify('1.2.3', '1.2.3').updateAllowed).toBe(false)
  })
  it('retains repository, fixed Git commit and subdirectory', () => {
    const commit = 'a'.repeat(40)
    expect(classify(`github:owner/repo#${commit}&path:plugins/chat`, `https://codeload.github.com/owner/repo/tar.gz/${commit}`))
      .toMatchObject({ kind: 'git', repository: 'github:owner/repo', commit, subdirectory: 'plugins/chat', updateAllowed: true })
    expect(classify('git+ssh://git@example.test/team/plugin.git#main').updateAllowed).toBe(false)
  })
  it('keeps release URL, ownership and checksum', () => {
    const url = 'https://github.com/owner/plugin/releases/download/v1.2.3/plugin.tgz'
    expect(classify(url, url, { integrity })).toMatchObject({ kind: 'archive', url, repository: 'https://github.com/owner/plugin', integrity, updateAllowed: true })
  })
  it('retains local link semantics and freezes unknown sources', () => {
    expect(classify('link:../development')).toMatchObject({ kind: 'local', originalSpec: 'link:../development', target: '/isolated/plugin', updateAllowed: false })
    expect(classify('custom-protocol:plugin')).toMatchObject({ kind: 'unknown', originalSpec: 'custom-protocol:plugin', updateAllowed: false })
  })
  it('rejects Git-to-npm substitution, changed content and disappeared plugins', () => {
    const git = classify(`github:owner/plugin#${'b'.repeat(40)}`)
    expect(() => assertPluginSourcesPreserved([git], [classify('1.2.3', '1.2.3', { integrity })])).toThrow(/provenance/)
    const npm = classify('1.2.3', '1.2.3', { integrity })
    expect(() => assertPluginSourcesPreserved([npm], [{ ...npm, integrity: 'different' }])).toThrow(/integrity/)
    expect(() => assertPluginSourcesPreserved([git], [])).toThrow(/disappeared/)
  })
  it('allows staging to make a relative link absolute only when its semantics and target match', () => {
    const local = classify('link:../development')
    expect(() => assertPluginSourcesPreserved([local], [{ ...local, originalSpec: 'link:/isolated/plugin' }])).not.toThrow()
    expect(() => assertPluginSourcesPreserved([local], [{ ...local, target: '/other/plugin' }])).toThrow(/link changed/)
  })
})
