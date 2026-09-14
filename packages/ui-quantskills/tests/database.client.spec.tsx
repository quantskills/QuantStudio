// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabasePage, type DatabaseAccess } from '../src/client/DatabasePage.tsx'
import type { DataSummary, DataResult } from '@deepseek-ai/dsh-panda-mcp'
afterEach(cleanup)
const item: DataSummary = { id: 'fixture', name: '研究行情', kind: 'timeseries', category: 'market', source: { kind: 'file' }, columns: ['date', 'close'], dateColumn: 'date', rowCount: 1, ttlSeconds: 3600, fetchedAt: '2026-09-12T00:00:00Z', expiresAt: '2099-09-12T01:00:00Z', from: '2026-09-10T00:00:00Z', to: '2026-09-10T00:00:00Z', bytes: 100 }
function access(): DatabaseAccess {
  return { list: vi.fn(async () => []), import: vi.fn(async () => item), fetch: vi.fn(async () => item), preview: vi.fn(async () => ({ dataset: item, status: 'hit' as const, reasons: [], rows: [{ date: '2026-09-10', close: 12 }], total: 1 })), query: vi.fn(async () => ({ dataset: item, status: 'insufficient' as const, reasons: ['可用行数不足 2'], rows: [], total: 1 })), refresh: vi.fn(async () => item), remove: vi.fn(async () => {}), categorize: vi.fn(async (_id, category) => ({ ...item, category })) }
}
describe('research database UI', () => {
  it('imports a CSV file with the selected metadata and opens its real preview', async () => {
    const api = access(); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: '添加数据', exact: true }))
    const dialog = screen.getByRole('dialog', { name: '添加研究数据' })
    const input = within(dialog).getByLabelText(/选择文件/)
    const file = new File(['date,close\n2026-09-10,12'], 'prices.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: async () => 'date,close\n2026-09-10,12' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect((within(dialog).getByRole('textbox', { name: '数据集名称' }) as HTMLInputElement).value).toBe('prices'))
    fireEvent.change(within(dialog).getByRole('textbox', { name: '数据集名称' }), { target: { value: '研究行情' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '导入并缓存' }))
    await screen.findByRole('region', { name: '数据详情' })
    expect(api.import).toHaveBeenCalledWith(expect.objectContaining({ name: '研究行情', format: 'csv', kind: 'auto', ttlSeconds: 3600 }))
    expect(await screen.findByRole('cell', { name: '12' })).toBeTruthy()
  })
  it('checks required rows and asks before removing the selected cache', async () => {
    const api = access(); vi.mocked(api.list).mockResolvedValue([item]); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: /^研究行情/ }))
    fireEvent.change(await screen.findByRole('spinbutton', { name: '所需最少条数' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '检查并按需更新' }))
    await screen.findByText(/暂不能满足：可用行数不足 2/)
    expect(api.query).toHaveBeenCalledWith({ id: 'fixture', minRows: 2, limit: 100 })
    expect(screen.queryByRole('cell', { name: '12' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '删除缓存' })); expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog', { name: '删除本地缓存' })).getByRole('button', { name: '删除缓存' }))
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('fixture'))
  })
  it('filters financial reports by subject rather than by whether they have dates', async () => {
    const financial: DataSummary = { ...item, id: 'financial', name: 'get_fina_reports', category: 'fundamental', source: { kind: 'pandadata', method: 'get_fina_reports', params: { symbol: '600519' } } }
    const news: DataSummary = { ...item, id: 'news', name: '每日快讯', category: 'news' }
    const api = access(); vi.mocked(api.list).mockResolvedValue([item, financial, news])
    vi.mocked(api.preview).mockResolvedValue({ dataset: financial, status: 'hit', reasons: [], rows: [], total: 1 })
    render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('tab', { name: /^基本面\s*1$/ }))
    const list = screen.getByRole('region', { name: '本地数据集' })
    expect(within(list).queryByRole('button', { name: /^研究行情/ })).toBeNull()
    fireEvent.click(within(list).getByRole('button', { name: /^财务报表.*600519/ }))
    await screen.findByRole('combobox', { name: '调整数据分类' })
    fireEvent.click(screen.getByRole('tab', { name: /^新闻\s*1$/ }))
    expect(within(list).getByRole('button', { name: /^每日快讯/ })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '数据详情' })).getByRole('heading', { name: '财务报表' })).toBeTruthy()
  })
  it('keeps the latest selection when a slower preview response arrives afterwards', async () => {
    const api = access(), second = { ...item, id: 'second', name: '第二份行情' }
    let firstResolve!: (result: DataResult) => void
    vi.mocked(api.list).mockResolvedValue([item, second])
    vi.mocked(api.preview).mockImplementation(id => id === item.id ? new Promise(resolve => { firstResolve = resolve }) : Promise.resolve({ dataset: second, status: 'hit', reasons: [], rows: [], total: 1 }))
    render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: /^研究行情/ }))
    fireEvent.click(screen.getByRole('button', { name: /^第二份行情/ }))
    await screen.findByRole('combobox', { name: '调整数据分类' })
    await act(async () => { firstResolve({ dataset: item, status: 'hit', reasons: [], rows: [], total: 1 }) })
    expect(within(screen.getByRole('region', { name: '数据详情' })).getByRole('heading', { name: '第二份行情' })).toBeTruthy()
  })
  it('saves a manual classification and refreshes the list counts', async () => {
    const api = access(); vi.mocked(api.list).mockResolvedValue([item]); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: /^研究行情/ }))
    const category = await screen.findByRole('combobox', { name: '调整数据分类' })
    vi.mocked(api.list).mockResolvedValue([{ ...item, category: 'fundamental' }])
    fireEvent.change(category, { target: { value: 'fundamental' } })
    await screen.findByRole('tab', { name: /^基本面\s*1$/ })
    expect(api.categorize).toHaveBeenCalledWith('fixture', 'fundamental')
    expect((category as HTMLSelectElement).value).toBe('fundamental')
  })
})

