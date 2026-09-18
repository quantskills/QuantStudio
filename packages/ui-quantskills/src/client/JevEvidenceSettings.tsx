import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { ContestWatchConfig, ContestWatchDataset } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'

const defaultRules: NonNullable<ContestWatchConfig['rangeRules']> = { lookbackBars: 30, tickSize: 0, minWidthTicks: 8, minTouches: 2, edgeFraction: .2,
  reboundTicks: 2, roundTripCostTicks: 0, minRewardCostRatio: 2, stopLossTicks: 8, takeProfitTicks: 12 }
const fields = [ ['lookbackBars', '区间回看 K 线根数', 10, 240, 1], ['tickSize', '最小价格变动（tick 对应价格）', .000001, undefined, 'any'],
  ['minWidthTicks', '最小区间宽度（tick）', .01, undefined, 'any'], ['minTouches', '上下沿各需独立触碰次数', 2, 10, 1],
  ['edgeFraction', '边沿区域占区间比例', .05, .4, .01], ['reboundTicks', '回升或回落确认幅度（tick）', .01, undefined, 'any'],
  ['roundTripCostTicks', '每手双边手续费及滑点假设（tick，不含点差）', .000001, undefined, 'any'], ['minRewardCostRatio', '目标空间 / 成本下限', 1, 20, .1],
  ['stopLossTicks', '持仓止损条件（tick）', .01, undefined, 'any'], ['takeProfitTicks', '持仓目标条件（tick）', .01, undefined, 'any'], ] as const
const signalFields = [ ['lookbackBars', '信号回看 K 线根数', 10, 240, 1], ['fastBars', '快均线周期', 2, 120, 1], ['slowBars', '慢均线周期', 3, 239, 1],
  ['pullbackTicks', '回踩容差与入场距离上限（tick）', .01, undefined, 'any'], ['reboundTicks', '回升或回落确认幅度（tick）', .01, undefined, 'any'],
  ['bufferTicks', '收盘突破幅度（tick）', .01, undefined, 'any'], ['maxChaseTicks', '突破追价上限（tick）', .01, undefined, 'any'],
  ...fields.filter(item => ['roundTripCostTicks', 'minRewardCostRatio', 'stopLossTicks', 'takeProfitTicks'].includes(item[0])), ] as const

