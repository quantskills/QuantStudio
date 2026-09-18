/** Durable local data catalog. Cached responses retain their source and coverage. */
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_CATEGORIES, inferDataCategory, type DataCategory } from './data-category.ts'
export type { DataCategory } from './data-category.ts'

export interface DataSource { kind: 'file' | 'http' | 'pandadata'; url?: string; method?: string; params?: Record<string, JsonValue>; filename?: string; rollingDay?: boolean }
export interface DataImport { name: string; format: 'csv' | 'json'; content: string; kind: 'timeseries' | 'table' | 'auto'; category?: DataCategory; dateColumn?: string; ttlSeconds: number }
export interface DataFetch { name: string; source: DataSource; kind: 'timeseries' | 'table' | 'auto'; category?: DataCategory; dateColumn?: string; ttlSeconds: number }
export interface DataSummary extends DataFetch { id: string; kind: 'timeseries' | 'table'; category: DataCategory; columns: string[]; rowCount: number; fetchedAt: string; expiresAt: string; from?: string; to?: string; bytes: number }
interface DataDocument extends DataSummary { rows: Record<string, JsonValue>[]; raw?: unknown }
export interface DataQuery { id: string; from?: string; to?: string; minRows?: number; limit?: number; offset?: number; refresh?: boolean }
export interface DataResult { dataset: DataSummary; status: 'hit' | 'refreshed' | 'insufficient'; reasons: string[]; rows: Record<string, JsonValue>[]; total: number; nextOffset?: number }
export type PandaDataCall = (method: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>
const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 100_000
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(value) ?? 'null'
const summary = ({ rows: _rows, raw: _raw, ...item }: DataDocument): DataSummary => item
function validId(id: string) { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('无效的数据集标识'); return id }
function instant(value: unknown): number {
  if (typeof value === 'number' && /^\d{8}$/.test(String(value))) return instant(String(value))
  if (typeof value === 'number') return value > 1e11 ? value : value > 1e9 ? value * 1000 : NaN
  if (typeof value !== 'string' || !value.trim()) return NaN
  const date = /^\d{8}$/.test(value) ? `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}` : value
  return Date.parse(date)
}
function boundary(value: string | undefined, end = false): number | undefined {
  if (value === undefined || value === '') return undefined
  const date = instant(value)
  if (!Number.isFinite(date)) throw new Error('日期格式无效，请使用 YYYY-MM-DD 或 ISO 时间')
  return date + (end && /^\d{4}-\d{2}-\d{2}$/.test(value) ? 86_399_999 : 0)
}
const DATE_COLUMNS = ['published_at', 'pub_time', 'publish_time', 'pub_date', 'ann_date', 'info_date', 'trade_date', 'date', 'datetime', 'time', 'timestamp', 'report_date', 'end_date', '发布日期', '公告日期', '日期', '时间']
function detectDateColumn(rows: Record<string, unknown>[], columns: string[]): string | undefined {
  return DATE_COLUMNS.map(name => columns.find(column => column.toLowerCase() === name)).find(column => column !== undefined && rows.every(row => Number.isFinite(instant(row[column]))))
}
/** RFC 4180 style quoting, including quoted newlines and escaped double quotes. */
export function parseCsv(text: string): Record<string, unknown>[] {
  const matrix: string[][] = []; let row: string[] = [], cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else if (quoted || cell === '') quoted = !quoted; else cell += c }
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) matrix.push(row); row = []; cell = '' }
    else cell += c
  }
  if (quoted) throw new Error('CSV 引号未闭合')
  row.push(cell); if (row.some(Boolean)) matrix.push(row)
  const headers = matrix.shift()?.map(h => h.trim()) ?? []
  if (!headers.length || headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('CSV 需要非空且不重复的列名')
  return matrix.map((values, i) => { if (values.length !== headers.length) throw new Error(`CSV 第 ${i + 2} 行列数不一致`); return Object.fromEntries(headers.map((h, j) => [h, values[j]])) })
}
export function dataRows(raw: unknown): Record<string, unknown>[] {
  if (typeof raw === 'string') return dataRows(JSON.parse(raw))
  if (Array.isArray(raw)) {
    if (raw.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) return raw as Record<string, unknown>[]
    throw new Error('JSON 必须是对象数组，或包含 data / rows / records 的对象')
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (obj.error || obj.isError === true || obj.success === false || obj.ok === false || obj.status === 'error') throw new Error('数据源返回错误，未写入缓存')
    if (obj.truncated === true) throw new Error('数据源返回被截断的预览，请缩小查询日期范围；未写入缓存')
    const matrix = obj.rows ?? obj.data
    if (Array.isArray(obj.columns) && Array.isArray(matrix) && matrix.every(Array.isArray)) {
      const columns = obj.columns
      if (!columns.length || columns.some(c => typeof c !== 'string' || !c.trim()) || new Set(columns).size !== columns.length
        || matrix.some(row => row.length !== columns.length)) throw new Error('表格列名或行列数不一致，未写入缓存')
      return matrix.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])))
    }
    for (const key of ['data', 'rows', 'records', 'result', 'items']) if (obj[key] !== undefined) return dataRows(obj[key])
  }
  throw new Error('没有识别到表格数据；请检查接口返回格式')
}
export class LocalDatabase {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(private readonly root: string, private readonly panda: PandaDataCall, private readonly now: () => number = Date.now) {}
  private path(id: string) { return join(this.root, `${validId(id)}.json`) }
  private async read(id: string): Promise<DataDocument> {
    const doc = JSON.parse(await readFile(this.path(id), 'utf8')) as DataDocument
    return { ...doc, category: inferDataCategory(doc) }
  }
  private mutate<T>(fn: () => Promise<T>): Promise<T> { const job = this.tail.then(fn); this.tail = job.catch(() => {}); return job }
  private async write(doc: DataDocument): Promise<DataDocument> {
    doc.bytes = Buffer.byteLength(JSON.stringify(doc))
    if (doc.bytes > MAX_BYTES) throw new Error('单个数据集不能超过 10 MB')
    await mkdir(this.root, { recursive: true }); const temp = join(this.root, `${validId(doc.id)}.${randomUUID()}.tmp`)
    try { await writeFile(temp, JSON.stringify(doc), { flag: 'wx' }); await rename(temp, this.path(doc.id)) }
    finally { await rm(temp, { force: true }) }
    return doc
  }
  async list(): Promise<DataSummary[]> {
    await this.tail; await mkdir(this.root, { recursive: true })
    const items: DataSummary[] = []
    for (const entry of await readdir(this.root, { withFileTypes: true })) if (entry.isFile() && /^[\w-]+\.json$/.test(entry.name)) items.push(summary(await this.read(entry.name.slice(0, -5))))
    return items.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
  }
  private async save(input: DataFetch, rows: Record<string, unknown>[], id: string = randomUUID(), raw?: unknown): Promise<DataDocument> {
    if (!input.name.trim() || input.name.length > 160) throw new Error('请输入 1–160 字的数据集名称')
    if (!['timeseries', 'table', 'auto'].includes(input.kind)) throw new Error('数据日期设置无效')
    if (input.category !== undefined && !DATA_CATEGORIES.includes(input.category)) throw new Error('数据分类无效')
    if (!Number.isFinite(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > 31_536_000) throw new Error('缓存有效期应为 1 秒至 365 天')
    if (!rows.length || rows.length > MAX_ROWS) throw new Error('数据集需要 1–100000 行')
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
    if (columns.length > 500) throw new Error('最多支持 500 列')
    const dateColumn = input.dateColumn?.trim() || (input.kind !== 'table' ? detectDateColumn(rows, columns) : undefined)
    const kind = input.kind === 'auto' ? dateColumn ? 'timeseries' : 'table' : input.kind
    let from: string | undefined, to: string | undefined
    if (kind === 'timeseries') {
      if (!dateColumn || !columns.includes(dateColumn)) throw new Error('按日期查询需要指定有效的日期列')
      const dates = rows.map(row => instant(row[dateColumn]))
      if (dates.some(d => !Number.isFinite(d))) throw new Error('日期列包含空值或无法识别的日期')
      from = new Date(Math.min(...dates)).toISOString(); to = new Date(Math.max(...dates)).toISOString()
    }
    const doc: DataDocument = { ...input, kind, category: inferDataCategory({ ...input, columns }), ...(dateColumn ? { dateColumn } : {}), id, rows: rows as Record<string, JsonValue>[], columns, rowCount: rows.length, fetchedAt: new Date(this.now()).toISOString(), expiresAt: new Date(this.now() + input.ttlSeconds * 1000).toISOString(), ...(from ? { from, to: to! } : {}), bytes: 0, ...(raw === undefined ? {} : { raw }) }
    return this.mutate(() => this.write(doc))
  }
  async import(input: DataImport): Promise<DataSummary> {
    if (Buffer.byteLength(input.content) > MAX_BYTES) throw new Error('文件不能超过 10 MB')
    const rows = input.format === 'csv' ? parseCsv(input.content) : dataRows(JSON.parse(input.content.replace(/^\uFEFF/, '')))
    return summary(await this.save({ name: input.name, kind: input.kind, ...(input.category ? { category: input.category } : {}), ttlSeconds: input.ttlSeconds, ...(input.dateColumn ? { dateColumn: input.dateColumn } : {}), source: { kind: 'file' } }, rows))
  }
  private async sourceData(source: DataSource, signal?: AbortSignal): Promise<unknown> {
    if (source.kind === 'pandadata') {
      if (!source.method?.startsWith('get_')) throw new Error('PandaData 仅支持已查阅文档的 get_* 方法')
      return this.panda(source.method, source.params ?? {}, signal)
    }
    if (source.kind !== 'http' || !source.url) throw new Error('本地导入数据需重新上传文件，不能在线刷新')
    const url = new URL(source.url)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请输入不含账号密码的 HTTP(S) 数据地址')
    const timeout = AbortSignal.timeout(30_000)
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    if (!response.ok) throw new Error(`数据源返回 HTTP ${response.status}`)
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('数据源返回超过 10 MB') }
    const reader = response.body?.getReader(); if (!reader) throw new Error('数据源没有返回内容')
    const chunks: Uint8Array[] = []; let bytes = 0
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > MAX_BYTES) throw new Error('数据源返回超过 10 MB'); chunks.push(part.value) } }
    finally { await reader.cancel() }
    const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '')
    return /csv/i.test(response.headers.get('content-type') ?? '') || /\.csv$/i.test(url.pathname) ? parseCsv(text) : JSON.parse(text)
  }
  async fetch(input: DataFetch, signal?: AbortSignal, id?: string): Promise<DataSummary> {
    if (input.source.rollingDay) {
      if (input.source.kind !== 'pandadata' || input.source.method !== 'get_future_min') throw new Error('随日期更新仅支持 PandaData 期货分钟行情')
      const day = (offset: number) => new Date(this.now() + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
      // Dates select trading-day labels: Friday's night session can belong to Monday.
      // Future labels include the current night session; consumers still reject future bars.
      input = { ...input, source: { ...input.source, params: { ...input.source.params, start_date: day(0), end_date: day(3) } } }
    }
    const raw = await this.sourceData(input.source, signal)
    return summary(await this.save(input, dataRows(raw), id))
  }
  async query(query: DataQuery, signal?: AbortSignal): Promise<DataResult> {
    const from = boundary(query.from), to = boundary(query.to, true)
    if (from !== undefined && to !== undefined && from > to) throw new Error('开始日期不能晚于结束日期')
    const minRows = query.minRows ?? 1, limit = query.limit ?? 100, offset = query.offset ?? 0
    if (![minRows, limit, offset].every(Number.isInteger) || minRows < 0 || minRows > MAX_ROWS || limit < 1 || limit > 5000 || offset < 0) throw new Error('条数或分页参数无效（每页最多 5000 行）')
    let doc = await this.read(query.id), refreshed = false
    const filtered = () => doc.rows.filter(row => { if (from === undefined && to === undefined) return true; const value = instant(row[doc.dateColumn ?? '']); return (from === undefined || value >= from) && (to === undefined || value <= to) })
    const reasons = () => {
      const out: string[] = []
      if (this.now() >= Date.parse(doc.expiresAt)) out.push('缓存已过期')
      if ((from !== undefined || to !== undefined) && !doc.dateColumn) out.push('这份数据没有可用于范围查询的日期列')
      if (from !== undefined && (!doc.from || Date.parse(doc.from) > from)) out.push('开始日期覆盖不足')
      // A date-only request asks for that trading day, not an artificial end-of-day tick.
      if (to !== undefined && (!doc.to || Date.parse(doc.to) < boundary(query.to)!)) out.push('结束日期覆盖不足')
      if (filtered().length < minRows) out.push(`可用行数不足 ${minRows}`)
      return out
    }
    if (reasons().length && query.refresh !== false && doc.source.kind !== 'file') {
      const input: DataFetch = { name: doc.name, kind: doc.kind, category: doc.category, source: doc.source, ttlSeconds: doc.ttlSeconds, ...(doc.dateColumn ? { dateColumn: doc.dateColumn } : {}) }
      // Only amend parameters already present in the user's documented source definition.
      if (input.source.kind === 'pandadata' && input.source.params) {
        const params = { ...input.source.params }
        if (query.from && 'start_date' in params) params.start_date = /^\d{8}$/.test(String(params.start_date)) ? query.from.replaceAll('-', '') : query.from
        if (query.to && 'end_date' in params) params.end_date = /^\d{8}$/.test(String(params.end_date)) ? query.to.replaceAll('-', '') : query.to
        if (typeof params.limit === 'number') params.limit = Math.max(params.limit, minRows)
        input.source = { ...input.source, params }
      }
      await this.fetch(input, signal, doc.id); doc = await this.read(doc.id); refreshed = true
    }
    const missing = reasons(), rows = filtered()
    return { dataset: summary(doc), status: missing.length ? 'insufficient' : refreshed ? 'refreshed' : 'hit', reasons: missing, rows: missing.length ? [] : rows.slice(offset, offset + limit), total: rows.length, ...(!missing.length && offset + limit < rows.length ? { nextOffset: offset + limit } : {}) }
  }
  /** Preview is explicitly allowed to show stale rows, and always returns freshness metadata. */
  async preview(id: string): Promise<DataResult> { const doc = await this.read(id); return { dataset: summary(doc), status: this.now() >= Date.parse(doc.expiresAt) ? 'insufficient' : 'hit', reasons: this.now() >= Date.parse(doc.expiresAt) ? ['缓存已过期'] : [], rows: doc.rows.slice(0, 100), total: doc.rowCount } }
  async remove(id: string): Promise<void> { await this.mutate(() => rm(this.path(id), { force: true })) }
  async categorize(id: string, category: DataCategory): Promise<DataSummary> {
    if (!DATA_CATEGORIES.includes(category)) throw new Error('数据分类无效')
    return this.mutate(async () => summary(await this.write({ ...await this.read(id), category })))
  }
  async cachedPanda(args: Record<string, unknown>, call: () => Promise<unknown>): Promise<unknown> {
    const method = String(args.method ?? '')
    const params = typeof args.params_json === 'string' ? JSON.parse(args.params_json) as Record<string, unknown> : args.params as Record<string, unknown> ?? {}
    const id = `panda-${createHash('sha256').update(canonical({ method, params })).digest('hex').slice(0, 32)}`
    let previous: DataDocument | undefined
    try { previous = await this.read(id); if (previous.raw !== undefined && this.now() < Date.parse(previous.expiresAt)) return previous.raw } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    const raw = await call()
    try {
      const rows = dataRows(raw)
      await this.save({ name: method, source: { kind: 'pandadata', method, params: params as Record<string, JsonValue> }, kind: 'auto', ...(previous ? { category: previous.category } : {}), ttlSeconds: 300 }, rows, id, raw)
    } catch { /* Non-tabular responses remain usable, but are never mislabeled as a cache hit. */ }
    return raw
  }
}
