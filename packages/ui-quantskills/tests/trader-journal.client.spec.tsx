// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TraderJournal } from '../src/client/fly/TraderJournal.tsx'
import { flyApi } from '../src/client/fly/transport.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyApi: vi.fn() }))
const entry = (seq: number) => ({ seq, actor: 'fly', kind: 'decision', at: 1790744400, decision_id: '', payload: {} })
const first = { events: Array.from({ length: 20 }, (_, i) => entry(45 - i)), total: 45, page: 1, pages: 3, page_size: 20, snapshot: 45, has_new: false }
const renderJournal = () => render(<TraderJournal actors={{ fly: '交易员', system: '系统' }} formatEvent={event => `事件 ${event.seq}`}/>)

beforeEach(() => vi.mocked(flyApi).mockReset().mockImplementation(async path => {
  const query = new URL(path, 'http://localhost').searchParams
  if (query.get('actor') === 'system') return { ...first, events: [entry(2)], total: 1, page: 1, pages: 1 }
  if (query.get('page') === '2') return { ...first, events: Array.from({ length: 20 }, (_, i) => entry(25 - i)), page: 2 }
  return first
}))
afterEach(cleanup)

describe('trader journal', () => {
  it('deletes all sources and pages from a filtered view using the latest confirmed count', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    fireEvent.change(screen.getByLabelText('记录来源'), { target: { value: 'system' } })
    await screen.findByText('事件 2')
    vi.mocked(flyApi).mockImplementation(async path => path === 'journal/delete' ? { deleted: 47 }
      : path === 'journal?actor=all&page=1' ? { ...first, total: 47, snapshot: 47 }
      : { ...first, events: [], total: 0, page: 1, pages: 1 })
    fireEvent.click(screen.getByRole('button', { name: '删除全部', exact: true }))
    await screen.findByRole('dialog', { name: '删除全部运行记录？' })
    expect(screen.getByRole('dialog').textContent).toContain('所有来源、全部分页中的 47 条运行记录')
    expect(vi.mocked(flyApi).mock.calls.some(([path]) => path === 'journal/delete')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '确认删除 47 条' }))
    await screen.findByText('暂无记录')
    expect(flyApi).toHaveBeenCalledWith('journal/delete', { actor: 'all', snapshot: 47, confirm: true, all_matching: true })
  })

  it('keeps delete-all available for an empty source and never deletes when cancelled', async () => {
    vi.mocked(flyApi).mockImplementation(async path => String(path).includes('actor=system')
      ? { ...first, events: [], total: 0, pages: 1 } : first)
    renderJournal()
    await screen.findByText('事件 45')
    fireEvent.change(screen.getByLabelText('记录来源'), { target: { value: 'system' } })
    await screen.findByText('暂无记录')
    expect(screen.getByRole('button', { name: '删除全部', exact: true }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '删除全部', exact: true }))
    await screen.findByRole('dialog', { name: '删除全部运行记录？' })
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
    expect(vi.mocked(flyApi).mock.calls.some(([path]) => path === 'journal/delete')).toBe(false)
  })

  it('does not open a destructive confirmation when the all-record count fails', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    vi.mocked(flyApi).mockRejectedValueOnce(new Error('读取总数失败'))
    fireEvent.click(screen.getByRole('button', { name: '删除全部', exact: true }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(vi.mocked(flyApi).mock.calls.some(([path]) => path === 'journal/delete')).toBe(false)
  })

  it('pages server history in twenties and keeps the snapshot when paging', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    expect(screen.getAllByRole('article')).toHaveLength(20)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByText('事件 25')
    expect(screen.queryByText('事件 45')).toBeNull()
    expect(String(vi.mocked(flyApi).mock.calls.at(-1)?.[0])).toContain('page=2&snapshot=45')
    fireEvent.change(screen.getByLabelText('记录来源'), { target: { value: 'system' } })
    await screen.findByText('事件 2')
    expect(String(vi.mocked(flyApi).mock.calls.at(-1)?.[0])).toBe('journal?actor=system&page=1')
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('requires confirmation and sends only the selected IDs', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    fireEvent.click(screen.getByRole('button', { name: '删除记录 #45' }))
    expect(screen.getByRole('dialog').textContent).toContain('策略审计底账会保留')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(vi.mocked(flyApi).mock.calls.some(([path]) => path === 'journal/delete')).toBe(false)
    fireEvent.click(screen.getByLabelText('选择记录 #45'))
    fireEvent.click(screen.getByLabelText('选择记录 #44'))
    fireEvent.click(screen.getByRole('button', { name: '删除所选' }))
    vi.mocked(flyApi).mockImplementation(async (path, body) => path === 'journal/delete'
      ? { deleted: (body as { seqs: number[] }).seqs.length }
      : { ...first, events: first.events.slice(2), total: 43 })
    fireEvent.click(screen.getByRole('button', { name: '确认删除 2 条' }))
    await screen.findByText('已删除 2 条列表记录')
    await waitFor(() => expect(screen.queryByText('事件 45')).toBeNull())
    expect(flyApi).toHaveBeenCalledWith('journal/delete', { actor: 'all', snapshot: 45, confirm: true, seqs: [45, 44] })
  })

  it('freezes the filtered cleanup scope and keeps the dialog on failure', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    fireEvent.change(screen.getByLabelText('记录来源'), { target: { value: 'system' } })
    await screen.findByText('事件 2')
    fireEvent.click(screen.getByRole('button', { name: '清理此来源记录' }))
    expect(screen.getByRole('dialog').textContent).toContain('系统中本次已加载范围的全部 1 条记录')
    vi.mocked(flyApi).mockRejectedValueOnce(new Error('存储失败'))
    fireEvent.click(screen.getByRole('button', { name: '确认删除 1 条' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('dialog').textContent).toContain('存储失败')
    expect(flyApi).toHaveBeenCalledWith('journal/delete', { actor: 'system', snapshot: 45, confirm: true, all_matching: true })
    expect(screen.getByText('事件 2')).toBeTruthy()
  })

  it('selects twenty only and displays a clamped page after cleanup', async () => {
    renderJournal()
    await screen.findByText('事件 45')
    fireEvent.click(screen.getByLabelText('选择本页全部记录'))
    fireEvent.click(screen.getByRole('button', { name: '删除所选' }))
    vi.mocked(flyApi).mockImplementation(async path => path === 'journal/delete' ? { deleted: 20 }
      : { ...first, events: [], total: 0, page: 1, pages: 1 })
    fireEvent.click(screen.getByRole('button', { name: '确认删除 20 条' }))
    await screen.findByText('暂无记录')
    expect(screen.getByText('第 1 / 1 页')).toBeTruthy()
    expect(screen.getByRole('button', { name: '下一页' }).hasAttribute('disabled')).toBe(true)
    expect(vi.mocked(flyApi).mock.calls.find(([path]) => path === 'journal/delete')?.[1]).toMatchObject({ seqs: first.events.map(event => event.seq) })
  })
})
