import { expect, it } from 'vitest'
import { instrumentIssue, makeTemplate, products, rangeTemplate, withInstrument, withSymbol } from '../src/client/jev-templates.ts'

it('retains manual history for a tick edit but invalidates it for another exchange or contract', () => {
  const config = rangeTemplate('rb2610')
  config.autoHistory = undefined
  config.history = { datasetId: 'manual-history', barSeconds: 60, timeMeaning: 'close', refresh: false, columns: { time: 'time', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' } }
  expect(withInstrument(config, { ...config.instrument!, tickSize: 2 }).history).toEqual(config.history)
  expect(withInstrument(config, { ...config.instrument!, exchange: 'DCE' }).history).toBeUndefined()
  expect(withSymbol(config, 'rb2611').history).toBeUndefined()
  const gold = withSymbol(config, 'au2612')
  expect(gold.history).toBeUndefined()
  expect(gold.rangeRules?.tickSize).toBe(.02)
  expect(gold.maxSpread).toBe(.04)
})

it('keeps every catalog product and its decimal tick across all three templates', () => {
  expect(new Set(products.map(row => row.exchange)).size).toBe(6)
  for (const row of products) {
    const symbol = row.product.replace('_f', '') + (row.exchange === 'CZC' ? '701' : '2701') + (row.product.endsWith('_f') ? 'F' : '')
    const selected = withSymbol(rangeTemplate(), symbol)
    for (const kind of ['range', 'trend', 'breakout'] as const) {
      const config = makeTemplate(kind, selected)
      expect(config.symbol).toBe(symbol)
      expect(config.instrument).toEqual({ product: row.product, exchange: row.exchange, tickSize: row.tickSize })
      expect(config.autoHistory?.exchange).toBe(row.exchange)
      expect(config.rangeRules?.tickSize ?? config.signalRules?.tickSize).toBe(row.tickSize)
      expect(config.maxSpread).toBeCloseTo(row.tickSize * 2, 8)
      expect(instrumentIssue(config)).toBe(row.enabled ? undefined : '晚籼稻（LR）在柜台品种目录中未启用，请先同步目录或联系比赛服务。')
    }
  }
})

it('preserves manual metadata entered before a custom contract, including partial keystrokes', () => {
  let config = withInstrument(rangeTemplate('rb2610'), { product: '', exchange: 'GFE', tickSize: .25 })
  for (const symbol of ['Z', 'ZZ', 'ZZ2', 'ZZ27', 'ZZ270', 'ZZ2701']) config = withSymbol(config, symbol)
  expect(config.instrument).toEqual({ product: 'zz', exchange: 'GFE', tickSize: .25 })
  expect(config.rangeRules?.tickSize).toBe(.25)
  expect(config.autoHistory?.exchange).toBe('GFE')
  expect(instrumentIssue(config)).toBeUndefined()
  const next = withSymbol(config, 'XY2701')
  expect(next.instrument?.tickSize).toBe(0)
  expect(instrumentIssue(next)).toContain('tick')
})

it('preserves explicit tick edits and old saved configurations without instrument metadata', () => {
  const pending = withInstrument(rangeTemplate(), { product: '', exchange: 'CFE', tickSize: .4 })
  expect(withSymbol(pending, 'IF2612').instrument?.tickSize).toBe(.4)
  const legacy = rangeTemplate('m2701'); delete legacy.instrument
  expect(instrumentIssue(legacy)).toBeUndefined()
  expect(instrumentIssue({ ...rangeTemplate('m2701'), instrument: { product: 'm', exchange: 'SHF', tickSize: 1 } })).toContain('大连')
})
