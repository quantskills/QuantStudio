import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { products } from '../src/contest-products.ts'
import { flyInstrumentSchema } from '../src/fly-service.ts'
it('accepts every catalog variety across all exchanges, including monthly-average contracts', () => {
  for (const p of products) {
    const symbol = p.product.endsWith('_f') ? p.product.slice(0,-2) + '2610F' : p.product + (p.exchange === 'CZC' ? '701' : '2701')
    expect(flyInstrumentSchema.safeParse({ product:p.product, symbol, exchange:p.exchange }).success, symbol).toBe(true)
  }
  expect(new Set(products.map(p => p.exchange)).size).toBe(6)
})
it('permits new varieties but rejects cross-product and cross-exchange contracts', () => {
  expect(flyInstrumentSchema.safeParse({product:'xyz',symbol:'xyz2701',exchange:'GFE'}).success).toBe(true)
  for (const i of [{product:'l',symbol:'l2610F',exchange:'DCE'}, {product:'ma',symbol:'MA701',exchange:'SHF'}, {product:'cu',symbol:'cu',exchange:'SHF'}]) expect(flyInstrumentSchema.safeParse(i).success).toBe(false)
})
it('ships the same full product metadata to the isolated Python controller', () => {
  const copy = JSON.parse(readFileSync(new URL('../fly-runtime/fly/futures-products.json', import.meta.url), 'utf8'))
  expect(copy).toEqual(products)
})
