import type { QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsInstalledVersion } from './types.ts'
import type { QuantSkillsLibrarySourceRecord } from './plugin-types.ts'

export type CapabilityLibrarySource = 'mine' | 'installed' | 'discover' | 'unknown'

/** Stable metadata wins; only exact installed provenance may classify legacy definitions. */
export function agentLibrarySource(
  id: string, sourceVersionId: string | undefined, records: readonly QuantSkillsLibrarySourceRecord[],
  catalog: QuantSkillsCatalogSnapshot,
): CapabilityLibrarySource | 'internal' {
  const record = records.find(item => item.id === id)
  if (record) return record.source === 'personal' ? 'mine' : record.source
  const version = sourceVersionId === undefined ? undefined
    : Object.values(catalog.versionsByAsset).flat().find(item => item.versionId === sourceVersionId)
  return version?.origin === 'local-authoring' ? 'mine' : version?.origin === 'catalog' ? 'installed' : 'unknown'
}

/** Read local capabilities from Host installation truth, not the public catalog. */
export function skillLibraryAssets(catalog: QuantSkillsCatalogSnapshot, source: CapabilityLibrarySource): readonly QuantSkillsAsset[] {
  if (source === 'discover') return catalog.assets.filter(asset => asset.projectType === 'skill')
  const origin = source === 'mine' ? 'local-authoring' : source === 'installed' ? 'catalog' : undefined
  return Object.values(catalog.versionsByAsset).flatMap((versions) => {
    const version = versions.filter(item => item.projectType === 'skill' && item.exposure === 'skill-registry' && item.origin === origin)
      .sort((a, b) => b.installedAt - a.installedAt || a.versionId.localeCompare(b.versionId))[0]
    if (!version) return []
    const catalogAsset = source === 'installed' ? catalog.assets.find(item => item.name === version.assetName && item.projectType === 'skill') : undefined
    return [skillAsset(version, catalogAsset)]
  })
}

function skillAsset(version: QuantSkillsInstalledVersion, catalogAsset?: QuantSkillsAsset): QuantSkillsAsset {
  const title = version.declarationTitleZh ?? catalogAsset?.title ?? version.assetName
  return {
    name: version.assetName, title, catalogTitle: title, englishTitle: catalogAsset?.englishTitle ?? version.assetName,
    aliases: catalogAsset?.aliases ?? [], nameSource: version.declarationTitleZh ? 'declaration' : catalogAsset?.nameSource ?? 'asset-id',
    summary: catalogAsset?.summary ?? (version.origin === 'local-authoring' ? '本地创建的技能' : '已保存的技能'),
    description: catalogAsset?.description ?? '', projectType: 'skill', category: catalogAsset?.category ?? '',
    subcategory: catalogAsset?.subcategory ?? '', commitSha: version.commitSha, declarationFile: 'SKILL.md',
    url: catalogAsset?.url ?? '', health: catalogAsset?.health ?? 'unknown', validationLevel: catalogAsset?.validationLevel ?? 'unknown',
    requires: catalogAsset?.requires ?? [],
  }
}
