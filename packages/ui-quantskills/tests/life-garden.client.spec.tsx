// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LifeGarden } from '../src/client/fly/LifeGarden.tsx'

const graphics = vi.hoisted(() => ({ dispose: vi.fn(), render: vi.fn(), setTheme: vi.fn() }))
vi.mock('../src/client/fly/life-garden/render.mjs', () => ({ GardenRenderer: class {
  dispose = graphics.dispose
  render = graphics.render
  setTheme = graphics.setTheme
} }))

class SimulationWorker {
  static instances: SimulationWorker[] = []
  onmessage?: (event: { data: unknown }) => void
  onerror?: (event: unknown) => void
  terminate = vi.fn()
  postMessage = vi.fn((message: { type: string; reason?: string }) => {
    if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }))
    if (message.type === 'snapshot') queueMicrotask(() => this.onmessage?.({ data: { type: 'checkpoint', reason: message.reason, snapshot: { seedId: '3GH2s' } } }))
  })
  constructor() { SimulationWorker.instances.push(this) }
}
let color = 'rgb(255, 255, 255)'
beforeEach(() => {
  SimulationWorker.instances = []
  color = 'rgb(255, 255, 255)'
  vi.clearAllMocks()
  vi.stubGlobal('Worker', SimulationWorker)
  vi.stubGlobal('indexedDB', { open() { throw new Error('storage disabled') } })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 123))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const computedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    const style = computedStyle(element)
    if (element.getAttribute('style')?.includes('--fv-panel')) Object.defineProperty(style, 'color', { value: color })
    return style
  })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:life-test'), revokeObjectURL: vi.fn() })
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

it('saves and releases worker, graphics and animation when leaving the page', async () => {
  const view = render(<LifeGarden />)
  await waitFor(() => expect(document.querySelector('#qs-life-garden')?.getAttribute('data-ready')).toBe('true'))
  expect(screen.getByText('存储不可用 · 本次生长不会自动保存')).toBeTruthy()
  const worker = SimulationWorker.instances[0]!
  fireEvent.click(screen.getByRole('button', { name: '暂停生长' }))
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'pause', value: true })
  view.unmount()
  await act(async () => {})
  expect(worker.postMessage).toHaveBeenCalledWith({ type: 'snapshot', reason: 'dispose' })
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(graphics.dispose).toHaveBeenCalledOnce()
  expect(cancelAnimationFrame).toHaveBeenCalledWith(123)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:life-test')
})

it('follows the product theme and removes the theme observer on unmount', async () => {
  const view = render(<div data-qs-preset="light"><LifeGarden /></div>)
  await waitFor(() => expect(graphics.setTheme).toHaveBeenCalledWith(false))
  color = 'rgb(18, 25, 36)'
  view.container.firstElementChild!.setAttribute('data-qs-preset', 'dark')
  await waitFor(() => expect(graphics.setTheme).toHaveBeenLastCalledWith(true))
  expect(document.querySelector('#qs-life-garden')?.getAttribute('data-theme')).toBe('dark')
  view.unmount()
  await act(async () => {})
  graphics.setTheme.mockClear()
  document.body.setAttribute('data-theme', 'light')
  await act(async () => {})
  expect(graphics.setTheme).not.toHaveBeenCalled()
})

it('does not create late workers when mounting is cancelled during initialization', async () => {
  const view = render(<LifeGarden />)
  view.unmount()
  await act(async () => {})
  expect(SimulationWorker.instances).toHaveLength(0)
  expect(graphics.dispose).not.toHaveBeenCalled()
})
