// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TradeAnalytics } from '../src/client/fly/TradeAnalytics.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
vi.mock('echarts', () => ({ init: vi.fn((host: HTMLElement) => {
  host.appendChild(document.createElement('canvas'))
  return { setOption: vi.fn(), resize: vi.fn(), dispose: () => host.replaceChildren() }
}) }))

const emptyData = {
  day: '20260930', start_day: '20260930', end_day: '20260930', period: '1m', days: ['20260930', '20260929'],
  generated_at: 1790744400, account_at: null, account_stale: true,
  official: { Balance: null, CloseProfit: null, PositionProfit: null, Commission: null, day_net: null },
  summary: { fills: 0, closing_fills: 0, matched_closes: 0, unmatched_closes: 0, wins: 0, losses: 0, breakeven: 0, win_rate: null, profit_factor: null, realized_gross: null, max_drawdown: null, max_drawdown_pct: null },
  coverage: { samples: 0, first_at: null, last_at: null, gaps: 0, observation_samples: 0, cash_flow_unknown: true, cash_flow_changed: false },
  equity: [], realized_curve: [], products: [], fills: [], periods: [], gaps: [], note: '缺失费用不按零计算。',
  period_summary: { recorded_days: 0, realized_net: null, day_net: null, CloseProfit: null, PositionProfit: null, Commission: null },
  equity_baseline: { value: null, at: null, method: 'unknown' },
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.mocked(flyFetch).mockReset().mockImplementation(async path => {
    const query = new URL(String(path), 'http://localhost').searchParams
    return { ok: true, json: async () => ({ ...emptyData, period: query.get('period') || '1m', start_day: query.get('start_day') || '20260930', end_day: query.get('end_day') || '20260930' }) } as Response
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('trading analytics filters and missing data', () => {
  it('opens fills directly, preserves pagination across views and supports keyboard tab selection', async () => {
    vi.mocked(flyFetch).mockImplementation(async path => ({ ok: true, json: async () => ({ ...emptyData,
      period: new URL(String(path), 'http://localhost').searchParams.get('period'),
      summary: { ...emptyData.summary, fills: 21 },
      fills: Array.from({ length: 21 }, (_, seq) => ({ seq, trading_day: '20260930', time: '10:00:00', time_source: 'counter', symbol: `rb${seq}`, offset: '0', direction: '0', volume: 1, price: 100, realized_gross: null, trade_id: `fill-${seq}` })),
    }) } as Response))
    render(<TradeAnalytics active traderDetails={<div>当日柜台盈亏内容</div>}/>)
    const fillsTab = await screen.findByRole('tab', { name: /成交明细\s*21/ })
    expect(fillsTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('当日柜台盈亏内容')).toBeNull()
    expect(within(screen.getByRole('tabpanel')).getByText('fill-0')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(within(screen.getByRole('tabpanel')).getByText('fill-20')).toBeTruthy()
    fireEvent.keyDown(fillsTab, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '周期统计' }))
    expect(screen.getByRole('tabpanel').textContent).toContain('所选范围暂无周期记录')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: '周期平仓盈亏' })).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(screen.getByRole('tabpanel').textContent).toContain('当日柜台盈亏内容')
    expect(screen.getByRole('tabpanel').textContent).toContain('独立于上方日期范围')
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(within(screen.getByRole('tabpanel')).getByText('fill-20')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '周期统计' }))
    fireEvent.change(screen.getByLabelText('图表周期'), { target: { value: 'raw' } })
    await screen.findByRole('tab', { name: /成交明细\s*21/ })
    expect(screen.queryByRole('tab', { name: '周期统计' })).toBeNull()
    expect(screen.getByRole('tab', { name: /成交明细\s*21/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('fill-20')
  })

  it('validates the submitted dates and fetches the exact custom range', async () => {
    render(<TradeAnalytics active/>)
    fireEvent.click(await screen.findByRole('button', { name: '2026-09-30', exact: true }))
    fireEvent.change(screen.getByLabelText('开始交易日'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: '应用日期' }))
    expect(screen.getByRole('status').textContent).toContain('开始日期不能晚于结束日期')
    expect(flyFetch).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('开始交易日'), { target: { value: '2026-09-29' } })
    fireEvent.click(screen.getByRole('button', { name: '应用日期' }))
    await screen.findByRole('button', { name: '2026-09-29 — 2026-09-30' })
    expect(String(vi.mocked(flyFetch).mock.calls.at(-1)?.[0])).toContain('start_day=20260929&end_day=20260930')
    expect(screen.queryByLabelText('开始交易日')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps unknown net returns unknown while curve and period controls remain usable', async () => {
    render(<TradeAnalytics active/>)
    await screen.findByRole('heading', { name: '累计平仓净盈亏' })
    expect(screen.getAllByText('待补齐')).toHaveLength(2)
    expect(screen.getByText('所选范围的历史快照缺少盈亏分项，无法还原累计净收益；可查看有完整记录的单日。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '回撤', exact: true }))
    expect(screen.getByRole('heading', { name: '账户回撤' })).toBeTruthy()
    expect(screen.getByText('至少需要两个真实权益采样。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '图表显示设置' }))
    fireEvent.change(screen.getByLabelText('权益缺口显示'), { target: { value: 'bridge' } })
    expect(flyFetch).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('图表周期'), { target: { value: '1d' } })
    await waitFor(() => expect(String(vi.mocked(flyFetch).mock.calls.at(-1)?.[0])).toContain('period=1d'))
    await screen.findByRole('heading', { name: '账户回撤' })
    expect(screen.getAllByText('待补齐')).toHaveLength(2)
  })

  it('switches repeatedly between a rendered chart and missing-data views without losing the page', async () => {
    vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => ({ ...emptyData,
      period: 'raw', equity: [{ at: 1790744400, Balance: 1000, drawdown: 0, gap_before: false }, { at: 1790744460, Balance: 990, drawdown: -10, gap_before: false }],
    }) } as Response)
    render(<TradeAnalytics active/>)
    await screen.findByRole('heading', { name: '累计平仓净盈亏' })
    for (const label of ['回撤', '平仓权益', '回撤', '净盈亏', '回撤']) {
      fireEvent.click(screen.getByRole('button', { name: label, exact: true }))
      expect(screen.getByRole('heading', { name: '交易表现' })).toBeTruthy()
    }
    expect(screen.getByRole('img', { name: /账户回撤/ }).querySelector('canvas')).toBeTruthy()
  })

  it('shows corrected net totals and equity after earlier incomplete samples', async () => {
    vi.mocked(flyFetch).mockResolvedValue({ ok: true, json: async () => ({ ...emptyData,
      period: 'raw', coverage: { ...emptyData.coverage, samples: 2, pnl_samples: 1, pnl_first_at: 1790744460 },
      period_summary: { recorded_days: 1, realized_net: 5065.95, day_net: 8960.95, CloseProfit: 5555, PositionProfit: 3895, Commission: 489.05 },
      equity_baseline: { value: 4997785.88, at: 1790744460, method: 'complete sample' },
      equity: [{ at: 1790744400, Balance: 5000000, cumulative_net: null, realized_equity: null, gap_before: false },
        { at: 1790744460, Balance: 5006746.83, cumulative_net: 5065.95, realized_equity: 5002851.83, gap_before: false }],
    }) } as Response)
    render(<TradeAnalytics active/>)
    await screen.findByRole('img', { name: /累计平仓净盈亏/ })
    expect(screen.queryByText('待补齐')).toBeNull()
    expect(screen.getAllByText('+5,065.95')).toHaveLength(2)
    expect(screen.getAllByText('+8,960.95')).toHaveLength(2)
    expect(screen.getByText(/此前曲线保留空白/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '平仓权益', exact: true }))
    expect(screen.getByRole('img', { name: /平仓权益曲线/ }).querySelector('canvas')).toBeTruthy()
  })
})
