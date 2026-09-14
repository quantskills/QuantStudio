// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FinalDeliverables } from '../src/client/FinalDeliverables.tsx'
import { artifactResourceUrl } from '../src/client/artifact-resource.ts'
import { isolatedHtmlDocument } from '../src/client/InteractiveHtml.tsx'

afterEach(cleanup)
const item = (path: string) => ({ path, title: path, presentation: 'card' as const })
const resource = (path: string, presentation: 'audio' | 'video' | 'pdf') => ({ kind: 'resource' as const, path, presentation, bytes: 300, mediaType: `${presentation}/test`, url: `/api/quantskills.result.file?sessionId=one&path=${encodeURIComponent(path)}` })
it('plays audio/video without autoplay and routes expand/download to the exact file', async () => {
  const previewFile = vi.fn(async (path: string) => resource(path, path.endsWith('.mp4') ? 'video' : 'audio'))
  const openWorkbench = vi.fn(), downloadFile = vi.fn()
  const { container } = render(<FinalDeliverables items={[item('output/a.mp3'), item('output/v.mp4')]} openFile={vi.fn()} previewFile={previewFile} openWorkbench={openWorkbench} downloadFile={downloadFile}/>)
  await waitFor(() => expect(container.querySelectorAll('audio,video')).toHaveLength(2))
  for (const media of container.querySelectorAll('audio,video')) {
    expect(media.getAttribute('preload')).toBe('none')
    expect(media.hasAttribute('controls')).toBe(true)
    expect(media.hasAttribute('autoplay')).toBe(false)
  }
  fireEvent.click(screen.getByRole('button', { name: '在右侧展开 output/v.mp4' }))
  fireEvent.click(screen.getByRole('button', { name: '下载 output/a.mp3' }))
  expect(openWorkbench).toHaveBeenCalledWith('output/v.mp4')
  expect(downloadFile).toHaveBeenCalledWith('output/a.mp3')
})
it('loads PDF only when expanded and unmounts it when collapsed', async () => {
  const previewFile = vi.fn(async (path: string) => resource(path, 'pdf'))
  render(<FinalDeliverables items={[item('output/a.pdf')]} openFile={vi.fn()} previewFile={previewFile} openWorkbench={vi.fn()}/>)
  expect(previewFile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'output/a.pdf', exact: true }))
  await screen.findByTitle('output/a.pdf PDF 预览')
  fireEvent.click(screen.getByRole('button', { name: 'output/a.pdf', exact: true }))
  expect(screen.queryByTitle('output/a.pdf PDF 预览')).toBeNull()
})
it('recovers from preview failures and rejects another file returned by a stale response', async () => {
  const previewFile = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(resource('output/wrong.mp3', 'audio')).mockResolvedValue(resource('output/a.mp3', 'audio'))
  const { container } = render(<FinalDeliverables items={[item('output/a.mp3')]} openFile={vi.fn()} previewFile={previewFile} openWorkbench={vi.fn()}/>)
  fireEvent.click(await screen.findByRole('button', { name: '重试' }))
  await waitFor(() => expect(previewFile).toHaveBeenCalledTimes(2))
  fireEvent.click(await screen.findByRole('button', { name: '重试' }))
  await waitFor(() => expect(container.querySelector('audio')).not.toBeNull())
})
it('bounds initial cards and reveals later files on demand', () => {
  render(<FinalDeliverables items={Array.from({ length: 10 }, (_, i) => item(`output/${i}.pdf`))} openFile={vi.fn()} previewFile={vi.fn()} openWorkbench={vi.fn()}/>)
  expect(screen.getAllByRole('article')).toHaveLength(6)
  fireEvent.click(screen.getByRole('button', { name: /显示更多文件/ }))
  expect(screen.getAllByRole('article')).toHaveLength(10)
})
it('opens report and dataset titles directly in the correct workbench preview', () => {
  const openWorkbench = vi.fn(), previewFile = vi.fn()
  render(<FinalDeliverables items={[item('output/report.md'), item('output/factors.parquet')]} openFile={vi.fn()} previewFile={previewFile} openWorkbench={openWorkbench}/>)
  fireEvent.click(screen.getByRole('button', { name: 'output/report.md', exact: true }))
  expect(openWorkbench).toHaveBeenLastCalledWith('output/report.md')
  fireEvent.click(screen.getByRole('button', { name: 'output/factors.parquet', exact: true }))
  expect(openWorkbench).toHaveBeenLastCalledWith('output/factors.parquet')
  expect(previewFile).not.toHaveBeenCalled()
})
it('keeps remote and script URLs out of resource frames', () => {
  expect(() => artifactResourceUrl('https://example.com/api/quantskills.result.file?sessionId=x&path=y')).toThrow()
  expect(() => artifactResourceUrl('javascript:alert(1)')).toThrow()
  expect(() => artifactResourceUrl('/api/other?sessionId=x&path=y')).toThrow()
})
it('isolates interactive scripts from the host origin and external network', () => {
  const source = isolatedHtmlDocument('<script>fetch("https://example.com")</script>', 'Chart')
  expect(source).toContain('sandbox="allow-scripts"')
  expect(source).not.toContain('allow-same-origin')
  expect(source).toContain("connect-src 'none'")
  expect(source.indexOf('Content-Security-Policy')).toBeLessThan(source.indexOf('fetch('))
})
