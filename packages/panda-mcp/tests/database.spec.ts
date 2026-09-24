import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dataRows, LocalDatabase, parseCsv } from '../src/database.ts'
import { inferDataCategory } from '../src/data-category.ts'

const roots: string[] = []
afterEach(async () => { vi.unstubAllGlobals(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function setup(panda = vi.fn(async () => [{ date: '2026-09-10', close: 12 }]), now = () => Date.parse('2026-09-12T00:00:00Z')) {
  const root = await mkdtemp(join(tmpdir(), 'qs-data-')); roots.push(root)
  return { root, panda, store: new LocalDatabase(root, panda, now) }
}
const data = { name: '研究行情', kind: 'timeseries' as const, ttlSeconds: 60, dateColumn: 'date' }
describe('local research database', () => {
  it('accepts the PandaData column/row matrix but rejects truncated or malformed previews', () => {
    const result = { type: 'dataframe', columns: ['datetime', 'close'], rows: [['2026-09-18 11:30:00', 3050]], truncated: false }
    expect(dataRows({ ok: true, result })).toEqual([{ datetime: '2026-09-18 11:30:00', close: 3050 }])
    expect(() => dataRows({ result: { ...result, truncated: true, total_rows: 2000 } })).toThrow('截断')
    expect(() => dataRows({ ...result, rows: [[3050]] })).toThrow('行列数')
    expect(() => dataRows({ ...result, columns: ['close', 'close'] })).toThrow('列名')
  })
  it('retrieves complete minute history by splitting truncated PandaData date windows', async () => {
    const { root } = await setup()
    const rows = ['17', '18', '21', '22', '23', '24'].flatMap((day, index) => Array.from({ length: index === 5 ? 39 : 240 }, (_, minute) =>
      [`2026-09-${day} ${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`, 'IF2612', minute + 4400]))
    const panda = vi.fn(async (_method, params) => {
      const selected = rows.filter(row => String(row[0]).slice(0, 10).replaceAll('-', '') >= params.start_date && String(row[0]).slice(0, 10).replaceAll('-', '') <= params.end_date)
      return { ok: true, result: { type: 'dataframe', columns: ['datetime', 'trading_code', 'close'], rows: selected.slice(0, 1000), total_rows: selected.length, truncated: selected.length > 1000 } }
    })
    const store = new LocalDatabase(root, panda)
    const params = { symbol: 'IF2612.CFE', start_date: '20260917', end_date: '20260927', frequency: '1m', fields: ['datetime', 'trading_code', 'close'] }
    const item = await store.fetch({ ...data, dateColumn: 'datetime', source: { kind: 'pandadata', method: 'get_future_min', params } })
    const result = await store.query({ id: item.id, limit: 5000 })
    expect(result.total).toBe(1239)
    expect(result.rows.at(-1)?.datetime).toBe('2026-09-24 09:38:00')
    expect(item.source.params).toEqual(params)
    expect(panda.mock.calls.map(([, request]) => [request.start_date, request.end_date])).toEqual([
      ['20260917', '20260927'], ['20260917', '20260922'], ['20260923', '20260927'],
    ])
    expect(panda).toHaveBeenLastCalledWith('get_future_min', { ...params, start_date: '20260923' }, undefined)
  })
  it('never commits a partial split refresh when a single-day preview is still truncated', async () => {
    const { root } = await setup()
    let truncate = false
    const panda = vi.fn(async (_method, params) => ({ result: { columns: ['date', 'close'], rows: [[params.start_date, 4400]], truncated: truncate && params.start_date !== '20260917' } }))
    const store = new LocalDatabase(root, panda)
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_future_min', params: { start_date: '20260917', end_date: '20260919' } } })
    const before = await readFile(join(root, item.id + '.json'), 'utf8')
    truncate = true
    // The broad request and its later slice are truncated; the first slice is complete.
    panda.mockImplementation(async (_method, params) => ({ result: { columns: ['date', 'close'], rows: [[params.start_date, 4400]], truncated: params.start_date !== params.end_date || params.start_date === '20260919' } }))
    await expect(store.fetch(item, undefined, item.id)).rejects.toThrow('截断')
    expect(await readFile(join(root, item.id + '.json'), 'utf8')).toBe(before)
    expect(panda).toHaveBeenCalledTimes(6)
  })
  it('rolls an opted-in minute source to the current Shanghai date on refresh, without growing the request window', async () => {
    let clock = Date.parse('2026-09-18T15:59:00Z')
    const { store, panda } = await setup(undefined, () => clock)
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_future_min', rollingDay: true, params: { symbol: 'RB2610.SHF', start_date: '20260917', end_date: '20260917', frequency: '1m' } } })
    expect(panda).toHaveBeenLastCalledWith('get_future_min', expect.objectContaining({ start_date: '20260918', end_date: '20260921' }), undefined)
    clock += 120000
    const refreshed = await store.query({ id: item.id })
    expect(panda).toHaveBeenLastCalledWith('get_future_min', expect.objectContaining({ start_date: '20260919', end_date: '20260922' }), undefined)
    expect(refreshed.dataset.source.params).toMatchObject({ start_date: '20260919', end_date: '20260922' })
    await expect(store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_daily', rollingDay: true } })).rejects.toThrow('期货分钟')
  })
  it('classifies research subjects independently of storage shape', () => {
    expect(inferDataCategory({ name: '行情研究', source: { method: 'get_fina_reports' }, columns: ['date', 'quarter'] })).toBe('fundamental')
    expect(inferDataCategory({ name: '数据', source: { method: 'get_fina_performance' }, columns: ['info_date', 'roe_weighted'] })).toBe('fundamental')
    expect(inferDataCategory({ name: '公司公告', columns: ['date', 'title'] })).toBe('news')
    expect(inferDataCategory({ name: '导入文件', columns: ['title', 'published_at', 'content'] })).toBe('news')
    expect(inferDataCategory({ name: '导入文件', columns: ['date', 'close'] })).toBe('market')
    expect(inferDataCategory({ name: '研究笔记', columns: ['date', 'value'] })).toBe('other')
  })
  it('reads legacy financial caches without rewriting their data or freshness', async () => {
    const { root, store } = await setup()
    const item = await store.import({ ...data, name: 'get_fina_reports', format: 'json', content: '[{"date":"2026-09-10","roe":12}]' })
    const path = join(root, item.id + '.json'), legacy = JSON.parse(await readFile(path, 'utf8'))
    delete legacy.category; await writeFile(path, JSON.stringify(legacy))
    const before = await readFile(path, 'utf8'), result = await store.preview(item.id)
    expect(result.dataset.category).toBe('fundamental'); expect(result.dataset.kind).toBe('timeseries')
    expect(result.dataset.fetchedAt).toBe(item.fetchedAt); expect(result.rows[0]?.roe).toBe(12)
    expect(await readFile(path, 'utf8')).toBe(before)
  })
  it('automatically recognizes publication dates, and accepts data with no date column', async () => {
    const { store } = await setup()
    const news = await store.import({ name: '财经快讯', kind: 'auto', ttlSeconds: 60, format: 'json', content: '[{"published_at":"2026-09-10","title":"新闻","content":"摘要"}]' })
    expect(news).toMatchObject({ category: 'news', kind: 'timeseries', dateColumn: 'published_at' })
    const fundamental = await store.import({ name: '公司资料', kind: 'auto', ttlSeconds: 60, format: 'json', content: '[{"name":"公司甲","sector":"科技"}]' })
    expect(fundamental).toMatchObject({ category: 'fundamental', kind: 'table' })
  })
  it('persists manual categories across restart and refresh without changing source data', async () => {
    const { root, store, panda } = await setup()
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_daily' } })
    const changed = await store.categorize(item.id, 'other')
    expect(changed.fetchedAt).toBe(item.fetchedAt)
    const reopened = new LocalDatabase(root, panda, () => Date.parse('2026-09-12T00:02:00Z'))
    const result = await reopened.query({ id: item.id })
    expect(result.dataset.category).toBe('other'); expect(result.status).toBe('refreshed')
    expect(result.rows[0]?.close).toBe(12)
    await expect(store.categorize(item.id, 'invalid' as never)).rejects.toThrow('分类无效')
  })
  it('imports quoted CSV and keeps cache and coverage across restart', async () => {
    const { root, store, panda } = await setup()
    const item = await store.import({ ...data, format: 'csv', content: '\uFEFFdate,note,close\r\n2026-09-10,"line one\nline two, ok",12\r\n2026-09-11,"say ""hi""",13' })
    const reopened = new LocalDatabase(root, panda, () => Date.parse('2026-09-12T00:00:10Z'))
    const result = await reopened.query({ id: item.id, from: '2026-09-10', to: '2026-09-11', minRows: 2 })
    expect(result.status).toBe('hit'); expect(result.rows[0]?.note).toContain('\n'); expect(result.dataset.rowCount).toBe(2)
    expect(panda).not.toHaveBeenCalled()
  })
  it('does not return stale local data to AI as a successful result', async () => {
    let clock = Date.parse('2026-09-12T00:00:00Z')
    const { store } = await setup(undefined, () => clock)
    const item = await store.import({ ...data, format: 'json', content: '[{"date":"2026-09-10","close":12}]' })
    clock += 61_000
    const result = await store.query({ id: item.id })
    expect(result.status).toBe('insufficient'); expect(result.rows).toEqual([]); expect(result.reasons).toContain('缓存已过期')
    expect((await store.preview(item.id)).rows).toHaveLength(1)
  })
  it('refreshes once when expired, then uses local rows without another remote call', async () => {
    let clock = Date.parse('2026-09-12T00:00:00Z')
    const { store, panda } = await setup(undefined, () => clock)
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_daily', params: {} } })
    clock += 61_000
    expect((await store.query({ id: item.id })).status).toBe('refreshed')
    expect((await store.query({ id: item.id })).status).toBe('hit'); expect(panda).toHaveBeenCalledTimes(2)
  })
  it('extends existing documented date and limit parameters but rejects still-insufficient rows', async () => {
    const { store, panda } = await setup()
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_daily', params: { start_date: '20260910', end_date: '20260910', limit: 1 } } })
    const result = await store.query({ id: item.id, from: '2026-09-01', to: '2026-09-11', minRows: 10 })
    expect(panda).toHaveBeenLastCalledWith('get_daily', { start_date: '20260901', end_date: '20260911', limit: 10 }, undefined)
    expect(result.status).toBe('insufficient'); expect(result.rows).toEqual([]); expect(panda).toHaveBeenCalledTimes(2)
  })
  it('keeps existing cache if the remote refresh fails', async () => {
    const { store, panda } = await setup()
    const item = await store.fetch({ ...data, source: { kind: 'pandadata', method: 'get_daily' } })
    panda.mockRejectedValueOnce(new Error('offline'))
    await expect(store.query({ id: item.id, minRows: 2 })).rejects.toThrow('offline')
    expect((await store.preview(item.id)).rows).toHaveLength(1)
  })
  it('caches canonical Panda requests but never mixes different parameter sets', async () => {
    const { store } = await setup()
    const call = vi.fn(async () => ({ data: [{ symbol: 'ABC', close: 1 }] }))
    const args = { method: 'get_quotes', params: { b: 2, a: 1 } }
    await store.cachedPanda(args, call)
    await store.cachedPanda({ method: 'get_quotes', params_json: '{"a":1,"b":2}' }, call)
    expect(call).toHaveBeenCalledTimes(1)
    await store.cachedPanda({ method: 'get_quotes', params: { a: 2 } }, call)
    expect(call).toHaveBeenCalledTimes(2); expect(await store.list()).toHaveLength(2)
  })
  it('does not cache failed or non-tabular Panda responses', async () => {
    const { store } = await setup()
    const call = vi.fn(async () => ({ error: 'reauth_required' }))
    await store.cachedPanda({ method: 'get_quotes' }, call); await store.cachedPanda({ method: 'get_quotes' }, call)
    expect(call).toHaveBeenCalledTimes(2); expect(await store.list()).toEqual([])
  })
  it('imports an external JSON endpoint with a bounded read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"rows":[{"name":"公司甲","sector":"科技"}]}', { headers: { 'content-type': 'application/json' } })))
    const { store } = await setup()
    const item = await store.fetch({ name: '企业名录', kind: 'table', ttlSeconds: 3600, source: { kind: 'http', url: 'https://example.test/companies' } })
    expect((await store.query({ id: item.id })).rows[0]?.name).toBe('公司甲')
    await expect(store.fetch({ ...item, source: { kind: 'http', url: 'file:///etc/passwd' } })).rejects.toThrow('HTTP(S)')
  })
  it('validates dates, pagination and CSV before storing data', async () => {
    const { store } = await setup()
    expect(() => parseCsv('a,a\n1,2')).toThrow('不重复')
    expect(() => parseCsv('a,b\n1')).toThrow('列数')
    await expect(store.import({ ...data, format: 'json', content: '[{"date":"nonsense"}]' })).rejects.toThrow('日期')
    const item = await store.import({ ...data, format: 'json', content: '[{"date":"2026-09-10"}]' })
    await expect(store.query({ id: item.id, limit: 6000 })).rejects.toThrow('分页')
    await expect(store.query({ id: item.id, from: '2026-10-10', to: '2026-09-10' })).rejects.toThrow('晚于')
    await expect(store.remove('../outside')).rejects.toThrow('标识')
    await store.remove(item.id); expect(await store.list()).toEqual([])
  })
})
