import { describe, expect, it } from 'vitest'
import { normalizeWatchBars, watchEvidence } from '../src/contest-watch-evidence.ts'
import { parseAssessments, watchAssessments } from '../src/contest-watch-evaluation.ts'
import type { ContestWatchConfig, ContestWatchHistory } from '../src/contest-watch-types.ts'
import { makeTemplate, rangeTemplate } from '../../ui-quantskills/src/client/jev-templates.ts'

const now = Date.parse('2026-09-18T03:00:00Z')
const config: ContestWatchConfig = { symbol: 'rb2610', volume: 1, intervalSeconds: 3, durationMinutes: 120, minConfidence: .8, maxEquityDrop: 1000, maxPlans: 5, instructions: 'range',
  rangeRules: { lookbackBars: 20, tickSize: 1, minWidthTicks: 8, minTouches: 2, edgeFraction: .2, reboundTicks: 2, roundTripCostTicks: 1, minRewardCostRatio: 2, stopLossTicks: 8, takeProfitTicks: 10 } }
const account = { allowed: ['hold', 'open_long', 'open_short'] as const, direction: 'flat' }
const history: ContestWatchHistory = { source: 'synthetic test bars', barSeconds: 60, bars: Array.from({ length: 20 }, (_, i) => ({ time: now - (20 - i) * 60000, open: 110, high: i % 4 === 2 ? 120 : 112, low: i % 4 === 0 ? 100 : 108, close: 110 })) }
const evidence = (prices: number[], patch: Partial<ContestWatchConfig> = {}, bars = history) => watchEvidence({ ...config, ...patch }, prices.map((price, i) => ({ time: now - (prices.length - i) * 3000, price, bid: price - 1, ask: price })), { ...account, allowed: [...account.allowed] }, bars, now)

describe('paired range conditions', () => {
  it('handles decimal ticks at exact thresholds without losing a qualifying rebound', () => {
    const price = (value: number) => 1000 + (value - 100) * .02
    const bars = { ...history, bars: history.bars.map(bar => ({ ...bar, open: price(bar.open), high: price(bar.high), low: price(bar.low), close: price(bar.close) })) }
    const quotes = [100, 100, 102].map((value, i) => ({ time: now - (3 - i) * 3000, price: price(value), bid: price(value - 1), ask: price(value) }))
    expect(watchEvidence({ ...config, rangeRules: { ...config.rangeRules!, tickSize: .02 } }, quotes, { ...account, allowed: [...account.allowed] }, bars, now).allowedActions).toEqual(['hold', 'open_long'])
  })
  it('permits a qualifying long, but removing the rebound removes only that candidate', () => {
    expect(evidence([100, 100, 102]).allowedActions).toEqual(['hold', 'open_long'])
    expect(evidence([102, 102, 102]).allowedActions).toEqual(['hold'])
    expect(evidence([102, 102, 102]).checks.find(x => x.id === 'rebound')).toMatchObject({ state: 'fail' })
  })
  it('permits a qualifying short and blocks a breakout or prohibitive costs', () => {
    expect(evidence([120, 120, 118]).allowedActions).toEqual(['hold', 'open_short'])
    expect(evidence([120, 120, 122]).allowedActions).toEqual(['hold'])
    expect(evidence([100, 100, 102], { rangeRules: { ...config.rangeRules!, roundTripCostTicks: 10 } }).allowedActions).toEqual(['hold'])
  })
  it('does not treat missing, stale or discontinuous bars as usable history', () => {
    for (const bars of [{ ...history, bars: [] }, { ...history, bars: history.bars.slice(0, -1) }, { ...history, bars: history.bars.map(x => ({ ...x, time: x.time - 600000 })) }]) {
      expect(evidence([100, 100, 102], {}, bars).allowedActions).toEqual(['hold'])
    }
  })
  it('preserves reducing a position with missing history and identifies numeric exit conditions', () => {
    const result = watchEvidence(config, [{ time: now, price: 101 }], { direction: 'long', entryPrice: 110, allowed: ['hold', 'close_long'] }, { ...history, bars: [] }, now)
    expect(result.allowedActions).toEqual(['hold', 'close_long'])
    expect(result.checks.find(x => x.id === 'exit')).toMatchObject({ state: 'pass' })
  })
})

