// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { TraderOverview } from '../src/client/fly/TraderOverview.tsx'
import { TradeStatistics } from '../src/client/fly/TradeStatistics.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const fixture = () => ({
  day: '20260930', date_basis: 'trading_day', account_day: '20260930',
  rows: [
    { symbol: 'au2612', product: 'au', long: 1, short: 0, floating_gross: 140, realized_gross: 0, position_reconciled: true, valuation_stale: true },
    { symbol: 'rb2701', product: 'rb', long: 0, short: 0, floating_gross: 0, realized_gross: -100, position_reconciled: true },
  ],
  summary: { realized_net: -110, commission: 10, pending_net_count: 0, realized_gross: -100, floating_gross: 140, fill_count: 3 },
  fills: [{ seq: 1, symbol: 'au2612', time: '21:06:15', time_source: 'counter', direction: '0', offset: '1', volume: 1, price: 900, realized_gross: 100, realized_net: 90, commission: 4, opening_commission: 6, trade_id: '123', order: 'abc', decision_id: 'test' }],
  official: { Balance: 5000000, Commission: 10, day_net: 30 }, note: '未扣费用',
})

it('shows net P&L and switches holdings to billed fills without leaving trading', async () => {
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => fixture() } as Response)
  const onRecords = vi.fn(), onManage = vi.fn()
  render(<TraderOverview activities={[{ id: 1, at: 1700000000, title: '继续观察', detail: 'au2612 · 等待方向明确' }]} {...{ onRecords, onManage }}/>)
  await screen.findByText('-110.00')
  expect(screen.getByText('平仓净盈亏')).toBeTruthy()
  expect(screen.queryByText('已结算净收益')).toBeNull()
  const positions = within(screen.getByRole('region', { name: '当前持仓' }))
  expect(positions.getByRole('rowheader', { name: 'au2612' })).toBeTruthy()
  expect(positions.queryByText('rb2701')).toBeNull()
  expect(positions.getByText('末次报价')).toBeTruthy()
  expect(screen.getByText('交易日 2026-09-30')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '查看成交记录' }))
  expect(screen.getByRole('region', { name: '成交明细', exact: true })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: '手续费' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '+90.00' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '返回持仓' }))
  fireEvent.click(screen.getByRole('button', { name: '查看工作记录' }))
  fireEvent.click(screen.getByRole('button', { name: '管理合约' }))
  expect(onRecords).toHaveBeenCalledOnce(); expect(onManage).toHaveBeenCalledOnce()
  expect(vi.mocked(flyFetch).mock.calls.every(([url, init]) => url.endsWith('/statistics') && !init?.method)).toBe(true)
})

it('keeps unknown valuation distinct from zero and reports unreconciled positions', async () => {
  const data = fixture()
  data.summary.floating_gross = null as unknown as number
  data.rows[0]!.floating_gross = null as unknown as number
  data.rows[0]!.position_reconciled = false
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => data } as Response)
  render(<TraderOverview activities={[]} onRecords={() => {}} onManage={() => {}}/>)
  await screen.findByText('1 个合约待估值')
  expect(screen.getAllByText('—')).toHaveLength(2)
  expect(screen.getByText('持仓核对中')).toBeTruthy()
})

it('opens the real fills view directly from the overview entry', async () => {
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => fixture() } as Response)
  render(<TradeStatistics initialTab="fills"/>)
  expect(await screen.findByRole('columnheader', { name: '成交编号' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '123' })).toBeTruthy()
})

it('never falls back to gross P&L when billing is incomplete', async () => {
  const data = fixture()
  data.summary.realized_net = null as unknown as number
  data.summary.pending_net_count = 1
  data.fills[0]!.realized_net = null as unknown as number
  data.fills[0]!.commission = null as unknown as number
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => data } as Response)
  render(<TraderOverview activities={[]} onRecords={() => {}} onManage={() => {}}/>)
  await screen.findByText('1 笔待核算 · 暂不汇总')
  fireEvent.click(screen.getByRole('button', { name: '查看成交记录' }))
  expect(screen.getByRole('cell', { name: '待核算' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '待回报' })).toBeTruthy()
  expect(screen.queryByText('+100.00')).toBeNull()
})

it('loads a selected date in place and returns to current holdings', async () => {
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => fixture() } as Response)
  render(<TraderOverview activities={[]} onRecords={() => {}} onManage={() => {}}/>)
  await screen.findByText('-110.00')
  fireEvent.click(screen.getByRole('button', { name: '查看成交记录' }))
  fireEvent.change(screen.getByLabelText('成交日期'), { target: { value: '2026-09-29' } })
  await screen.findByText('所选日期成交')
  expect(flyFetch).toHaveBeenCalledWith('/api/fly/v2/statistics?day=20260929', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: '返回持仓' }))
  await screen.findByRole('region', { name: '当前持仓' })
  expect(vi.mocked(flyFetch).mock.calls.at(-1)?.[0]).toBe('/api/fly/v2/statistics')
})

it('filters fill count and fees by contract while preserving the daily net total', async () => {
  const data = fixture()
  data.fills.push({ ...data.fills[0]!, seq: 2, symbol: 'rb2701', commission: 6 })
  vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => data } as Response)
  render(<TraderOverview activities={[]} onRecords={() => {}} onManage={() => {}}/>)
  await screen.findByText('-110.00')
  fireEvent.click(screen.getByRole('button', { name: '查看成交记录' }))
  expect(screen.getByText('10.00 元')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('成交合约筛选'), { target: { value: 'au2612' } })
  const fills = within(screen.getByRole('region', { name: '成交明细', exact: true }))
  expect(fills.getByText('1 笔')).toBeTruthy()
  expect(fills.getByText('所选合约手续费')).toBeTruthy()
  expect(fills.getByText('4.00 元')).toBeTruthy()
  expect(fills.queryByRole('rowheader', { name: 'rb2701' })).toBeNull()
  expect(screen.getByText('-110.00')).toBeTruthy()
})
