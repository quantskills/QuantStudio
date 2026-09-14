// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfPreview } from '../src/client/PdfPreview.tsx'

const pdf = vi.hoisted(() => {
  const cancel = vi.fn()
  const renderPage = vi.fn(() => ({ promise: Promise.resolve(), cancel }))
  const getPage = vi.fn(async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: renderPage }))
  const destroy = vi.fn(async () => {})
  const getDocument = vi.fn(() => ({ promise: Promise.resolve({ numPages: 2, getPage }), destroy }))
  return { getDocument, getPage, destroy, cancel, renderPage }
})
vi.mock('pdfjs-dist', () => ({ getDocument: pdf.getDocument, GlobalWorkerOptions: {} }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?raw', () => ({ default: '' }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it('renders one page, supports pagination, and releases PDF tasks on unmount', async () => {
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:local-worker' } })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
  const { unmount } = render(<PdfPreview title="报告" url="/api/quantskills.result.file?sessionId=one&path=output/report.pdf"/>)
  await waitFor(() => expect(pdf.renderPage).toHaveBeenCalledTimes(1))
  expect(pdf.getDocument).toHaveBeenCalledWith(expect.objectContaining({ enableXfa: false, url: expect.stringContaining('/api/quantskills.result.file?') }))
  expect(screen.getByRole('button', { name: '报告 上一页' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '报告 下一页' }))
  await waitFor(() => expect(pdf.getPage).toHaveBeenLastCalledWith(2))
  expect(screen.getByText('2 / 2')).toBeDefined()
  unmount()
  expect(pdf.destroy).toHaveBeenCalled()
  expect(pdf.cancel).toHaveBeenCalled()
})

it('rejects external document URLs without passing them to the PDF engine', async () => {
  render(<PdfPreview title="外部文件" url="https://example.com/report.pdf"/>)
  await screen.findByText(/PDF 预览暂不可用/)
  expect(pdf.getDocument).not.toHaveBeenCalled()
})
