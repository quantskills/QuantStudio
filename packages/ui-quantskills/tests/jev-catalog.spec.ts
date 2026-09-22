import { expect, it } from 'vitest'
import { parseVarieties } from '../src/client/jev-catalog.ts'

it('accepts live additions and enablement changes without inventing a price tick', () => {
  const rows = parseVarieties({ total: 3, items: [
    { code: 'RB', name: '螺纹钢', exchange: 'SHF', enabled: false },
    { code: 'L_F', name: '聚乙烯月均价', exchange: 'DCE', enabled: true },
    { code: 'ZZ', name: '新增测试品种', exchange: 'GFE', enabled: true },
  ] })
  expect(rows).toEqual([
    { product: 'rb', name: '螺纹钢', exchange: 'SHF', tickSize: 1, enabled: false },
    { product: 'l_f', name: '聚乙烯月均价', exchange: 'DCE', tickSize: 1, enabled: true },
    { product: 'zz', name: '新增测试品种', exchange: 'GFE', tickSize: 0, enabled: true },
  ])
})

it.each([
  null, { items: [], total: 0 }, { items: [{ code: 'RB', name: '螺纹钢', exchange: 'SHF', enabled: true }], total: 2 },
  { items: [{ code: 'RB', name: '螺纹钢', exchange: 'SHFE', enabled: true }], total: 1 },
  { items: [{ code: 'RB', name: '螺纹钢', exchange: 'SHF', enabled: true }, { code: 'rb', name: '重复', exchange: 'DCE', enabled: true }], total: 2 },
])('rejects incomplete or ambiguous metadata instead of silently replacing the catalog', value => {
  expect(() => parseVarieties(value)).toThrow()
})
