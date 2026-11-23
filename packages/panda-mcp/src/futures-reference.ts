import { dataRows, type PandaDataCall } from './database.ts'
import { historicalRules, products } from './futures-reference-catalog.ts'
import { beijingTime, FuturesReports, pandaFuturesUrl, sourceFor, tradingDay, type Report, type ReportRow } from './futures-reference-reports.ts'
import type { FuturesCatalog, FuturesContractTerms, FuturesExchange, FuturesFees, FuturesQuote, FuturesReferenceQuery, FuturesReferenceResult } from './futures-reference-types.ts'

export const futuresCatalog: FuturesCatalog = {
  snapshotDate: '2026-11-23',
  exchanges: [
    { id: 'SHFE', name: '上海期货交易所' }, { id: 'INE', name: '上海国际能源交易中心' },
    { id: 'DCE', name: '大连商品交易所' }, { id: 'CZCE', name: '郑州商品交易所' },
    { id: 'CFFEX', name: '中国金融期货交易所' }, { id: 'GFEX', name: '广州期货交易所' },
  ],
  products,
}

const vendorExchanges = { SHFE: 'SHF', INE: 'INE', DCE: 'DCE', CZCE: 'CZC', CFFEX: 'CFE', GFEX: 'GFE' } as const
const productByCode = new Map(products.map(product => [`${product.exchange}/${product.product}`, product]))
const codeText = (value: unknown) => String(value ?? '').trim().toUpperCase()
const decimal = (value: unknown) => {
  const text = String(value ?? '').trim().replaceAll(',', '')
  const result = Number(text)
  return text && Number.isFinite(result) ? result : null
}

function contractCode(exchange: FuturesExchange, value: unknown): { contract: string; product: string } | null {
  const [contract = '', suffix, ...rest] = codeText(value).split('.')
  if (rest.length || (suffix !== undefined && suffix !== vendorExchanges[exchange] && suffix !== exchange)) return null
  const match = /^([A-Z]+)(\d{3,4})(F?)$/.exec(contract)
  if (!match || match[2]?.length !== (exchange === 'CZCE' ? 3 : 4)) return null
  const month = Number(match[2].slice(-2))
  const product = match[1]! + match[3]
  if (month < 1 || month > 12 || !productByCode.has(`${exchange}/${product}`)) return null
  return { contract, product }
}

function quoteFrom(row: ReportRow, exchange: FuturesExchange): { code: unknown; quote: FuturesQuote } {
  const read = (code: unknown, interest: unknown, volume: unknown, settlement: unknown) => ({
    code, quote: { openInterest: decimal(interest), volume: decimal(volume), settlement: decimal(settlement) },
  })
  if (exchange === 'SHFE' || exchange === 'INE') return read(codeText(row.PRODUCTGROUPID) + codeText(row.DELIVERYMONTH), row.OPENINTEREST, row.VOLUME, row.SETTLEMENTPRICE)
  if (exchange === 'CZCE') return read(row['合约代码'], row['持仓量'], row['成交量(手)'], row['今结算'])
  if (exchange === 'CFFEX') return read(row['合约代码'], row['持仓量'], row['成交量'], row['今结算'])
  return read(row.contract ?? row.symbol, row.open_interest, row.volume, row.settlement)
}

function takeQuoteRows(exchange: FuturesExchange, product: string, report: Report): Map<string, FuturesQuote> {
  const quotes = new Map<string, FuturesQuote>()
  for (const row of report.rows) {
    const { code, quote } = quoteFrom(row, exchange)
    const parsed = contractCode(exchange, code)
    if (parsed?.product !== product) continue
    if (quotes.has(parsed.contract)) {
      report.source.status = 'error'
      return new Map()
    }
    if (Object.values(quote).some(value => value !== null)) quotes.set(parsed.contract, quote)
  }
  return quotes
}

function researchMain(quotes: Map<string, FuturesQuote>): string | null {
  return [...quotes]
    .filter(([, row]) => (row.openInterest ?? 0) > 0 && row.volume !== null && row.volume >= 0 && row.settlement)
    .sort(([a, left], [b, right]) => right.openInterest! - left.openInterest! || right.volume! - left.volume! || a.localeCompare(b))[0]?.[0] ?? null
}

function requiredNumber(value: unknown): number {
  const number = decimal(value)
  if (number === null || number < 0) throw new Error('Missing or invalid settlement number')
  return number
}

function percentage(value: unknown): number { return requiredNumber(String(value ?? '').trim().replace(/%$/, '')) / 100 }

