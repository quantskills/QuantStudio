import { describe, expect, it } from 'vitest'
import { mergePlanFills } from '../src/contest-fills.ts'
import type { ContestPlan } from '../src/contest-types.ts'

function fixture() {
  const now = Date.now()
  const plan: ContestPlan = { id: 'plan', sessionId: 'session', identity: { accountId: 'account', contestId: 'contest' }, operation: 'place_order',
    createdAt: now - 1000, expiresAt: now + 60000, clientRequestId: 'request', summary: 'test', status: 'completed',
    details: { parameters: { contractCode: 'ag2612', side: 'buy', offset: 'open', volume: 3 }, marketQuote: { latestPrice: 99999 } },
    result: { latestOrder: { orderId: 'order', contractCode: 'AG2612.SHF', price: 88888 } } }
  const trade = { id: 'fill', tradeId: 'trade', orderId: 'order', contractCode: 'AG2612.SHF', side: 'buy', offset: 'open', price: 16299, volume: 1, tradeTime: new Date(now).toISOString() }
  return { plan, trade }
}
describe('actual execution evidence', () => {
  it('matches monthly-average fills without mixing them with the regular contract', () => {
    const { plan, trade } = fixture()
    plan.details.parameters = { contractCode: 'l2610F', side: 'buy', offset: 'open', volume: 3 }
    plan.result = { latestOrder: { orderId: 'order', contractCode: 'L2610F.DCE' } }
    expect(mergePlanFills(plan, [{ ...trade, contractCode: 'L2610.DCE' }])).toBe(false)
    expect(mergePlanFills(plan, [{ ...trade, contractCode: 'L2610F.DCE' }])).toBe(true)
  })
  it('merges partial fills and overlapping pages without counting a fill twice', () => {
    const { plan, trade } = fixture()
    expect(mergePlanFills(plan, [trade])).toBe(true)
    expect(mergePlanFills(plan, [trade, { ...trade, id: 'fill-2', tradeId: 'trade-2', volume: 2, price: 16302 }])).toBe(true)
    expect(plan.fills).toHaveLength(2)
    expect(mergePlanFills(plan, [trade])).toBe(false)
    expect(plan.fills?.reduce((sum, fill) => sum + fill.volume, 0)).toBe(3)
  })
  it.each([{ orderId: 'another' }, { contractCode: 'AG2611.SHF' }, { contractCode: 'AG2612.DCE' }, { side: 'sell' }, { offset: 'close' },
    { accountId: 'other-account' }, { price: 0 }, { price: Infinity }, { volume: 0 }, { volume: 4 }, { tradeTime: '2020-01-01 09:00:00' }])('refuses a mismatched or invalid fill: %j', change => {
    const { plan, trade } = fixture()
    expect(mergePlanFills(plan, [{ ...trade, ...change }])).toBe(false)
    expect(plan.fills).toBeUndefined()
  })
  it('does not infer fills from an order limit, a quote, or a cancelled plan', () => {
    const { plan, trade } = fixture()
    expect(mergePlanFills(plan, [])).toBe(false)
    plan.status = 'cancelled'
    expect(mergePlanFills(plan, [trade])).toBe(false)
    expect(plan.fills).toBeUndefined()
  })
})
