import { useRef, useState } from 'react'
import type { ContestWatchConfig } from './plugin-types.ts'
import { configuredInstrument, exchanges, products, withInstrument, withSymbol, selectedContracts, withContracts } from './jev-templates.ts'
import type { ContestAccess } from './contest.ts'
import { FlyInstrumentContract } from './fly/FlyInstrumentContract.tsx'
import type { FuturesProduct } from './jev-products.ts'
import css from './ContestPage.module.css'

export function JevInstrument({ config, onChange, catalog = products, quote, accountKey = '' }: { config: ContestWatchConfig; onChange: (value: ContestWatchConfig) => void; catalog?: readonly FuturesProduct[]; compact?: boolean; quote?: NonNullable<ContestAccess['watch']>['quote']; accountKey?: string }) {
  const [search, setSearch] = useState('')
  const [exchange, setExchange] = useState('')
  const [manualEntry, setManualEntry] = useState(!config.symbol && !config.contracts?.length)
  const current = useRef(config); current.current = config
  const change = (value: ContestWatchConfig) => { current.current = value; onChange(value) }
  const selected = selectedContracts(config, catalog)
  const quoteAccess = useRef<Pick<ContestAccess, 'query'>>()
  if (quote && quoteAccess.current?.query !== quote) quoteAccess.current = { query: quote }
  const instrument = configuredInstrument(config, catalog)
  const known = catalog.some(item => item.product === instrument.product)
  const term = search.trim().toLowerCase()
  const visible = catalog.filter(item => (!exchange || item.exchange === exchange) && `${item.name} ${item.product} ${item.exchange} ${exchanges[item.exchange]}`.toLowerCase().includes(term))
  const parameters = <>
    <label>交易所<select value={instrument.exchange} onChange={event => change(withInstrument(config, { ...instrument, exchange: event.target.value as typeof instrument.exchange }))}>
      {Object.entries(exchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select></label>
    <label>最小价格变动（tick 对应价格）<input type="number" required min="0.000001" step="any" value={instrument.tickSize || ''}
      placeholder="按合约填写" onChange={event => change(withInstrument(config, { ...instrument, tickSize: Number(event.target.value) }))}/></label>
    {known && !instrument.tickSize && <p className={css.jevInstrumentHint}>该品种尚无本地 tick 参数，请按实际合约规格填写最小价格变动。</p>}
  </>
  return <div className="qs-jev-instruments">
    <details className="qs-instrument-browser" open><summary>勾选期货品种 · 已选 {selected.length} 个</summary><div className="qs-product-filters"><label>搜索期货品种<input type="search" placeholder="名称、代码或交易所" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <label>筛选交易所<select value={exchange} onChange={event => setExchange(event.target.value)}><option value="">全部交易所</option>{Object.entries(exchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label></div>
      <div className="qs-product-checklist" aria-label="可选期货品种">{visible.map(item => <label key={item.product}>
        <input type="checkbox" disabled={!item.enabled} checked={selected.some(value => value.instrument.product === item.product)} onChange={event => {
          setManualEntry(false)
          const entries = selectedContracts(current.current, catalog)
          change(withContracts(current.current, event.target.checked ? [...entries, { symbol: '', instrument: { product: item.product, exchange: item.exchange, tickSize: item.tickSize } }] : entries.filter(value => value.instrument.product !== item.product)))
        }}/><span>{item.name}<small>{item.product.toUpperCase()} · {item.enabled ? item.exchange : '柜台未启用'}</small></span>
      </label>)}{!visible.length && <p>没有匹配品种，可在下方手动填写合约。</p>}</div>
    </details>
    <div className="qs-selected-contracts">{selected.length > 0 && !manualEntry && <strong>实际合约 · {selected.length} 个品种</strong>}
    {selected.length && !manualEntry ? selected.map((item, index) => {
      const name = catalog.find(p => p.product === item.instrument.product)?.name ?? item.instrument.product.toUpperCase()
      return <section key={index === 0 ? 'primary' : item.instrument.product} className="qs-selected-contract">
        <header><b>{name} <small>{item.instrument.product.toUpperCase()}</small></b><button type="button" aria-label={`移除${name}`} onClick={() => change(withContracts(current.current, selectedContracts(current.current, catalog).filter(entry => entry.instrument.product !== item.instrument.product)))}>×</button></header>
        <FlyInstrumentContract product={item.instrument.product} label={name} inputLabel={index === 0 ? '实际合约' : `${name}实际合约`} symbol={item.symbol} invalid={false} contest={quoteAccess.current} accountKey={accountKey} onSymbolChange={(symbol, onlyIfEmpty) => {
          if (index === 0 && !onlyIfEmpty) { change(withSymbol(current.current, symbol, catalog)); return }
          const entries = selectedContracts(current.current, catalog)
          change(withContracts(current.current, entries.map(entry => entry.instrument.product === item.instrument.product && (!onlyIfEmpty || !entry.symbol.trim()) ? { ...entry, symbol } : entry)))
        }}/>
        <details open={!item.instrument.tickSize}><summary>合约参数 · {item.instrument.exchange} · tick {item.instrument.tickSize || '待填写'}</summary>
          <label>{index === 0 ? '最小价格变动（tick 对应价格）' : `${name}最小价格变动`}<input type="number" min="0.000001" step="any" required value={item.instrument.tickSize || ''} onChange={event => change(withContracts(current.current, selectedContracts(current.current, catalog).map(entry => entry.instrument.product === item.instrument.product ? { ...entry, instrument: { ...entry.instrument, tickSize: Number(event.target.value) } } : entry)))}/></label>
        </details>
      </section>
    }) : <label>实际合约<input placeholder="也可直接填写，如 m2701、MA701" value={config.symbol} onChange={event => change(withSymbol(config, event.target.value.trim(), catalog))}/></label>}
    <p className="qs-settings-note">勾选后读取当前主力，也可自行选择月份或填写实际合约。各合约独立采样与判断，轮流查询，共用账户额度。</p></div>
    <details className="qs-instrument-parameters" open={!known || !instrument.tickSize}><summary>手动更换首个品种与交易所</summary>
    <label>交易品种<select value={!known ? 'custom' : instrument.product} onChange={event => {
      const product = catalog.find(item => item.product === event.target.value)
      change(withInstrument(config, product ? { product: product.product, exchange: product.exchange, tickSize: product.tickSize } : { product: '', exchange: instrument.exchange, tickSize: 0 }))
    }}>{Object.entries(exchanges).map(([code, name]) => <optgroup key={code} label={name}>
      {catalog.filter(item => item.exchange === code).map(item => <option key={item.product} value={item.product} disabled={!item.enabled}>{item.name} · {item.product.toUpperCase()}{item.enabled ? '' : ' · 柜台未启用'}</option>)}
    </optgroup>)}<option value="custom">其他品种 / 自定义</option></select></label>
    {selected.length && !manualEntry ? <label>交易所<select value={instrument.exchange} onChange={event => change(withInstrument(config, { ...instrument, exchange: event.target.value as typeof instrument.exchange }))}>{Object.entries(exchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label> : parameters}
    </details>
  </div>
}
