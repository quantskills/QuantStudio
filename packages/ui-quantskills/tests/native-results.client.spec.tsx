// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import { openNativeResult } from '../src/client/native-result-navigation.ts'
import { NativeResults, NativeResultMedia } from '../src/client/NativeResults.tsx'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
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
  expect(previewFile).toHaveBeenCalledWith('owner', 'output/movie.mp4', expect.any(AbortSignal))
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

function withPaths(paths: readonly string[]) {
  return (select: (state: unknown) => unknown) => select({
    timeline: { turnOrder: [], turns: new Map() },
    legacy: { nodes: [{ kind: 'assistant', blocks: [{ kind: 'text', text: paths.map(path => `\`${path}\``).join('\n') }] }], runningCalls: [] },
  })
}
const readyFiles = (paths: readonly string[]) => paths.map(path => ({ path, sourcePath: path, status: 'ready' as const }))

it('prepares every candidate across batches without hiding already loaded history', async () => {
  const paths = Array.from({ length: 251 }, (_, n) => `output/file-${n}.html`)
  let finishFirst!: () => void
  const prepareFiles = vi.fn(async (batch: readonly string[]) => {
    if (batch.length > 100) throw Error('Host request limit')
    if (batch[0] === paths[0]) await new Promise<void>(resolve => { finishFirst = resolve })
    return readyFiles(batch)
  })
  render(<NativeResults {...summaryProps({ useChat: withPaths(paths), prepareFiles })}/>)
  await screen.findByTitle('output/report.html')
  expect(screen.getByRole('status')).toBeDefined()
  await act(async () => finishFirst())
  await screen.findByText('252 个文件')
  expect(prepareFiles.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 51])
  expect(prepareFiles.mock.calls.flatMap(([batch]) => batch)).toEqual(paths)
  expect(screen.getByTitle(paths[250]!)).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps history and successful batches after a batch failure, and refresh retries missing files', async () => {
  const paths = Array.from({ length: 201 }, (_, n) => `output/file-${n}.html`)
  let fail = true
  const prepareFiles = vi.fn(async (batch: readonly string[]) => {
    if (fail && batch[0] === paths[100]) throw Error('offline')
    return readyFiles(batch)
  })
  render(<NativeResults {...summaryProps({ useChat: withPaths(paths), prepareFiles })}/>)
  expect((await screen.findByRole('alert')).textContent).toContain('已保留成功结果')
  expect(screen.getByTitle('output/report.html')).toBeDefined()
  expect(screen.getByTitle(paths[0]!)).toBeDefined()
  expect(screen.getByTitle(paths[200]!)).toBeDefined()
  expect(screen.queryByTitle(paths[100]!)).toBeNull()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '刷新结果' }))
  await screen.findByTitle(paths[100]!)
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(screen.getByText('202 个文件')).toBeDefined()
})

it('keeps prepared files when the history request fails', async () => {
  render(<NativeResults {...summaryProps({
    useChat: withPaths(['output/current.html']),
    listFiles: vi.fn(async () => { throw Error('history unavailable') }),
    prepareFiles: vi.fn(async (paths: readonly string[]) => readyFiles(paths)),
  })}/>)
  await screen.findByRole('alert')
  expect(screen.getByTitle('output/current.html')).toBeDefined()
})

it('does not let a failed duplicate hide an archived file', async () => {
  let finish!: (files: unknown[]) => void
  render(<NativeResults {...summaryProps({
    useChat: withPaths(['output/report.html']),
    listFiles: vi.fn(async () => [{ path: 'output/report.html', sourcePath: '/legacy/report.html', status: 'archived' }]),
    prepareFiles: vi.fn(() => new Promise(resolve => { finish = resolve })),
  })}/>)
  await screen.findByTitle('output/report.html')
  await act(async () => finish([{ path: 'output/report.html', sourcePath: 'output/report.html', status: 'unavailable' }]))
  expect((screen.getByTitle('output/report.html') as HTMLButtonElement).disabled).toBe(false)
})

