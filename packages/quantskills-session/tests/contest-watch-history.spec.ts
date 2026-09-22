import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { prepareWatchHistory, watchHistory } from '../src/contest-watch-history.ts'
import type { ContestWatchConfig } from '../src/contest-watch-types.ts'

const columns = { time: 'datetime', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
const config: ContestWatchConfig = { symbol: 'rb2610', volume: 1, intervalSeconds: 3, durationMinutes: 120, minConfidence: .8, maxEquityDrop: 1000, maxPlans: 5, instructions: 'range',
  history: { datasetId: 'minute-bars', barSeconds: 60, timeMeaning: 'open', refresh: true, columns } }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-18T03:00:00Z')) })
afterEach(() => vi.useRealTimers())
function fixture() {
  const dataset = { id: 'minute-bars', name: 'Panda minutes', kind: 'timeseries', category: 'market', columns: Object.values(columns), fetchedAt: new Date().toISOString(), source: { kind: 'pandadata', method: 'get_future_min', params: { frequency: '1m' } } }
  const row = { symbol: 'RB2610.SHF', datetime: '2026-09-18 10:59:00', open: 3000, high: 3002, low: 2999, close: 3001 }
  const result = { status: 'ok', dataset, rows: [row, { ...row, symbol: 'AU2612.SHF' }, { ...row, datetime: '2026-09-18 11:00:00' }], total: 3 }
  const gateway = { databaseList: vi.fn(async () => [dataset]), databaseQuery: vi.fn(async () => result), databaseFetch: vi.fn(async () => dataset) }
  return { dataset, result, gateway, ctx: { get: () => gateway } as unknown as Context }
}
it.each(['m2701.DCE', 'MA701.CZC', 'IF2612.CFE', 'sc2611.INE', 'lc2611.GFE', 'l2610F.DCE'])('prepares exact exchange-qualified history for %s', async symbol => {
  const f = fixture()
  await prepareWatchHistory(f.ctx, { symbol, barSeconds: 60 })
  expect(f.gateway.databaseFetch).toHaveBeenCalledWith(expect.objectContaining({ source: expect.objectContaining({ params: expect.objectContaining({ symbol: symbol.toUpperCase(), frequency: '1m' }) }) }), undefined)
})
it('fetches PandaData minute bars through the app gateway with a bounded date window', async () => {
  const f = fixture(), result = await prepareWatchHistory(f.ctx, { symbol: 'rb2610.shf', barSeconds: 300 })
  expect(result).toMatchObject({ datasetId: 'minute-bars', barSeconds: 300, refresh: true, timeMeaning: 'close' })
  expect(f.gateway.databaseFetch).toHaveBeenCalledWith(expect.objectContaining({ ttlSeconds: 60, source: { kind: 'pandadata', method: 'get_future_min', rollingDay: true, params: expect.objectContaining({ symbol: 'RB2610.SHF', frequency: '5m', start_date: '20260918', end_date: '20260921' }) } }), undefined)
  await expect(prepareWatchHistory(f.ctx, { symbol: 'RB_DOMINANT.SHF', barSeconds: 60 })).rejects.toThrow('实际合约')
  expect(f.gateway.databaseFetch).toHaveBeenCalledOnce()
})
it('uses the configured refresh policy and admits only completed bars of the exact contract', async () => {
  const f = fixture(), signal = new AbortController().signal
  const result = await watchHistory(f.ctx, config, signal)
  expect(result.bars).toEqual([{ time: Date.now(), open: 3000, high: 3002, low: 2999, close: 3001 }])
  expect(f.gateway.databaseQuery).toHaveBeenCalledWith({ id: 'minute-bars', limit: 5000, refresh: true, to: '2026-09-18' }, signal)
  await watchHistory(f.ctx, { ...config, history: { ...config.history!, refresh: false } }, signal)
  expect(f.gateway.databaseQuery).toHaveBeenLastCalledWith(expect.objectContaining({ refresh: false }), signal)
})
it('corrects legacy automatic PandaData open-time settings without shifting close timestamps or admitting forming bars', async () => {
  const f = fixture(), signal = new AbortController().signal
  f.result.rows.push({ ...f.result.rows[0]!, datetime: '2026-09-18 11:01:00' })
  f.result.total++
  const result = await watchHistory(f.ctx, { ...config, autoHistory: { exchange: 'SHF', barSeconds: 60 } }, signal)
  expect(result.bars.map(bar => bar.time)).toEqual([Date.now() - 60000, Date.now()])
  // Manually mapped sources retain the user's explicit time meaning.
  const manual = await watchHistory(f.ctx, config, signal)
  expect(manual.bars.map(bar => bar.time)).toEqual([Date.now()])
})
it('reuses an exact rolling source without creating duplicate datasets, but never reuses another contract or period', async () => {
  const f = fixture()
  Object.assign(f.dataset.source, { rollingDay: true, params: { symbol: 'RB2610.SHF', frequency: '1m' } })
  expect((await prepareWatchHistory(f.ctx, { symbol: 'RB2610.SHF', barSeconds: 60 })).datasetId).toBe('minute-bars')
  expect(f.gateway.databaseFetch).not.toHaveBeenCalled()
  await prepareWatchHistory(f.ctx, { symbol: 'RB2611.SHF', barSeconds: 60 })
  expect(f.gateway.databaseFetch).toHaveBeenCalledOnce()
  await prepareWatchHistory(f.ctx, { symbol: 'RB2610.SHF', barSeconds: 300 })
  expect(f.gateway.databaseFetch).toHaveBeenCalledTimes(2)
})
it('rejects mismatched periods, insufficient caches and oversized datasets', async () => {
  const f = fixture(), signal = new AbortController().signal
  expect((await watchHistory(f.ctx, { ...config, history: { ...config.history!, barSeconds: 300 } }, signal)).issue).toContain('周期')
  expect(f.gateway.databaseQuery).not.toHaveBeenCalled()
  f.result.status = 'insufficient'
  expect((await watchHistory(f.ctx, config, signal)).bars).toEqual([])
  f.result.status = 'ok'; f.result.total = 5001
  expect((await watchHistory(f.ctx, config, signal)).issue).toContain('5000')
})
it('does not leak provider errors and propagates cancellation', async () => {
  const f = fixture(), controller = new AbortController()
  f.gateway.databaseQuery.mockRejectedValue(new Error('private-provider-secret'))
  expect((await watchHistory(f.ctx, config, controller.signal)).issue).not.toContain('private-provider-secret')
  expect((await watchHistory(f.ctx, config, controller.signal)).diagnostic).toEqual({ stage: 'query', code: 'READ_FAILED', retryable: true })
  f.gateway.databaseQuery.mockRejectedValue(new Error('ETIMEDOUT private-provider-secret'))
  const timeout = await watchHistory(f.ctx, config, controller.signal)
  expect(timeout.diagnostic).toEqual({ stage: 'query', code: 'TIMEOUT', retryable: true })
  expect(timeout.issue).not.toContain('登录')
  f.gateway.databaseQuery.mockRejectedValue(new Error('HTTP 401 private-provider-secret'))
  expect((await watchHistory(f.ctx, config, controller.signal)).diagnostic).toEqual({ stage: 'query', code: 'AUTH_REQUIRED', retryable: false })
  controller.abort()
  await expect(watchHistory(f.ctx, config, controller.signal)).rejects.toThrow()
})
