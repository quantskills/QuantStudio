import { flyFetch } from './transport.ts'
import { useEffect, useState } from 'react'
import ResizableNativeTable from './FlyTable.tsx'

type Reward = { decision_id: string; symbol: string; action: string; reward: number | null; learned: boolean; learned_at: number | null; trade_ids: string[]; before_score: number | null; after_score: number | null; before_choice: string | null; after_choice: string | null }
type Cycle = { id: string; day: string; settled_at: number; net_pnl: number; commission: number; fill_count: number; decision_count: number; learned_count: number; ignored_replays: number; weight_delta_l2: number | null; changed_choices: number | null; credit: string; rewards: Reward[]; weights: { action: string; before: number[]; after: number[]; delta: number[] }[]; checks: Record<string, boolean> }
type Report = { day: string; days: string[]; cycles: Cycle[]; checkpoint: { version: string | null; updates: number | null; replay_matches: boolean; current: boolean }; worker_updates: number | null; note: string }
const actionNames: Record<string, string> = { LONG: '开多', SHORT: '开空', CLOSE: '平仓', WAIT: '等待' }
const fmt = (v: number | null | undefined, digits = 2) => v == null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const signed = (v: number | null | undefined, digits = 4) => v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, digits)}`

export function TradeLearning() {
  const [data, setData] = useState<Report>()
  const [day, setDay] = useState(''); const [cycleId, setCycleId] = useState('')
  const [tab, setTab] = useState<'feedback' | 'scores' | 'weights'>('feedback')
  const [error, setError] = useState('')
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const response = await flyFetch(`/api/fly/v2/learning${day ? `?day=${encodeURIComponent(day)}` : ''}`)
        if (!response.ok) throw new Error('学习记录暂未刷新')
        const result = await response.json() as Report
        if (!stopped) { setData(result); setError('') }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : '学习记录暂不可用') }
      if (!stopped) timer = setTimeout(() => void refresh(), 15000)
    }
    void refresh(); return () => { stopped = true; clearTimeout(timer) }
  }, [day])
  const cycle = data?.cycles.find(c => c.id === cycleId) || data?.cycles[0]
  return <section id="fly-trade-learning" className="fv-trade-learning" aria-label="交易反馈学习">
    <div className="fv-learning-toolbar"><span>实际成交 → 周期净收益 → 读出层更新 → 保存与恢复</span>{data && <select aria-label="学习交易日" value={day || data.day} onChange={e => { setDay(e.target.value); setCycleId('') }}>{data.days.map(d => <option key={d}>{d}</option>)}</select>}</div>
    {error && <p role="status">{error}，保留上次结果。</p>}
    {!data ? <p>正在核对持久成交、学习事件与检查点…</p> : !cycle ? <div className="fv-empty"><h2>该交易日尚无已结算的交易学习周期</h2><p>全账户平仓并收到正式费用、权益回报后生成反馈。当前累计交易更新 {data.worker_updates ?? '—'} 次。</p><small>有成交或浮盈，并不等于已经完成反馈学习。</small></div> : <>
      <div className="fv-learning-title"><div><h2>{cycle.checks.feedback_applied ? '本轮反馈已学习' : '本轮已结算，反馈未全部更新参数'}</h2><p>交易日 {cycle.day} · {new Date(cycle.settled_at * 1000).toLocaleString('zh-CN')} · {cycle.fill_count} 笔柜台成交 · 连接组冻结</p></div>{data.cycles.length > 1 && <select aria-label="学习周期" value={cycle.id} onChange={e => setCycleId(e.target.value)}>{data.cycles.map(c => <option key={c.id} value={c.id}>{new Date(c.settled_at * 1000).toLocaleTimeString()} · {signed(c.net_pnl, 2)} 元</option>)}</select>}</div>
      <div className="fv-pnl-cards fv-learning-cards">
        <div><small>反馈依据 · 扣费净收益</small><strong>{signed(cycle.net_pnl, 2)} <small>元</small></strong></div>
        <div><small>已学习 / 成交决策</small><strong>{cycle.learned_count} / {cycle.decision_count}</strong></div>
        <div><small>本周期权重变化量 L2</small><strong>{fmt(cycle.weight_delta_l2, 6)}</strong></div>
        <div><small>重复反馈已忽略</small><strong>{cycle.ignored_replays} <small>次</small></strong></div>
      </div>
      <div className="fv-learning-checks">{[['fills_linked', '成交与原始决策关联'], ['feedback_applied', '实际反馈已更新参数'], ['checkpoint_matches', '重算与检查点一致'], ['restart_deduplicated', '恢复后重复反馈已忽略']].map(([key = '', label]) => <div key={key} className={cycle.checks[key] ? 'verified' : ''}><span>{cycle.checks[key] ? '✓ 已核对' : '待核对'}</span>{label}</div>)}</div>
      <div className="fv-statistics-toolbar">{[['feedback', '反馈决策'], ['scores', '评分变化'], ['weights', '权重详情']].map(([key = '', label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key as typeof tab)}>{label}</button>)}</div>
      {tab === 'feedback' && <><p className="fv-learning-explanation">本轮净收益共同反馈给 {cycle.decision_count} 个成交决策。下面的奖励是学习信号，不是每笔交易的盈亏；亏损交易也可能收到本周期共同的正反馈。</p><div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-trade-learning-feedback"><thead><tr><th>合约 / 动作</th><th>学习反馈</th><th>参数更新</th><th>柜台成交编号</th><th>原始神经决策</th></tr></thead><tbody>{cycle.rewards.map(r => <tr key={r.decision_id}><td>{r.symbol} · {actionNames[r.action] || r.action}</td><td>{signed(r.reward, 6)}</td><td>{r.learned ? '已更新' : '未更新'}{r.learned_at && <small>{new Date(r.learned_at * 1000).toLocaleTimeString()}</small>}</td><td>{r.trade_ids.join('、') || '待核对'}</td><td title={r.decision_id}>{r.decision_id.slice(0, 12)}</td></tr>)}</tbody></ResizableNativeTable></div></>}
      {tab === 'scores' && <><p className="fv-learning-explanation">复用当时的神经输入和持仓，对比本周期学习前后的评分。{cycle.changed_choices == null ? '历史更新链尚未与检查点核对一致，暂不展示推算结果。' : `${cycle.decision_count} 个历史样本中，${cycle.changed_choices} 个动作选择发生变化。评分改变也可能保持原动作。`} 此对照不会提交委托。</p><div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-trade-learning-scores"><thead><tr><th>合约 / 原动作</th><th>学习前评分</th><th>学习后评分</th><th>评分变化</th><th>同输入动作对照</th></tr></thead><tbody>{cycle.rewards.map(r => <tr key={r.decision_id}><td title={r.decision_id}>{r.symbol} · {actionNames[r.action]}</td><td>{fmt(r.before_score, 6)}</td><td>{fmt(r.after_score, 6)}</td><td>{signed(r.after_score == null || r.before_score == null ? null : r.after_score - r.before_score, 6)}</td><td>{r.before_choice && r.after_choice ? `${actionNames[r.before_choice]} → ${actionNames[r.after_choice]}` : '待核对'}</td></tr>)}</tbody></ResizableNativeTable></div></>}
      {tab === 'weights' && <><p className="fv-learning-explanation">本周期更新前 → 更新后的 3 × 5 读出权重。它们调整神经输入对动作评分的影响；下面不是连接组突触权重，也不是“神经元占比”。L2 表示整组权重变化的大小。</p>{cycle.weights.length ? <div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-trade-learning-weights"><thead><tr><th>动作</th>{['短期上涨', '短期下跌', '较慢上涨', '较慢下跌', '波动'].map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{cycle.weights.map(r => <tr key={r.action}><td>{actionNames[r.action]}</td>{r.before.map((v, i) => <td key={i}>{fmt(v, 6)} → {fmt(r.after[i], 6)}<small>变化 {signed(r.delta[i], 6)}</small></td>)}</tr>)}</tbody></ResizableNativeTable></div> : <p>历史权重暂不可核验；不会用零值代替缺失记录。</p>}</>}
      <small className="fv-note fv-learning-footer">{data.note}<br />保存版本 {data.checkpoint.version || '尚未保存'} · 保存的交易更新 {data.checkpoint.updates ?? '—'} 次 · {data.checkpoint.current ? '已与实际反馈重算核对' : '等待完整记录或最新检查点'}</small>
    </>}
  </section>
}