describe('trend and breakout conditions', () => {
  const trendBars = { ...history, bars: Array.from({ length: 30 }, (_, i) => ({ time: now - (30 - i) * 60000, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i })) }
  const breakoutBars = { ...history, bars: Array.from({ length: 30 }, (_, i) => ({ time: now - (30 - i) * 60000, open: i === 29 ? 119 : 110, high: i === 29 ? 124 : 120, low: i === 29 ? 118 : 100, close: i === 29 ? 123 : 110 })) }
  const mirror = (source: ContestWatchHistory) => ({ ...source, bars: source.bars.map(bar => ({ ...bar, open: 300 - bar.open, close: 300 - bar.close, high: 300 - bar.low, low: 300 - bar.high })) })
  function check(kind: 'trend' | 'breakout', bars: ContestWatchHistory, prices: number[], cost = 2) {
    const template = makeTemplate(kind, rangeTemplate('rb2610'))
    template.decisionMode = 'strict'
    template.signalRules!.roundTripCostTicks = cost
    return watchEvidence(template, prices.map((price, i) => ({ time: now - (prices.length - i) * 3000, price, bid: price - 1, ask: price })), { ...account, allowed: [...account.allowed] }, bars, now)
  }
  it('permits trend pullbacks in either direction, rejects missing recovery and never applies range gates', () => {
    const long = check('trend', trendBars, [127, 127, 129])
    expect(long.allowedActions).toEqual(['hold', 'open_long'])
    expect(long.checks.some(item => ['inside', 'touches'].includes(item.id))).toBe(false)
    expect(check('trend', mirror(trendBars), [173, 173, 171]).allowedActions).toEqual(['hold', 'open_short'])
    expect(check('trend', trendBars, [129, 129, 129]).allowedActions).toEqual(['hold'])
    expect(check('trend', trendBars, [132, 132, 134]).allowedActions).toEqual(['hold'])
  })
  it('confirms breakouts with a completed bar, excludes it from the boundary, and blocks chasing', () => {
    expect(check('breakout', breakoutBars, [121, 122, 123]).allowedActions).toEqual(['hold', 'open_long'])
    expect(check('breakout', mirror(breakoutBars), [179, 178, 177]).allowedActions).toEqual(['hold', 'open_short'])
    expect(check('breakout', breakoutBars, [128, 129, 130]).allowedActions).toEqual(['hold'])
    const notClosed = { ...breakoutBars, bars: breakoutBars.bars.map((bar, i) => i === 29 ? { ...bar, close: 119 } : bar) }
    expect(check('breakout', notClosed, [121, 122, 123]).allowedActions).toEqual(['hold'])
    expect(check('breakout', { ...breakoutBars, bars: breakoutBars.bars.map((bar, i) => i === 29 ? { ...bar, time: now + 1 } : bar) }, [121, 122, 123]).allowedActions).toEqual(['hold'])
  })
  it('blocks missing, stale, discontinuous history and excessive costs for both templates', () => {
    for (const [kind, source, prices] of [['trend', trendBars, [127, 127, 129]], ['breakout', breakoutBars, [121, 122, 123]]] as const) {
      for (const bars of [{ ...source, bars: [] }, { ...source, bars: source.bars.map(bar => ({ ...bar, time: bar.time - 600000 })) }, { ...source, bars: source.bars.filter((_, i) => i !== 15) }]) {
        expect(check(kind, bars, [...prices]).allowedActions).toEqual(['hold'])
      }
      expect(check(kind, source, [...prices], 30).allowedActions).toEqual(['hold'])
      const template = makeTemplate(kind, rangeTemplate('rb2610'))
      const exiting = watchEvidence(template, [{ time: now, price: 100 }], { direction: 'long', entryPrice: 120, allowed: ['hold', 'close_long'] }, { ...source, bars: [] }, now)
      expect(exiting.allowedActions).toEqual(['hold', 'close_long'])
      expect(exiting.checks.find(item => item.id === 'exit')?.state).toBe('pass')
    }
  })
  it('requires valid historical data for a blank custom strategy without applying range gates', () => {
    const template = makeTemplate('blank', rangeTemplate('au2612'))
    expect(watchEvidence(template, [], { ...account, allowed: [...account.allowed] }, { ...history, bars: [] }, now).allowedActions).toEqual(['hold'])
    expect(watchEvidence(template, [{ time: now, price: 3000, bid: 3000, ask: 3000.02 }], { ...account, allowed: [...account.allowed] }, trendBars, now).allowedActions).toEqual(['hold', 'open_long', 'open_short'])
  })
})

