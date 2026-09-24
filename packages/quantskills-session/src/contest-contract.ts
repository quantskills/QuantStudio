/** Actual delivery contracts, including DCE monthly-average contracts (e.g. l2610F). */
export const futuresContractPattern = /^[a-z]{1,3}\d{3,4}f?$/i
export const futuresProductPattern = /^[a-z]{1,3}(?:_f)?$/i
export const futuresExchanges = { SHF: '上海期货交易所', DCE: '大连商品交易所', CZC: '郑州商品交易所', CFE: '中国金融期货交易所', INE: '上海国际能源交易中心', GFE: '广州期货交易所' } as const
export type FuturesExchange = keyof typeof futuresExchanges

/** Compare actual futures contracts without losing an explicit exchange or the monthly-average suffix. */
export const contestContractParts = (value: unknown) => typeof value === 'string'
  ? /^([a-z]{1,3}\d{3,4}f?)(?:\.(SHF|DCE|CZC|CFE|INE|GFE))?$/i.exec(value.trim()) : null

export function futuresProduct(symbol: string): string | undefined {
  const contract = contestContractParts(symbol)?.[1]
  if (!contract) return undefined
  return contract.match(/^[a-z]+/i)![0].toLowerCase() + (/\df$/i.test(contract) ? '_f' : '')
}

export function sameContestContract(a: unknown, b: string, exchange?: string): boolean {
  const left = contestContractParts(a), right = contestContractParts(b)
  const expectedExchange = right?.[2] ?? exchange
  return Boolean(left && right && left[1]!.toLowerCase() === right[1]!.toLowerCase()
    && (!left[2] || !expectedExchange || left[2].toUpperCase() === expectedExchange.toUpperCase()))
}

export { products, catalogCheckedAt, catalogVersion, type FuturesProduct } from './contest-products.ts'
