// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FlyV2Page from '../src/client/fly/FlyV2Page.tsx'
import { flyFetch } from '../src/client/fly/transport.ts'
import type { ContestAccess } from '../src/client/contest.ts'

vi.mock('../src/client/fly/transport.ts', () => ({ flyFetch: vi.fn() }))
vi.mock('../src/client/fly/LifeGarden.tsx', () => ({ LifeGarden: () => <div>生活场景</div> }))
vi.mock('../src/client/fly/TradeStatistics.tsx', () => ({ TradeStatistics: () => <div>成交统计内容</div> }))
vi.mock('../src/client/fly/TradeLearning.tsx', () => ({ TradeLearning: () => <div>交易学习内容</div> }))
afterEach(cleanup)

function mount({ complete = false, onboarding = true, connected = false, trading = false, markets = false, brain = true, llm = false, profiles = false, manual = false } = {}) {
  const settings = { execution_mode: manual ? 'manual' : 'automatic', decision_engine: 'neural', instruments: [{ product: 'rb', symbol: 'rb2610', exchange: 'SHF' }, ...(markets ? [{ product: 'au', symbol: 'au2612', exchange: 'SHF' }] : [])], name: '小果', account: '',
    ...(llm ? { decision_engine: 'llm', trade_model: '{"provider":"test","model":"mock"}', trade_instructions: '顺势交易', llm_max_lots: 1, trade_daily_calls: 0 } : {}),
    target_notional: complete ? 100000 : 0, total_notional: complete ? 200000 : 0, loss_limit: complete ? 10000 : 0,
    life_validation: false, onboarding_complete: !onboarding, trade_period_minutes: 1, signal_confirmations: 1,
    min_signal_margin: 0, reentry_cooldown_minutes: 0, cost_filter_multiplier: 0, learning: true,
    ai_provider: '', jev_enabled: false, jev_provider: 'typesafe', ai_daily_calls: 0, jev_daily_calls: 0, scenes_daily: 0, model_calls_unlimited: false }
  const state = { name: '小果', settings, control: { paused: !trading, trading }, neural: { status: 'ready' },
    ...(connected ? { binding: { identity: { accountId: 'a', contestId: 'c' } }, connection: { status: 'ready' } } : {}),
    world: { goal: 'idle', action: 'idle', position: [0, 0, 0], energy: 1 }, home: { name: '家园' }, home_version: 'default',
    markets: markets ? [{ product: 'rb', symbol: 'rb2610', price: 3010, chart: [3000, 3010], quote_at: 1700000000, readiness: 'ready', count: 2, long: 1, short: 0 }, { product: 'au', symbol: 'au2610', price: 999, chart: [998, 999], quote_at: 1700000000, readiness: 'ready', count: 2, long: 5, short: 0 }] : [], usage: {}, events: [], accounts: [], layout: [], checkpoints: [], versions: [], scene_jobs: [],
    environment: { blender: '', brain_ready: brain, blender_ready: false, progress: { status: 'complete' } }, onboarding }
  const calls: { path: string; body: any }[] = []
  vi.mocked(flyFetch).mockImplementation(async (path, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null
    if (body) calls.push({ path, body })
    if (path.endsWith('/settings')) { Object.assign(settings, body); return { ok: true, json: async () => settings } as Response }
    return { ok: true, json: async () => path.endsWith('/state') ? state : { profiles: profiles || llm ? [{ provider_id: '{"provider":"test","model":"mock"}', label: 'Test / Mock', configured: true }] : [], jev_configured: false, jev_providers: [] } } as Response
  })
  const contest = { status: vi.fn(async () => ({ enabled: true, phase: 'connected', identity: { accountId: 'a', contestId: 'c' } })),
    query: vi.fn(async () => ({ data: { contractCode: 'rb2610' } })) } as unknown as ContestAccess
  render(<FlyV2Page active contest={contest}/>)
  return calls
}

