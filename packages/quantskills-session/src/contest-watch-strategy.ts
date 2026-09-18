import type { ContestWatchAction, ContestWatchConfig } from './contest-watch-types.ts'

export const defaultActionCriteria: Record<ContestWatchAction, string> = {
  hold: 'Abstain when evidence is insufficient, or maintaining the current position is preferable.',
  open_long: 'When flat, propose a long position if the observed evidence supports it.',
  open_short: 'When flat, propose a short position if the observed evidence supports it.',
  close_long: 'Assess reducing the existing long position.', close_short: 'Assess reducing the existing short position.',
}

// Match the complete shipped text, never rewrite edited or user-authored instructions.
const legacyTrend = {
  instructions: '使用已完成 K 线的快慢均线判断方向；趋势同向、回踩或反弹后恢复，且对应程序条件满足才评估开仓。证据不足观望，不加仓、不直接反手。',
  actionCriteria: { hold: '历史或对应入场条件不足、点差或成本不合适时观望。',
    open_long: '空仓，上行趋势、回踩恢复与回升确认均满足时评估开多。', open_short: '空仓，下行趋势、反弹转弱与回落确认均满足时评估开空。',
    close_long: '持有多头，止损、目标或策略失效等退出条件满足时评估平多。', close_short: '持有空头，止损、目标或策略失效等退出条件满足时评估平空。' },
}
export function upgradeWatchStrategy(config: ContestWatchConfig): ContestWatchConfig {
  if (config.decisionMode !== 'jev' || config.customStrategy || config.signalRules?.kind !== 'trend' || config.instructions !== legacyTrend.instructions
    || Object.entries(legacyTrend.actionCriteria).some(([key, text]) => config.actionCriteria?.[key as ContestWatchAction] !== text)) return config
  return { ...config,
    instructions: '以趋势回调为研究方向，参考快慢均线、价格结构、回踩恢复和实时变化综合判断方向及机会。自主模式中数值阈值和程序信号仅作参考，不因单项未达阈值直接放弃评估；严格模式遵守程序条件。历史不足时分析缺口，不新开仓。不加仓、不直接反手。',
    actionCriteria: { ...config.actionCriteria, hold: '综合证据不足、风险成本不合适或维持持仓更合理时观望。',
      open_long: '空仓，综合趋势延续、回踩恢复和成本判断开多是否合理。', open_short: '空仓，综合下行延续、反弹转弱和成本判断开空是否合理。' },
  }
}
export function watchStrategyWarnings(config: ContestWatchConfig): string[] {
  if (config.decisionMode !== 'jev') return []
  const text = [config.instructions, ...Object.values(config.actionCriteria ?? {})].join('\n')
  return /程序条件满足才|均满足时|全部条件.*满足|必须.*阈值/.test(text)
    ? ['策略文字包含必须满足条件的要求，可能限制自主判断；已保留你的文字，请在微调模板中核对。'] : []
}
