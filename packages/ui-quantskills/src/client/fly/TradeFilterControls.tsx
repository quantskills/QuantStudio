import { useEffect, useState } from 'react'

export type TradeFilterSettings = {
  trade_period_minutes: 1 | 5; signal_confirmations: number; min_signal_margin: number
  reentry_cooldown_minutes: number; cost_filter_multiplier: number
}
const legacy: TradeFilterSettings = { trade_period_minutes: 1, signal_confirmations: 1, min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0 }

export function TradeFilterControls({ settings, onApply, onDraftChange }: { settings: TradeFilterSettings; onApply: (value: TradeFilterSettings) => Promise<unknown>; onDraftChange?: (value: TradeFilterSettings) => void }) {
  const [draft, setLocalDraft] = useState<TradeFilterSettings>({ ...legacy, ...settings })
  const setDraft = (value: TradeFilterSettings) => { setLocalDraft(value); onDraftChange?.(value) }
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setLocalDraft({ ...legacy, ...settings }) }, [settings.trade_period_minutes, settings.signal_confirmations, settings.min_signal_margin, settings.reentry_cooldown_minutes, settings.cost_filter_multiplier])
  const apply = async () => {
    setPending(true); setMessage('')
    try { await onApply(draft); setMessage('已保存，使用新设置下的完整周期信号。') }
    catch (error) { setMessage(String(error).replace(/^Error: /, '')) }
    finally { setPending(false) }
  }
  return <details className="fv-trade-filter-controls">
    <summary>交易节奏与信号过滤 <span>{settings.trade_period_minutes || 1} 分钟决策 · 开仓确认 {settings.signal_confirmations || 1} 次 · 平仓后冷却 {settings.reentry_cooldown_minutes || 0} 分钟</span></summary>
    <p>图表周期只改变显示。交易决策读取 PandaData 原生 1 或 5 分钟周期最新 500 根已完成 K 线。切换周期后等待对应数据就绪。</p>
    <div className="fv-form-grid">
      <label>交易决策周期<select aria-label="交易决策周期" disabled={pending} value={draft.trade_period_minutes} onChange={e => setDraft({ ...draft, trade_period_minutes: Number(e.target.value) as 1 | 5 })}>{[1, 5].map(n => <option key={n} value={n}>{n} 分钟</option>)}</select></label>
      <label>连续同向开仓确认<select aria-label="连续同向开仓确认" disabled={pending} value={draft.signal_confirmations} onChange={e => setDraft({ ...draft, signal_confirmations: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} 个完整周期</option>)}</select></label>
      <label>开仓神经分数最小领先<input aria-label="开仓神经分数最小领先" type="number" min="0" max="1" step="0.01" disabled={pending} value={draft.min_signal_margin} onChange={e => setDraft({ ...draft, min_signal_margin: Number(e.target.value) })} /></label>
      <label>平仓后开仓冷却（分钟）<input aria-label="平仓后开仓冷却" type="number" min="0" max="120" step="1" disabled={pending} value={draft.reentry_cooldown_minutes} onChange={e => setDraft({ ...draft, reentry_cooldown_minutes: Number(e.target.value) })} /></label>
      <label>成本过滤（等待柜台费用参数）<input aria-label="波动空间成本倍数" type="number" min="0" max="10" step="0.5" disabled value={draft.cost_filter_multiplier} /></label>
    </div>
    <p>开仓须连续同向且分数差足够；平仓后等待冷却结束，再重新确认。神经平仓选择不增加这些开仓限制。</p>
    <small>比赛接口暂未提供完整费用参数，成本过滤保持关闭。实际手续费只使用柜台返回的数据。</small>
    <div className="fv-actions"><button type="button" disabled={pending} onClick={() => setDraft({ trade_period_minutes: 5, signal_confirmations: 2, min_signal_margin: 0.08, reentry_cooldown_minutes: 10, cost_filter_multiplier: 0 })}>填入低频预设</button>{!onDraftChange && <button type="button" disabled={pending} onClick={() => void apply()}>{pending ? '保存中…' : '应用交易过滤'}</button>}</div>
    {message && <p role="status">{message}</p>}
  </details>
}