it('reviews and starts neural trading without Blender or a per-order execute request', async () => {
  const calls = mount({ onboarding: false, connected: true })
  fireEvent.click(await screen.findByRole('button', { name: '开始自动交易', exact: true }))
  expect(screen.getByRole('dialog', { name: '启动自动交易' }).textContent).toContain('不再逐笔询问')
  expect(calls).toEqual([])
  expect((screen.getByRole('button', { name: '确认并开始自动交易' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: '我已理解上述风险，授权本轮自动下单' }))
  fireEvent.click(screen.getByRole('button', { name: '确认并开始自动交易' }))
  await waitFor(() => expect(calls).toEqual([{ path: '/api/fly/v2/control', body: { action: 'trade', version: '', execution_consent: 'automatic-orders-v1' } }]))
})

it('recognizes neural dependencies as ready without Blender in environment settings', async () => {
  const calls = mount({ onboarding: false, connected: true })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '运行环境', exact: true }))
  expect(screen.getByRole('button', { name: '神经环境已就绪' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByText(/Blender/)).toBeNull()
  expect(calls).toEqual([])
})

it('pauses new automatic orders while leaving life running', async () => {
  const calls = mount({ onboarding: false, connected: true, trading: true })
  fireEvent.click(await screen.findByRole('button', { name: '暂停自动交易', exact: true }))
  await waitFor(() => expect(calls).toEqual([{ path: '/api/fly/v2/control', body: { action: 'observe', version: '' } }]))
})

it('manual execution starts plan generation without granting automatic-order consent', async () => {
  const calls = mount({ manual: true, onboarding: false, connected: true })
  fireEvent.click(await screen.findByRole('button', { name: '开始生成计划', exact: true }))
  const dialog = screen.getByRole('dialog', { name: '启动逐笔确认' })
  expect(dialog.textContent).toContain('确认前不会提交委托')
  expect(within(dialog).queryByRole('checkbox')).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认并开始生成计划' }))
  await waitFor(() => expect(calls).toEqual([{ path: '/api/fly/v2/control', body: { action: 'trade', version: '' } }]))
})

it('cancelling the automatic-run review does not cache risk consent', async () => {
  const calls = mount({ onboarding: false, connected: true })
  fireEvent.click(await screen.findByRole('button', { name: '开始自动交易', exact: true }))
  fireEvent.click(screen.getByRole('checkbox', { name: '我已理解上述风险，授权本轮自动下单' }))
  fireEvent.click(screen.getByRole('button', { name: '返回', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '开始自动交易', exact: true }))
  expect((screen.getByRole('button', { name: '确认并开始自动交易' }) as HTMLButtonElement).disabled).toBe(true)
  expect(calls).toEqual([])
})

it('allows inspecting all setting categories while a trader is running but locks edits and saving', async () => {
  const calls = mount({ complete: true, onboarding: false, connected: true, trading: true })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '账户与合约' }))
  expect(screen.getByRole('textbox', { name: '螺纹钢实际合约' }).matches(':disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '运行与额度', exact: true }))
  expect(screen.getByRole('checkbox', { name: '启用交易功能' }).matches(':disabled')).toBe(true)
  expect(screen.getByRole('spinbutton', { name: '账户损失上限 ¥' }).matches(':disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '保存配置' }).matches(':disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(calls).toEqual([])
})

it('places the automatic trading switch with run settings', async () => {
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '运行与额度' }))
  expect((await screen.findByRole('checkbox', { name: '启用交易功能' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '账户与合约' }))
  expect(screen.queryByRole('checkbox', { name: '启用交易功能' })).toBeNull()
})

