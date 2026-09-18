import type { ContestWatchAnalysis } from './plugin-types.ts'
import { contestTime } from './contest.ts'
import css from './ContestPage.module.css'

const names: Record<string, string> = { range: '区间', rising: '上行', falling: '下行', unclear: '不明确', supported: '适用', contradicted: '不适用', insufficient: '证据不足',
  none: '未识别到阻碍', data_missing: '数据不足', regime_mismatch: '环境不匹配', entry_not_met: '入场条件未满足', cost_conflict: '成本不合适', position_constraint: '持仓限制', exit_not_met: '退出条件未满足' }
const actionNames = { hold: '观望', open_long: '开多', open_short: '开空', close_long: '平多', close_short: '平空' }
export function JevEvidence({ analysis }: { analysis: ContestWatchAnalysis }) {
  const evidence = analysis.evidence, assessment = analysis.decision?.assessments
  if (!evidence && !assessment) return null
  return <section className={css.jevEvidence} aria-label="决策证据与条件">
    {evidence && <>
      <p>历史来源：{evidence.history.source} · {evidence.history.count} 根 {evidence.history.barSeconds / 60} 分钟已完成 K 线</p>
      <p className={css.jevFine}>{evidence.history.from && evidence.history.to ? `${contestTime(evidence.history.from)} — ${contestTime(evidence.history.to)}` : '没有可用历史覆盖'} · 报价窗口 {evidence.features.quoteWindowSeconds} 秒</p>
      <p className={css.jevFine}>{evidence.decisionMode === 'jev' ? 'Jev 自主决策：策略指标供模型参考；硬性限制不允许模型突破。历史不足时仍可分析，但不能新开仓。' : '严格规则模式：未满足或未知会拦截标注的动作，另一方向的条件独立判断。'}</p>
      {evidence.decisionMode === 'jev' && evidence.allowedActions.every(action => action === 'hold') && <p className={css.jevFine}>本轮硬性限制只允许观望；Jev 仍评估市场状态、策略适用性与主要阻碍。此时观望概率不代表模型在多个交易动作中作出的取舍。</p>}
      <ul className={css.jevChecks}>{evidence.checks.map(check => <li key={check.id} data-state={check.state}><strong>{check.label}<span>{check.state === 'pass' ? '满足' : check.state === 'fail' ? '未满足' : '未知'}</span></strong><p>{check.detail}</p><small>{check.enforcement === 'reference' ? `Jev 参考${check.actions.length ? '：' + check.actions.map(action => actionNames[action]).join(' / ') : ''}（不作程序拦截）` : check.actions.length ? `${check.enforcement === 'hard' ? '硬性' : ''}约束：${check.actions.map(action => actionNames[action]).join(' / ')}` : '仅供判断参考'}</small></li>)}</ul>
    </>}
    {assessment && <>
      <p>Jev 分项判断</p><div className={css.jevAssessment}>{(['regime', 'fit', 'blocker'] as const).map(key => <div key={key}>
        <span>{key === 'regime' ? '市场状态' : key === 'fit' ? '策略适用性' : '主要阻碍'}</span>
        <strong>{names[assessment[key].choice] ?? assessment[key].choice}</strong><small>置信度 {(assessment[key].confidence * 100).toFixed(1)}%</small>
      </div>)}</div>
      <p className={css.jevFine}>分项与动作独立判断。自主模式以最终动作生成候选建议，分项冲突提示人工复核；严格模式中冲突会阻止开仓计划。</p>
    </>}
    {evidence && !analysis.decision && analysis.finishedAt && <p className={css.jevFine}>本轮没有有效 Jev 决策。具体原因见本轮结果；程序拦截不计为模型“观望”。</p>}
  </section>
}
