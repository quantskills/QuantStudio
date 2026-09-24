// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { FlyMarketView } from '../src/client/fly/FlyMarketView.tsx'
afterEach(cleanup)

it('shows a genuine empty state instead of generating a price curve', () => {
  render(<FlyMarketView observing onDetails={() => {}}/>)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('等待行情')).toBeTruthy()
  expect(screen.getByText('持仓待同步')).toBeTruthy()
})

it('labels historical data and a stale quote without presenting it as live', () => {
  render(<FlyMarketView observing market={{ product: 'cu', symbol: 'cu2611', price: 100, chart: [99, 101, 100], count: 3, readiness: 'quote_stale', long: 1, short: 0, quote_at: 1700000000 }} onDetails={() => {}}/>)
  expect(screen.getByText('末次报价 · 等待有效行情')).toBeTruthy()
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('最低 99，最高 101')
  expect(screen.getByText(/报价时间/)).toBeTruthy()
  expect(screen.getByText('多 1 / 空 0 手')).toBeTruthy()
})