function splitFee(value: unknown, mode: unknown): FuturesFees['open'] {
  const amount = requiredNumber(value)
  if (mode === '绝对值') return { yuanPerLot: amount, rate: 0 }
  if (mode === '比例值') return { yuanPerLot: 0, rate: amount / 10_000 }
  throw new Error('Unsupported settlement fee unit')
}

function feesFrom(exchange: FuturesExchange, row: ReportRow): FuturesFees {
  let open: FuturesFees['open'], closeToday: FuturesFees['closeToday'], marginLong: number, marginShort: number
  if (exchange === 'CZCE') {
    open = splitFee(row['交易手续费'], row['手续费收取方式'])
    closeToday = splitFee(row['日内平今仓交易手续费'], row['手续费收取方式'])
    marginLong = marginShort = percentage(row['交易保证金率(%)'])
  } else {
    let discount: number
    if (exchange === 'CFFEX') {
      const text = String(row['交易手续费标准'] ?? '').trim()
      const match = /^(?:万分之(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)元\/手)$/.exec(text)
      if (!match) throw new Error('Unsupported CFFEX fee unit')
      open = match[1] ? splitFee(match[1], '比例值') : splitFee(match[2], '绝对值')
      discount = percentage(row['平今仓收取率'])
      marginLong = percentage(row['合约多头保证金标准'])
      marginShort = percentage(row['合约空头保证金标准'])
    } else {
      open = { yuanPerLot: requiredNumber(row.TRADEFEEUNIT), rate: requiredNumber(row.TRADEFEERATION) }
      discount = requiredNumber(row.DISCOUNTRATE)
      marginLong = requiredNumber(row.SPEC_LONGMARGINRATIO)
      marginShort = requiredNumber(row.SPEC_SHORTMARGINRATIO)
    }
    closeToday = { yuanPerLot: open.yuanPerLot * discount, rate: open.rate * discount }
  }
  if (Math.max(marginLong, marginShort) > 1) throw new Error('Margin must be a fraction')
  return { open, closePrevious: { ...open }, closeToday, marginLong: marginLong || null, marginShort: marginShort || null }
}

function forContract<T>(report: Report, rows: ReportRow[], decode: (row: ReportRow) => T): T | null {
  if (report.source.status !== 'available') return null
  if (!rows.length) {
    report.source.status = 'no_contract'
    return null
  }
  try {
    if (rows.length !== 1) throw new Error('Duplicate contract report rows')
    return decode(rows[0]!)
  } catch {
    report.source.status = 'error'
    return null
  }
}

function termsFrom(row: ReportRow): FuturesContractTerms {
  return { listedDate: tradingDay(row.OPENDATE), lastTradingDate: tradingDay(row.EXPIREDATE),
    deliveryStart: tradingDay(row.STARTDELIVDATE), deliveryEnd: tradingDay(row.ENDDELIVDATE) }
}

export class FuturesReference {
  private readonly reports: FuturesReports
  private readonly panda: PandaDataCall | undefined

  constructor(options: { fetch?: typeof globalThis.fetch; archive?: string; panda?: PandaDataCall } = {}) {
    this.reports = new FuturesReports(options.fetch ?? globalThis.fetch, options.archive)
    this.panda = options.panda
  }

  private async vendorQuote(exchange: 'DCE' | 'GFEX', product: string, date: string, cutoff: string | null, explicit: string | null, signal?: AbortSignal) {
    const source = sourceFor(date, 'no_contract', cutoff, pandaFuturesUrl, 'pandadata')
    const report: Report = { rows: [], source }
    const day = date.replaceAll('-', '')
    const dates = { start_date: day, end_date: day }
    let main: string | null = null
    if (!this.panda) {
      source.status = 'login_required'
      return { report, main }
    }
    try {
      const call = async (method: string, params: Record<string, unknown>) => {
        const raw = await this.panda!(method, params, signal)
        if (raw && typeof raw === 'object' && 'error' in raw && raw.error === 'reauth_required') {
          source.status = 'login_required'
          return []
        }
        return dataRows(raw)
      }
      if (!explicit) {
        const mapping = (await call('get_future_dominant', { underlying_symbol: product, ...dates }))
          .filter(row => tradingDay(row.date) === date && codeText(row.underlying_symbol) === product)
        if (mapping.length > 1) throw new Error('Ambiguous PandaData mapping')
        const parsed = contractCode(exchange, mapping[0]?.symbol)
        if (mapping.length && parsed?.product !== product) throw new Error('Unexpected PandaData contract')
        main = parsed?.contract ?? null
      }
      const contract = explicit ?? main
      if (contract) {
        const symbol = `${contract}.${vendorExchanges[exchange]}`
        report.rows = (await call('get_future_daily', { symbol, ...dates, fields: ['symbol', 'date', 'open_interest', 'volume', 'settlement'] }))
          .filter(row => tradingDay(row.date) === date && codeText(row.symbol) === symbol)
        if (report.rows.length) source.status = 'available'
      }
    } catch {
      signal?.throwIfAborted()
      source.status = 'error'
    }
    return { report, main }
  }

