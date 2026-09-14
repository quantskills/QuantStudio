import { describe, expect, it } from 'vitest'
import {
  parseCatalogDocument,
  validateCatalogUrl,
  validateRepositoryUrl,
} from '../src/catalog.ts'

const commit = 'a'.repeat(40)
const snapshot = `sha256:${'b'.repeat(64)}`

function document(overrides: Record<string, unknown> = {}): unknown {
  return {
    snapshot_id: snapshot,
    taxonomy: {
      categories: {
        '02': {
          label_en: 'Factor R&D Toolbox',
          label_zh: '因子研发工具箱',
          subcategories: [{ id: '02.factor-generation', label_en: 'Factor Generation', label_zh: '因子生成' }],
        },
        '01': {
          label_en: 'Data APIs & Warehouse',
          label_zh: '数据接口与数据仓库',
          subcategories: [],
        },
      },
    },
    assets: [{
      catalog_status: 'approved',
      name: 'skill-safe-example',
      project_type: 'skill',
      url: 'https://github.com/quantskills/skill-safe-example',
      commit_sha: commit,
      declaration_file: 'SKILL.md',
      category: '02',
      subcategory: '02.factor-generation',
      description: 'Complete safe example.',
      health: 'healthy',
      validation_level: 'verified',
      requires: ['skill-required-example'],
      summary_en: 'Safe example.',
    }],
    ...overrides,
  }
}

describe('QuantSkills catalog validation', () => {
  it('projects approved assets and excludes non-approved rows', () => {
    const value = document({
      assets: [
        ...(document() as { assets: unknown[] }).assets,
        { catalog_status: 'pending', name: 'skill-not-approved' },
      ],
    })
    expect(parseCatalogDocument(value, { maxBytes: 1024, maxAssets: 10 })).toEqual({
      snapshotId: snapshot,
      categories: [
        {
          id: '01',
          labelEn: 'Data APIs & Warehouse',
          labelZh: '数据接口与数据仓库',
          subcategories: [],
        },
        {
          id: '02',
          labelEn: 'Factor R&D Toolbox',
          labelZh: '因子研发工具箱',
          subcategories: [{
            id: '02.factor-generation',
            labelEn: 'Factor Generation',
            labelZh: '因子生成',
          }],
        },
      ],
      assets: [{
        assetId: 'skill-safe-example',
        kind: 'skill',
        repository: 'https://github.com/quantskills/skill-safe-example',
        commit,
        declaration: 'SKILL.md',
        displayNames: { zhCN: 'skill-safe-example', en: 'Safe Example' },
        aliases: [],
        nameSource: 'asset-id',
        category: '02',
        subcategory: '02.factor-generation',
        description: 'Complete safe example.',
        health: 'healthy',
        validationLevel: 'verified',
        requires: ['skill-required-example'],
        summaryEn: 'Safe example.',
      }],
    })
  })

  it('accepts localized publication fields and searchable aliases', () => {
    const base = (document() as { assets: Array<Record<string, unknown>> }).assets[0]!
    const parsed = parseCatalogDocument(document({
      assets: [{
        ...base,
        title_zh: '安全示例',
        title_en: 'Safe Example',
        aliases: ['验证样例'],
        name_source: 'declaration',
      }],
    }), { maxBytes: 1024, maxAssets: 10 })

    expect(parsed.assets[0]).toMatchObject({
      displayNames: { zhCN: '安全示例', en: 'Safe Example' },
      aliases: ['验证样例'],
      nameSource: 'declaration',
    })
  })

  it('omits invalid approved rows without rejecting the valid catalog projection', () => {
    const base = (document() as { assets: Array<Record<string, unknown>> }).assets[0]!
    const parsed = parseCatalogDocument(document({
      assets: [
        base,
        { name: 'skill-missing-status' },
        { catalog_status: 'approved', name: 'skill-incomplete' },
      { ...base, url: 'https://github.com/other/skill-safe-example' },
      { ...base, url: 'https://github.com/quantskills/other-name' },
      { ...base, declaration_file: 'AGENTS.md' },
      { ...base, commit_sha: 'main' },
        { ...base, category: 'missing' },
        { ...base, requires: ['invalid dependency'] },
        base,
      ],
    }), { maxBytes: 1024, maxAssets: 20 })

    expect(parsed.assets.map(asset => asset.assetId)).toEqual(['skill-safe-example'])
  })

  it('accepts safe underscores throughout an official asset identity', () => {
    const base = (document() as { assets: Array<Record<string, unknown>> }).assets[0]!
    const parsed = parseCatalogDocument(document({
      assets: [{
        ...base,
        name: 'skill-backtest-assumption_check',
        url: 'https://github.com/quantskills/skill-backtest-assumption_check',
        requires: ['skill-required_example'],
      }],
    }), { maxBytes: 1024, maxAssets: 10 })

    expect(parsed.assets[0]).toMatchObject({
      assetId: 'skill-backtest-assumption_check',
      repository: 'https://github.com/quantskills/skill-backtest-assumption_check',
      requires: ['skill-required_example'],
    })
  })

  it('accepts only the official catalog and exact HTTPS repository grammar', () => {
    expect(() => {
      validateCatalogUrl('https://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json')
    }).not.toThrow()
    for (const url of [
      'http://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json',
      'https://raw.githubusercontent.com/other/quantskills/main/site/catalog.json',
      'https://raw.githubusercontent.com/quantskills/quantskills/dev/site/catalog.json',
    ]) expect(() => { validateCatalogUrl(url) }).toThrow()

    expect(validateRepositoryUrl(
      'https://github.com/quantskills/skill-safe-example', 'skill-safe-example',
    )).toBe('https://github.com/quantskills/skill-safe-example')
    expect(validateRepositoryUrl(
      'https://github.com/quantskills/skill-safe_example', 'skill-safe_example',
    )).toBe('https://github.com/quantskills/skill-safe_example')
    expect(() => {
      validateRepositoryUrl('https://github.com/quantskills/skill-safe-example?x=1', 'skill-safe-example')
    }).toThrow()
  })
})