it('aborts outstanding preparation and never requests later batches after switching sessions', async () => {
  const paths = Array.from({ length: 201 }, (_, n) => `output/old-${n}.html`)
  let finish!: (files: ReturnType<typeof readyFiles>) => void
  const prepareFiles = vi.fn((_paths: readonly string[], _signal: AbortSignal) => new Promise<ReturnType<typeof readyFiles>>(resolve => { finish = resolve }))
  const view = render(<NativeResults {...summaryProps({ useChat: withPaths(paths), prepareFiles })}/>)
  view.rerender(<NativeResults {...summaryProps({ sessionId: 'session-2', listFiles: vi.fn(async () => readyFiles(['output/new.html'])) })}/>)
  await screen.findByTitle('output/new.html')
  await act(async () => finish(readyFiles(paths.slice(0, 100))))
  expect(prepareFiles).toHaveBeenCalledOnce()
  expect(prepareFiles.mock.calls[0]![1].aborted).toBe(true)
  expect(screen.queryByTitle(paths[0]!)).toBeNull()
})

function resourceMediaProps(url = '/api/quantskills.result.file?sessionId=owner&path=report.html') {
  return {
    useTabInfo: () => ({ tab: { contentId: fileAddressFor('owner', undefined, 'report.html'), navigation: { revision: 1 } } }),
    previewFile: vi.fn(async () => ({ kind: 'resource', path: 'report.html', bytes: 3 * 1024 * 1024, mediaType: 'text/html', presentation: 'text', url })),
  } as unknown as Parameters<typeof NativeResultMedia>[0]
}

it('renders the entire resource HTML above 2 MiB inside the same isolated preview', async () => {
  const source = `<h1>Large report</h1><!--${'x'.repeat(3 * 1024 * 1024)}--><p>End-of-large-report</p>`
  const fetchFile = vi.fn(async () => new Response(source))
  vi.stubGlobal('fetch', fetchFile)
  const view = render(<NativeResultMedia {...resourceMediaProps()}/>)
  await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
  const frame = view.container.querySelector('iframe')!
  expect(frame.srcdoc).toContain('End-of-large-report')
  expect(frame.srcdoc).toContain('x'.repeat(3 * 1024 * 1024))
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.srcdoc).toContain("connect-src 'none'")
  expect(frame.srcdoc).not.toContain('allow-same-origin')
  expect(fetchFile).toHaveBeenCalledWith(expect.stringContaining('/api/quantskills.result.file?'), expect.objectContaining({ signal: expect.any(AbortSignal), redirect: 'error', credentials: 'same-origin' }))
}, 15000)

it('reports a failed resource read and can retry without showing the error page as HTML', async () => {
  const fetchFile = vi.fn().mockResolvedValueOnce(new Response('server error', { status: 503 })).mockResolvedValueOnce(new Response('<h1>Recovered</h1>'))
  vi.stubGlobal('fetch', fetchFile)
  const view = render(<NativeResultMedia {...resourceMediaProps()}/>)
  await screen.findByRole('alert')
  expect(view.container.querySelector('iframe')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '刷新预览' }))
  await waitFor(() => expect(view.container.querySelector('iframe')?.srcdoc).toContain('Recovered'))
  expect(screen.queryByRole('alert')).toBeNull()
})

it('cancels HTML resource loading and ignores late responses when the tab navigates', async () => {
  let finish!: (response: Response) => void
  const fetchFile = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetchFile)
  const view = render(<NativeResultMedia {...resourceMediaProps()}/>)
  await waitFor(() => expect(fetchFile).toHaveBeenCalledOnce())
  const next = resourceMediaProps()
  view.rerender(<NativeResultMedia {...next} previewFile={async () => ({ kind: 'text', path: 'next.html', bytes: 4, mediaType: 'text/html', text: 'Next report' })}/>)
  await waitFor(() => expect(view.container.querySelector('iframe')?.srcdoc).toContain('Next report'))
  expect(fetchFile.mock.calls[0]![1].signal?.aborted).toBe(true)
  await act(async () => finish(new Response('Stale report')))
  expect(view.container.querySelector('iframe')?.srcdoc).not.toContain('Stale report')
})

it('rejects resource HTML outside the verified result endpoint before fetching', async () => {
  const fetchFile = vi.fn()
  vi.stubGlobal('fetch', fetchFile)
  render(<NativeResultMedia {...resourceMediaProps('https://untrusted.example/report.html')}/>)
  await screen.findByRole('alert')
  expect(fetchFile).not.toHaveBeenCalled()
})
