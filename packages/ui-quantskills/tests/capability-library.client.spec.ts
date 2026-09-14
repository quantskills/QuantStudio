import { expect, it } from 'vitest'
import { skillLibraryAssets } from '../src/client/capability-library.ts'
import type { QuantSkillsCatalogSnapshot, QuantSkillsInstalledVersion } from '../src/client/types.ts'

function version(origin?: QuantSkillsInstalledVersion['origin'], commit = 'a', installedAt = 1): QuantSkillsInstalledVersion {
  return {
    assetName: 'skill-example', versionId: `skill-example@${commit.repeat(40)}`,
    projectType: 'skill', commitSha: commit.repeat(40), declarationFile: 'SKILL.md',
    installedAt, exposure: 'skill-registry', ...(origin ? { origin } : {}), declarationTitleZh: '本地测试技能',
  }
}
function catalog(versions: readonly QuantSkillsInstalledVersion[]): QuantSkillsCatalogSnapshot {
  return {
    phase: 'error', installedPhase: 'ready', assets: [], categories: [],
    versionsByAsset: { 'skill-example': versions }, installing: new Set(), sync: { mode: 'manual', state: 'idle' },
  }
}

it('shows authored Skills absent from the public catalog, even while offline', () => {
  expect(skillLibraryAssets(catalog([version('local-authoring')]), 'mine')).toMatchObject([
    { name: 'skill-example', title: '本地测试技能', declarationFile: 'SKILL.md', url: '' },
  ])
})

it('does not mix personal, installed, unknown or discover sources', () => {
  const data = catalog([version('local-authoring', 'a'), version('catalog', 'b'), version(undefined, 'c')])
  expect(skillLibraryAssets(data, 'mine')[0]?.commitSha).toBe('a'.repeat(40))
  expect(skillLibraryAssets(data, 'installed')[0]?.commitSha).toBe('b'.repeat(40))
  expect(skillLibraryAssets(data, 'unknown')[0]?.commitSha).toBe('c'.repeat(40))
  expect(skillLibraryAssets(data, 'discover')).toEqual([])
})

it('counts one asset rather than every installed revision', () => {
  const rows = skillLibraryAssets(catalog([version('local-authoring', 'a', 1), version('local-authoring', 'b', 2)]), 'mine')
  expect(rows).toHaveLength(1)
  expect(rows[0]?.commitSha).toBe('b'.repeat(40))
})

it('does not expose 专家 templates as Skills', () => {
  expect(skillLibraryAssets(catalog([{ ...version('local-authoring'), projectType: 'agent', exposure: 'agent-template' }]), 'mine')).toEqual([])
})