it('opens the relevant setup step from beginner guidance without saving or starting', async () => {
  localStorage.clear()
  const calls = mount({ onboarding: false })
  fireEvent.click(await screen.findByRole('button', { name: '快速上手' }))
  await screen.findByRole('region', { name: 'AI 交易员新手引导' })
  fireEvent.click(screen.getByRole('button', { name: '下一步说明 →' }))
  fireEvent.click(screen.getByRole('button', { name: '设置账户、合约与限额 ↗' }))
  expect(screen.getByRole('dialog', { name: 'AI 交易员运行设置' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '账户与合约' }).getAttribute('aria-current')).toBe('page')
  expect(calls).toEqual([])
})

it('starts with the existing account and contracts without mandatory notional inputs', async () => {
  const calls = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '配置摘要' }))
  await screen.findByText('交易配置已齐全')
  fireEvent.click(screen.getByRole('button', { name: '保存并核对启动' }))
  await screen.findByRole('dialog', { name: '启动自动交易' })
  expect(calls.some(c => c.body.action === 'trade')).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: '我已理解上述风险，授权本轮自动下单' }))
  fireEvent.click(screen.getByRole('button', { name: '确认并开始自动交易' }))
  await waitFor(() => expect(calls.some(c => c.body.action === 'trade')).toBe(true))
  expect(calls.find(c => c.path.endsWith('/settings'))?.body.target_notional).toBe(0)
})

it('starts automatic trading after complete first setup without a per-order UI call', async () => {
  const calls = mount({ complete: true })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '配置摘要' }))
  await waitFor(() => expect(screen.getByText('交易配置已齐全')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '保存并核对启动' }))
  await screen.findByRole('dialog', { name: '启动自动交易' })
  expect(calls.some(c => c.body.action === 'trade')).toBe(false)
  fireEvent.click(screen.getByRole('checkbox', { name: '我已理解上述风险，授权本轮自动下单' }))
  fireEvent.click(screen.getByRole('button', { name: '确认并开始自动交易' }))
  await waitFor(() => expect(calls.some(c => c.body.action === 'trade')).toBe(true))
  expect(calls.map(c => c.path.split('/').pop())).toEqual(['settings', 'control'])
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: '当前合约行情' })).toBeTruthy()
})

it('keeps the trading dashboard ordered and life widgets in the life page', async () => {
  mount({ onboarding: false })
  await screen.findByRole('region', { name: '当前合约行情' })
  expect(screen.queryByText('成交统计内容')).toBeNull()
  expect(screen.queryByText('交易学习内容')).toBeNull()
  expect(screen.queryByRole('region', { name: 'AI 交易员新手引导' })).toBeNull()
  expect(screen.queryByText('生活因果链')).toBeNull()
  expect(screen.queryByRole('button', { name: '编辑看板' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '生活' }))
  expect(screen.getByText('生活场景')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '成交与盈亏' })).toBeNull()
})

it('opens the decision engine first and keeps life auxiliary models separate', async () => {
  const calls = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  expect(screen.getByRole('button', { name: '决策引擎' }).getAttribute('aria-current')).toBe('page')
  expect(screen.queryByRole('combobox', { name: 'QuantStudio 已接入模型' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '生活辅助' }))
  expect(screen.getByRole('combobox', { name: 'QuantStudio 已接入模型' })).toBeTruthy()
  expect(calls).toEqual([])
})

it('saving valid existing settings does not undo a manual stop', async () => {
  const calls = mount({ complete: true, onboarding: false })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '配置摘要' }))
  await screen.findByText('交易配置已齐全')
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(calls.some(c => c.path.endsWith('/control'))).toBe(false)
})

