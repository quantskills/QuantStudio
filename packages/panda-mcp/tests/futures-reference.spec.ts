import { describe, expect, it, vi } from 'vitest'
import { FuturesReference, futuresCatalog } from '../src/futures-reference.ts'

const day = '20250414'
const report = (key: string, rows: object[], updated = '20250414 16:30:00') =>
  new Response(JSON.stringify({ report_date: day, update_date: updated, [key]: rows }))
const quote = (month: string, interest: number, volume: number) => ({
  PRODUCTGROUPID: 'cu', DELIVERYMONTH: month, OPENINTEREST: interest, VOLUME: volume, SETTLEMENTPRICE: 76140,
})
const fee = (code: string) => ({
  INSTRUMENTID: code, TRADINGDAY: day, TRADEFEEUNIT: '0', TRADEFEERATION: '0.00005',
  DISCOUNTRATE: '2', SPEC_LONGMARGINRATIO: '0.2', SPEC_SHORTMARGINRATIO: '0.18',
})
const shfe = vi.fn(async (input: string | URL | Request) => {
  const url = String(input)
  if (url.includes('/kx')) return report('o_curinstrument', [quote('2506', 90, 30), quote('2505', 90, 30), quote('2504', 80, 60)])
  if (url.includes('/Settlement')) return report('Settlement', [fee('cu2505')], '20250415 10:00:00')
  return report('ContractBaseInfo', [{ INSTRUMENTID: 'cu2505', EXCHANGEID: 'SHFE', TRADINGDAY: day, OPENDATE: '20240516', EXPIREDATE: '20250515' }])
})

