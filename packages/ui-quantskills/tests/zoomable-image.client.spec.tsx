// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZoomableImage } from '../src/client/ZoomableImage.tsx'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function openImage() {
  render(<ZoomableImage src="data:image/png;base64,fixture" alt="四联诊断图"/>)
  const thumbnail = screen.getByRole('img', { name: '四联诊断图' })
  fireEvent.doubleClick(thumbnail)
  const dialog = screen.getByRole('dialog', { name: '四联诊断图' }), image = within(dialog).getByRole('img')
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 2000 })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1200 })
  fireEvent.load(image)
  return { thumbnail, dialog, image, stage: within(dialog).getByRole('region', { name: '图片缩放画布' }), zoom: within(dialog).getByLabelText('图片缩放比例') }
}
describe('image viewer', () => {
  it('opens above scaled panels, fits the whole image, and restores focus on Escape', () => {
    const { thumbnail, dialog, zoom } = openImage()
    expect(dialog.parentElement).toBe(document.body)
    expect(zoom.textContent).toBe('38%')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(thumbnail)
  })
  it('consumes wheel scrolling and zooms around the pointer rather than moving the page', () => {
    const { stage, zoom, image } = openImage()
    expect(fireEvent.wheel(stage, { deltaY: -120, clientX: 600, clientY: 300 })).toBe(false)
    expect(Number(zoom.textContent?.replace('%', ''))).toBeGreaterThan(38)
    expect(image.style.transform).toMatch(/translate\(-\d/)
    fireEvent.wheel(stage, { deltaY: 120, clientX: 600, clientY: 300 })
    expect(zoom.textContent).toBe('38%')
  })
  it('supports original size, fit, bounded wheel zoom, and loading errors', () => {
    const { dialog, stage, zoom, image } = openImage()
    fireEvent.click(within(dialog).getByRole('button', { name: '原始尺寸' }))
    expect(zoom.textContent).toBe('100%')
    for (let i = 0; i < 25; i++) fireEvent.wheel(stage, { deltaY: -300 })
    expect(zoom.textContent).toBe('1600%')
    for (let i = 0; i < 25; i++) fireEvent.wheel(stage, { deltaY: 300 })
    expect(zoom.textContent).toBe('10%')
    fireEvent.click(within(dialog).getByRole('button', { name: '适应窗口' }))
    expect(zoom.textContent).toBe('38%')
    fireEvent.error(image)
    expect(within(dialog).getByRole('alert').textContent).toContain('无法加载')
    expect((within(dialog).getByRole('button', { name: '放大图片' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('provides keyboard opening and a visible close control', () => {
    render(<ZoomableImage src="test.png" alt="报告图表"/>)
    fireEvent.keyDown(screen.getByRole('img'), { key: 'Enter' })
    const dialog = screen.getByRole('dialog', { name: '报告图表' })
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭图片预览' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
