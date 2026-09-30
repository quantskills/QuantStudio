import { describe, expect, it } from 'vitest'
import { flyAccount } from '../src/fly-account.ts'

const panda = { totalProfit: 5006746.83, staticProfit: 4997785.88,
  dailyPnl: 8960.95, positionPnl: 3895, cost: 489.05, tradeDate: '20260930' }

describe('competition account P&L normalization', () => {
  it('uses the actual Panda schema and deducts cost exactly once', () => {
    const { official: p, knownDay } = flyAccount(panda, '20260929')
    expect(knownDay).toBe(true)
    expect(p.TradingDay).toBe('20260930')
    expect(p.CloseProfit).toBeCloseTo(5555)
    expect(p.PositionProfit).toBe(3895)
    expect(p.CloseProfit! - p.Commission!).toBeCloseTo(5065.95)
    expect(p.CloseProfit! + p.PositionProfit! - p.Commission!).toBeCloseTo(panda.dailyPnl)
    expect(p.PnlSource).toBe('panda_daily_net_reconciled')
    expect(p.Deposit).toBeNull()
    expect(p.Withdraw).toBeNull()
  })

  it('preserves authoritative close values and genuine zeros', () => {
    const { official: p } = flyAccount({ ...panda, CloseProfit: 0, PositionProfit: 0, Commission: 0 }, '')
    expect(p).toMatchObject({ CloseProfit: 0, PositionProfit: 0, Commission: 0, PnlSource: 'reported_close_profit' })
    expect(flyAccount({ ...panda, totalProfit: 100, staticProfit: 100, dailyPnl: 0, positionPnl: 0, cost: 0 }, '').official.CloseProfit).toBe(0)
  })

  it.each([
    { dailyPnl: null }, { staticProfit: null }, { cost: null }, { positionPnl: null, holdingPnl: 3895 },
    { dailyPnl: 9000 }, { positionPnl: Infinity },
  ])('does not invent P&L from incomplete or inconsistent evidence: %j', patch => {
    expect(flyAccount({ ...panda, ...patch }, '').official.CloseProfit).toBeNull()
  })
})
