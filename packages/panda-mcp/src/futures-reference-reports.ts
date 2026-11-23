import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseCsv } from './database.ts'
import type { FuturesExchange, FuturesSource } from './futures-reference-types.ts'

type ReportKind = 'quotes' | 'settlement' | 'contracts'
type ReportSpec = { url: string; key: string; extension: string; format: 'shanghai' | 'zhengzhou' | 'cffex' }
export type ReportRow = Record<string, unknown>
export type Report = { rows: ReportRow[]; source: FuturesSource }

export const pandaFuturesUrl = 'https://www.pandaaiquant.com/docs/strategy/futures'

export function tradingDay(value: unknown): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$|^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const iso = (match[1] ? match.slice(1, 4) : match.slice(4, 7)).join('-')
  const stamp = new Date(iso)
  return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === iso ? iso : null
}

export function beijingTime(date: string, time: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time)
  return match ? `${date}T${match[1]}:${match[2]}:${match[3] ?? '00'}+08:00` : null
}

export function sourceFor(date: string, status: FuturesSource['status'], cutoff: string | null, url: string | null = null, provider: FuturesSource['provider'] = 'exchange'): FuturesSource {
  return { status, url, provider, reportDate: date, sha256: null, sourceUpdatedAt: null, firstPublishedAt: null, cutoff: cutoff ? 'unknown' : null }
}

function specification(exchange: FuturesExchange, kind: ReportKind, day: string): ReportSpec | null {
  if (exchange === 'SHFE' || exchange === 'INE') {
    const base = exchange === 'SHFE' ? 'https://www.shfe.com.cn' : 'https://www.ine.cn'
    const [path, key] = {
      quotes: ['tradedata/future/dailydata/kx', 'o_curinstrument'],
      settlement: ['busiparamdata/future/Settlement', 'Settlement'],
      contracts: ['busiparamdata/future/ContractBaseInfo', 'ContractBaseInfo'],
    }[kind] as [string, string]
    return { url: `${base}/data/${path}${day}.dat`, key, extension: 'json', format: 'shanghai' }
  }
  if (exchange === 'CZCE' && kind !== 'contracts') {
    const name = kind === 'quotes' ? 'FutureDataDaily' : 'FutureDataClearParams'
    const key = kind === 'quotes' ? '期货每日行情表' : '期货结算参数表'
    return { url: `https://www.czce.com.cn/cn/DFSStaticFiles/Future/${day.slice(0, 4)}/${day}/${name}.txt`, key, extension: 'txt', format: 'zhengzhou' }
  }
  if (exchange === 'CFFEX' && kind !== 'contracts') {
    const path = kind === 'quotes' ? 'hqsj/rtj' : 'jscs'
    const key = kind === 'quotes' ? '合约代码' : '期货合约结算业务参数表'
    return { url: `http://www.cffex.com.cn/sj/${path}/${day.slice(0, 6)}/${day.slice(-2)}/${day}_1.csv`, key, extension: 'csv', format: 'cffex' }
  }
  return null
}

function reportText(raw: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw) }
  catch { return new TextDecoder('gb18030', { fatal: true }).decode(raw) }
}