describe('Jev-led evidence', () => {
  it.each([60, 300])('accepts exact intraday breaks for %i-second bars without masking missing boundary bars', barSeconds => {
    const time = (value: string) => Date.parse(`2026-09-18T${value}+08:00`)
    const step = barSeconds * 1000
    for (const [exchange, before, after] of [['SHF', '11:30:00', '13:30:00'], ['SHF', '10:15:00', '10:30:00'], ['CFE', '11:30:00', '13:00:00']] as const) {
      const times = [...Array.from({ length: 10 }, (_, i) => time(before) - (9 - i) * step), ...Array.from({ length: 10 }, (_, i) => time(after) + (i + 1) * step)]
      const input = { ...config, decisionMode: 'jev' as const, autoHistory: { exchange, barSeconds: barSeconds as 60 | 300 } }
      const check = (values: number[]) => watchEvidence(input, [], { ...account, allowed: [...account.allowed] }, { ...history, barSeconds, bars: values.map(time => ({ ...history.bars[0]!, time })) }, times.at(-1)! + 1000)
      expect(check(times).allowedActions).toEqual(['hold', 'open_long', 'open_short'])
      expect(check(times).checks[0]!.detail).toContain('休市')
      // Keep 20 bars so failure is due to continuity, not the sample count.
      for (const index of [4, 9, 10]) {
        const missing = [times[0]! - step, ...times.filter((_, i) => i !== index)]
        expect(check(missing).allowedActions).toEqual(['hold'])
        expect(check(missing).checks[0]!.detail).toContain('衔接异常')
      }
    }
  })
  it('does not infer a break for an unknown exchange, a different day, or a CFE morning gap', () => {
    const start = Date.parse('2026-09-18T10:15:00+08:00')
    const bars = [...Array.from({ length: 10 }, (_, i) => ({ ...history.bars[0]!, time: start - (9 - i) * 60000 })),
      ...Array.from({ length: 10 }, (_, i) => ({ ...history.bars[0]!, time: start + (16 + i) * 60000 }))]
    for (const autoHistory of [undefined, { exchange: 'CFE' as const, barSeconds: 60 as const }]) {
      expect(watchEvidence({ ...config, decisionMode: 'jev', autoHistory }, [], { ...account, allowed: [...account.allowed] }, { ...history, bars }, bars.at(-1)!.time).allowedActions).toEqual(['hold'])
    }
    const crossDay = bars.map((bar, i) => i >= 10 ? { ...bar, time: bar.time + 86400000 } : bar)
    expect(watchEvidence({ ...config, decisionMode: 'jev', autoHistory: { exchange: 'SHF', barSeconds: 60 } }, [], { ...account, allowed: [...account.allowed] }, { ...history, bars: crossDay }, crossDay.at(-1)!.time).allowedActions).toEqual(['hold'])
  })
  it('keeps unmet strategy checks as references, while strict mode still gates entries', () => {
    const result = evidence([110, 110, 110], { decisionMode: 'jev' })
    expect(result.allowedActions).toEqual(['hold', 'open_long', 'open_short'])
    expect(result.checks.find(check => check.id === 'rebound')).toMatchObject({ state: 'fail', enforcement: 'reference' })
    expect(result.checks.find(check => check.id === 'history')).toMatchObject({ state: 'pass', enforcement: 'hard' })
    expect(evidence([110, 110, 110], { decisionMode: 'strict' }).allowedActions).toEqual(['hold'])
  })
  it('does not relax historical validity or position constraints in Jev mode, even without numeric rules', () => {
    const input = { ...config, decisionMode: 'jev' as const, rangeRules: undefined }
    const missing = { ...history, bars: [] }
    expect(watchEvidence(input, [], { ...account, allowed: [...account.allowed] }, missing, now).allowedActions).toEqual(['hold'])
    expect(watchEvidence(input, [], { direction: 'short', allowed: ['hold', 'close_short'] }, missing, now).allowedActions).toEqual(['hold', 'close_short'])
    expect(watchEvidence(input, [], { ...account, allowed: ['hold', 'open_long'] }, history, now).allowedActions).toEqual(['hold', 'open_long'])
  })
})

const mapping: NonNullable<ContestWatchConfig['history']> = { datasetId: 'fixture', barSeconds: 60, timeMeaning: 'open', refresh: false, columns: { time: 'time', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' } }
it('normalizes Shanghai bar times, excludes forming/future bars, and rejects duplicate or invalid OHLC', () => {
  const row = { symbol: 'rb2610', time: '2026-09-18 10:59:00', open: '100', high: '102', low: '99', close: '101' }
  expect(normalizeWatchBars([row, { ...row, symbol: 'au2612' }, { ...row, time: '2026-09-18 11:00:00' }], mapping, 'rb2610', now)).toEqual([{ time: now, open: 100, high: 102, low: 99, close: 101 }])
  expect(() => normalizeWatchBars([row, row], mapping, 'rb2610', now)).toThrow('重复')
  expect(() => normalizeWatchBars([{ ...row, low: '105' }], mapping, 'rb2610', now)).toThrow('OHLC')
})
it('rejects missing assessments, wrong option sets and a choice inconsistent with its probabilities', () => {
  const answers = Object.fromEntries(Object.entries(watchAssessments).map(([key, value]) => {
    const options = Object.keys(value.criteria)
    return [key, { type: 'choice', choice: options[0], confidence: 1, probabilities: Object.fromEntries(options.map((option, i) => [option, i ? 0 : 1])) }]
  }))
  expect(parseAssessments(answers).regime.choice).toBe('range')
  expect(() => parseAssessments({})).toThrow('缺失')
  expect(() => parseAssessments({ ...answers, regime: { ...answers.regime, choice: 'falling' } })).toThrow('无效')
})
