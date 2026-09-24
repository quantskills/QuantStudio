import { useEffect, useRef, useState } from 'react'
import css from './FlyHistory.module.css'

export type HistoryStatus = { status: string; last_success_at?: number | null; retry_at?: number | null; source?: string; blocked?: boolean }
export function useRetryCountdown(retryAt?: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    setNow(Date.now())
    if (!retryAt || retryAt * 1000 <= Date.now()) return
    const timer = setInterval(() => { setNow(Date.now()); if (Date.now() >= retryAt * 1000) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  return Math.max(0, Math.ceil(((retryAt ?? 0) * 1000 - now) / 1000))
}
export type HistoryMarket = { product: string; symbol?: string; count: number; history_source?: { at?: number | null; error?: string } }
export const marketReadiness: Record<string, string> = { ready: '行情就绪', history_incomplete: '等待历史补齐', history_gap: '分钟线有缺口', quote_stale: '等待新鲜报价', bars_stale: '等待分钟线' }
const updated = (at?: number | null) => at ? new Date(at * 1000).toLocaleString('zh-CN', { hour12: false }) : '尚未成功获取'

export function FlyHistory({ history, error, markets, enabled, onRefresh }: {
  history?: HistoryStatus | undefined; error?: string | undefined; markets: HistoryMarket[]; enabled: boolean; onRefresh(): Promise<void>
}) {
  const [pending, setPending] = useState(false), [failure, setFailure] = useState('')
  const submitting = useRef(false)
  const running = pending || history?.status === 'running'
  const cooldown = useRetryCountdown(history?.retry_at)
  useEffect(() => { if (history?.status === 'complete') setFailure('') }, [history?.last_success_at, history?.status])
  async function refresh() {
    if (submitting.current || running || cooldown || !enabled) return
    submitting.current = true; setPending(true); setFailure('')
    try { await onRefresh() }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : '历史获取未完成，请重试。') }
    finally { submitting.current = false; setPending(false) }
  }
  return <section className={css.history} aria-label="PandaData 历史数据" aria-busy={running}>
    <div className={css.heading}><div><strong>PandaData 历史数据</strong><p>首次补齐 500 根；之后按 1／5 分钟周期补最新数据与缺口，休市减少请求，重启复用缓存。</p></div>
      <button type="button" disabled={!enabled || running || cooldown > 0} onClick={() => void refresh()}>{running ? '正在获取历史数据…' : cooldown ? `冷却中 · ${cooldown} 秒` : '获取历史数据'}</button></div>
    <p role="status">{cooldown ? `${history?.source === 'competition' ? '比赛接口' : 'PandaData'}将在 ${cooldown} 秒后重试。` : running ? '正在后台获取，切换页面后继续。' : history?.blocked ? '请检查连接或授权，处理后点击获取历史数据。' : history?.status === 'error' ? '本次获取未完成，可重试。' : history?.status === 'complete' ? '本次获取完成，完整性见各合约状态。' : '等待自动补齐或手动获取。'} 最近全部成功：{updated(history?.last_success_at)}</p>
    {!enabled && <p>请先保存「行情配置」，再点击「连接比赛行情」；PandaData 授权在 QuantStudio 设置中完成。</p>}
    {markets.length > 0 && <ul>{markets.map(market => <li key={market.product}><span><b>{market.symbol || market.product}</b> · {market.count}/500 根</span><span>最近成功：{updated(market.history_source?.at)}</span>{market.history_source?.error && <span className={css.error}>{market.history_source.error}</span>}</li>)}</ul>}
    {(failure || error) && <p role="alert" className={css.error}>{failure || error}</p>}
  </section>
}
