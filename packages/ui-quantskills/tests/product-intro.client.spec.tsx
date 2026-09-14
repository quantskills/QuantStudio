/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ProductIntro, PRODUCT_URLS } from '../src/client/ProductIntro.tsx'
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterEach(() => { cleanup(); if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
it.each(['qube', 'evo'] as const)('%s presents the real interface and opens its own experience URL', product => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const navigate = vi.fn(), view = render(<ProductIntro product={product} navigate={navigate}/>)
  const name = product.toUpperCase()
  expect(view.getByRole('img', { name: new RegExp(`${name} .*真实界面`) }).getAttribute('src')).toContain(`${product}-interface.webp`)
  for (const link of view.getAllByRole('link', { name: '开始体验' })) {
    expect(link.getAttribute('href')).toBe(PRODUCT_URLS[product])
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  }
  expect(view.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6)
  const other = product === 'qube' ? 'evo' : 'qube'
  fireEvent.click(within(view.getByRole('navigation', { name: '产品介绍切换' })).getByRole('button', { name: other.toUpperCase() }))
  expect(navigate).toHaveBeenCalledWith(other)
})
