// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TradingGuide } from '../src/client/TradingGuide.tsx'

afterEach(() => { cleanup(); localStorage.clear() })
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
