import { useEffect, useRef, useState } from 'react'
import { futuresProduct } from '@deepseek-ai/dsh-quantskills-session/contracts'
import { waitForCompetition } from '../competition-async.ts'
import type { ContestAccess } from '../contest.ts'
function contractCode(data: unknown, product: string): string {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const raw = row.contractCode ?? row.symbol
  const code = typeof raw === 'string' ? raw.split('.')[0]!.trim() : ''
  if (futuresProduct(code) !== product.toLowerCase()) throw new Error('比赛行情未返回该品种的实际合约代码。')
  return code
}
export function deliveryMonths(product: string, main: string): string[] {
  const match = /^([a-z]+)([0-9]{3,4})(f?)$/i.exec(main)
  if (!match || futuresProduct(main) !== product.toLowerCase()) return []
  const digits = match[2]!, width = digits.length - 2, month = Number(digits.slice(-2))
  if (month < 1 || month > 12) return []
  const year = Number(digits.slice(0, -2))
  return Array.from({ length: 12 }, (_, offset) => {
    const date = new Date(Date.UTC(2000 + year, month + offset, 1))
    return `${match[1]}${String(date.getUTCFullYear() % (10 ** width)).padStart(width, '0')}${String(date.getUTCMonth() + 1).padStart(2, '0')}${match[3]}`
  })
}
export function FlyInstrumentContract({ product, label, symbol, invalid, contest, accountKey, onSymbolChange }: {
  product: string; label: string; symbol: string; invalid: boolean; contest?: Pick<ContestAccess, 'query'> | undefined; accountKey: string
  onSymbolChange: (value: string, onlyIfEmpty?: boolean) => void
}) {
  const [main, setMain] = useState(''), [message, setMessage] = useState(''), [checking, setChecking] = useState(false)
  const request = useRef(0), updateSymbol = useRef(onSymbolChange)
  updateSymbol.current = onSymbolChange
  useEffect(() => {
    setMain(''); setChecking(false)
    if (!contest || !accountKey) { setMessage('先点击上方「连接比赛账户」，无需填写合约。也可手动填写实际合约。'); return }
    if (product.toLowerCase().endsWith('_f')) { setMessage('月均价品种请手动填写带 F 后缀的实际合约，避免解析成普通月份合约。'); return }
    const controller = new AbortController(), id = ++request.current
    setChecking(true); setMessage('正在查询当前主力合约…')
    void waitForCompetition(signal => contest.query({ kind: 'quote', symbol: product }, signal), '主力合约查询', 30_000, controller.signal)
      .then(result => { if (id !== request.current) return; const code = contractCode(result.data, product); setMain(code); updateSymbol.current(code, true); setMessage(`当前主力 ${code} · 来自比赛行情`) })
      .catch(error => { if (id === request.current) setMessage(`主力查询失败：${String(error).replace(/^(?:Error|RemoteFailure): /, '')} 可手动填写实际合约。`) })
      .finally(() => { if (id === request.current) setChecking(false) })
    return () => { request.current++; controller.abort() }
  }, [contest, product, accountKey])
  async function selectMonth(code: string) {
    if (!code) return
    if (code === main) { onSymbolChange(code); setMessage(`当前主力 ${code} · 来自比赛行情`); return }
    if (!contest) return
    const id = ++request.current
    setChecking(true); setMessage(`正在核对 ${code}…`)
    try {
      const result = await waitForCompetition(signal => contest.query({ kind: 'quote', symbol: code }, signal), '月份合约查询', 30_000)
      if (id !== request.current) return
      if ((result.data && typeof result.data === 'object' && !Array.isArray(result.data) && result.data.ready === false) || contractCode(result.data, product).toLowerCase() !== code.toLowerCase()) throw new Error('比赛行情未确认该月份合约。')
      updateSymbol.current(code); setMessage(`${code} 已由比赛行情确认`)
    } catch (error) { if (id === request.current) setMessage(`${code} 无法确认：${String(error).replace(/^(?:Error|RemoteFailure): /, '')}`) }
    finally { if (id === request.current) setChecking(false) }
  }
  const months = main ? deliveryMonths(product, main) : []
  return <div className="fv-contract-choice"><input aria-label={`${label}实际合约`} aria-invalid={invalid} placeholder="填写实际合约代码" value={symbol} onChange={e => { request.current++; setChecking(false); onSymbolChange(e.target.value.trim()); setMessage('手动填写的合约将在交易前核对。') }} /><select aria-label={`${label}合约月份`} value={[main, ...months].includes(symbol) ? symbol : ''} disabled={!main || checking} onChange={e => void selectMonth(e.target.value)}><option value="">选择合约月份</option>{main && <option value={main}>主力 · {main}</option>}{months.map(code => <option key={code} value={code}>{code} · 候选月份</option>)}</select><small role="status">{message || '选择品种后查询主力合约'}</small></div>
}
