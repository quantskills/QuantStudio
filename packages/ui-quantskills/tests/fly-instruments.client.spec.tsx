// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { FlyInstruments, type FlyInstrument } from '../src/client/fly/FlyInstruments.tsx'
import { deliveryMonths } from '../src/client/fly/FlyInstrumentContract.tsx'
afterEach(cleanup)

function Picker() {
  const [items, setItems] = useState<FlyInstrument[]>([])
  return <><FlyInstruments instruments={items} onChange={setItems} contest={undefined} accountKey="" invalid={false}/><output data-testid="selection">{JSON.stringify(items)}</output></>
}
it('selects varieties across all six exchanges and retains selections across searches', () => {
  render(<Picker/> )
  for (const [search, label] of [['cu', '铜 · cu'], ['MA', '甲醇 · ma'], ['TL', '30年期国债 · tl'], ['LC', '碳酸锂 · lc']]) {
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索期货品种' }), { target: { value: search } })
    fireEvent.click(screen.getByRole('checkbox', { name: label }))
  }
  const selected = JSON.parse(screen.getByTestId('selection').textContent!)
  expect(selected.map((i: FlyInstrument) => i.exchange)).toEqual(['SHF','CZC','CFE','GFE'])
  expect(selected.map((i: FlyInstrument) => i.product)).toEqual(['cu','ma','TL','lc'])
})
it('accepts a manual future variety and preserves DCE monthly-average suffixes', () => {
  render(<Picker/> )
  fireEvent.click(screen.getByText('手动添加其他品种或实际合约'))
  fireEvent.change(screen.getByRole('textbox', { name: '自定义实际合约' }), { target: { value: 'l2610F' } })
  fireEvent.click(screen.getByRole('button', { name: '添加合约' }))
  expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual([{product:'l_f',symbol:'l2610F',exchange:'DCE'}])
  fireEvent.change(screen.getByRole('textbox', { name: '自定义实际合约' }), { target: { value: 'xyz2701' } })
  fireEvent.change(screen.getByRole('combobox', { name: '合约交易所' }), { target: { value: 'GFE' } })
  fireEvent.click(screen.getByRole('button', { name: '添加合约' }))
  expect(JSON.parse(screen.getByTestId('selection').textContent!)[1]).toEqual({product:'xyz',symbol:'xyz2701',exchange:'GFE'})
})
it('keeps three-digit delivery years and monthly-average contracts when listing candidate months', () => {
  expect(deliveryMonths('ma', 'MA912').slice(0,2)).toEqual(['MA001','MA002'])
  expect(deliveryMonths('l_f', 'l2612F').slice(0,2)).toEqual(['l2701F','l2702F'])
  expect(deliveryMonths('l', 'l2612F')).toEqual([])
})
