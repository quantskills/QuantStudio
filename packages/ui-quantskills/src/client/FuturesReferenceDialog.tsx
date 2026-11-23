import { useEffect, useState } from 'react'
import type {
  FuturesCatalog, FuturesExchange, FuturesProduct, FuturesReferenceQuery, FuturesReferenceResult, FuturesSource,
} from '@deepseek-ai/dsh-panda-mcp/types'
import { ActionDialog } from './ActionDialog.tsx'
import css from './DatabasePage.module.css'

export interface FuturesReferenceAccess {
  catalog(): Promise<FuturesCatalog>
  query(input: FuturesReferenceQuery): Promise<FuturesReferenceResult>
}

const sourceStatus: Record<FuturesSource['status'], string> = {
  available: '已查到',
  missing: '该交易日归档缺失，休市日也可能无归档',
  unsupported: '该交易所暂未接入此类逐日数据',
  no_contract: '该日未查到对应合约记录',
  login_required: '请在设置中连接 PandaData 后查询',
  error: '来源暂不可读或文件格式异常，可重试',
}
const cutoffStatus = { visible: '该报告版本在截止前已更新', after_cutoff: '该报告版本晚于截止时间', unknown: '该报告版本的可见时点未证实' }
const percent = (value: number | null) => value === null ? '—' : `${Number((value * 100).toFixed(8))}%`
const dateSpan = (days: number, from: string | null, through: string | null) =>
  days ? `${days} 日（${from} 至 ${through}）` : '样本暂无覆盖'

