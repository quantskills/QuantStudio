import { expect, it } from 'vitest'
import { rangeTemplate, withInstrument, withSymbol } from '../src/client/jev-templates.ts'

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
