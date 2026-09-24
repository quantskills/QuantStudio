import { useState } from 'react'
import { futuresExchanges, futuresProduct, futuresContractPattern, type FuturesExchange } from '@deepseek-ai/dsh-quantskills-session/contracts'
import type { ContestAccess } from '../contest.ts'
import { useJevProducts } from '../jev-catalog.ts'
import { FlyInstrumentContract } from './FlyInstrumentContract.tsx'

export type FlyInstrument = { product: string; symbol: string; exchange: string }
export function FlyInstruments({ instruments, contest, accountKey, invalid, onChange }: {
  instruments: FlyInstrument[]; contest: Pick<ContestAccess, 'query' | 'watch'> | undefined; accountKey: string; invalid: boolean
  onChange: (items: FlyInstrument[] | ((current: FlyInstrument[]) => FlyInstrument[])) => void
}) {
  const { catalog, message, loading, refresh } = useJevProducts(contest?.watch, !!accountKey)
  const [search, setSearch] = useState(''), [exchange, setExchange] = useState('')
  const [custom, setCustom] = useState(''), [customExchange, setCustomExchange] = useState<FuturesExchange>('SHF'), [error, setError] = useState('')
  const term = search.trim().toLowerCase()
  const visible = catalog.filter(p => (!exchange || p.exchange === exchange) && `${p.name} ${p.product} ${futuresExchanges[p.exchange]}`.toLowerCase().includes(term))
  const labelFor = (item: FlyInstrument) => catalog.find(p => p.product === item.product.toLowerCase())?.name || item.product.toUpperCase()
  function addCustom() {
    const symbol = custom.trim(), product = futuresProduct(symbol)
    if (!futuresContractPattern.test(symbol) || !product) { setError('请填写实际合约，例如 MA701、cu2612、l2610F。'); return }
    const known = catalog.find(p => p.product === product)
    if (known && known.exchange !== customExchange) { setError(`该品种属于${futuresExchanges[known.exchange]}，请核对交易所。`); return }
    const current = instruments.find(i => i.product.toLowerCase() === product)
    const item = { product: customExchange === 'CFE' ? product.toUpperCase() : product, symbol, exchange: customExchange }
    onChange(current ? instruments.map(i => i === current ? item : i) : [...instruments, item])
    setCustom(''); setError('')
  }
  return <div className="fv-instruments">
    <details className="fv-catalog-picker" open={!instruments.length}><summary>添加品种 · 全部期货市场</summary><div className="fv-instrument-search">
      <label>搜索期货品种<input type="search" value={search} placeholder="名称、代码或交易所" onChange={e => setSearch(e.target.value)} /></label>
      <label>筛选交易所<select value={exchange} onChange={e => setExchange(e.target.value)}><option value="">全部交易所</option>{Object.entries(futuresExchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <button type="button" disabled={!accountKey || !contest?.watch?.varieties || loading} onClick={() => void refresh()}>{loading ? '正在同步…' : '同步柜台品种'}</button>
    </div>
    <p className="fv-note">{message}</p>
    <div className="fv-product-catalog" aria-label="全部期货品种">
      {visible.map(p => <label key={p.product} className="fv-product-option"><input type="checkbox" checked={instruments.some(i => i.product.toLowerCase() === p.product)} onChange={e => onChange(e.target.checked ? [...instruments, { product: p.exchange === 'CFE' ? p.product.toUpperCase() : p.product, symbol: '', exchange: p.exchange }] : instruments.filter(i => i.product.toLowerCase() !== p.product))} />{p.name} · {p.product}{!p.enabled && <small>柜台未启用</small>}</label>)}
      {!visible.length && <p>没有匹配品种，可在下面手动添加实际合约。</p>}
    </div>
    <details className="fv-data-details"><summary>手动添加其他品种或实际合约</summary><div className="fv-instrument-search">
      <label>自定义实际合约<input value={custom} placeholder="例如 MA701、cu2612、l2610F" onChange={e => { const value = e.target.value; setCustom(value); setError(''); const known = catalog.find(p => p.product === futuresProduct(value.trim())); if (known) setCustomExchange(known.exchange) }} /></label>
      <label>合约交易所<select value={customExchange} onChange={e => setCustomExchange(e.target.value as FuturesExchange)}>{Object.entries(futuresExchanges).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
      <button type="button" disabled={!custom.trim()} onClick={addCustom}>添加合约</button>
    </div>{error && <p role="alert" className="fv-error">{error}</p>}</details>
    </details><h3>已选品种 · {instruments.length}</h3>
    {instruments.map(item => <div className="fv-instrument" key={item.product}>
      <div><strong>{labelFor(item)} · {item.product}</strong><small>{futuresExchanges[item.exchange as FuturesExchange]}</small></div>
      <FlyInstrumentContract product={item.product} label={labelFor(item)} symbol={item.symbol} invalid={invalid && (!futuresContractPattern.test(item.symbol) || futuresProduct(item.symbol) !== item.product.toLowerCase())} contest={contest} accountKey={accountKey} onSymbolChange={(symbol, onlyIfEmpty) => onChange(current => current.map(i => i.product === item.product && (!onlyIfEmpty || !i.symbol.trim()) ? { ...i, symbol } : i))} />
      <button type="button" aria-label={`移除${labelFor(item)}`} onClick={() => onChange(instruments.filter(i => i.product !== item.product))}>移除</button>
    </div>)}
    <p className="fv-note">可选择全部品种或手动添加。能否取得行情及参赛交易，以比赛账户和柜台实际开放情况为准；每个品种配置一个实际合约。</p>
  </div>
}