function Source({ label, source }: { label: string; source: FuturesSource | null }) {
  if (!source) return null
  return <div className={css.futuresSource}>
    <p>{label} · {sourceStatus[source.status]}{source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">{source.provider === 'pandadata' ? 'PandaData 来源' : '交易所来源'}{source.url.startsWith('http:') ? '（HTTP）' : ''}</a></>}</p>
    {source.status === 'available' && <p>首次公布时间未知{source.sourceUpdatedAt && <> · 源文件更新时间 {source.sourceUpdatedAt.slice(0, 19).replace('T', ' ')}（北京时间）</>}</p>}
    {source.cutoff && <p>{cutoffStatus[source.cutoff]}</p>}
  </div>
}

function Product({ product, catalogDate }: { product: FuturesProduct; catalogDate: string }) {
  return <section className={css.futuresSection} aria-label="品种目录">
    <h3>{product.name} · {product.product}</h3>
    <dl className={css.meta}>
      <div><dt>现行最小价位</dt><dd>{product.tickText}</dd></div>
      <div><dt>现行合约乘数</dt><dd>{product.multiplier}（{product.tradingUnit}）</dd></div>
      <div><dt>现行分类</dt><dd>{product.currentCategory}</dd></div>
      <div><dt>目录版本</dt><dd>{catalogDate} · <a href={product.sourceUrl} target="_blank" rel="noreferrer">合约规则来源</a></dd></div>
    </dl>
    <details><summary>已核验的历史覆盖</summary>
      <dl className={css.meta}>
        <div><dt>行情样本</dt><dd>{dateSpan(product.coverage.quoteDays, product.coverage.quoteFrom, product.coverage.quoteThrough)}</dd></div>
        <div><dt>结算参数样本</dt><dd>{dateSpan(product.coverage.feeDays, product.coverage.feeFrom, product.coverage.feeThrough)}</dd></div>
      </dl>
    </details>
  </section>
}

function History({ result }: { result: FuturesReferenceResult }) {
  const { historicalRule: rule, contractTerms: terms, fees, quote, main } = result
  return <section className={css.futuresSection} aria-label="历史查询结果">
    <h3>{result.date} · {result.contract ?? '无可定位的合约'}</h3>
    <dl className={css.meta}>
      <div><dt>主力合约</dt><dd>{main ? `${main.contract} · ${main.method === 'after_close' ? '按当日收盘持仓量、成交量、合约代码重算' : 'PandaData 主力映射'}` : '暂无证据'}</dd></div>
      {quote && <div><dt>当日行情</dt><dd>结算价 {quote.settlement ?? '—'} · 成交量 {quote.volume ?? '—'} 手 · 持仓量 {quote.openInterest ?? '—'} 手</dd></div>}
      <div><dt>当期最小价位</dt><dd>{rule?.tickSize ?? '暂无核实条款'}</dd></div>
      <div><dt>当期合约乘数</dt><dd>{rule?.multiplier ?? '暂无核实条款'}</dd></div>
      <div><dt>历史板块</dt><dd>{rule?.historicalSector && rule.sectorSourceUrl ? <a href={rule.sectorSourceUrl} target="_blank" rel="noreferrer">{rule.historicalSector}（指数编制方案）</a> : '暂无当期证据'}</dd></div>
      {rule && <div><dt>条款核验区间</dt><dd>{rule.validFrom} 至 {rule.validThrough} · <a href={rule.sourceUrl} target="_blank" rel="noreferrer">历史条款</a></dd></div>}
      {terms && <div><dt>合约日期</dt><dd>挂牌 {terms.listedDate ?? '—'} · 最后交易 {terms.lastTradingDate ?? '—'}<small>交割 {terms.deliveryStart ?? '—'} 至 {terms.deliveryEnd ?? '—'}</small></dd></div>}
    </dl>
    <Source label="当日行情" source={result.quoteSource}/>
    {result.contractSource?.status !== 'unsupported' && <Source label="合约日期资料" source={result.contractSource}/>}
    {fees && <>
      <div className={css.table}><table aria-label="交易所手续费">
        <thead><tr><th scope="col">成交方向</th><th scope="col">元 / 手</th><th scope="col">成交额费率</th></tr></thead>
        <tbody>{([['开仓', fees.open], ['平昨', fees.closePrevious], ['平今', fees.closeToday]] as const).map(([label, fee]) =>
          <tr key={label}><th scope="row">{label}</th><td>{fee.yuanPerLot}</td><td>{percent(fee.rate)}</td></tr>)}</tbody>
      </table></div>
      <p className={css.futuresHint}>交易所标准。保证金率 多头 {percent(fees.marginLong)} · 空头 {percent(fees.marginShort)}。</p>
    </>}
    <Source label="当日结算参数" source={result.feeSource}/>
  </section>
}

export function FuturesReferenceDialog({ access, close }: { access: FuturesReferenceAccess; close(): void }) {
  const [catalog, setCatalog] = useState<FuturesCatalog>()
  const [exchange, setExchange] = useState<FuturesExchange>('SHFE')
  const [productCode, setProductCode] = useState('')
  const [contract, setContract] = useState('')
  const [date, setDate] = useState('')
  const [cutoff, setCutoff] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FuturesReferenceResult>()
  useEffect(() => {
    let active = true
    access.catalog().then(catalog => { if (active) setCatalog(catalog) })
      .catch(() => { if (active) setError('暂时无法打开期货品种目录。') })
    return () => { active = false }
  }, [access, attempt])
  const products = catalog?.products.filter(product => product.exchange === exchange) ?? []
  const product = products.find(item => item.product === productCode) ?? products[0]
  return <ActionDialog title="期货参考" wide busy={busy} error={error} onClose={close}>
    {!catalog ? error ? <button onClick={() => { setError(''); setAttempt(attempt + 1) }}>重试</button> : <p role="status">正在读取期货品种目录…</p> : <>
      <form className={css.form} onChange={() => { setResult(undefined); setError('') }} onSubmit={async event => {
        event.preventDefault()
        if (!product || busy) return
        setBusy(true); setError(''); setResult(undefined)
        try {
          const next = await access.query({ exchange, symbol: contract.trim() || product.product, date, ...(cutoff ? { cutoff } : {}) })
          if (next.product.product !== product.product) throw new Error('合约代码与所选品种不一致。')
          setResult(next)
        } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
        finally { setBusy(false) }
      }}>
        <div className={css.futuresFields}>
          <label>交易所<select value={exchange} disabled={busy} onChange={event => { setExchange(event.target.value as FuturesExchange); setProductCode(''); setContract('') }}>
            {catalog.exchanges.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
          </select></label>
          <label>品种<select value={product?.product ?? ''} disabled={busy} onChange={event => { setProductCode(event.target.value); setContract('') }}>
            {products.map(item => <option key={item.product} value={item.product}>{item.product} · {item.name}</option>)}
          </select></label>
          <label>交易日<input type="date" required value={date} disabled={busy} onChange={event => setDate(event.target.value)}/></label>
          <label>合约代码（可选）<input value={contract} maxLength={24} spellCheck={false} disabled={busy} placeholder="留空时查询当日主力" onChange={event => setContract(event.target.value)}/></label>
          <label>可见时点（北京时间，可选）<input type="datetime-local" value={cutoff} disabled={busy} onChange={event => setCutoff(event.target.value)}/></label>
          <button type="submit" disabled={!product || !date || busy}>{busy ? '查询中…' : '查询历史'}</button>
        </div>
      </form>
      {result && <History result={result}/>}
      {product && <Product product={product} catalogDate={catalog.snapshotDate}/>}
    </>}
  </ActionDialog>
}