  async query(input: FuturesReferenceQuery, signal?: AbortSignal): Promise<FuturesReferenceResult> {
    if (!futuresCatalog.exchanges.some(exchange => exchange.id === input?.exchange)) throw new Error('请选择有效的期货交易所')
    const { exchange } = input
    const parsed = contractCode(exchange, input.symbol)
    const product = productByCode.get(`${exchange}/${parsed?.product ?? codeText(input.symbol)}`)
    if (!product) throw new Error('该交易所没有此品种或合约代码。郑商所合约请使用三位年月代码。')
    const date = input.date === undefined ? null : tradingDay(input.date)
    if (input.date !== undefined && !date) throw new Error('交易日格式无效，请使用 YYYY-MM-DD')
    let cutoff = null
    if (input.cutoff !== undefined) {
      const [day, clock, ...rest] = typeof input.cutoff === 'string' ? input.cutoff.replace(/\+08:00$/, '').split('T') : []
      const cutoffDay = tradingDay(day)
      cutoff = cutoffDay && clock && !rest.length ? beijingTime(cutoffDay, clock) : null
      if (!date || !cutoff) throw new Error('可见时点核验需指定交易日和有效的北京时间')
    }
    const result: FuturesReferenceResult = {
      product, catalogDate: futuresCatalog.snapshotDate, date, contract: parsed?.contract ?? null, main: null,
      quote: null, quoteSource: null, fees: null, feeSource: null, historicalRule: null, contractTerms: null, contractSource: null,
    }
    if (!date) return result
    const rule = historicalRules.find(item => item.exchange === exchange && item.product === product.product && item.validFrom <= date && date <= item.validThrough)
    if (rule) {
      const { exchange: _exchange, product: _product, ...historicalRule } = rule
      result.historicalRule = historicalRule
    }
    let [quotesReport, feeReport, contractReport] = await Promise.all([
      this.reports.read(exchange, 'quotes', date, cutoff, signal),
      this.reports.read(exchange, 'settlement', date, cutoff, signal),
      this.reports.read(exchange, 'contracts', date, cutoff, signal),
    ])
    const canRecalculateMain = quotesReport.source.status === 'available'
    if ((exchange === 'DCE' || exchange === 'GFEX') && quotesReport.source.status === 'missing') {
      const { report, main } = await this.vendorQuote(exchange, product.product, date, cutoff, result.contract, signal)
      quotesReport = report
      if (main) result.main = { contract: main, method: 'pandadata' }
    }
    const quotes = takeQuoteRows(exchange, product.product, quotesReport)
    if (canRecalculateMain && quotesReport.source.status === 'available') {
      const main = researchMain(quotes)
      if (main) result.main = { contract: main, method: 'after_close' }
    }
    result.contract ??= result.main?.contract ?? null
    const contract = result.contract
    result.quoteSource = quotesReport.source
    result.quote = contract ? quotes.get(contract) ?? null : null
    if (!result.quote && quotesReport.source.status === 'available') quotesReport.source.status = 'no_contract'
    const feeRows = contract ? feeReport.rows.filter(row =>
      codeText(row.INSTRUMENTID ?? row['合约代码'] ?? row['期货合约']) === contract) : []
    result.fees = forContract(feeReport, feeRows, row => {
      if ((exchange === 'SHFE' || exchange === 'INE') && tradingDay(row.TRADINGDAY) !== date) throw new Error('Wrong settlement date')
      return feesFrom(exchange, row)
    })
    result.feeSource = feeReport.source
    if (exchange === 'INE' && contract && contractReport.source.status !== 'available') {
      const combined = await this.reports.read('SHFE', 'contracts', date, cutoff, signal)
      if (combined.source.status === 'available') contractReport = combined
    }
    const termRows = contract ? contractReport.rows.filter(row => {
      const venue = codeText(row.EXCHANGEID)
      return codeText(row.INSTRUMENTID) === contract && (venue === exchange || (exchange === 'INE' && venue === 'SHFE'))
    }) : []
    result.contractTerms = forContract(contractReport, termRows, row => {
      if (tradingDay(row.TRADINGDAY) !== date) throw new Error('Wrong contract report date')
      return termsFrom(row)
    })
    result.contractSource = contractReport.source
    return result
  }
}
