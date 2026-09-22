import { useState } from 'react'
import type { ContestWatchConfig } from './plugin-types.ts'
import { configuredInstrument, exchanges, products, withInstrument, withSymbol } from './jev-templates.ts'
import type { FuturesProduct } from './jev-products.ts'
import css from './ContestPage.module.css'

export function JevInstrument({ config, onChange, catalog = products }: { config: ContestWatchConfig; onChange: (value: ContestWatchConfig) => void; catalog?: readonly FuturesProduct[] }) {
  const [search, setSearch] = useState('')
  const instrument = configuredInstrument(config, catalog)
  const known = catalog.some(item => item.product === instrument.product)
  const term = search.trim().toLowerCase()
  const visible = catalog.filter(item => item.product === instrument.product || `${item.name} ${item.product} ${item.exchange} ${exchanges[item.exchange]}`.toLowerCase().includes(term))
  return <>
    <label>搜索期货品种<input type="search" placeholder="名称、代码或交易所" value={search} onChange={event => setSearch(event.target.value)}/></label>
    <label>交易品种<select value={!known ? 'custom' : instrument.product} onChange={event => {
      const product = catalog.find(item => item.product === event.target.value)
      onChange(withInstrument(config, product ? { product: product.product, exchange: product.exchange, tickSize: product.tickSize } : { product: '', exchange: instrument.exchange, tickSize: 0 }))
    }}>{Object.entries(exchanges).map(([code, name]) => <optgroup key={code} label={name}>
      {visible.filter(item => item.exchange === code).map(item => <option key={item.product} value={item.product} disabled={!item.enabled}>{item.name} · {item.product.toUpperCase()}{item.enabled ? '' : ' · 柜台未启用'}</option>)}
    </optgroup>)}<option value="custom">其他品种 / 自定义</option></select></label>
    <label>实际合约<input required pattern="[a-zA-Z]{1,3}[0-9]{3,4}[fF]?" placeholder="如 m2701、MA701、l2610F" value={config.symbol}
      onChange={event => onChange(withSymbol(config, event.target.value.trim(), catalog))}/></label>
    <label>交易所<select value={instrument.exchange} onChange={event => onChange(withInstrument(config, { ...instrument, exchange: event.target.value as typeof instrument.exchange }))}>
      {Object.entries(exchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select></label>
    <label>最小价格变动（tick 对应价格）<input type="number" required min="0.000001" step="any" value={instrument.tickSize || ''}
      placeholder="按合约填写" onChange={event => onChange(withInstrument(config, { ...instrument, tickSize: Number(event.target.value) }))}/></label>
    {known && !instrument.tickSize && <p className={css.jevInstrumentHint}>该品种尚无本地 tick 参数，请按实际合约规格填写最小价格变动。</p>}
  </>
}