function decodeReport(raw: Uint8Array, spec: ReportSpec, kind: ReportKind, date: string): { rows: ReportRow[]; updated: string | null } {
  const content = reportText(raw)
  if (spec.format === 'shanghai') {
    const report = JSON.parse(content) as Record<string, unknown>
    const rows = report[spec.key]
    if (tradingDay(report.report_date) !== date || !Array.isArray(rows) || !rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) {
      throw new Error('Unexpected Shanghai report date or schema')
    }
    const match = /^(\d{8}) (\d{2}:\d{2}:\d{2})$/.exec(String(report.update_date ?? '').trim())
    const updatedDate = match && tradingDay(match[1])
    const updated = updatedDate && updatedDate >= date ? beijingTime(updatedDate, match![2]!) : null
    return { rows, updated }
  }
  const [title = '', ...lines] = content.trim().split(/\r?\n/)
  if (spec.format === 'zhengzhou') {
    const header = lines.shift()?.split('|').map(value => value.trim())
    if (!title.includes(spec.key) || !title.includes(date) || !header?.includes('合约代码')) throw new Error('Unexpected Zhengzhou report date or schema')
    const columns = kind === 'quotes' ? ['持仓量', '成交量(手)', '今结算'] : ['交易手续费', '手续费收取方式', '日内平今仓交易手续费', '交易保证金率(%)']
    if (!columns.every(column => header.includes(column))) throw new Error('Missing Zhengzhou report columns')
    const rows = lines.filter(line => line.includes('|')).map(line => {
      const cells = line.split('|')
      if (cells.length !== header.length) throw new Error('Unexpected Zhengzhou row length')
      return Object.fromEntries(header.map((key, index) => [key, cells[index]!.trim()]))
    })
    return { rows, updated: null }
  }
  if (kind === 'settlement' && (!title.includes(spec.key) || !title.includes(date.replaceAll('-', '')))) {
    throw new Error('Unexpected CFFEX settlement bulletin')
  }
  const optionsStart = lines.findIndex(line => line.trimStart().startsWith('期权合约结算业务参数表'))
  const csv = kind === 'quotes' ? content : (optionsStart === -1 ? lines : lines.slice(0, optionsStart)).join('\n')
  const columns = kind === 'quotes' ? [spec.key, '持仓量', '成交量', '今结算'] : [
    '期货合约', '交易手续费标准', '平今仓收取率', '合约多头保证金标准', '合约空头保证金标准',
  ]
  if (!columns.every(field => csv.split(/\r?\n/, 1)[0]?.split(',').includes(field))) throw new Error('Unexpected CFFEX report schema')
  return { rows: parseCsv(csv), updated: null }
}

async function boundedBody(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty exchange response')
  const limit = 4 * 1024 * 1024
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, size)
      size += value.byteLength
      if (size > limit) throw new Error('Exchange report exceeds size limit')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
}

export class FuturesReports {
  constructor(private readonly fetch: typeof globalThis.fetch, private readonly archive?: string) {}
  private async cached(exchange: FuturesExchange, kind: ReportKind, filename: string): Promise<Uint8Array | undefined> {
    if (!this.archive) return undefined
    try { return await readFile(join(this.archive, exchange, kind, filename)) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async read(exchange: FuturesExchange, kind: ReportKind, date: string, cutoff: string | null, signal?: AbortSignal): Promise<Report> {
    const day = date.replaceAll('-', '')
    const spec = specification(exchange, kind, day)
    const vendorArchive = !spec && kind === 'quotes' && (exchange === 'DCE' || exchange === 'GFEX')
    const source = sourceFor(date, spec || vendorArchive ? 'missing' : 'unsupported', cutoff,
      spec?.url ?? (vendorArchive ? pandaFuturesUrl : null), vendorArchive ? 'pandadata' : 'exchange')
    if (!spec && !vendorArchive) return { rows: [], source }
    try {
      let raw = await this.cached(exchange, kind, `${day}.${spec?.extension ?? 'csv'}`)
      if (spec && !raw) {
        const timeout = AbortSignal.timeout(12_000)
        const response = await this.fetch(spec.url, { redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
        if (!response.ok) {
          await response.body?.cancel()
          return { rows: [], source: { ...source, status: [404, 410].includes(response.status) ? 'missing' : 'error' } }
        }
        raw = await boundedBody(response)
      }
      if (!raw) return { rows: [], source }
      const { rows, updated } = spec ? decodeReport(raw, spec, kind, date)
        : { rows: parseCsv(reportText(raw)), updated: null }
      if (!spec && rows.some(row => row.exchange !== exchange || tradingDay(row.date) !== date)) throw new Error('Unexpected PandaData snapshot date or exchange')
      return {
        rows,
        source: { ...source, status: 'available', sha256: createHash('sha256').update(raw).digest('hex'),
          sourceUpdatedAt: updated, cutoff: cutoff && updated ? updated <= cutoff ? 'visible' : 'after_cutoff' : source.cutoff },
      }
    } catch {
      signal?.throwIfAborted()
      return { rows: [], source: { ...source, status: 'error' } }
    }
  }
}
