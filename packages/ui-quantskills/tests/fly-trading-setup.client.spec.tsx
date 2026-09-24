// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FlyV2Page from '../src/client/fly/FlyV2Page.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'
import type { ContestAccess } from '../src/client/contest.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
vi.mock('../src/client/fly/FlyHomeV2.tsx', () => ({ default: () => <div>生活场景</div> }))
vi.mock('../src/client/fly/TradeStatistics.tsx', () => ({ TradeStatistics: () => <div>成交统计内容</div> }))
vi.mock('../src/client/fly/TradeLearning.tsx', () => ({ TradeLearning: () => <div>交易学习内容</div> }))
afterEach(cleanup)

function mount({ complete = false, onboarding = true } = {}) {
  const settings = { instruments: [{ product: 'rb', symbol: 'rb2610', exchange: 'SHF' }], name: '小果', account: '',
    target_notional: complete ? 100000 : 0, total_notional: complete ? 200000 : 0, loss_limit: complete ? 10000 : 0,
    life_validation: false, onboarding_complete: !onboarding, trade_period_minutes: 1, signal_confirmations: 1,
    min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0, learning: true,
    ai_provider: '', jev_enabled: false, jev_provider: 'typesafe', ai_daily_calls: 0, jev_daily_calls: 0, scenes_daily: 0, model_calls_unlimited: false }
  const state = { name: '小果', settings, control: { paused: true, trading: false }, neural: { status: 'ready' },
    world: { goal: 'idle', action: 'idle', position: [0, 0, 0], energy: 1 }, home: { name: '家园' }, home_version: 'default',
    markets: [], usage: {}, events: [], accounts: [], layout: [], checkpoints: [], versions: [], scene_jobs: [],
    environment: { blender: '', brain_ready: true, blender_ready: true, progress: { status: 'complete' } }, onboarding }
  const calls: { path: string; body: any }[] = []
  vi.mocked(flyFetch).mockImplementation(async (path, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null
    if (body) calls.push({ path, body })
    return { ok: true, json: async () => path.endsWith('/state') ? state : { profiles: [], jev_configured: false, jev_providers: [] } } as Response
  })
  const contest = { status: vi.fn(async () => ({ enabled: true, phase: 'connected', identity: { accountId: 'a', contestId: 'c' } })),
    query: vi.fn(async () => ({ data: { contractCode: 'rb2610' } })) } as unknown as ContestAccess
  render(<FlyV2Page active contest={contest}/>)
  return calls
}

it('places the positive trade-choice switch in environment settings', async () => {
  mount()
  expect((await screen.findByRole('checkbox', { name: '生成交易选择' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '3 比赛' }))
  expect(screen.queryByRole('checkbox', { name: '生成交易选择' })).toBeNull()
})

it('starts with the existing account and contracts without mandatory notional inputs', async () => {
  const calls = mount()
  fireEvent.click(await screen.findByRole('button', { name: '4 进入' }))
  await screen.findByText('交易配置已齐全')
  fireEvent.click(screen.getByRole('button', { name: '完成并开始交易' }))
  await waitFor(() => expect(calls.some(c => c.body.action === 'trade')).toBe(true))
  expect(calls.find(c => c.path.endsWith('/settings'))?.body.target_notional).toBe(0)
})

it('starts plans after complete first setup without executing orders', async () => {
  const calls = mount({ complete: true })
  fireEvent.click(await screen.findByRole('button', { name: '4 进入' }))
  await waitFor(() => expect(screen.getByText('交易配置已齐全')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '完成并开始交易' }))
  await waitFor(() => expect(calls.some(c => c.body.action === 'trade')).toBe(true))
  expect(calls.map(c => c.path.split('/').pop())).toEqual(['settings', 'control'])
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { name: '成交与盈亏' })).toBeTruthy()
})

it('keeps the trading dashboard ordered and life widgets in the life page', async () => {
  mount({ onboarding: false })
  await screen.findByRole('heading', { name: '成交与盈亏' })
  const headings = screen.getAllByRole('heading', { level: 2 }).map(n => n.textContent)
  expect(headings).toEqual(['成交与盈亏', '决策原因', '学习反馈'])
  expect(screen.queryByText('生活因果链')).toBeNull()
  expect(screen.queryByRole('button', { name: '编辑看板' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '生活' }))
  expect(screen.getByText('生活场景')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '成交与盈亏' })).toBeNull()
})

it('saving valid existing settings does not undo a manual stop', async () => {
  const calls = mount({ complete: true, onboarding: false })
  fireEvent.click(await screen.findByRole('button', { name: '设置', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '4 进入' }))
  await screen.findByText('交易配置已齐全')
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls.some(c => c.path.endsWith('/control'))).toBe(false)
})
