import { describe, expect, it } from 'vitest'
import {
  extractChineseDeclarationTitle,
  resolveQuantSkillsDisplayName,
} from '../src/display-names.ts'

describe('QuantSkills localized display names', () => {
  it('prefers published Chinese metadata and preserves searchable English metadata', () => {
    expect(resolveQuantSkillsDisplayName({
      assetId: 'skill-a-share-market-risk-radar',
      kind: 'skill',
      title: 'Legacy generic title',
      titleZh: 'A股风险雷达',
      titleEn: 'A-Share Risk Radar',
      aliases: ['市场风险扫描', 'A股风险雷达'],
    })).toEqual({
      displayNames: { zhCN: 'A股风险雷达', en: 'A-Share Risk Radar' },
      aliases: ['市场风险扫描', 'A股风险雷达', 'Legacy generic title'],
      nameSource: 'catalog',
    })
  })

  it('derives stable concise names without a model or render-time request', () => {
    expect(resolveQuantSkillsDisplayName({
      assetId: 'skill-a-share-market-risk-radar',
      kind: 'skill',
      summaryZh: '扫描 A 股宏观、资金、估值和事件风险。',
    })).toMatchObject({
      displayNames: { zhCN: 'A股市场风险雷达', en: 'A Share Market Risk Radar' },
      nameSource: 'generated',
    })
    expect(resolveQuantSkillsDisplayName({
      assetId: 'agent-correlation-break-research',
      kind: 'agent',
      summaryZh: '用 Pandadata 多资产收益相关性变化识别风格切换。',
    }).displayNames.zhCN).toBe('相关性突变研究智能体')
  })

  it('uses a Chinese summary for future unknown ids and the exact id only as the last fallback', () => {
    expect(resolveQuantSkillsDisplayName({
      assetId: 'skill-future-unknown-tool',
      kind: 'skill',
      summaryZh: '用于研究未来公开数据，输出可追溯报告。',
    }).displayNames.zhCN).toBe('研究未来公开数据')
    expect(resolveQuantSkillsDisplayName({
      assetId: 'skill-future-unknown-tool',
      kind: 'skill',
    })).toMatchObject({ displayNames: { zhCN: 'skill-future-unknown-tool' }, nameSource: 'asset-id' })
  })

  it('accepts only a Chinese declaration H1 and removes a trailing English gloss', () => {
    expect(extractChineseDeclarationTitle('# 农产品期货季节性分析（Ag Futures Seasonality）\n\n正文'))
      .toBe('农产品期货季节性分析')
    expect(extractChineseDeclarationTitle('# A股市场风险雷达 (A-Share Market Risk Radar)\n'))
      .toBe('A股市场风险雷达')
    expect(extractChineseDeclarationTitle('# Market Regime Monitor\n\n中文正文'))
      .toBeUndefined()
  })
})
