import { describe, expect, it } from 'vitest'
import { contestRequestCost, reserveContestRequests, type ContestRequestHistory } from '../src/contest-rate-budget.ts'

describe('competition request budgets', () => {
  const empty = (): ContestRequestHistory => ({ query: [], trade: [] })
  it('keeps query 60/min and trade 10/min independent', () => {
    const history = empty()
    for (let i = 0; i < 60; i++) reserveContestRequests(history, ['quote', 'rb2701'], 100000)
    expect(() => reserveContestRequests(history, ['account'], 100000)).toThrow('60 次/分钟')
    for (let i = 0; i < 10; i++) reserveContestRequests(history, ['plan', 'create'], 100000)
    expect(() => reserveContestRequests(history, ['plan', 'execute'], 100000)).toThrow('10 次/分钟')
    expect(history).toMatchObject({ query: Array(60).fill(100000), trade: Array(10).fill(100000) })
  })
  it('counts preflight, plan creation, execution, and status separately', () => {
    const history = empty()
    for (const args of [['order', '--dry-run'], ['plan', 'create'], ['plan', 'execute'], ['operation', 'show'], ['plan', 'show']]) reserveContestRequests(history, args, 100000)
    expect(history.trade).toHaveLength(3)
    expect(history.query).toHaveLength(2)
    reserveContestRequests(history, ['doctor'], 100000)
    expect(history.query).toHaveLength(4)
  })
  it('uses a rolling minute, with release exactly at the expiry boundary', () => {
    const history = empty()
    for (let i = 0; i < 10; i++) reserveContestRequests(history, ['plan', 'execute'], 100000 + i * 1000)
    try { reserveContestRequests(history, ['plan', 'create'], 159999) }
    catch (error) { expect(error).toMatchObject({ code: 'rate_limit_exceeded', retryAfterSeconds: 1 }) }
    expect(history.trade).toHaveLength(10)
    expect(() => reserveContestRequests(history, ['plan', 'create'], 160000)).not.toThrow()
    expect(history.trade).toHaveLength(10)
    expect(() => reserveContestRequests(history, ['plan', 'create'], 160000)).toThrow('1 秒后重试')
  })
  it('reserves multi-request commands atomically without consuming quota on rejection', () => {
    const history = empty()
    for (let i = 0; i < 59; i++) reserveContestRequests(history, ['positions'], 100000)
    expect(() => reserveContestRequests(history, ['doctor'], 100001)).toThrow('60 次/分钟')
    expect(history.query).toHaveLength(59)
    reserveContestRequests(history, ['positions'], 100001)
    expect(history.query).toHaveLength(60)
  })
  it('does not charge public metadata or local logout to either bucket', () => {
    const history = empty()
    for (const args of [['agent', 'describe'], ['skill', 'install'], ['update', '--check'], ['logout']]) {
      expect(contestRequestCost(args)).toBeUndefined()
      reserveContestRequests(history, args)
    }
    expect(history).toEqual(empty())
  })
})