describe('futures reference', () => {
  it('lists all six exchanges and 92 distinct products with source links', () => {
    expect(futuresCatalog.exchanges).toHaveLength(6)
    expect(futuresCatalog.products).toHaveLength(92)
    expect(new Set(futuresCatalog.products.map(p => `${p.exchange}/${p.product}`)).size).toBe(92)
    expect(futuresCatalog.products.every(p => p.tickSize > 0 && p.multiplier > 0 && p.sourceUrl.startsWith('https://'))).toBe(true)
    expect(futuresCatalog.products.find(p => p.product === 'LR')?.coverage).toMatchObject({ quoteDays: 359 })
  })

  it('selects the after-close main and keeps report versions distinct from first publication', async () => {
    const service = new FuturesReference({ fetch: shfe })
    const result = await service.query({ exchange: 'SHFE', symbol: 'cu', date: '2025-04-14', cutoff: '2025-04-15T08:59' })
    expect(result).toMatchObject({
      contract: 'CU2505', main: { contract: 'CU2505', method: 'after_close' },
      historicalRule: { tickSize: 10, multiplier: 5, historicalSector: '工业金属' },
      contractTerms: { lastTradingDate: '2025-05-15' },
      fees: { open: { yuanPerLot: 0, rate: 0.00005 }, closeToday: { yuanPerLot: 0, rate: 0.0001 }, marginShort: 0.18 },
      quoteSource: { status: 'available', cutoff: 'visible', firstPublishedAt: null },
      feeSource: { status: 'available', cutoff: 'after_cutoff', firstPublishedAt: null },
    })
    expect(result.feeSource?.sha256).toMatch(/^[a-f0-9]{64}$/)
    const explicit = await service.query({ exchange: 'SHFE', symbol: 'CU2504.SHF', date: day })
    expect(explicit).toMatchObject({ contract: 'CU2504', main: { contract: 'CU2505' }, fees: null, feeSource: { status: 'no_contract' } })
  })

  it('keeps current and historical rules separate and skips network for catalog-only lookups', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 404 }))
    const service = new FuturesReference({ fetch })
    const current = await service.query({ exchange: 'INE', symbol: 'EC' })
    expect(current).toMatchObject({ product: { tickSize: 0.5 }, historicalRule: null, feeSource: null })
    expect(fetch).not.toHaveBeenCalled()
    const historical = await service.query({ exchange: 'INE', symbol: 'EC2506', date: day })
    expect(historical).toMatchObject({ product: { tickSize: 0.5 }, historicalRule: { tickSize: 0.1 }, fees: null, feeSource: { status: 'missing' } })
    await expect(service.query({ exchange: 'SHFE', symbol: 'CU2504', date: '2025-02-30' })).rejects.toThrow('交易日')
    await expect(service.query({ exchange: 'DCE', symbol: 'L2513F', date: day })).rejects.toThrow('代码')
  })

  it('decodes Zhengzhou ratio fees and represents fixed and zero fees independently', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => String(input).includes('Daily.txt')
      ? new Response(`期货每日行情表(2025-04-14)\n合约代码|持仓量|成交量(手)|今结算\nMA509|20,000|10,000|2,300\nSR509|200|0|5,800`)
      : new Response(`期货结算参数表(2025-04-14)\n合约代码|交易手续费|手续费收取方式|日内平今仓交易手续费|交易保证金率(%)\nMA509|0.5|比例值|1.5|8\nSR509|3|绝对值|0|10`))
    const service = new FuturesReference({ fetch })
    expect(await service.query({ exchange: 'CZCE', symbol: 'MA509', date: day })).toMatchObject({
      quote: { volume: 10000, openInterest: 20000, settlement: 2300 },
      fees: { open: { rate: 0.00005, yuanPerLot: 0 }, closeToday: { rate: 0.00015, yuanPerLot: 0 }, marginLong: 0.08 },
    })
    expect(await service.query({ exchange: 'CZCE', symbol: 'SR509', date: day })).toMatchObject({
      fees: { open: { rate: 0, yuanPerLot: 3 }, closeToday: { rate: 0, yuanPerLot: 0 } },
    })
  })

  it('reads the CFFEX futures section of a combined futures and options bulletin', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => String(input).includes('/jscs/')
      ? new Response(`期货合约结算业务参数表（20261019）\n期货合约,合约多头保证金标准,合约空头保证金标准,交易手续费标准,交割手续费标准,平今仓收取率\nIF2611,12.00%,12.00%,万分之0.23,万分之0.5,1000%\n期权合约结算业务参数表（20261019）\n期权合约,其他字段`)
      : new Response(null, { status: 404 }))
    const result = await new FuturesReference({ fetch }).query({ exchange: 'CFFEX', symbol: 'IF2611', date: '20261019' })
    expect(result.feeSource).toMatchObject({ status: 'available', firstPublishedAt: null })
    expect(result.fees?.open.rate).toBeCloseTo(0.000023)
    expect(result.fees?.closeToday.rate).toBeCloseTo(0.00023)
  })

  it('reads energy contracts published under the Shanghai exchange identifier', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => String(input).includes('/ContractBaseInfo')
      ? report('ContractBaseInfo', [{ INSTRUMENTID: 'ec2506', EXCHANGEID: 'SHFE', TRADINGDAY: day, EXPIREDATE: '20250630' }])
      : new Response(null, { status: 404 }))
    const result = await new FuturesReference({ fetch }).query({ exchange: 'INE', symbol: 'EC2506', date: day })
    expect(result.contractTerms?.lastTradingDate).toBe('2025-06-30')
    expect(result.contractSource?.status).toBe('available')
  })

  it('uses the vendor mapping for connected Dalian data and leaves exchange fees missing', async () => {
    const panda = vi.fn(async (method: string) => method === 'get_future_dominant'
      ? [{ date: 20250414, symbol: 'L2505F.DCE', underlying_symbol: 'LF' }]
      : { columns: ['symbol', 'date', 'open_interest', 'volume', 'settlement'], data: [['L2505F.DCE', day, 12, 0, 7000]] })
    const result = await new FuturesReference({ panda }).query({ exchange: 'DCE', symbol: 'LF', date: day })
    expect(panda.mock.calls.map(([method]) => method)).toEqual(['get_future_dominant', 'get_future_daily'])
    expect(result).toMatchObject({
      contract: 'L2505F', main: { method: 'pandadata', contract: 'L2505F' }, fees: null,
      quote: { volume: 0, settlement: 7000 }, feeSource: { status: 'unsupported' },
    })
  })
})
