import { describe, expect, it } from 'vitest'
import { upgradeWatchStrategy, watchStrategyWarnings } from '../src/contest-watch-strategy.ts'
import { makeTemplate, rangeTemplate } from '../../ui-quantskills/src/client/jev-templates.ts'

const legacy = () => ({ ...makeTemplate('trend', rangeTemplate('ag2612')), decisionIntervalSeconds: 45, minConfidence: .85,
  referenceMaterial: '用户保留资料', instructions: '使用已完成 K 线的快慢均线判断方向；趋势同向、回踩或反弹后恢复，且对应程序条件满足才评估开仓。证据不足观望，不加仓、不直接反手。',
  actionCriteria: { hold: '历史或对应入场条件不足、点差或成本不合适时观望。',
    open_long: '空仓，上行趋势、回踩恢复与回升确认均满足时评估开多。', open_short: '空仓，下行趋势、反弹转弱与回落确认均满足时评估开空。',
    close_long: '持有多头，止损、目标或策略失效等退出条件满足时评估平多。', close_short: '持有空头，止损、目标或策略失效等退出条件满足时评估平空。' } })
describe('legacy strategy compatibility', () => {
  it('upgrades only the exact shipped text while preserving numbers, reference material and the original object', () => {
    const original = legacy(), upgraded = upgradeWatchStrategy(original)
    expect(upgraded.instructions).toBe(makeTemplate('trend', rangeTemplate()).instructions)
    expect(upgraded).toMatchObject({ decisionIntervalSeconds: 45, minConfidence: .85, referenceMaterial: '用户保留资料' })
    expect(original.instructions).toContain('程序条件满足才')
    expect(watchStrategyWarnings(upgraded)).toEqual([])
  })
  it('preserves edited text, custom strategies and explicit strict mode', () => {
    for (const config of [{ ...legacy(), instructions: legacy().instructions + '用户补充' }, { ...legacy(), customStrategy: true }, { ...legacy(), decisionMode: 'strict' as const }]) {
      expect(upgradeWatchStrategy(config)).toBe(config)
    }
    expect(watchStrategyWarnings(legacy())).toHaveLength(1)
  })
})