describe('database cache management', () => {
  const news: DataSummary = { ...item, id: 'news', name: '新闻缓存', category: 'news' }
  function mutable(initial: DataSummary[]) {
    const api = access(), data = new Map(initial.map(value => [value.id, value]))
    vi.mocked(api.list).mockImplementation(async () => [...data.values()])
    vi.mocked(api.remove).mockImplementation(async id => { data.delete(id) })
    return { api, data }
  }
  it('opens row deletion without selecting it and cancel keeps the cache', async () => {
    const { api } = mutable([item]); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: /^删除 研究行情/ }))
    expect(api.preview).not.toHaveBeenCalled(); expect(api.remove).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull(); expect(api.remove).not.toHaveBeenCalled()
  })
  it('deletes only selected rows from the current filter and closes deleted details', async () => {
    const { api, data } = mutable([item, news]); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: /^研究行情/ }))
    await screen.findByRole('cell', { name: '12' })
    fireEvent.click(screen.getByRole('tab', { name: /^行情/ }))
    fireEvent.click(screen.getByRole('button', { name: '批量管理' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '全选当前列表' }))
    fireEvent.click(screen.getByRole('button', { name: '删除所选（1）' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除缓存' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.remove).toHaveBeenCalledTimes(1); expect(api.remove).toHaveBeenCalledWith(item.id)
    expect([...data.keys()]).toEqual(['news']); expect(screen.queryByRole('cell', { name: '12' })).toBeNull()
  })
  it('clears all confirmed categories even when filtered, preserving arrivals after confirmation', async () => {
    const { api, data } = mutable([item, news]); render(<DatabasePage access={api}/>)
    fireEvent.click(await screen.findByRole('tab', { name: /^新闻\s*1$/ }))
    fireEvent.click(screen.getByRole('button', { name: '清空全部缓存' }))
    const dialog = screen.getByRole('dialog', { name: '清空全部缓存' })
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    expect(api.remove).not.toHaveBeenCalled()
    data.set('new', { ...item, id: 'new', name: '新到达的数据' })
    fireEvent.click(within(dialog).getByRole('button', { name: '确认清空' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.remove).toHaveBeenCalledTimes(2); expect([...data.keys()]).toEqual(['new'])
    expect(screen.getByRole('tab', { name: /^全部\s*1$/ })).toBeTruthy()
  })
  it('keeps failed rows visible and retries only failures after a partial clear', async () => {
    const { api, data } = mutable([item, news])
    vi.mocked(api.remove).mockRejectedValueOnce(new Error('缓存正被占用'))
    render(<DatabasePage access={api}/>)
    await screen.findByRole('button', { name: /^研究行情/ })
    fireEvent.click(screen.getByRole('button', { name: '清空全部缓存' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认清空' }))
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByText(/1 份缓存未删除/)
    expect([...data.keys()]).toEqual([item.id])
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('button', { name: '确认清空' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.remove).toHaveBeenNthCalledWith(3, item.id); expect(data.size).toBe(0)
  })
})
