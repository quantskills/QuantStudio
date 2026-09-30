import { useEffect, useState } from 'react'
import { flyFetch } from './transport.ts'

export type StatisticValue = number | null
type BilledStatistics = { realized_net: StatisticValue; commission: StatisticValue; pending_net_count: number }
export type PositionRow = BilledStatistics & { symbol: string; product: string; fill_count: number; opening_lots: number; closing_lots: number; long: number; short: number; long_entry: StatisticValue; short_entry: StatisticValue; last_price: StatisticValue; realized_gross: StatisticValue; floating_gross: StatisticValue; total_gross: StatisticValue; position_reconciled: boolean; valuation_stale: boolean }
export type TradeFill = { seq: number; symbol: string; time: string; time_source: string; direction: string; offset: string; volume: number; price: number; realized_gross: StatisticValue; realized_net: StatisticValue; commission: StatisticValue; opening_commission: StatisticValue; trade_id: string; order: string; decision_id: string; unmatched_closing_lots: number }
export type TradeStatisticsData = { day: string; date_basis: 'trading_day' | 'calendar'; account_day: string; rows: PositionRow[]; fills: TradeFill[]; summary: BilledStatistics & { fill_count: number; realized_gross: StatisticValue; floating_gross: StatisticValue }; official: { Balance: StatisticValue; Commission: StatisticValue; day_net: StatisticValue }; note: string }

// Reads the local receipt ledger, without querying the competition counter.
export function useTradeStatistics(day = '') {
  const [data, setData] = useState<TradeStatisticsData>()
  const [error, setError] = useState('')
  useEffect(() => {
    setData(undefined)
    let stopped = false; let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await flyFetch(`/api/fly/v2/statistics${day ? `?day=${day.replaceAll('-', '')}` : ''}`, { signal: controller.signal })
        if (!response.ok) throw new Error('统计暂未刷新，等待服务恢复')
        const result = await response.json() as TradeStatisticsData
        if (!Array.isArray(result.rows) || !Array.isArray(result.fills) || !result.summary) throw new Error('统计暂不可用')
        if (!stopped) { setData(result); setError('') }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : '统计暂不可用') }
      if (!stopped) timer = setTimeout(() => void refresh(), 5000)
    }
    void refresh()
    return () => { stopped = true; clearTimeout(timer); controller.abort() }
  }, [day])
  return { data, error }
}
