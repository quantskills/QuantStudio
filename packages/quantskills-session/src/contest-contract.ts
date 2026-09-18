/** Compare actual futures contracts without losing an explicit exchange constraint. */
export const contestContractParts = (value: unknown) => typeof value === 'string'
  ? /^([a-z]{1,3}\d{3,4})(?:\.(SHF|DCE|CZC|CFE|INE|GFE))?$/i.exec(value.trim()) : null

export function sameContestContract(a: unknown, b: string, exchange?: string): boolean {
  const left = contestContractParts(a), right = contestContractParts(b)
  const expectedExchange = right?.[2] ?? exchange
  return Boolean(left && right && left[1]!.toLowerCase() === right[1]!.toLowerCase()
    && (!left[2] || !expectedExchange || left[2].toUpperCase() === expectedExchange.toUpperCase()))
}
