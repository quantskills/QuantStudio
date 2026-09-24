// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FlyV2Page from '../src/client/fly/FlyV2Page.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'
import type { ContestAccess } from '../src/client/contest.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
vi.mock('../src/client/fly/RuntimeContinuity.tsx', () => ({ RuntimeContinuity: () => null }))
vi.mock('../src/client/fly/TradeFilterControls.tsx', () => ({ TradeFilterControls: () => null }))
vi.mock('../src/client/fly/TradeLoop.tsx', () => ({ TradeLoop: () => null }))
vi.mock('../src/client/fly/TradeStatistics.tsx', () => ({ TradeStatistics: () => null }))
vi.mock('../src/client/fly/TradeLearning.tsx', () => ({ TradeLearning: () => null }))
vi.mock('../src/client/fly/FlyHomeV2.tsx', () => ({ default: () => null }))

afterEach(cleanup)

it('reports a stalled home state read instead of loading forever', async () => {
  vi.useFakeTimers()
  try {
    vi.mocked(flyFetch).mockImplementation(() => new Promise(() => {}))
    render(<FlyV2Page active/>)
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(screen.getByText(/果蝇家园状态读取响应超时/)).toBeTruthy()
  } finally { vi.useRealTimers() }
})

it('keeps incomplete contract selections in onboarding instead of sending invalid settings', async () => {
  const settings = { instruments: [{ product: 'rb', symbol: '', exchange: 'SHF' }], name: '小果', account: '',
    target_notional: 0, total_notional: 0, loss_limit: 0, jev_daily_calls: 0, ai_daily_calls: 0, scenes_daily: 0,
    model_calls_unlimited: false, ai_provider: '', jev_provider: 'typesafe', jev_enabled: false, learning: true,
    life_validation: true, onboarding_complete: false, trade_period_minutes: 1, signal_confirmations: 1,
    min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0 }
  const state = { name: '小果', settings, control: { paused: true, trading: false }, neural: { status: 'ready' },
    world: { goal: 'idle', action: 'idle', position: [0, 0, 0], energy: 1 }, home: { name: '家园' }, home_version: 'default',
    markets: [], usage: {}, events: [], accounts: [], layout: [], checkpoints: [], versions: [], scene_jobs: [],
    environment: { blender: '', brain_ready: true, blender_ready: true, progress: { status: 'complete' } }, onboarding: true }
  const calls: string[] = []
  vi.mocked(flyFetch).mockImplementation(async (url, init) => {
    calls.push(`${init?.method || 'GET'} ${url}`)
    const data = url.endsWith('/state') ? state : url.endsWith('/models') ? { profiles: [], jev_configured: false, jev_providers: [] } : {}
    return { ok: true, json: async () => data } as Response
  })
  render(<FlyV2Page active/>)
  fireEvent.click(await screen.findByRole('button', { name: '果蝇运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '核对配置' }))
  fireEvent.click(screen.getByRole('button', { name: '完成并进入生活' }))
  expect((await screen.findByRole('alert')).textContent).toContain('螺纹')
  expect(screen.getByRole('textbox', { name: '螺纹钢实际合约' }).getAttribute('aria-invalid')).toBe('true')
  expect(calls.some(call => call.includes('/settings'))).toBe(false)
  fireEvent.change(screen.getByRole('textbox', { name: '螺纹钢实际合约' }), { target: { value: 'rb2610' } })
  fireEvent.click(screen.getByRole('button', { name: '核对并继续' }))
  fireEvent.click(screen.getByRole('button', { name: '完成并进入生活' }))
  await waitFor(() => expect(calls.some(call => call.includes('/settings'))).toBe(true))
  expect(screen.queryByRole('dialog', { name: '果蝇运行设置' })).toBeNull()
})

it('fills the verified main contract and lets the user replace it with a verified delivery month', async () => {
  const settings = { instruments: [], name: '小果', account: '', target_notional: 0, total_notional: 0, loss_limit: 0,
    jev_daily_calls: 0, ai_daily_calls: 0, scenes_daily: 0, model_calls_unlimited: false, ai_provider: '',
    jev_provider: 'typesafe', jev_enabled: false, learning: true, life_validation: true, onboarding_complete: false,
    trade_period_minutes: 1, signal_confirmations: 1, min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0 }
  const state = { name: '小果', settings, control: { paused: true, trading: false }, neural: { status: 'ready' },
    world: { goal: 'idle', action: 'idle', position: [0, 0, 0], energy: 1 }, home: { name: '家园' }, home_version: 'default',
    markets: [], usage: {}, events: [], accounts: [], layout: [], checkpoints: [], versions: [], scene_jobs: [],
    environment: { blender: '', brain_ready: true, blender_ready: true, progress: { status: 'complete' } }, onboarding: true }
  vi.mocked(flyFetch).mockImplementation(async url => ({ ok: true, json: async () => url.endsWith('/state') ? state : { profiles: [], jev_configured: false, jev_providers: [] } }) as Response)
  const query = vi.fn(async ({ symbol }: { symbol?: string }) => ({ data: { contractCode: symbol === 'rb' || symbol === 'rb2612' ? 'rb2610' : symbol }, fetchedAt: Date.now() }))
  const contest = { query, status: vi.fn(async () => ({ enabled: true, phase: 'connected', identity: { accountId: 'a', contestId: 'c' }, updateAvailable: false, message: '', plans: [] })) } as unknown as ContestAccess
  render(<FlyV2Page active contest={contest}/>)
  fireEvent.click(await screen.findByRole('button', { name: '果蝇运行设置' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '螺纹钢 · rb' }))
  await waitFor(() => expect((screen.getByRole('textbox', { name: '螺纹钢实际合约' }) as HTMLInputElement).value).toBe('rb2610'))
  expect(query).toHaveBeenCalledWith({ kind: 'quote', symbol: 'rb' }, expect.anything())
  fireEvent.change(screen.getByRole('combobox', { name: '螺纹钢合约月份' }), { target: { value: 'rb2611' } })
  await waitFor(() => expect((screen.getByRole('textbox', { name: '螺纹钢实际合约' }) as HTMLInputElement).value).toBe('rb2611'))
  expect(query).toHaveBeenCalledWith({ kind: 'quote', symbol: 'rb2611' }, expect.anything())
  fireEvent.change(screen.getByRole('combobox', { name: '螺纹钢合约月份' }), { target: { value: 'rb2612' } })
  await waitFor(() => expect(screen.getByText(/rb2612 无法确认/)).toBeTruthy())
  expect((screen.getByRole('textbox', { name: '螺纹钢实际合约' }) as HTMLInputElement).value).toBe('rb2611')
})

it('saves contract configuration separately and reuses account authorization when connecting the market once', async () => {
  const settings = { instruments: [], name: '小果', account: '', target_notional: 0, total_notional: 0, loss_limit: 0,
    jev_daily_calls: 0, ai_daily_calls: 0, scenes_daily: 0, model_calls_unlimited: false, ai_provider: '',
    jev_provider: 'typesafe', jev_enabled: false, learning: true, life_validation: true, onboarding_complete: false,
    trade_period_minutes: 1, signal_confirmations: 1, min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0 }
  const state = { name: '小果', settings, control: { paused: true, trading: false }, neural: { status: 'ready' },
    world: { goal: 'idle', action: 'idle', position: [0, 0, 0], energy: 1 }, home: { name: '家园' }, home_version: 'default',
    markets: [], usage: {}, events: [], accounts: [], layout: [], checkpoints: [], versions: [], scene_jobs: [],
    environment: { blender: '', brain_ready: true, blender_ready: true, progress: { status: 'complete' } }, onboarding: false }
  const operations: string[] = []
  let savedInstruments: unknown[] = []
  vi.mocked(flyFetch).mockImplementation(async (url, init) => {
    if (url.endsWith('/settings')) { savedInstruments = JSON.parse(String(init?.body)).instruments; Object.assign(state.settings, { instruments: savedInstruments }); operations.push('save') }
    if (url.endsWith('/control')) {
      const action = JSON.parse(String(init?.body)).action
      if (action === 'connect' && !savedInstruments.length) throw new Error('请先选择品种并填写实际合约')
      operations.push(action)
    }
    return { ok: true, json: async () => url.endsWith('/state') ? state : url.endsWith('/control') ? { connection: { status: 'ready', message: '已连接' } } : { profiles: [], jev_configured: false, jev_providers: [] } } as Response
  })
  let connected = false
  const account = () => ({ enabled: connected, phase: connected ? 'connected' : 'off', updateAvailable: false, message: '', plans: [], ...(connected ? { identity: { accountId: 'a', contestId: 'c' } } : {}) })
  const contest = {
    status: vi.fn(async () => account()),
    mode: vi.fn(async () => { operations.push('enable-account'); return account() }),
    connect: vi.fn(async () => { operations.push('connect-account'); connected = true; return account() }),
    query: vi.fn(async () => { if (!connected) throw new Error('请先连接比赛账户'); operations.push('resolve-main'); return { data: { contractCode: 'rb2610' }, fetchedAt: Date.now() } }),
  } as unknown as ContestAccess
  render(<FlyV2Page active contest={contest}/>)
  fireEvent.click(await screen.findByRole('button', { name: '管理合约' }))
  fireEvent.click(await screen.findByRole('checkbox', { name: '螺纹钢 · rb' }))
  expect(contest.query).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '连接比赛账户' }))
  await waitFor(() => expect((screen.getByRole('textbox', { name: '螺纹钢实际合约' }) as HTMLInputElement).value).toBe('rb2610'))
  expect(operations).toEqual(['enable-account', 'connect-account', 'resolve-main'])
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => expect(operations).toEqual(['enable-account', 'connect-account', 'resolve-main', 'save']))
  expect(savedInstruments).toEqual([{ product: 'rb', symbol: 'rb2610', exchange: 'SHF' }])
  expect(screen.queryByRole('dialog', { name: '果蝇运行设置' })).toBeNull()
  fireEvent.click(screen.getByText(/行情与运行详情/))
  fireEvent.click(screen.getByRole('button', { name: '连接比赛行情' }))
  await screen.findByText('比赛行情已连接')
  expect(operations).toEqual(['enable-account', 'connect-account', 'resolve-main', 'save', 'connect'])
  expect(contest.connect).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: '连接比赛行情' })).toBeNull()
})
