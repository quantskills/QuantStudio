// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TradingGuide } from '../src/client/TradingGuide.tsx'

afterEach(() => { cleanup(); localStorage.clear() })
it('opens the drawer guide even when the inline guide was collapsed and closes before following its action', () => {
  localStorage.setItem('qs-guide-v1-JEV', 'closed')
  const action = vi.fn()
  render(<TradingGuide compact name="JEV" steps={[{ title: '连接', status: '待连接', body: '配置说明', note: '先检查连接', action: { label: '去配置', run: action } }]} troubleshooting={[{ title: '为什么等待行情？', body: '检查实际合约与时间。' }]}/> )
  fireEvent.click(screen.getByRole('button', { name: '快速上手' }))
  expect(screen.getByRole('dialog', { name: 'JEV快速上手' })).toBeTruthy()
  expect(screen.getByText('配置说明')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '打开新手引导' })).toBeNull()
  expect(action).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '去配置 ↗' }))
  expect(action).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('keeps guide navigation separate from actions and remembers only collapsed state per product', () => {
  const action = vi.fn()
  const steps = [
    { title: '连接', status: '待连接', body: '配置说明', note: '连接与下单不同', action: { label: '去配置', run: action } },
    { title: '检查', status: '待检查', body: '核对账户与实际合约', note: '停止不撤单' },
  ]
  const first = render(<TradingGuide name="JEV" steps={steps} troubleshooting={[]}/> )
  fireEvent.click(screen.getByRole('button', { name: '下一步说明 →' }))
  expect(screen.getByText('核对账户与实际合约')).toBeTruthy()
  expect(action).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '上一步说明' }))
  fireEvent.click(screen.getByRole('button', { name: '去配置 ↗' }))
  expect(action).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '收起新手引导' }))
  first.unmount()
  render(<><TradingGuide name="JEV" steps={steps} troubleshooting={[]}/><TradingGuide name="果蝇" steps={steps} troubleshooting={[]}/></>)
  expect(screen.getAllByRole('button', { name: '打开新手引导' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: '收起新手引导' })).toHaveLength(1)
})
