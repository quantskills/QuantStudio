import ResizableNativeTable from './FlyTable.tsx'
export type TradeMarket = {
  product: string; symbol?: string; count: number; period_minutes?: number; readiness: string; long: number; short: number;
  decision?: { decision_id: string; input_at: number; choice: { action: string; reason: string; sampling: boolean }; trade_response?: Record<string, {value: number; active: number; neurons: number}> };
  execution?: { decision_id: string; status: string; message: string };
  pending?: { decision_id: string; filled: number; terminal: boolean };
  signal_filter?: { period_minutes: number; required: number; confirmed: number; allowed: boolean; reason: string; margin?: number; cost?: { known: boolean; room_cost_ratio?: number; source?: string } };
  history_source?: {source: string; message?: string};
}
const actions: Record<string,string> = {WAIT:'等待',LONG:'开多',SHORT:'开空',CLOSE:'平仓'}
const readiness: Record<string,string> = {ready:'行情就绪',history_incomplete:'历史不足',history_gap:'分钟线有缺口',quote_stale:'等待 PandaAI 模拟赛 新报价',bars_stale:'分钟线过期'}

export function TradeLoop({markets, observing}: {markets: TradeMarket[]; observing: boolean}) {
  return <section className="fv-trade-loop" aria-label="PandaAI 模拟赛 交易闭环">
    <h3>PandaAI 模拟赛 交易闭环 <small>{observing ? '观察：记录选择，不发出新委托' : '已启用：生成计划后逐笔确认'}</small></h3>
    <p>行情工程编码 → 冻结连接组放电 → 确定性读出 → 冻结计划 → 人工确认 → 柜台成交 → 平仓周期反馈</p>
    <div className="fv-trade-scroll"><ResizableNativeTable resizeStorageKey="fly-trade-loop"><thead><tr><th>具体合约</th><th>感知</th><th>神经响应 / 选择</th><th>执行结果</th><th>持仓</th></tr></thead><tbody>{markets.map(m => {
      const d=m.decision, response=Object.values(d?.trade_response || {});
      const active=response.reduce((sum,c)=>sum+c.active,0), total=response.reduce((sum,c)=>sum+c.neurons,0);
      return <tr key={m.product}><td><b>{m.symbol || m.product}</b></td><td>{m.period_minutes || 1} 分钟 · {m.count}/500 · {readiness[m.readiness] || m.readiness}<small>{m.history_source?.source}</small></td>
        <td>{d ? <><b>{actions[d.choice.action] || d.choice.action}</b> · {active}/{total} 个读出神经元放电<small>{d.choice.reason} · {new Date(d.input_at*1000).toLocaleTimeString()} · {d.decision_id.slice(0,8)}</small></> : (m.count === 500 ? '历史已齐；休市或断线时暂停决策' : '等待完整行情进入神经模型')}</td>
        <td>{m.execution?.message || '尚无交易执行记录'}{m.signal_filter && <small>{m.signal_filter.period_minutes} 分钟 · 开仓确认 {m.signal_filter.confirmed}/{m.signal_filter.required}{m.signal_filter.margin != null && ` · 神经分差 ${m.signal_filter.margin.toFixed(3)}`}{m.signal_filter.cost?.known && ` · 波动/成本 ${m.signal_filter.cost.room_cost_ratio?.toFixed(2)}`}</small>}{m.pending && <small>成交回报 {m.pending.filled} 手 · {m.pending.terminal ? '委托已终结，核对成交' : '等待柜台终态'}</small>}{m.execution && <small>决策 {m.execution.decision_id.slice(0,8)}</small>}</td>
        <td>多 {m.long} / 空 {m.short}</td></tr>
    })}</tbody></ResizableNativeTable></div>
    <small>神经元数量是实际放电计数，不是“决策占比”。行情编码及初始读出规则是工程设计；连接组冻结，交易有效性尚未验证。只有柜台成交计入交易记录。</small>
  </section>
}
