// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import { openNativeResult } from '../src/client/native-result-navigation.ts'
import { NativeResults, NativeResultMedia } from '../src/client/NativeResults.tsx'

afterEach(cleanup)
const id = 'session-1' as SessionId

describe('official sidebar result navigation', () => {
  it('keeps Windows paths, Unicode and session ownership in the resource address', () => {
    const sidebar = { mounted: { getSnapshot: () => id }, openTab: vi.fn(), openResource: vi.fn() } as unknown as ISidebarRight
    expect(openNativeResult(sidebar, id, 'D:\\work', 'D:\\work\\研究 #1.html')).toBe(true)
    expect(sidebar.openResource).toHaveBeenCalledWith(fileAddressFor(id, 'D:\\work', 'D:\\work\\研究 #1.html'))
    expect(openNativeResult(sidebar, id, 'D:\\work')).toBe(true)
    expect(sidebar.openTab).toHaveBeenCalledWith('quantskills-results')
  })
  it('does not open another session after selection changes and permits absent-plugin fallback', () => {
    const sidebar = { mounted: { getSnapshot: () => 'other' }, openTab: vi.fn(), openResource: vi.fn() } as unknown as ISidebarRight
    expect(openNativeResult(sidebar, id, 'D:\\work', 'a.html')).toBe(false)
    expect(openNativeResult(undefined, id, 'D:\\work', 'a.html')).toBe(false)
    expect(sidebar.openResource).not.toHaveBeenCalled()
    expect(sidebar.openTab).not.toHaveBeenCalled()
  })
})

function summaryProps(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: id,
    useSession: (select: (state: { running: boolean }) => unknown) => select({ running: false }),
    useSessions: (select: (state: unknown) => unknown) => select({ byId: { [id]: { displayTitle: '研究报告' } } }),
    useChat: (select: (state: unknown) => unknown) => select({ timeline: { turnOrder: [], turns: new Map() }, legacy: { nodes: [], runningCalls: [] } }),
    prepareFiles: vi.fn(async () => []),
    listFiles: vi.fn(async () => [{ path: 'output/report.html', sourcePath: 'report.html', status: 'ready' }, { path: 'missing.pdf', sourcePath: 'missing.pdf', status: 'unavailable', reason: '文件不存在' }]),
    openFile: vi.fn(), openWorkspace: vi.fn(), downloadFile: vi.fn(), ...overrides,
  } as unknown as Parameters<typeof NativeResults>[0]
}

it('opens only prepared files and preserves download and workspace browsing', async () => {
  const props = summaryProps()
  render(<NativeResults {...props}/>)
  fireEvent.click(await screen.findByTitle('output/report.html'))
  expect(props.openFile).toHaveBeenCalledWith('output/report.html')
  expect((screen.getByRole('button', { name: /missing.pdf/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '下载 output/report.html' }))
  expect(props.downloadFile).toHaveBeenCalledWith('output/report.html')
  fireEvent.click(screen.getByRole('button', { name: '浏览工作区' }))
  expect(props.openWorkspace).toHaveBeenCalledOnce()
})

it('cancels stale list reads and exposes a recoverable loading error', async () => {
  let signal: AbortSignal | undefined
  const listFiles = vi.fn((input: AbortSignal) => { signal = input; return new Promise<never>(() => {}) })
  const view = render(<NativeResults {...summaryProps({ listFiles })}/>)
  expect(screen.getByRole('status').textContent).toContain('正在读取')
  view.rerender(<NativeResults {...summaryProps({ listFiles: vi.fn(async () => { throw Error('offline') }) })}/>)
  expect(signal?.aborted).toBe(true)
  expect((await screen.findByRole('alert')).textContent).toContain('刷新重试')
})

it('includes assistant-delivered reports after Host validation and deduplicates canonical paths', async () => {
  const prepareFiles = vi.fn(async () => [{ path: 'output/report.html', sourcePath: 'output/report.html', status: 'ready' }])
  render(<NativeResults {...summaryProps({ prepareFiles,
    useChat: (select: (state: unknown) => unknown) => select({ timeline: { turnOrder: [], turns: new Map() }, legacy: { nodes: [{ kind: 'assistant', blocks: [{ kind: 'text', text: '变量 `SURF_SPEED` 和工具 `read_image`\n```quantskills-deliverables\n{"version":1,"items":[{"path":"output/report.html","title":"报告","presentation":"interactive"}]}\n```' }] }], runningCalls: [] } }),
  })}/>)
  await screen.findByTitle('output/report.html')
  expect(prepareFiles).toHaveBeenCalledWith(['output/report.html'], expect.any(AbortSignal))
  expect(screen.getAllByTitle('output/report.html')).toHaveLength(1)
})

it('loads media using the resource owner, not the selected session, without autoplay', async () => {
  const previewFile = vi.fn(async () => ({ kind: 'resource', path: 'output/movie.mp4', bytes: 100, presentation: 'video', mediaType: 'video/mp4', url: '/api/quantskills.result.file?sessionId=owner&path=output%2Fmovie.mp4' }))
  const props = { useTabInfo: () => ({ tab: { contentId: fileAddressFor('owner', undefined, 'output/movie.mp4'), navigation: { revision: 1 } } }), previewFile } as unknown as Parameters<typeof NativeResultMedia>[0]
  const view = render(<NativeResultMedia {...props}/>)
  await waitFor(() => expect(view.container.querySelector('video')).not.toBeNull())
  expect(previewFile).toHaveBeenCalledWith('owner', 'output/movie.mp4')
  expect(view.container.querySelector('video')?.autoplay).toBe(false)
})

it('keeps report HTML isolated in the native dock without granting origin or external network access', async () => {
  const previewFile = vi.fn(async () => ({ kind: 'text', path: 'report.html', bytes: 30, mediaType: 'text/html', text: '<h1>Report</h1>' }))
  const props = { useTabInfo: () => ({ tab: { contentId: fileAddressFor('owner', undefined, 'report.html'), navigation: { revision: 1 } } }), previewFile } as unknown as Parameters<typeof NativeResultMedia>[0]
  const view = render(<NativeResultMedia {...props}/>)
  await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
  const frame = view.container.querySelector('iframe')!
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.srcdoc).toContain('Report')
  expect(frame.srcdoc).toContain("connect-src 'none'")
  expect(frame.srcdoc).not.toContain('allow-same-origin')
})
