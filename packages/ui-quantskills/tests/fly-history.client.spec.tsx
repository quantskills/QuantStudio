// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FlyHistory } from '../src/client/fly/FlyHistory.tsx'
import FlyV2Page from '../src/client/fly/FlyV2Page.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
vi.mock('../src/client/fly/RuntimeContinuity.tsx', () => ({ RuntimeContinuity: () => null }))
vi.mock('../src/client/fly/TradeFilterControls.tsx', () => ({ TradeFilterControls: () => null }))
vi.mock('../src/client/fly/TradeLoop.tsx', () => ({ TradeLoop: () => null }))
vi.mock('../src/client/fly/FlyHomeV2.tsx', () => ({ default: () => null }))
afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows counts, successful refresh times and per-contract failures without inventing missing data', () => {
  const refresh = vi.fn()
  render(<FlyHistory enabled={false} history={{ status: 'error' }} error="au2612：授权失效" onRefresh={refresh}
    markets={[{ product: 'rb', symbol: 'rb2610', count: 500, history_source: { at: 1790211600 } }, { product: 'au', symbol: 'au2612', count: 0, history_source: { error: '授权失效' } }]} />)
  expect(screen.getByText(/500\/500 根/)).toBeTruthy()
  expect(screen.getByText(/· 0\/500 根/)).toBeTruthy()
  expect(screen.getByText(/请先保存「行情配置」/)).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('au2612')
  fireEvent.click(screen.getByRole('button', { name: '获取历史数据' }))
  expect(refresh).not.toHaveBeenCalled()
})

it('prevents repeated submissions and surfaces a failure for retry', async () => {
  let fail!: (error: Error) => void
  const refresh = vi.fn(() => new Promise<void>((_, reject) => { fail = reject }))
  render(<FlyHistory enabled markets={[]} onRefresh={refresh}/>)
  const button = screen.getByRole('button', { name: '获取历史数据' })
  fireEvent.click(button); fireEvent.click(button)
  expect(refresh).toHaveBeenCalledOnce()
  expect(button.matches(':disabled')).toBe(true)
  await act(async () => { fail(new Error('请重新连接 PandaData')) })
  expect(screen.getByRole('alert').textContent).toContain('请重新连接 PandaData')
  expect(button.matches(':disabled')).toBe(false)
})

it('connects the dashboard button to the shared background history job', async () => {
  const state = { name: '小果', settings: { instruments: [{ product: 'rb', symbol: 'rb2610' }], life_validation: true },
    control: { paused: true, trading: false }, neural: { status: 'stopped' }, binding: { identity: { accountId: 'a', contestId: 'c' } },
    connection: { status: 'waiting', message: '比赛报价暂时限流' }, history: { status: 'idle' }, world: { goal: 'idle', action: 'idle', position: [0, 0, 0] },
    home: { name: '家园' }, home_version: 'default', markets: [{ product: 'rb', symbol: 'rb2610', count: 120 }], usage: {}, events: [], layout: [],
    checkpoints: [], environment: { blender: '', brain_ready: true, blender_ready: true, progress: { status: 'complete' } }, onboarding: false }
  vi.mocked(flyFetch).mockImplementation(async url => ({ ok: true, json: async () => url.endsWith('/state') ? state : url.endsWith('/control') ? { history: { status: 'running' } } : { profiles: [], jev_configured: false } }) as Response)
  render(<FlyV2Page active/>)
  fireEvent.click(await screen.findByRole('button', { name: '获取历史数据' }))
  expect(await screen.findByRole('button', { name: '正在获取历史数据…' })).toBeTruthy()
  expect(vi.mocked(flyFetch).mock.calls.some(([url, init]) => url.endsWith('/control') && JSON.parse(String(init?.body)).action === 'history')).toBe(true)
  expect(screen.getByRole('button', { name: '正在获取历史数据…' }).matches(':disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: '连接比赛行情' })).toBeNull()
})

it('shows the failing source and blocks clicks until the server cooldown expires', async () => {
  vi.useFakeTimers()
  const refresh = vi.fn(async () => {})
  render(<FlyHistory enabled markets={[]} history={{ status: 'cooldown', source: 'competition', retry_at: Date.now() / 1000 + 60 }} onRefresh={refresh}/>)
  const button = screen.getByRole('button', { name: '冷却中 · 60 秒' })
  fireEvent.click(button)
  expect(refresh).not.toHaveBeenCalled()
  expect(screen.getByRole('status').textContent).toContain('比赛接口将在 60 秒后重试')
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(screen.getByRole('button', { name: '获取历史数据' }).matches(':disabled')).toBe(false)
})
