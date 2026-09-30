export type TradingEngineConfig = {
  decision_engine?: 'neural' | 'llm'
  trade_model?: string
  trade_instructions?: string
  llm_max_lots?: number
  trade_daily_calls?: number
}
export const defaultTradingInstructions = '根据最近行情和当前持仓判断趋势。证据不足时等待，不追逐短暂波动；趋势失效时减仓或平仓。'

export function TradingEngineSettings({ value, models, onChange, openModels, available = true }: {
  available?: boolean
  value: TradingEngineConfig
  models: { provider_id: string; label: string }[]
  onChange(value: TradingEngineConfig): void
  openModels?: (() => void) | undefined
}) {
  const llm = value.decision_engine === 'llm'
  return <div className="fv-setup-body qs-engine-settings">
    <div className="qs-engine-choices" role="group" aria-label="交易决策方式">
      <button type="button" disabled={!available} aria-pressed={llm} onClick={() => onChange({ ...value, decision_engine: 'llm',
        trade_model: value.trade_model || models[0]?.provider_id || '',
        trade_instructions: value.trade_instructions ?? defaultTradingInstructions,
        llm_max_lots: value.llm_max_lots ?? 1, trade_daily_calls: value.trade_daily_calls ?? 0 })}>
        <strong>大模型交易员</strong><span>按你的交易要求分析行情</span>
      </button>
      <button type="button" aria-pressed={!llm} onClick={() => onChange({ ...value, decision_engine: 'neural' })}>
        <strong>神经交易员</strong><span>沿用本地神经模型决策</span>
      </button>
    </div>
    {!available && <p role="status">当前后台仍为旧版。暂停当前自动交易并重启 QuantStudio 后，可启用大模型交易员。</p>}
    {llm ? <>
      <label>交易模型<select aria-label="交易模型" value={value.trade_model || ''} onChange={e => onChange({ ...value, trade_model: e.target.value })}>
        <option value="">选择 QS 已配置的模型</option>{models.map(model => <option key={model.provider_id} value={model.provider_id}>{model.label}</option>)}
      </select></label>
      {!models.length && <p>还没有可用模型。先在 QS 模型设置中配置一个。{openModels && <button type="button" onClick={openModels}>打开模型设置 ↗</button>}</p>}
      <label>交易要求<textarea aria-label="交易要求" rows={5} maxLength={4000} value={value.trade_instructions ?? defaultTradingInstructions}
        onChange={e => onChange({ ...value, trade_instructions: e.target.value })}
        placeholder="例如：顺势交易，不追涨杀跌。趋势变弱时退出，没有把握就等待。" /></label>
      <p>每轮读取最近 60 根完整 K 线、报价和持仓，给出目标手数与原因，再按所选执行方式提交交易。</p>
      <details className="fv-data-details"><summary>手数与调用额度</summary><div className="fv-form-grid">
        <label>单合约最大持仓（手）<input aria-label="大模型最大持仓手数" type="number" min={1} max={500} step={1} value={value.llm_max_lots ?? 1} onChange={e => onChange({ ...value, llm_max_lots: Number(e.target.value) })}/></label>
        <label>每日模型调用上限<input aria-label="交易模型每日调用上限" type="number" min={0} max={100000} step={1} value={value.trade_daily_calls ?? 0} onChange={e => onChange({ ...value, trade_daily_calls: Number(e.target.value) })}/></label>
      </div><small>默认每合约最多 1 手；调用上限 0 表示不限。按合约分别分析，调用会计入所选模型的用量。</small></details>
    </> : <p>使用本地 MaleCNS 神经模型生成交易信号。首次使用需在「运行环境」中准备依赖；已有神经配置继续保留。</p>}
  </div>
}