export function JevEvidenceSettings({ access, config, onChange, onBusy }: { access: NonNullable<ContestAccess['watch']>; config: ContestWatchConfig; onChange: Dispatch<SetStateAction<ContestWatchConfig>>; onBusy: (busy: boolean) => void }) {
  const [datasets, setDatasets] = useState<ContestWatchDataset[]>([]), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [pandaSymbol, setPandaSymbol] = useState(''), [preparing, setPreparing] = useState(false)
  const [pandaPeriod, setPandaPeriod] = useState(60)
  useEffect(() => {
    let disposed = false
    void waitForCompetition(() => access.datasets(), '历史行情数据集').then(result => { if (!disposed) { setDatasets(result); setError('') } })
      .catch(() => { if (!disposed) setError('历史数据集读取失败，请重试。') })
    return () => { disposed = true }
  }, [access, revision])
  const selected = datasets.find(item => item.id === config.history?.datasetId)
  const select = (id: string) => {
    const dataset = datasets.find(item => item.id === id)
    if (!dataset) { onChange(current => ({ ...current, history: undefined })); return }
    const column = (...names: string[]) => dataset.columns.find(key => names.includes(key.toLowerCase())) ?? ''
    onChange(current => ({ ...current, history: { datasetId: id, barSeconds: 60, timeMeaning: 'open', refresh: false,
      columns: { time: column('datetime', 'timestamp', 'time', '日期'), symbol: column('symbol', 'contractcode', 'contract'), open: column('open'), high: column('high'), low: column('low'), close: column('close') } } }))
  }
  return <div className={css.watchInstructions}>
    <details className={css.jevHistory} open={Boolean(config.history || config.rangeRules || config.signalRules)}><summary>历史行情与策略条件</summary>
      <label className={css.jevCheckLabel}><input type="checkbox" checked={Boolean(config.autoHistory)} onChange={event => onChange({ ...config, autoHistory: event.target.checked ? { exchange: config.instrument?.exchange ?? 'SHF', barSeconds: 60 } : undefined })}/>启动时自动准备 PandaData 行情</label>
      {config.autoHistory && <div className={css.watchFields}>
        <label>自动行情周期<select value={config.autoHistory.barSeconds} onChange={event => onChange({ ...config, autoHistory: { ...config.autoHistory!, barSeconds: Number(event.target.value) as 60 | 300 } })}><option value={60}>1 分钟</option><option value={300}>5 分钟</option></select></label>
        <p className={css.jevFine}>自动匹配上方实际合约、创建或复用分钟数据源，并开启刷新。首次需在设置中连接 PandaData。</p>
      </div>}
      {!config.autoHistory && <>
      <div className={css.jevStrategyPreset}><label>PandaData 实际合约<input placeholder="例如 RB2610.SHF" value={pandaSymbol} onChange={event => setPandaSymbol(event.target.value.trim().toUpperCase())}/></label>
        <label>PandaData 读取周期<select value={pandaPeriod} onChange={event => setPandaPeriod(Number(event.target.value))}><option value={60}>1 分钟</option><option value={300}>5 分钟</option></select></label>
        <button type="button" disabled={preparing || !pandaSymbol} onClick={() => {
          setPreparing(true); onBusy(true); setError('')
          void waitForCompetition(() => access.prepareHistory({ symbol: pandaSymbol, barSeconds: pandaPeriod }), 'PandaData 分钟行情', 60000)
            .then(history => { onChange(current => ({ ...current, history })); setRevision(value => value + 1) })
            .catch(failure => setError(failure instanceof Error ? failure.message : '分钟行情读取失败。'))
            .finally(() => { setPreparing(false); onBusy(false) })
        }}>{preparing ? '正在读取 PandaData…' : '创建 PandaData 分钟数据源'}</button>
      </div>
      <p className={css.jevFine}>读取当前实际合约分钟数据，数据源随日期更新并覆盖夜盘交易日标签，排除未来 K 线。默认 1 分钟，首次按开始时间保守处理，请核对时间含义。启动后每分钟最多检查一次缓存并刷新过期数据。</p>
      <p className={css.jevFine}>读取数据库页配置的行情时间序列。仅使用实际合约匹配且已完成的 K 线；时间无时区时按北京时间处理。样本跨越休市缺口时，等待重新积累连续窗口。</p>
      <label>历史行情数据集<select value={config.history?.datasetId ?? ''} onChange={event => select(event.target.value)}>
        <option value="">未选择：只有报价快照，缺少历史背景</option>
        {config.history && !selected && <option value={config.history.datasetId}>原数据集不可用</option>}
        {datasets.map(item => <option key={item.id} value={item.id}>{item.name} · {item.rows} 行 · {item.source}</option>)}
      </select></label>
      <button type="button" onClick={() => setRevision(value => value + 1)}>重新读取数据集列表</button>
      {!datasets.length && <p className={css.jevFine}>暂无可用行情时间序列。请先在数据库页导入 CSV/JSON，或配置 PandaData 行情源，并将分类设为「行情」。需要合约、时间及 OHLC 列。</p>}
      {error && <p className={css.error}>{error}</p>}
      {config.history && <div className={css.watchFields}>
        <label>K 线周期<select value={config.history.barSeconds} onChange={event => onChange({ ...config, history: { ...config.history!, barSeconds: Number(event.target.value) as 60 | 300 } })}><option value={60}>1 分钟</option><option value={300}>5 分钟</option></select></label>
        <label>时间列代表<select value={config.history.timeMeaning} onChange={event => onChange({ ...config, history: { ...config.history!, timeMeaning: event.target.value as 'open' | 'close' } })}><option value="open">K 线开始时间</option><option value="close">K 线结束时间</option></select></label>
        {(Object.entries({ time: '时间', symbol: '实际合约', open: '开盘价', high: '最高价', low: '最低价', close: '收盘价' }) as [keyof NonNullable<ContestWatchConfig['history']>['columns'], string][]).map(([key, label]) => <label key={key}>{label}数据列<select required value={config.history!.columns[key]}
          onChange={event => onChange({ ...config, history: { ...config.history!, columns: { ...config.history!.columns, [key]: event.target.value } } })}>
          <option value="">请选择对应列</option>{selected?.columns.map(column => <option key={column}>{column}</option>)}
        </select></label>)}
        <label className={css.watchInstructions}>允许刷新所选远程数据源<input type="checkbox" checked={config.history.refresh} onChange={event => onChange({ ...config, history: { ...config.history!, refresh: event.target.checked } })}/></label>
      </div>}
      </>}
      {!config.signalRules && <label className={css.jevCheckLabel}><input type="checkbox" checked={Boolean(config.rangeRules)} onChange={event => onChange({ ...config, builtInTemplate: undefined, customStrategy: !event.target.checked, rangeRules: event.target.checked ? { ...defaultRules, tickSize: config.instrument?.tickSize ?? 0 } : undefined })}/>{config.decisionMode === 'jev' ? '提供区间参考指标（由 Jev 综合判断）' : '启用明确区间规则（不满足时阻止开仓）'}</label>}
      {config.rangeRules && <>
        <p className={css.jevFine}>以下初值是待验证示例，未经收益回测。自主模式中数值条件只作为 Jev 参考，严格模式中用于程序筛选。止损/目标仅生成待确认的平仓建议，不是柜台止损单。</p>
        <div className={css.watchFields}>{fields.filter(item => item[0] !== 'tickSize').map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={config.rangeRules![key] || ''}
          onChange={event => onChange({ ...config, rangeRules: { ...config.rangeRules!, [key]: Number(event.target.value) } })}/></label>)}</div>
        {!config.history && !config.autoHistory && <p className={css.jevFine}>尚未选择历史行情；启用此规则后，会等待历史数据，期间不生成开仓计划。</p>}
      </>}
      {config.signalRules && <>
        <p className={css.jevFine}>{config.decisionMode === 'jev' ? '以下信号由程序计算并发送给 Jev 参考；不以信号未满足为由取消模型请求。' : '以下信号作为硬性入场条件，由程序逐项校验。'}</p>
        <p className={css.jevFine}>{config.signalRules.kind === 'trend' ? '趋势回调：快均线周期 < 慢均线周期 < 回看根数；趋势、回踩及报价恢复按方向分别校验。' : '突破跟随：末根收盘与最新价共同确认，前序窗口不包含确认 K 线；突破幅度须小于追价上限。'} 止损和目标仅生成待确认平仓建议。</p>
        <div className={css.watchFields}>{signalFields.filter(item => config.signalRules!.kind === 'trend' ? !['bufferTicks', 'maxChaseTicks'].includes(item[0]) : !['fastBars', 'slowBars', 'pullbackTicks', 'reboundTicks'].includes(item[0])).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step}
          value={config.signalRules![key as keyof Omit<NonNullable<ContestWatchConfig['signalRules']>, 'kind'>] || ''}
          onChange={event => onChange({ ...config, signalRules: { ...config.signalRules!, [key]: Number(event.target.value) } })}/></label>)}</div>
      </>}
    </details>
  </div>
}
