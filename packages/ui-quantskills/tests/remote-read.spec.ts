import { afterEach, describe, expect, it, vi } from 'vitest'
import { retryHostRead } from '../src/client/remote-read.ts'

afterEach(() => vi.useRealTimers())
describe('read-only host recovery', () => {
  it('recovers a temporarily unregistered route', async () => {
    vi.useFakeTimers()
    const read = vi.fn().mockRejectedValueOnce(new Error('transport failure: HTTP 404')).mockResolvedValue(['saved expert'])
    const result = retryHostRead(read)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual(['saved expert'])
    expect(read).toHaveBeenCalledTimes(2)
  })
  it('surfaces persistent failures after bounded retries', async () => {
    vi.useFakeTimers()
    const read = vi.fn().mockRejectedValue(new Error('HTTP 503'))
    const result = expect(retryHostRead(read)).rejects.toThrow('HTTP 503')
    await vi.runAllTimersAsync()
    await result
    expect(read).toHaveBeenCalledTimes(3)
  })
  it('does not retry permission or validation failures', async () => {
    const read = vi.fn().mockRejectedValue(new Error('HTTP 401'))
    await expect(retryHostRead(read)).rejects.toThrow('HTTP 401')
    expect(read).toHaveBeenCalledTimes(1)
  })
})
