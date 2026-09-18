import type { ContestWatchConfig } from './plugin-types.ts'
import { exchanges, instrumentFor, products, withInstrument, withSymbol } from './jev-templates.ts'

export function JevInstrument({ config, onChange }: { config: ContestWatchConfig; onChange: (value: ContestWatchConfig) => void }) {
  const inferred = instrumentFor(config.symbol)
  const instrument = config.instrument ?? { ...inferred, exchange: config.autoHistory?.exchange ?? inferred.exchange, tickSize: config.rangeRules?.tickSize ?? config.signalRules?.tickSize ?? inferred.tickSize }
  const known = products.some(item => item.product === instrument.product)
  return <>
    <label>交易品种<select value={!known ? 'custom' : instrument.product} onChange={event => {
      const product = products.find(item => item.product === event.target.value)
      onChange(withInstrument(config, product ? { product: product.product, exchange: product.exchange, tickSize: product.tickSize } : { product: '', exchange: 'SHF', tickSize: 0 }))
    }}>{products.map(item => <option key={item.product} value={item.product}>{item.name} · {item.product.toUpperCase()}</option>)}<option value="custom">其他品种 / 自定义</option></select></label>
    <label>实际合约<input required pattern="[a-zA-Z]{1,3}[0-9]{3,4}" placeholder="例如 rb2610、au2612、IF2609" value={config.symbol}
      onChange={event => onChange(withSymbol(config, event.target.value.trim()))}/></label>
    <label>交易所<select value={instrument.exchange} onChange={event => onChange(withInstrument(config, { ...instrument, exchange: event.target.value as typeof instrument.exchange }))}>
      {Object.entries(exchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select></label>
    <label>最小价格变动（tick 对应价格）<input type="number" required min="0.000001" step="any" value={instrument.tickSize || ''}
      placeholder="按合约填写" onChange={event => onChange(withInstrument(config, { ...instrument, tickSize: Number(event.target.value) }))}/></label>
  </>
}
