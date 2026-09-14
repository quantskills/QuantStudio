import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { openSystemBrowser } from '../src/browser.ts'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))

describe('desktop OAuth browser errors', () => {
  it('handles asynchronous ENOENT without crashing the process or leaking an authorization URL', async () => {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    vi.mocked(spawn).mockImplementation(() => {
      queueMicrotask(() => child.emit('error', new Error('spawn xdg-open ENOENT')))
      return child as ReturnType<typeof spawn>
    })
    await expect(openSystemBrowser('https://example.test/authorize?secret=sensitive')).rejects.toThrow('无法打开本机浏览器')
  })
})
