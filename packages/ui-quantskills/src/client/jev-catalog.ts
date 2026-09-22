import { useCallback, useEffect, useRef, useState } from 'react'
import { futuresExchanges, futuresProductPattern, type FuturesExchange } from '@deepseek-ai/dsh-quantskills-session/contracts'
import type { ContestAccess } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import { catalogCheckedAt, products, type FuturesProduct } from './jev-products.ts'

/** Official varieties metadata only; never resolves a delivery month or requests market quotes. */
export function parseVarieties(value: unknown): FuturesProduct[] {
  const body = value as { items?: unknown; total?: unknown }
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 1000 || body.total !== body.items.length) throw new Error('柜台品种目录不完整，请稍后重新同步。')
  const seen = new Set<string>()
  return body.items.map(value => {
    const item = value as { code?: unknown; name?: unknown; exchange?: unknown; enabled?: unknown }
    if (!item || typeof item.code !== 'string' || !futuresProductPattern.test(item.code) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80
      || typeof item.exchange !== 'string' || !Object.hasOwn(futuresExchanges, item.exchange) || typeof item.enabled !== 'boolean') throw new Error('柜台品种目录格式不匹配，请检查比赛 CLI 版本。')
    const product = item.code.toLowerCase(), exchange = item.exchange as FuturesExchange
    if (seen.has(product)) throw new Error('柜台品种目录存在重复代码，请核对交易所后手动配置。')
    seen.add(product)
    const preset = products.find(row => row.product === product && row.exchange === exchange)
    // The varieties protocol does not return a price tick. Unknown metadata must stay visibly unset.
    return { product, name: item.name, exchange, tickSize: preset?.tickSize ?? 0, enabled: item.enabled }
  })
}

export function useJevProducts(access: NonNullable<ContestAccess['watch']>, connected: boolean) {
  const [catalog, setCatalog] = useState<readonly FuturesProduct[]>(products)
  const [message, setMessage] = useState(`本地目录 · ${catalogCheckedAt} · ${products.length} 个品种`)
  const [loading, setLoading] = useState(false), generation = useRef(0), controller = useRef<AbortController>()
  const refresh = useCallback(async () => {
    if (!connected || !access.varieties) return
    controller.current?.abort()
    const active = new AbortController(), version = ++generation.current
    controller.current = active; setLoading(true)
    try {
      const result = await waitForCompetition(() => access.varieties!(active.signal), '柜台品种目录', 30000, active.signal)
      const next = parseVarieties(result.data)
      if (version !== generation.current || active.signal.aborted) return
      setCatalog(next); setMessage(`已同步柜台目录 · ${next.length} 个品种 · ${next.filter(item => item.enabled).length} 个已启用`)
    } catch (error) {
      if (version === generation.current && !active.signal.aborted) setMessage(`${error instanceof Error ? error.message : '品种目录同步失败。'} 保留现有目录，仍可手动填写合约。`)
    } finally { if (version === generation.current && !active.signal.aborted) setLoading(false) }
  }, [access, connected])
  useEffect(() => {
    setCatalog(products); setMessage(`本地目录 · ${catalogCheckedAt} · ${products.length} 个品种`); setLoading(false)
    void refresh()
    return () => { generation.current++; controller.current?.abort() }
  }, [refresh])
  return { catalog, message, loading, refresh }
}