it('discards contract and filter drafts on cancel without mutating saved settings', async () => {
  const calls = mount({ complete: true, onboarding: false })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '账户与合约' }))
  await screen.findByText('账户已连接')
  fireEvent.change(screen.getByRole('textbox', { name: '螺纹钢实际合约' }), { target: { value: 'rb2612' } })
  fireEvent.click(screen.getByRole('button', { name: '运行与额度', exact: true }))
  fireEvent.click(screen.getByText('交易节奏与信号过滤'))
  fireEvent.change(screen.getByLabelText('交易决策周期'), { target: { value: '5' } })
  expect(calls).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '账户与合约' }))
  expect((screen.getByRole('textbox', { name: '螺纹钢实际合约' }) as HTMLInputElement).value).toBe('rb2610')
  fireEvent.click(screen.getByRole('button', { name: '运行与额度', exact: true }))
  expect((screen.getByLabelText('交易决策周期') as HTMLSelectElement).value).toBe('1')
  expect(calls).toEqual([])
})

it('saves filter changes together with the draft and never automatically resumes a paused individual', async () => {
  const calls = mount({ complete: true, onboarding: false })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: '账户与合约' }))
  await screen.findByText('账户已连接')
  fireEvent.click(screen.getByRole('button', { name: '运行与额度', exact: true }))
  fireEvent.click(screen.getByText('交易节奏与信号过滤'))
  fireEvent.change(screen.getByLabelText('交易决策周期'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0]).toEqual(expect.objectContaining({ path: '/api/fly/v2/settings', body: expect.objectContaining({ trade_period_minutes: 5, total_notional: 200000, loss_limit: 10000 }) }))
})


it('switches configured contract details without trading calls and excludes old-month market data', async () => {
  const calls = mount({ complete: true, onboarding: false, connected: true, trading: true, markets: true })
  await screen.findByRole('button', { name: '查看合约 rb2610' })
  const quote = () => within(screen.getByRole('region', { name: '当前合约行情' }))
  expect(quote().getByText('3,010')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '查看合约 au2612' }))
  expect(quote().getByRole('heading', { name: 'au2612' })).toBeTruthy()
  expect(quote().getByText('持仓待同步')).toBeTruthy()
  expect(quote().queryByRole('img')).toBeNull()
  expect(quote().queryByText('999')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '查看合约 rb2610' }))
  expect(quote().getByText('3,010')).toBeTruthy()
  expect(screen.getByRole('button', { name: '暂停自动交易' })).toBeTruthy()
  expect(calls).toEqual([])
})

it('starts the configured model trader without the neural runtime', async () => {
  const calls = mount({ onboarding: false, connected: true, brain: false, llm: true })
  fireEvent.click(await screen.findByRole('button', { name: '开始自动交易', exact: true }))
  const dialog = screen.getByRole('dialog', { name: '启动自动交易' })
  expect(dialog.textContent).toContain('大模型决策')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '我已理解上述风险，授权本轮自动下单' }))
  fireEvent.click(within(dialog).getByRole('button', { name: '确认并开始自动交易' }))
  await waitFor(() => expect(calls).toEqual([{ path: '/api/fly/v2/control', body: { action: 'trade', version: '', execution_consent: 'automatic-orders-v1' } }]))
})
it('switches to a configured QS model and saves instructions without starting a paused trader', async () => {
  const calls = mount({ onboarding: false, connected: true, brain: false, profiles: true })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  fireEvent.click(screen.getByRole('button', { name: /大模型交易员.*按你的交易要求/ }))
  fireEvent.change(screen.getByRole('textbox', { name: '交易要求' }), { target: { value: '只做趋势明确的机会，不追涨。' } })
  expect((screen.getByRole('combobox', { name: '交易模型' }) as HTMLSelectElement).value).toContain('mock')
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0]?.body).toMatchObject({ decision_engine: 'llm', trade_instructions: '只做趋势明确的机会，不追涨。', llm_max_lots: 1 })
})
it('does not allow switching engines while automatic trading is active', async () => {
  const calls = mount({ onboarding: false, connected: true, trading: true, profiles: true })
  fireEvent.click(await screen.findByRole('button', { name: 'AI 交易员运行设置' }))
  expect(screen.getByRole('button', { name: /大模型交易员.*按你的交易要求/ }).matches(':disabled')).toBe(true)
  expect(calls).toEqual([])
})
