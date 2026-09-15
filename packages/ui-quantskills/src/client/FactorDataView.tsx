import { asRecord, display } from './contest.ts'
import css from './ContestPage.module.css'
import styles from './FactorContestPage.module.css'

const labels: Record<string, string> = {
  success: '查询成功', status: '状态', name: '名称', factor_name: '因子名称', workflow_id: '工作流编号', _id: '编号', factor_id: '因子编号', factor_run_id: '回测编号',
  total: '总数', count: '本页数量', page: '页码', limit: '每页数量', factors: '研究因子', items: '明细', last_run_id: '最近回测', create_at: '创建时间',
  name_zh: '名称', pool_id: '因子池', pool_name: '因子池名称', rankings: '各榜排名', ranking_key: '榜单', rank: '名次', score: '得分', scores: '成绩',
  total_score: '总分', total_points: '累计积分', cumulative_points: '累计积分', monthly_points: '月度积分', monthly_score: '月度得分', points: '积分',
  period: '周期', settlement_month: '结算月', data_date: '数据日期', updated_at: '更新时间', rebalance_cycle_days: '统一调仓周期',
  IC_mean: '平均 IC', Rank_IC: 'Rank IC', IC_IR: 'ICIR', rank_ic: 'Rank IC', ic: 'IC', ic_ir: 'ICIR', ic_mean: '平均 IC', ic_win_rate: 'IC 胜率',
  p_value: 'p 值', t_statistic: 't 统计量', monotonicity: '单调性', annualized_ratio: '年化收益', return_ratio: '收益率', sharpe_ratio: '夏普比率',
  maximum_drawdown: '最大回撤', turnoverRate: '换手率', turnover: '换手率', excess_return: '超额收益', annual_return: '年化收益', win_rate: '胜率',
  duration_seconds: '耗时（秒）', start_time: '开始时间', end_time: '结束时间', factor_analysis: '因子分析', results: '分析结果', nodes: '计算节点结果',
  billing: '算力统计', balance: '余额', deducted: '观测消耗', output: '输出', content: '公式或代码', mode: '定义方式', direction: '方向',
  adjustment_cycle: '调仓周期', group_number: '分组数', factor_direction: '因子方向', start_date: '开始日期', end_date: '结束日期', stock_pool: '股票池',
  query_factor_analysis_data: '因子分析指标', query_one_group_data: '分组表现', candidate: '候选定义', formula: '公式', code: 'Python 定义', result: '结果',
}
/** Show platform metrics as readable tables; large nested raw results remain expandable. */
export function FactorDataView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <p className={css.muted}>暂无数据。</p>
  if (typeof value !== 'object') return <span>{display(value)}</span>
  if (depth >= 3) return <pre className={styles.json}>{JSON.stringify(value, null, 2)}</pre>
  if (Array.isArray(value)) {
    if (!value.length) return <p className={css.muted}>暂无记录。</p>
    const rows = value.slice(0, 50).map(asRecord), keys = [...new Set(rows.flatMap(row => Object.keys(row)))].slice(0, 12)
    if (!keys.length) return <p>{value.map(display).join('、')}</p>
    return <div className={css.tableWrap}><table><thead><tr>{keys.map(k => <th key={k}>{labels[k] ?? k}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{keys.map(k => <td key={k}>
      {row[k] !== null && typeof row[k] === 'object' ? <details><summary>查看</summary><FactorDataView value={row[k]} depth={depth + 1}/></details> : display(row[k])}
    </td>)}</tr>)}</tbody></table></div>
  }
  const entries = Object.entries(asRecord(value)), simple = entries.filter(([, v]) => v == null || typeof v !== 'object'), nested = entries.filter(([, v]) => v != null && typeof v === 'object')
  return <div>{simple.length > 0 && <dl className={css.metrics}>{simple.map(([k, v]) => <div key={k}><dt>{labels[k] ?? k}</dt><dd>{typeof v === 'boolean' ? v ? '是' : '否' : display(v)}</dd></div>)}</dl>}
    {nested.map(([k, v]) => <details key={k} open={depth === 0 && ['factors', 'rankings', 'scores', 'items', 'factor_analysis', 'results'].includes(k)}><summary>{labels[k] ?? k}</summary><FactorDataView value={v} depth={depth + 1}/></details>)}
  </div>
}
