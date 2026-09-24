export type TradeMarket = {
  product: string; symbol?: string; count: number; period_minutes?: number; readiness: string; long: number; short: number;
  decision?: { decision_id: string; input_at: number; choice: { action: string; reason: string; sampling: boolean; current_position?: number; target_position?: number }; trade_response?: Record<string, {value: number; active: number; neurons: number}> };
  execution?: { decision_id: string; status: string; message: string };
  pending?: { decision_id: string; filled: number; terminal: boolean };
  signal_filter?: { period_minutes: number; required: number; confirmed: number; allowed: boolean; reason: string; margin?: number; cost?: { known: boolean; room_cost_ratio?: number; source?: string } };
  history_source?: {source: string; message?: string};
}
const actions: Record<string,string> = {WAIT:'等待',LONG:'目标做多',SHORT:'目标做空',CLOSE:'平仓'}
const position = (n: number) => n === 0 ? '空仓' : `${n > 0 ? '多' : '空'} ${Math.abs(n)} 手`
const readiness: Record<string,string> = {ready:'行情就绪',history_incomplete:'历史不足',history_gap:'分钟线有缺口',quote_stale:'等待 PandaAI 模拟赛 新报价',bars_stale:'分钟线过期'}

export function TradeLoop({markets, observing}: {markets: TradeMarket[]; observing: boolean}) {
  return <div className="fv-decisions">
    {!markets.length && <p className="fv-note">选择实际合约后，在这里查看交易选择和原因。</p>}
    {markets.map(m => {
      const d = m.decision
      const waiting = m.readiness !== 'ready' ? readiness[m.readiness] || m.readiness : observing ? '交易建议未启动' : '等待下一轮神经决策'
      return <article className="fv-decision" key={m.product}>
        <header><strong>{m.symbol || m.product}</strong><span>{!observing && m.readiness === 'ready' && d ? actions[d.choice.action] || d.choice.action : '等待'}</span></header>
        {d?.choice.target_position !== undefined && <p>{position(d.choice.current_position ?? 0)} → {position(d.choice.target_position)}</p>}
        <p>{observing || m.readiness !== 'ready' || !d ? waiting : d.choice.reason}</p>
        <small>{m.execution?.message || (observing ? '未生成交易计划' : '有有效信号后生成待确认计划')}{m.signal_filter && ` · ${m.signal_filter.reason}`}</small>
        {d && <small>最近决策 {new Date(d.input_at * 1000).toLocaleTimeString()} · {actions[d.choice.action] || d.choice.action}</small>}
        <details><summary>查看依据</summary><p>{m.period_minutes || 1} 分钟 · {m.count}/500 根 · {readiness[m.readiness] || m.readiness}</p>
          {d && <><p>决策编号 {d.decision_id}</p>{Object.entries(d.trade_response || {}).map(([key, value]) => <p key={key}>{key} · 活跃 {value.active}/{value.neurons} · 读出 {value.value.toFixed(3)}</p>)}</>}
          {m.pending && <p>成交回报 {m.pending.filled} 手 · {m.pending.terminal ? '委托已终结' : '等待柜台终态'}</p>}
        </details>
      </article>
    })}
  </div>
}
