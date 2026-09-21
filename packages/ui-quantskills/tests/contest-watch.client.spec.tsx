// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContestWatch } from '../src/client/ContestWatch.tsx'
import { JevEvidence } from '../src/client/JevEvidence.tsx'
import { ContestWatchVisuals } from '../src/client/ContestWatchVisuals.tsx'
import type { ContestAccess } from '../src/client/contest.ts'
import type { ContestWatchStatus, ContestWatchTemplate } from '../src/client/plugin-types.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })
function fixture(running = false) {
  let state: ContestWatchStatus = { running, message: running ? '采样中' : '尚未启动', sampleCount: 0, planCount: 0, events: [] }
  let saved: ContestWatchTemplate[] = []
  const access: NonNullable<ContestAccess['watch']> = {
    templates: vi.fn(async () => saved),
    saveTemplate: vi.fn(async item => { const config = { ...item.config, strategyName: item.name, builtInTemplate: undefined }; saved = [...saved.filter(x => x.name !== item.name), { name: item.name, config }]; return saved }),
    datasets: vi.fn(async () => []),
    prepareHistory: vi.fn(),
    usage: vi.fn(async () => ({ since: Date.now(), requests: 0, responsesOk: 0, unknownUsage: 0, inputTokens: 0, outputTokens: 0, records: [] })),
    settings: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0' })),
    configure: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0', message: '连接成功，密钥已保存到本机。' })),
    status: vi.fn(async () => state),
    start: vi.fn(async config => { state = { ...state, config, running: true, message: '已启动' }; return state }),
    stop: vi.fn(async () => { state = { ...state, running: false, message: '已停止' }; return state }),
  }
  return { access, setState: (next: ContestWatchStatus) => { state = next } }
}
describe('Jev continuous watch controls', () => {
  it('offers a persisted opening-only cooldown and opening plan quota', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(screen.getByText('微调模板'))
    expect((screen.getByLabelText('开仓冷却时间（秒，0 不冷却）') as HTMLInputElement).value).toBe('300')
    fireEvent.change(screen.getByLabelText('开仓冷却时间（秒，0 不冷却）'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('本次开仓计划上限'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('保存模板名称'), { target: { value: '无开仓冷却' } })
    fireEvent.click(screen.getByRole('button', { name: '保存为我的模板' })); await screen.findByText(/已保存至本机/)
    expect(f.access.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ openingCooldownSeconds: 0, maxPlans: 2 }) }))
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' })); await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ openingCooldownSeconds: 0, maxPlans: 2 }))
  })
  it('saves an explicit translator independently of the Jev key and retains Chinese strategy text', async () => {
    const f = fixture(), translator = { provider: 'verified-route', model: 'DeepSeek-V4-Flash' }
    vi.mocked(f.access.settings).mockResolvedValue({ configured: true, writable: true, model: 'jev-1.13.0', translationModels: [translator] })
    render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(screen.getByText('Jev 连接配置'))
    fireEvent.change(screen.getByLabelText('中文专用翻译模型'), { target: { value: JSON.stringify(translator) } })
    fireEvent.click(screen.getByRole('button', { name: '保存翻译模型' }))
    await waitFor(() => expect(f.access.configure).toHaveBeenCalledWith({ translator }))
    expect((screen.getByLabelText('研究目标和约束') as HTMLTextAreaElement).value).toContain('以区间回归')
    expect(f.access.start).not.toHaveBeenCalled()
  })
  it('keeps review warnings and candidate outcomes visible while folding detailed evidence', () => {
    const time = Date.now(), decision = { action: 'open_long' as const, confidence: .6, probabilities: { hold: .2, open_long: .6, open_short: .2 }, model: 'jev-1.13.0', time }
    render(<ContestWatchVisuals active status={{ running: true, sampleCount: 8, planCount: 0, events: [], message: '', lastDecision: decision,
      analyses: [{ id: 'candidate', startedAt: time, finishedAt: time, sampleCount: 8, fromTime: time, toTime: time, price: 3000, allowedActions: ['hold', 'open_long', 'open_short'], decision,
        planStatus: 'candidate', reviewNotes: ['最终动作与独立分项判断不一致，请在确认计划前复核。'], outcome: '候选建议：开多；置信度 60% 未达到计划门槛 80%。' }] }}/>)
    expect(within(screen.getByLabelText('Jev 决策输出')).getByText(/候选建议：开多/)).toBeTruthy()
    expect(screen.getByText(/请在确认计划前复核/)).toBeTruthy()
    expect(screen.getByText('查看判断依据').closest('details')?.open).toBe(false)
    expect(screen.queryByLabelText('Jev 处理流程')).toBeNull()
    expect(within(screen.getByLabelText('各动作概率')).queryByText('平多')).toBeNull()
  })
  it('labels a sole hold as restricted, ties its reason to that round, and keeps numeric confidence for genuine choices', () => {
    const time = Date.now(), decision = { action: 'hold' as const, confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time }
    const round = { id: 'limited', startedAt: time - 1000, sampleCount: 8, fromTime: time - 24000, toTime: time, price: 100, allowedActions: ['hold'] as ['hold'], decision, outcome: 'Jev 观望 · 置信度 100.0%；未生成交易计划。',
      evidence: { evaluatedAt: time, history: { source: 'test', barSeconds: 60, count: 0 }, allowedActions: ['hold'] as ['hold'],
        features: { quoteWindowSeconds: 21, quoteCount: 8, lower: null, upper: null, widthTicks: null, lowerTouches: 0, upperTouches: 0, location: null, reboundTicks: 0, pullbackTicks: 0, spreadTicks: 1, longRewardCostRatio: null, shortRewardCostRatio: null },
        checks: [{ id: 'history', label: '历史覆盖', state: 'fail' as const, detail: '历史 K 线不足', actions: ['open_long'] as ['open_long'], enforcement: 'hard' as const }] } }
    const state: ContestWatchStatus = { running: true, sampleCount: 8, planCount: 0, message: '等待', events: [], lastDecision: decision,
      analyses: [round, { ...round, id: 'pending', decision: undefined, startedAt: time + 1000, evidence: undefined, outcome: '正在分析', allowedActions: ['hold', 'open_long'] }] }
    const view = render(<ContestWatchVisuals status={state} active/>)
    const panel = within(screen.getByRole('region', { name: 'Jev 决策输出' }))
    expect(panel.getByRole('heading', { name: '受限观望' })).toBeTruthy()
    expect(panel.getByText(/历史 K 线不足/)).toBeTruthy()
    expect(panel.queryByText(/100/)).toBeNull()
    expect(panel.getAllByText('不适用').length).toBeGreaterThan(0)
    expect(screen.queryByText('Jev 观望 · 置信度 100.0%；未生成交易计划。')).toBeNull()
    const chosen = { ...decision, probabilities: { hold: 1, open_long: 0 } }
    view.rerender(<ContestWatchVisuals status={{ ...state, lastDecision: chosen, analyses: [{ ...round, decision: chosen, allowedActions: ['hold', 'open_long'] }] }} active/>)
    expect(panel.getByRole('heading', { name: '观望' })).toBeTruthy()
    expect(panel.getByText('100.0%')).toBeTruthy()
  })
  it('defaults to Jev-led decisions, preserves explicit strict mode across templates and persists the choice', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    expect((screen.getByLabelText('决策方式') as HTMLSelectElement).value).toBe('jev')
    expect(screen.getByText(/历史不足也会请求分析并产生用量/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('决策方式'), { target: { value: 'strict' } })
    fireEvent.click(screen.getByRole('button', { name: /内置模板.*趋势回调/ }))
    expect((screen.getByLabelText('决策方式') as HTMLSelectElement).value).toBe('strict')
    fireEvent.click(screen.getByText('微调模板'))
    fireEvent.change(screen.getByLabelText('保存模板名称'), { target: { value: '严格趋势' } })
    fireEvent.click(screen.getByRole('button', { name: '保存为我的模板' })); await screen.findByText(/已保存至本机/)
    cleanup(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(await screen.findByRole('button', { name: /我的模板.*严格趋势/ }))
    expect((screen.getByLabelText('决策方式') as HTMLSelectElement).value).toBe('strict')
    fireEvent.change(screen.getByLabelText('决策方式'), { target: { value: 'jev' } })
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' })); await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ decisionMode: 'jev' }))
  })
  it('distinguishes reference failures from hard data limits in Jev evidence', () => {
    const now = Date.now()
    render(<JevEvidence analysis={{ id: 'diagnostic', startedAt: now, finishedAt: now, sampleCount: 8, fromTime: now, toTime: now, price: 100, allowedActions: ['hold'], outcome: '诊断', evidence: {
      evaluatedAt: now, decisionMode: 'jev', history: { source: 'PandaData', barSeconds: 60, count: 0 }, allowedActions: ['hold'],
      features: { quoteWindowSeconds: 21, quoteCount: 8, lower: null, upper: null, widthTicks: null, lowerTouches: 0, upperTouches: 0, location: null, reboundTicks: 0, pullbackTicks: 0, spreadTicks: 1, longRewardCostRatio: null, shortRewardCostRatio: null },
      checks: [{ id: 'history', label: '历史覆盖', state: 'fail', detail: '数据缺失', actions: ['open_long', 'open_short'], enforcement: 'hard' },
        { id: 'rebound', label: '回升参考', state: 'fail', detail: '未达到参考阈值', actions: ['open_long'], enforcement: 'reference' }],
    } }}/>)
    expect(screen.getByText('硬性约束：开多 / 开空')).toBeTruthy()
    expect(screen.getByText('Jev 参考：开多（不作程序拦截）')).toBeTruthy()
    expect(screen.getByText(/本轮硬性限制只允许观望/)).toBeTruthy()
  })
  it('keeps the selected product when switching defaults and applies decimal tick and spread values', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.change(screen.getByLabelText('交易品种'), { target: { value: 'au' } })
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'au2612' } })
    for (const name of ['趋势回调', '突破跟随']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp('内置模板.*' + name) }))
      expect((screen.getByLabelText('交易品种') as HTMLSelectElement).value).toBe('au')
      expect((screen.getByLabelText('实际合约') as HTMLInputElement).value).toBe('au2612')
      expect((screen.getByLabelText('最小价格变动（tick 对应价格）') as HTMLInputElement).value).toBe('0.02')
    }
    expect(f.access.start).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' })); await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'au2612', maxSpread: .04, rangeRules: undefined, signalRules: expect.objectContaining({ kind: 'breakout', tickSize: .02 }) }))
  })
  it('clears stale contract data on a product change and supports manual products on another exchange', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.change(screen.getByLabelText('交易品种'), { target: { value: 'custom' } })
    expect((screen.getByLabelText('实际合约') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('最小价格变动（tick 对应价格）') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'IF2609' } })
    fireEvent.change(screen.getByLabelText('交易所'), { target: { value: 'CFE' } })
    fireEvent.change(screen.getByLabelText('最小价格变动（tick 对应价格）'), { target: { value: '.2' } })
    fireEvent.click(screen.getByRole('button', { name: /内置模板.*趋势回调/ }))
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' })); await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'IF2609', instrument: { product: 'if', exchange: 'CFE', tickSize: .2 }, autoHistory: { exchange: 'CFE', barSeconds: 60 }, signalRules: expect.objectContaining({ kind: 'trend', tickSize: .2 }) }))
  })
  it('creates, saves and reloads an independent template without needing a contract or starting', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(screen.getByRole('button', { name: '＋ 新建模板' }))
    fireEvent.change(screen.getByLabelText('新模板名称'), { target: { value: '我的突破' } })
    fireEvent.change(screen.getByLabelText('创建方式'), { target: { value: 'breakout' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }))
    expect(screen.getByText('微调模板').closest('details')?.open).toBe(true)
    fireEvent.change(screen.getByLabelText('突破追价上限（tick）'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: '保存为我的模板' })); await screen.findByText(/已保存至本机/)
    expect(f.access.start).not.toHaveBeenCalled()
    expect(f.access.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: '我的突破', config: expect.objectContaining({ symbol: '', signalRules: expect.objectContaining({ kind: 'breakout', maxChaseTicks: 6 }) }) }))
    cleanup(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(await screen.findByRole('button', { name: /我的模板.*我的突破/ }))
    expect((screen.getByLabelText('突破追价上限（tick）') as HTMLInputElement).value).toBe('6')
    fireEvent.click(screen.getByRole('button', { name: '＋ 新建模板' }))
    fireEvent.change(screen.getByLabelText('新模板名称'), { target: { value: '我的突破' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }))
    expect(screen.getByRole('alert').textContent).toContain('已有同名模板')
  })
  it('creates a blank strategy without inherited range conditions and retains custom action text', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(screen.getByRole('button', { name: '＋ 新建模板' }))
    fireEvent.change(screen.getByLabelText('新模板名称'), { target: { value: '我的自主策略' } })
    fireEvent.change(screen.getByLabelText('创建方式'), { target: { value: 'blank' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }))
    expect((screen.getByLabelText('研究目标和约束') as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByLabelText('开多标准') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('研究目标和约束'), { target: { value: '自定义目标' } })
    for (const action of ['观望', '开多', '开空', '平多', '平空']) fireEvent.change(screen.getByLabelText(action + '标准'), { target: { value: action + '的自定义条件' } })
    fireEvent.click(screen.getByRole('button', { name: '保存为我的模板' })); await screen.findByText(/已保存至本机/)
    expect(f.access.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ customStrategy: true, rangeRules: undefined, instructions: '自定义目标', actionCriteria: expect.objectContaining({ open_long: '开多的自定义条件' }) }) }))
    expect(f.access.start).not.toHaveBeenCalled()
  })
  it('saves edits without starting, reloads the custom template and can restore built-in defaults', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.click(screen.getByText('微调模板'))
    fireEvent.change(screen.getByLabelText('决策间隔（秒）'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('参考资料'), { target: { value: '我的区间研究' } })
    fireEvent.change(screen.getByLabelText('保存模板名称'), { target: { value: '午后区间' } })
    fireEvent.click(screen.getByRole('button', { name: '保存为我的模板' }))
    await screen.findByText(/已保存至本机/)
    expect(f.access.start).not.toHaveBeenCalled()
    expect(f.access.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: '午后区间', config: expect.objectContaining({ decisionIntervalSeconds: 45, referenceMaterial: '我的区间研究' }) }))
    cleanup(); render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(await screen.findByRole('button', { name: /午后区间/ }))
    expect((screen.getByLabelText('实际合约') as HTMLInputElement).value).toBe('rb2610')
    expect((screen.getByLabelText('决策间隔（秒）') as HTMLInputElement).value).toBe('45')
    fireEvent.click(screen.getByRole('button', { name: /内置模板.*区间回归/ }))
    expect((screen.getByLabelText('决策间隔（秒）') as HTMLInputElement).value).toBe('30')
    expect((screen.getByLabelText('实际合约') as HTMLInputElement).value).toBe('rb2610')
    expect((screen.getByLabelText('参考资料') as HTMLTextAreaElement).value).toBe('')
  })
  it('reuses the previous contract without starting automatically and retains access to the previous full configuration', async () => {
    const f = fixture()
    const previous = { symbol: 'rb2610', volume: 5, intervalSeconds: 3, durationMinutes: 120, minConfidence: .8, maxEquityDrop: 5000, maxPlans: 2, instructions: '旧配置' }
    f.setState({ running: false, message: '尚未启动', sampleCount: 0, planCount: 0, events: [], config: previous })
    render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    expect((screen.getByLabelText('实际合约') as HTMLInputElement).value).toBe('rb2610')
    expect(f.access.start).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '载入上次运行配置' }))
    expect((screen.getByLabelText('手数及持仓上限') as HTMLInputElement).value).toBe('5')
    expect((screen.getByLabelText('研究目标和约束') as HTMLTextAreaElement).value).toBe('旧配置')
  })
  it('shows action-specific gates separately from actual model assessments', () => {
    const now = Date.now()
    render(<JevEvidence analysis={{ id: 'test', startedAt: now, finishedAt: now, sampleCount: 8, fromTime: now - 21000, toTime: now, price: 102, allowedActions: ['hold', 'open_long'], outcome: '测试',
      evidence: { evaluatedAt: now, history: { source: '测试历史', barSeconds: 60, count: 20 }, features: { quoteWindowSeconds: 21, quoteCount: 8, lower: 100, upper: 120, widthTicks: 20, lowerTouches: 5, upperTouches: 5, location: .1, reboundTicks: 2, pullbackTicks: 0, spreadTicks: 1, longRewardCostRatio: 5, shortRewardCostRatio: 1 },
        checks: [{ id: 'rebound', label: '回升确认', state: 'pass', detail: '2 tick', actions: ['open_long'] }, { id: 'pullback', label: '回落确认', state: 'fail', detail: '0 tick', actions: ['open_short'] }], allowedActions: ['hold', 'open_long'] },
      decision: { action: 'open_long', confidence: .94, probabilities: { open_long: .94, hold: .06 }, model: 'jev-1.13.0', time: now, assessments: {
        regime: { choice: 'range', confidence: .9, probabilities: { range: .9 } }, fit: { choice: 'supported', confidence: .95, probabilities: { supported: .95 } }, blocker: { choice: 'none', confidence: .96, probabilities: { none: .96 } },
      } } }}/>)
    expect(screen.getByText('约束：开多')).toBeTruthy(); expect(screen.getByText('约束：开空')).toBeTruthy()
    expect(screen.getByText('市场状态')).toBeTruthy(); expect(screen.getByText('适用')).toBeTruthy()
    expect(screen.getByText('未识别到阻碍')).toBeTruthy()
  })
  it('creates PandaData history at the selected period and prevents startup while it is being prepared', async () => {
    const f = fixture(), columns = { time: 'datetime', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
    let finish!: (history: NonNullable<Parameters<typeof f.access.start>[0]['history']>) => void
    vi.mocked(f.access.prepareHistory).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    fireEvent.click(screen.getByText('微调模板'))
    fireEvent.click(screen.getByLabelText('启动时自动准备 PandaData 行情'))
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.change(screen.getByLabelText('权益回落停止线（元）'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('PandaData 实际合约'), { target: { value: 'rb2610.shf' } })
    fireEvent.change(screen.getByLabelText('PandaData 读取周期'), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: '创建 PandaData 分钟数据源' }))
    expect(f.access.prepareHistory).toHaveBeenCalledWith({ symbol: 'RB2610.SHF', barSeconds: 300 })
    expect(screen.getByRole('button', { name: '开始盯盘' }).matches(':disabled')).toBe(true)
    vi.mocked(f.access.datasets).mockResolvedValue([{ id: 'history-test', name: 'Panda minutes', columns: Object.values(columns), rows: 40, source: 'pandadata' }])
    await act(async () => finish({ datasetId: 'history-test', barSeconds: 300, timeMeaning: 'open', refresh: true, columns }))
    expect((screen.getByLabelText('历史行情数据集') as HTMLSelectElement).value).toBe('history-test')
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' }))
    await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ history: expect.objectContaining({ datasetId: 'history-test', barSeconds: 300, refresh: true }) }))
  })
  it('shows audited API usage and submits editable strategy settings', async () => {
    const f = fixture()
    vi.mocked(f.access.usage).mockResolvedValue({ since: Date.now(), requests: 1, responsesOk: 1, unknownUsage: 0, inputTokens: 382, outputTokens: 34,
      records: [{ id: 'local-id', purpose: 'connection-test', startedAt: Date.now(), finishedAt: Date.now() + 100, keyFingerprint: 'abcdef123456', httpStatus: 200, model: 'jev-1.13.0', usage: { input_tokens: 382, output_tokens: 34 } }] })
    render(<ContestWatch access={f.access}/>); await screen.findByText('尚未启动')
    expect(await screen.findByText('382 / 34')).toBeTruthy()
    expect(screen.getByText(/非官网账单/)).toBeTruthy()
    fireEvent.click(screen.getByText('微调模板'))
    fireEvent.change(screen.getByLabelText('策略名称'), { target: { value: '我的区间' } })
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.change(screen.getByLabelText('权益回落停止线（元）'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('允许开仓方向'), { target: { value: 'long_only' } })
    fireEvent.change(screen.getByLabelText('参考资料'), { target: { value: '自编策略参考' } })
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' }))
    await screen.findByText('已启动')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ strategyName: '我的区间', allowedSide: 'long_only', referenceMaterial: '自编策略参考', actionCriteria: expect.objectContaining({ open_long: expect.any(String) }) }))
  })
  it('starts a complete template without editing parameters or a second confirmation dialog', async () => {
    const f = fixture(); render(<ContestWatch access={f.access}/>)
    await screen.findByText('尚未启动')
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.change(screen.getByLabelText('权益回落停止线（元）'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: /内置模板.*区间回归/ }))
    expect(f.access.start).not.toHaveBeenCalled()
    expect(screen.getByText('微调模板').closest('details')?.open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' }))
    expect(screen.queryByRole('region', { name: '确认盯盘配置' })).toBeNull()
    expect(screen.getByText(/每笔计划仍由你确认/)).toBeTruthy()
    await screen.findByText('已启动')
    expect(screen.getByRole('status').getAttribute('data-active')).toBe('true')
    expect(f.access.start).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'rb2610', maxEquityDrop: 1000, volume: 1, intervalSeconds: 3, decisionIntervalSeconds: 30, autoHistory: { exchange: 'SHF', barSeconds: 60 }, rangeRules: expect.objectContaining({ tickSize: 1, roundTripCostTicks: 2 }) }))
    expect(screen.getByLabelText('实际合约').matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '停止盯盘' }))
    await screen.findByText('已停止')
    expect(screen.getByRole('status').getAttribute('data-active')).toBe('false')
    expect(f.access.stop).toHaveBeenCalledOnce()
  })
  it('lets a new user configure Jev in the page before connecting a contest account', async () => {
    const f = fixture()
    vi.mocked(f.access.settings).mockResolvedValueOnce({ configured: false, writable: true, model: 'jev-1.13.0' })
    render(<ContestWatch access={f.access} connected={false}/>)
    await screen.findByText('尚未启动')
    expect(screen.getByRole('button', { name: '开始盯盘' }).matches(':disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Jev API Key'), { target: { value: 'private-candidate' } })
    fireEvent.click(screen.getByRole('button', { name: '测试并保存密钥' }))
    await screen.findByText('密钥已配置')
    expect(f.access.configure).toHaveBeenCalledWith({ apiKey: 'private-candidate' })
    expect((screen.getByLabelText('Jev API Key') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('Jev API Key').getAttribute('type')).toBe('password')
    expect(screen.getByRole('button', { name: '开始盯盘' }).matches(':disabled')).toBe(true)
    expect(f.access.start).not.toHaveBeenCalled()
  })
  it('shows real samples, action probabilities and the recorded reason a plan was not created', async () => {
    const f = fixture(true), time = Date.now()
    const decision = { action: 'hold' as const, confidence: .82, probabilities: { hold: .82, open_long: .12, open_short: .06 }, model: 'jev-1.13.0', time }
    f.setState({ running: true, phase: 'sampling', message: '等待下次决策', sampleCount: 8, planCount: 0, events: [], lastDecision: decision,
      samples: [{ time: time - 3000, price: 3042 }, { time, price: 3044 }],
      analyses: [{ id: 'round-one', startedAt: time - 1000, responseAt: time, finishedAt: time, sampleCount: 8, fromTime: time - 24000,
        toTime: time - 1000, price: 3044, allowedActions: ['hold', 'open_long', 'open_short'], decision, outcome: '证据不足，本轮观望。' }] })
    render(<ContestWatch access={f.access}/>)
    await screen.findByText('等待下次决策')
    expect(screen.getByRole('img', { name: /最低 3042，最高 3044，最新 3044/ })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Jev 决策输出' })).getByText('82.0%')).toBeTruthy()
    expect(screen.getByText('Jev 响应 1.0 秒')).toBeTruthy()
    expect(screen.getAllByText('证据不足，本轮观望。').length).toBe(2)
    expect(screen.getByText('分析历史')).toBeTruthy()
  })
  it('animates the reported watch phase and stops claiming activity while status is unavailable', async () => {
    vi.useFakeTimers()
    const f = fixture(true)
    f.setState({ running: true, phase: 'waiting_quote', message: '等待行情恢复', sampleCount: 0, planCount: 0,
      lastQuoteCheckedAt: Date.now(), events: [] })
    render(<ContestWatch access={f.access}/>)
    await act(async () => {})
    expect(screen.getByText('正在盯盘 · 等待行情')).toBeTruthy()
    expect(screen.getByText(/实时报价来自比赛柜台，PandaData 用于历史 K 线/)).toBeTruthy()
    expect(screen.getByText(/最新行情.*价格与时间/)).toBeTruthy()
    expect(screen.getByText(/最近行情检查/)).toBeTruthy()
    expect(screen.getByRole('status').getAttribute('data-active')).toBe('true')
    vi.mocked(f.access.status).mockRejectedValueOnce(new Error('测试连接中断'))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('连接中断 · 状态待确认')).toBeTruthy()
    expect(screen.getByRole('status').getAttribute('data-active')).toBe('false')
    f.setState({ running: true, phase: 'deciding', message: '分析快照', sampleCount: 8, planCount: 0, events: [] })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('正在盯盘 · Jev 分析中')).toBeTruthy()
    expect(screen.queryByText(/实时报价来自比赛柜台，PandaData 用于历史 K 线/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').getAttribute('data-active')).toBe('true')
  })
  it('allows stopping during startup and ignores the late start response', async () => {
    const f = fixture(); let finish!: (state: ContestWatchStatus) => void
    vi.mocked(f.access.start).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ContestWatch access={f.access}/>)
    await screen.findByText('尚未启动')
    fireEvent.change(screen.getByLabelText('实际合约'), { target: { value: 'rb2610' } })
    fireEvent.change(screen.getByLabelText('权益回落停止线（元）'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: '开始盯盘' }))
    await waitFor(() => expect(finish).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '停止盯盘' }))
    await screen.findByText('已停止')
    await act(async () => finish({ running: true, message: '迟到的启动结果', sampleCount: 0, planCount: 0, events: [] }))
    expect(screen.queryByText('迟到的启动结果')).toBeNull()
    expect(screen.getByText('已停止')).toBeTruthy()
  })
})
