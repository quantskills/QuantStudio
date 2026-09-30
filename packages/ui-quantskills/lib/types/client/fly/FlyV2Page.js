import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { GearSixIcon, RobotIcon } from '@phosphor-icons/react';
import { futuresProduct, futuresContractPattern, products } from '@deepseek-ai/dsh-quantskills-session/contracts';
import { TradingEngineSettings } from "./TradingEngineSettings.js";
import { FlyInstruments } from "./FlyInstruments.js";
import { TradingSettingsNavigation } from "../TradingNavigation.js";
import { ExecutionModeChoice, ExecutionDisclosure, AUTOMATIC_TRADING_CONSENT } from "../TradingExecution.js";
import { ActionDialog } from "../ActionDialog.js";
import { FlyMarketView } from "./FlyMarketView.js";
import { FlyContractList } from "./FlyContractList.js";
import { TradingGuide } from "../TradingGuide.js";
import { flyFetch } from "./transport.js";
import { useEffect, useRef, useState } from 'react';
import { FlyReplayLab } from "./FlyReplay.js";
import './fly-v2.css';
import { collapseNeuralWaits } from './flyJournal';
import { lifeGoals } from './LifeTrace';
import { TradeStatistics } from './TradeStatistics';
import { TraderOverview } from "./TraderOverview.js";
import { TradeLearning } from './TradeLearning';
import { TradeAnalytics } from './TradeAnalytics';
import { RuntimeContinuity } from './RuntimeContinuity';
import { TradeFilterControls } from './TradeFilterControls';
import { waitForCompetition } from "../competition-async.js";
import './fly-workspace.css';
import './trader-overview.css';
import { FlyHistory, useRetryCountdown } from "./FlyHistory.js";
const goals = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' };
const environmentNames = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' };
const actors = { fly: 'AI 交易员决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' };
const names = Object.fromEntries(products.map(p => [p.exchange === 'CFE' ? p.product.toUpperCase() : p.product, p.name]));
const fmt = (v) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
async function api(path, body) {
    const response = await flyFetch(`/api/fly/v2/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok)
        throw new Error(typeof result.detail === 'string' ? result.detail : '请求未完成，请检查输入');
    return result;
}
function eventText(e) {
    const p = e.payload;
    if (e.kind === 'model_call' && p.provider === 'jev' && p.status === 'ok')
        return p.purpose === 'connection_test' ? 'Jev 连接测试通过' : `Jev 返回建议：${environmentNames[p.event] || p.event}；实际效果见执行记录`;
    if (e.kind === 'model_call')
        return `${p.provider === 'codex_cli' ? 'Codex CLI' : p.provider === 'jev' ? (p.service_provider === 'vercel' ? 'Jev · Vercel' : 'Jev · TypeSafe') : p.provider === 'trade_model' ? '交易模型' : '语言 AI'} · ${p.status === 'ok' ? '调用完成' : '调用未完成'}${p.reason ? ' · ' + p.reason : ''}`;
    if (e.kind === 'oracle_interpretation' && p.application === 'memory_only')
        return `神谕 #${p.source_seq} 已存入偏好记忆；当前运动闭环不直接改动作分数`;
    if (e.kind === 'decision' && p.life_response)
        return `神经目标：${lifeGoals[p.choice.action] || p.choice.action} · ${p.motor.drive ? '已形成运动指令' : p.choice.action === 'rest' ? '恢复精力' : '身体停留'} · 读出层选择，无随机抽签`;
    if (e.kind === 'reward' && p.evidence?.outcome === 'life_episode')
        return `${lifeGoals[p.evidence.goal]}完成 · 移动 ${Number(p.evidence.distance).toFixed(2)} m · 取食 ${p.evidence.meals.length} 次 · 反馈 ${Number(p.reward).toFixed(3)}`;
    if (e.kind === 'decision' && p.motor)
        return p.motor.drive ? `神经运动：${p.motor.turn < -.1 ? '左转' : p.motor.turn > .1 ? '右转' : '向前'} · ${p.motor.active_readout_neurons} 个读出神经元放电` : `${p.wait_reason?.message || (p.sensory?.visible_food === 0 ? '果盘已吃空，没有食物线索' : '神经响应暂未形成运动指令')}${e.merged_count ? `（合并最近 ${e.merged_count} 次感知）` : ''}`;
    if (e.kind === 'oracle_interpretation')
        return `${p.interpreter === 'language_ai' ? '语言模型' : '本地关键词'}已理解神谕 #${p.source_seq}，形成生活偏好`;
    if (e.kind === 'life_interrupted')
        return p.reason;
    if (e.kind === 'decision')
        return p.head === 'life' ? `选择${goals[p.choice.action] || p.choice.action}` : `${p.product} · ${{ WAIT: '等待', LONG: '开多', SHORT: '开空', CLOSE: '平仓' }[p.choice.action] || p.choice.action}`;
    if (e.kind === 'execution_gate')
        return `${p.product} · ${p.message}`;
    if (e.kind === 'trade')
        return `${p.symbol} · ${p.volume} 手 · 成交价 ${p.price}`;
    if (e.kind === 'oracle')
        return p.text;
    if (e.kind === 'environment_assistance')
        return p.status === 'not_applied' ? `Jev 未执行：${p.reason}` : p.status === 'no_change' ? `Jev 无新变化：已经是${environmentNames[p.event] || p.event}${p.cached ? '（复用缓存）' : ''}` : `Jev 已执行：${environmentNames[p.before] || p.before || ''} → ${environmentNames[p.event] || p.event}${p.target ? ' · 物件 ' + p.target : ''}${p.cached ? '（复用缓存）' : ''}`;
    if (e.kind === 'environment_recovery')
        return `家园环境：${(p.objects || []).map((o) => o.name).join('、')}的果实重新成熟；等待神经重新感知`;
    if (e.kind === 'report')
        return p.text;
    if (e.kind === 'reward' && p.evidence?.outcome === 'neural_contact_feeding')
        return `接触取食完成 · ${p.evidence.target} · 已记录神经动作与接触位置`;
    if (e.kind === 'reward')
        return `${p.head === 'life' ? '生活' : '交易'}反馈 ${Number(p.reward).toFixed(3)} · ${p.evidence?.outcome || '柜台结果'}`;
    if (e.kind === 'learning_deferred')
        return p.reason;
    if (e.kind === 'learning_update')
        return p.applied ? (p.scope === 'life_readout_only' ? '生活读出层已学习实际反馈；连接组冻结' : '决策层已学习这次反馈') : (p.reason || '反馈已记录，参数保持冻结');
    return p.message || p.error || p.description || p.action || { checkpoint_saved: '检查点已保存', organism_started: '个体开始运行', binding_created: '比赛账户已绑定' }[e.kind] || e.kind;
}
export default function FlyV2Page({ active, contest, openContest, openModelSettings, preparing = false, prepareMessage, onPrepare, tradePlans, initialTab = 'dashboard' }) {
    const [status, setStatus] = useState();
    const [tab, setTab] = useState(initialTab);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [setupError, setSetupError] = useState('');
    const connectionCooldown = useRetryCountdown(status?.connection?.retry_at);
    const [setup, setSetup] = useState(false);
    const [step, setStep] = useState(2);
    const [details, setDetails] = useState(false), [selected, setSelected] = useState(''), [startReview, setStartReview] = useState(false);
    const [marketOpen, setMarketOpen] = useState(false);
    const [riskAccepted, setRiskAccepted] = useState(false);
    useEffect(() => setRiskAccepted(false), [JSON.stringify(status?.settings), JSON.stringify(status?.binding)]);
    const [contestStatus, setContestStatus] = useState(), [contestError, setContestError] = useState('');
    const contestRevision = useRef(0);
    const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : '';
    const [draft, setDraft] = useState();
    const [models, setModels] = useState();
    const [oracle, setOracle] = useState('');
    const [report, setReport] = useState('');
    const [filter, setFilter] = useState('all');
    const loaded = useRef(false);
    const tradingRef = useRef(null);
    function showTrading() {
        setTab('dashboard');
        requestAnimationFrame(() => { tradingRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); tradingRef.current?.focus({ preventScroll: true }); });
    }
    useEffect(() => {
        if (!active || !setup || !contest)
            return;
        const revision = ++contestRevision.current, controller = new AbortController();
        setContestStatus(undefined);
        setContestError('');
        void waitForCompetition(() => contest.status(), '比赛账户状态读取', 15_000, controller.signal)
            .then(value => { if (revision === contestRevision.current)
            setContestStatus(value); })
            .catch(error => { if (revision === contestRevision.current)
            setContestError(String(error).replace(/^(?:Error|RemoteFailure): /, '')); });
        return () => { contestRevision.current++; controller.abort(); };
    }, [active, setup, contest]);
    useEffect(() => {
        if (!active)
            return;
        let disposed = false;
        let timer;
        const poll = async () => {
            try {
                const result = await waitForCompetition(() => api('state'), 'AI 交易员状态读取', 15_000);
                if (!disposed) {
                    setStatus(result);
                    if (!loaded.current) {
                        loaded.current = true;
                        setDraft(result.settings);
                        setSetup(false);
                    }
                }
            }
            catch (error) {
                if (!disposed)
                    setError(String(error));
            }
            finally {
                if (!disposed)
                    timer = setTimeout(() => void poll(), 1000);
            }
        };
        void poll();
        void api('models').then(value => { if (!disposed)
            setModels(value); }).catch(error => { if (!disposed)
            setError(String(error)); });
        return () => { disposed = true; clearTimeout(timer); };
    }, [active]);
    async function run(fn) {
        setPending(true);
        setError('');
        setSetupError('');
        try {
            await fn();
        }
        catch (e) {
            const message = String(e).replace(/^(?:Error|RemoteFailure): /, '');
            if (setup)
                setSetupError(message);
            else
                setError(message);
        }
        finally {
            setPending(false);
        }
    }
    async function control(action, version = '', execution_consent) { await api('control', { action, version, ...(execution_consent ? { execution_consent } : {}) }); }
    async function connectContestAccount() {
        if (!contest)
            throw new Error('比赛账户服务尚未连接，请重启 QuantStudio。');
        const revision = ++contestRevision.current;
        setContestError('');
        const result = await waitForCompetition(async (signal) => {
            const current = await contest.status();
            signal.throwIfAborted();
            if (current.enabled && current.phase === 'connected' && current.identity)
                return current;
            if (!current.enabled)
                await contest.mode(true);
            signal.throwIfAborted();
            return contest.connect();
        }, '比赛账户连接', 600_000);
        if (revision !== contestRevision.current)
            return;
        setContestStatus(result);
        if (!result.enabled || result.phase !== 'connected' || !result.identity)
            throw new Error(result.message || '比赛账户尚未连接完成，请重试。');
    }
    function openSetup() { if (status)
        setDraft(structuredClone(status.settings)); setSetupError(''); setSetup(true); setStep(5); }
    function checkInstruments() {
        const invalid = draft?.instruments.filter(item => !futuresContractPattern.test(item.symbol.trim())) ?? [];
        if (!invalid.length)
            return true;
        setSetupError(`请为已选品种填写实际合约代码（如 rb2610），或取消勾选：${invalid.map(item => names[item.product] || item.product).join('、')}`);
        setStep(2);
        return false;
    }
    if (!status)
        return _jsxs("div", { className: "fv-page fv-loading", children: [_jsx("div", { className: "fv-orbit", children: "\u2726" }), _jsx("h2", { children: "\u6B63\u5728\u8FDE\u63A5 AI \u4EA4\u6613\u5458" }), _jsx("p", { children: error || '恢复交易状态…' })] });
    const s = status;
    const isLLM = s.settings.decision_engine === 'llm';
    const executionMode = s.settings.execution_mode ?? 'automatic';
    const automatic = executionMode === 'automatic';
    const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse();
    const issueList = (value) => {
        const issues = [];
        if (value.decision_engine !== 'llm' && !s.environment.brain_ready)
            issues.push({ key: 'environment', label: '准备神经运行环境', step: 0 });
        if (value.decision_engine === 'llm') {
            if (!value.trade_model || (models && !models.profiles.some(m => m.provider_id === value.trade_model)))
                issues.push({ key: 'trade_model', label: '选择可用的交易模型', step: 5 });
            if (!value.trade_instructions?.trim())
                issues.push({ key: 'trade_instructions', label: '填写交易要求', step: 5 });
            if (!Number.isInteger(value.llm_max_lots) || (value.llm_max_lots ?? 0) < 1 || (value.llm_max_lots ?? 0) > 500)
                issues.push({ key: 'llm_max_lots', label: '单合约手数须为 1–500 的整数', step: 5 });
            if (!Number.isInteger(value.trade_daily_calls) || (value.trade_daily_calls ?? -1) < 0 || (value.trade_daily_calls ?? 0) > 100000)
                issues.push({ key: 'trade_daily_calls', label: '模型调用上限须为 0–100000 的整数', step: 5 });
        }
        if (!(accountKey || (s.binding && s.connection?.status !== 'needs_auth')))
            issues.push({ key: 'account', label: '连接比赛账户', step: 2 });
        if (!value.instruments.length || value.instruments.some(i => !futuresContractPattern.test(i.symbol) || futuresProduct(i.symbol) !== i.product.toLowerCase()))
            issues.push({ key: 'instruments', label: '选择品种并填写有效实际合约', step: 2 });
        for (const [key, label, max] of [['target_notional', '每品种名义上限', 100000000], ['total_notional', '总名义占用上限', 500000000], ['loss_limit', '账户损失上限', 100000000]]) {
            if (!Number.isFinite(value[key]) || value[key] < 0)
                issues.push({ key, label: `设置${label}（0 表示不额外限制）`, step: 4 });
            else if (value[key] > max)
                issues.push({ key, label: `${label}不能超过 ${max.toLocaleString('zh-CN')} 元`, step: 4 });
        }
        if (value.total_notional > 0 && value.target_notional > value.total_notional)
            issues.push({ key: 'total_notional', label: '总名义占用上限不能小于每品种名义上限', step: 4 });
        return issues;
    };
    const missing = issueList(s.settings), draftIssues = draft ? issueList(draft) : [];
    const canStart = !s.settings.life_validation && !missing.length;
    function configureAt(index) { openSetup(); setStep(index); }
    function checkSetup() {
        if (!checkInstruments())
            return false;
        if (draft?.decision_engine !== 'llm' && !s.environment.brain_ready) {
            setSetupError('请先准备神经运行环境');
            setStep(0);
            return false;
        }
        if (!draft?.life_validation && draftIssues.length) {
            setSetupError(draftIssues.map(i => i.label).join('；'));
            setStep(draftIssues[0].step);
            return false;
        }
        return true;
    }
    async function saveSetup(later = false) {
        if (!draft || (later ? !checkInstruments() : !checkSetup()))
            return;
        const saved = await api('settings', { ...draft, onboarding_complete: !later });
        setStatus({ ...s, settings: saved });
        setDraft(saved);
        if (!later && !draft.life_validation && (s.onboarding || s.settings.life_validation)) {
            setRiskAccepted(false);
            setStartReview(true);
        }
        else if (!later && s.onboarding)
            await control('start');
        setSetup(false);
        setTab('dashboard');
    }
    const guide = _jsx(TradingGuide, { compact: true, name: "AI \u4EA4\u6613\u5458", steps: [
            { title: '选择决策方式', status: isLLM ? '使用 QS 大模型' : s.environment.brain_ready ? '神经环境已就绪' : '运行环境待准备', ready: isLLM ? !!s.settings.trade_model : s.environment.brain_ready,
                body: '打开「交易设置 → 决策引擎」。大模型模式选择 QS 已配置的模型，再写几句交易要求；神经模式先准备本地神经环境。两种引擎都支持逐笔确认或自动下单。',
                note: '大模型模式直接使用 QS 模型服务，无需安装神经依赖。', action: { label: '选择决策方式', run: () => configureAt(5) } },
            { title: '连接账户与合约', status: s.settings.instruments.length ? `已保存 ${s.settings.instruments.length} 个合约 · 仍需核对行情` : '账户与合约待设置',
                body: '在设置中连接期货模拟赛账户，再选择品种并核对实际合约月份。可搜索全部品种或手动填写其他合约。初次先选一个熟悉的品种，便于观察行情、信号与回执是否连贯。',
                note: '实时报价来自比赛柜台，历史数据需先到「设置 → PandaData」连接授权。合约代码示例不代表当前可交易月份。名义金额不是保证金；额外风险上限填 0 表示不额外限制，请根据模拟账户资金设置。', action: { label: '设置账户、合约与限额', run: () => configureAt(2) } },
            { title: '启动自动交易', status: s.control.trading ? s.connection?.status === 'ready' ? '自动交易已启用' : '已启用 · 等待行情' : '自动交易未启用', ready: s.control.trading && s.connection?.status === 'ready',
                body: '在「运行与额度」选择执行方式。完成设置后核对启动范围；自动下单须确认风险。修改设置只保存，回到交易页启动。先观察行情就绪、决策原因和回执状态。',
                note: '按所选引擎生成决策。大模型会产生 API 用量，调用失败会显示原因并等待下一轮，不会切换成神经信号。独立的 Jev 盯盘仍在比赛页。', action: { label: '检查完成前的配置', run: () => configureAt(3) } },
            { title: '查看回执与暂停', status: automatic ? '信号触发后自动提交' : '信号触发后等待确认',
                body: '信号满足条件后，逐笔确认模式等待你核对计划；自动模式通过 CLI 提交。在「交易计划与回执」查看合约、手数与成交。',
                note: '「暂停自动交易」停止后续新委托，不撤单、不平仓。关闭浏览器不代表后台停止；要停止请使用页面控制，并检查已有委托和持仓。', action: { label: '查看交易状态与计划', run: showTrading } },
        ], troubleshooting: [
            { title: '环境一直准备中或下载失败', body: '神经模式可在「运行环境」查看准备进度，下载失败后重试会复用已校验文件。使用大模型时无需准备神经环境。' },
            { title: '账户已连接，行情仍未就绪', body: '核对实际合约月份、柜台是否开放该合约及当前是否交易时段。在比赛页查同一合约的最新行情，再看AI 交易员历史数据诊断。PandaData 授权和比赛账户授权互不替代。' },
            { title: '没有计划，或者额度不足', body: '先看是否开启自动交易、行情与决策引擎是否就绪，再检查信号、冷却、未完成委托及柜台保证金。名义上限低于一手合约所需名义金额时可能无法开仓，不要盲目把上限清零。' },
        ] });
    const displayedMarkets = s.settings.instruments.map(item => s.markets.find(m => m.product === item.product && (!m.symbol || m.symbol.toLowerCase() === item.symbol.toLowerCase()))
        ?? { ...item, count: 0, readiness: 'waiting', long: 0, short: 0, chart: [] });
    const currentMarket = displayedMarkets.find(m => m.product === selected) ?? displayedMarkets[0];
    const activities = [...new Map([...s.events, ...(s.trade_events || [])].map(e => [e.seq, e])).values()]
        .filter(e => (e.kind === 'decision' && e.payload.product && e.payload.head !== 'life') || e.kind === 'trade' || e.kind === 'execution_gate' || (e.kind === 'model_call' && e.payload.provider === 'trade_model' && e.payload.status !== 'ok'))
        .sort((a, b) => b.at - a.at || b.seq - a.seq).slice(0, 3).map(e => {
        const p = e.payload;
        const symbol = p.symbol || displayedMarkets.find(m => m.product === p.product)?.symbol || p.product || '';
        const title = e.kind === 'trade' ? '柜台已成交' : e.kind === 'execution_gate' ? '执行进展' : e.kind === 'model_call' ? '模型调用未完成'
            : { WAIT: '继续观察', LONG: '目标做多', SHORT: '目标做空', CLOSE: '平仓决策' }[p.choice?.action] || '交易决策';
        const detail = e.kind === 'trade' ? `${p.volume} 手 · 成交价 ${fmt(p.price)}`
            : p.choice?.reason || p.wait_reason?.message || p.message || p.reason || eventText(e);
        return { id: e.seq, at: e.at, title, detail: [symbol, detail].filter(Boolean).join(' · ') };
    });
    const runningLabel = s.control.trading ? s.control.close_only ? '仅平仓运行中' : automatic ? '自动交易中' : '生成计划中' : automatic ? '自动交易已暂停' : '计划生成已暂停';
    function startTrading() { setRiskAccepted(false); setStartReview(true); }
    const navigation = _jsx("nav", { className: "fv-nav qs-trader-sections", "aria-label": "AI \u4EA4\u6613\u5458\u680F\u76EE", children: [['dashboard', '交易'], ['analysis', '表现'], ['talk', '记录']].map(([key, label]) => _jsx("button", { type: "button", className: tab === key ? 'selected' : '', "aria-current": tab === key ? 'page' : undefined, onClick: () => setTab(key), children: label }, key)) });
    return _jsxs("div", { className: "fv-page fv-workspace qs-workspace-refined qs-trader-dashboard", children: [_jsxs("header", { className: "fv-header qs-trader-identity-header", children: [_jsxs("div", { className: "fv-identity", children: [_jsx("div", { className: "fv-avatar", "aria-hidden": "true", children: _jsx(RobotIcon, { size: 30, weight: "duotone" }) }), _jsxs("div", { children: [_jsxs("div", { className: "qs-trader-name-line", children: [_jsx("h1", { children: s.name || 'AI 交易员' }), _jsxs("span", { className: "qs-trader-running", "data-running": s.control.trading, children: [_jsx("span", { className: "qs-state-dot", "data-active": s.control.trading }), runningLabel] })] }), _jsxs("p", { className: "qs-trader-subtitle", children: [isLLM ? '大模型' : '神经模型', " \u00B7 ", s.settings.trade_period_minutes || 1, " \u5206\u949F \u00B7 ", s.settings.instruments.length, " \u4E2A\u5408\u7EA6"] })] })] }), _jsxs("div", { className: "fv-header-actions", children: [_jsxs("button", { type: "button", "aria-label": "AI \u4EA4\u6613\u5458\u8FD0\u884C\u8BBE\u7F6E", onClick: openSetup, children: [_jsx(GearSixIcon, { size: 18 }), _jsx("span", { children: "\u7F16\u8F91" })] }), _jsx("button", { type: "button", className: s.control.trading ? 'fv-pause' : 'fv-primary', disabled: pending, onClick: () => {
                                    if (s.control.trading)
                                        void run(() => control('observe'));
                                    else if (!canStart)
                                        configureAt(s.settings.life_validation ? 4 : missing[0].step);
                                    else
                                        startTrading();
                                }, children: pending ? '处理中…' : s.control.trading ? (automatic ? '暂停自动交易' : '暂停生成计划') : canStart ? (automatic ? '开始自动交易' : '开始生成计划') : '继续配置' })] })] }), _jsxs("div", { className: "qs-trader-navigation", children: [navigation, guide] }), error && _jsxs("div", { role: "alert", className: "fv-error", children: [error, _jsx("button", { type: "button", onClick: () => setError(''), children: "\u5173\u95ED" })] }), s.persistence?.ok === false && _jsxs("div", { role: "alert", className: "fv-error", children: ["\u5B58\u6863\u5F02\u5E38 \u00B7 \u6682\u505C\u65B0\u589E\u5F00\u4ED3\u3002", s.persistence.error, _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u67E5\u770B\u8BCA\u65AD" })] }), s.neural.message && s.neural.status !== 'ready' && _jsx("p", { className: "fv-runtime-note", role: "status", children: s.neural.message }), s.history_error && _jsxs("div", { role: "alert", className: "fv-error", children: ["\u5386\u53F2\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF1A", s.history_error, _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u68C0\u67E5\u5386\u53F2\u6570\u636E" })] }), tab === 'dashboard' && _jsxs(_Fragment, { children: [!!missing.length && _jsxs("div", { className: "fv-setup-needed", role: "status", children: [_jsx("strong", { children: "\u5F00\u59CB\u524D\uFF0C\u8865\u9F50\u5FC5\u8981\u8BBE\u7F6E" }), _jsx("span", { children: missing.map(i => i.label).join(' · ') }), _jsx("button", { type: "button", onClick: () => configureAt(missing[0].step), children: "\u7EE7\u7EED\u8BBE\u7F6E \u2192" })] }), s.control.trading && s.connection?.status !== 'ready' && _jsxs("div", { className: "fv-runtime-note", role: "status", children: [s.connection?.message || '等待比赛行情恢复，暂不生成新计划。', _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u68C0\u67E5\u8FDE\u63A5" })] }), _jsx("div", { ref: tradingRef, tabIndex: -1, className: "qs-trader-overview-anchor", children: _jsx(TraderOverview, { activities: activities, onRecords: () => setTab('talk'), onManage: () => configureAt(2) }) }), _jsxs("details", { className: "qs-trader-market-fold", children: [_jsxs("summary", { children: ["\u884C\u60C5\u4E0E\u8FDE\u63A5 ", _jsxs("span", { children: ["\u00B7 ", displayedMarkets.filter(m => m.readiness === 'ready').length, "/", displayedMarkets.length, " \u5C31\u7EEA"] })] }), _jsx(FlyContractList, { markets: displayedMarkets, selected: currentMarket?.product, trading: s.control.trading && !s.control.paused, onSelect: product => { setSelected(product); setMarketOpen(true); }, onManage: () => configureAt(2) }), _jsxs("div", { className: "qs-trader-connection-actions", children: [_jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u8FDE\u63A5\u4E0E\u8BCA\u65AD \u2197" }), _jsxs("span", { children: ["\u5B58\u6863", s.persistence?.ok === false ? '异常' : s.persistence?.ok ? '已保存' : '待确认'] })] })] }), _jsx("section", { className: "fv-plans-focus", "aria-label": "\u4EA4\u6613\u8BA1\u5212\u4E0E\u56DE\u6267", children: tradePlans || _jsxs("details", { children: [_jsx("summary", { children: "\u4EA4\u6613\u8BA1\u5212\u4E0E\u56DE\u6267" }), _jsx("p", { children: automatic ? '暂无委托。有有效信号后自动提交，回执显示在这里。' : '暂无计划。有有效信号后生成计划，核对并确认后才会下单。' })] }) }), s.account?.official && _jsxs("details", { className: "qs-trader-account-fold", children: [_jsxs("summary", { children: ["\u6BD4\u8D5B\u8D26\u6237 ", _jsxs("span", { children: ["\u00B7 \u6743\u76CA ", fmt(s.account.official.Balance), " \u5143"] })] }), _jsxs("div", { className: "fv-account-strip", "aria-label": "\u8D26\u6237\u4E0A\u6B21\u5FEB\u7167", children: [_jsxs("div", { children: [_jsx("small", { children: "\u8D26\u6237\u6743\u76CA \u00B7 \u4E0A\u6B21\u5FEB\u7167" }), _jsx("strong", { children: fmt(s.account.official.Balance) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u53EF\u7528\u8D44\u91D1" }), _jsx("strong", { children: fmt(s.account.official.Available) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u5F53\u65E5\u624B\u7EED\u8D39" }), _jsx("strong", { children: fmt(s.account.official.Commission) })] })] })] })] }), tab === 'talk' && _jsxs("div", { className: "fv-talk-layout", children: [_jsxs("section", { className: "fv-oracle", children: [_jsx("span", { className: "fv-kicker", children: "A MESSAGE FROM ABOVE" }), _jsx("h2", { children: "\u7ED9\u4EA4\u6613\u5458\u7559\u4E00\u6761\u8BB0\u5F55" }), _jsxs("p", { children: ["\u4FE1\u606F\u3001\u5EFA\u8BAE\u548C\u957F\u671F\u504F\u597D\u4F1A\u8FDB\u5165\u8BB0\u5FC6\u3002", _jsx("br", {}), "\u56E0\u679C\u9A8C\u8BC1\u671F\u95F4\uFF0C\u795E\u8C15\u4FDD\u5B58\u4E3A\u8BB0\u5FC6\uFF0C\u4E0D\u76F4\u63A5\u6539\u52A8\u4F5C\u5206\u6570\u3002"] }), _jsx("textarea", { value: oracle, onChange: e => setOracle(e.target.value), maxLength: 2000, placeholder: "\u8BB0\u5F55\u4F60\u7684\u89C2\u5BDF\u4E0E\u957F\u671F\u504F\u597D\u3002" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || !oracle.trim(), onClick: () => void run(async () => { await api('oracle', { text: oracle }); setOracle(''); }), children: "\u9001\u5165\u8BB0\u5FC6" }), _jsx("small", { className: "fv-note", children: "\u6682\u505C\u548C\u4EA4\u6613\u989D\u5EA6\u8BF7\u4F7F\u7528\u72EC\u7ACB\u63A7\u5236\u6309\u94AE\u3002" }), _jsx("hr", {}), _jsx("h3", { children: "\u6700\u8FD1\u53D1\u751F\u4E86\u4EC0\u4E48" }), _jsx("button", { type: "button", disabled: pending, onClick: () => void run(async () => setReport((await api('report', {})).text)), children: "\u751F\u6210\u4E8B\u5B9E\u62A5\u544A" }), report && _jsx("p", { className: "fv-report", children: report })] }), _jsxs("section", { className: "fv-journal", children: [_jsxs("header", { children: [_jsx("h2", { children: "\u8FD0\u884C\u4E0E\u4EA4\u6613\u8BB0\u5F55" }), _jsxs("select", { "aria-label": "\u8BB0\u5F55\u6765\u6E90", value: filter, onChange: e => setFilter(e.target.value), children: [_jsx("option", { value: "all", children: "\u6240\u6709\u6765\u6E90" }), Object.entries(actors).map(([id, label]) => _jsx("option", { value: id, children: label }, id))] })] }), events.length ? events.map(e => _jsxs("article", { children: [_jsx("div", { className: `fv-event-dot ${e.actor}` }), _jsxs("div", { children: [_jsxs("div", { className: "fv-event-meta", children: [_jsx("b", { children: actors[e.actor] || e.actor }), _jsx("time", { children: new Date(e.at * 1000).toLocaleTimeString() }), _jsxs("small", { children: ["#", e.seq] })] }), _jsx("p", { children: eventText(e) }), e.decision_id && _jsxs("small", { className: "fv-note", children: ["\u51B3\u7B56 ", e.decision_id.slice(0, 12)] })] })] }, e.seq)) : _jsx("div", { className: "fv-empty", children: "\u5524\u9192\u540E\uFF0C\u8FD9\u91CC\u4F1A\u8BB0\u5F55\u5B83\u7684\u9009\u62E9\u4E0E\u7ECF\u5386\u3002" })] })] }), tab === 'analysis' && _jsxs(_Fragment, { children: [_jsx(TradeStatistics, {}), _jsx(TradeAnalytics, { active: active }), !isLLM && _jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u5B66\u4E60\u53CD\u9988" }), _jsx(TradeLearning, {})] })] }), tab === 'replay' && _jsx(FlyReplayLab, { active: active }), marketOpen && _jsx(ActionDialog, { drawer: true, title: `${currentMarket?.symbol || '合约'} · 行情与决策`, onClose: () => setMarketOpen(false), children: _jsx(FlyMarketView, { automatic: automatic, market: currentMarket, observing: !s.control.trading, onDetails: () => { setMarketOpen(false); setDetails(true); } }) }), details && _jsxs(ActionDialog, { drawer: true, title: "AI \u4EA4\u6613\u5458\u884C\u60C5\u4E0E\u8FD0\u884C\u8BE6\u60C5", busy: pending, onClose: () => setDetails(false), children: [openContest && _jsx("button", { type: "button", onClick: () => { setDetails(false); openContest(); }, children: "\u6253\u5F00\u6BD4\u8D5B\u8D26\u6237\u4E0E\u56DE\u6267" }), _jsx(RuntimeContinuity, { status: s }), isLLM && _jsxs("p", { children: ["\u4EA4\u6613\u6A21\u578B\u4ECA\u65E5\u8C03\u7528 ", s.usage.trade_model || 0, " \u6B21", s.settings.trade_daily_calls ? ` / 上限 ${s.settings.trade_daily_calls}` : ' · 不限次数', "\u3002\u6BCF\u4E2A\u5408\u7EA6\u72EC\u7ACB\u5206\u6790\uFF0C\u6700\u591A\u540C\u65F6\u5206\u6790 3 \u4E2A\u3002"] }), _jsxs("div", { className: "fv-runtime-note", role: "status", "aria-label": "\u6BD4\u8D5B\u884C\u60C5\u8FDE\u63A5\u72B6\u6001", children: [_jsx("strong", { children: s.connection?.status === 'ready' ? '比赛行情已连接' : s.connection?.status === 'connecting' ? '正在连接比赛行情' : s.connection?.status === 'waiting' ? '行情暂不可用 · 自动恢复中' : '比赛行情未连接' }), s.connection?.message && _jsx("p", { children: s.connection.message }), connectionCooldown > 0 && _jsxs("p", { children: ["\u51B7\u5374\u4E2D\uFF0C", connectionCooldown, " \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5\u3002"] }), s.connection?.updated_at && _jsxs("small", { children: ["\u6700\u8FD1\u540C\u6B65\uFF1A", new Date(s.connection.updated_at * 1000).toLocaleString('zh-CN', { hour12: false })] }), !['ready', 'waiting'].includes(s.connection?.status || '') && _jsx("button", { type: "button", disabled: pending || s.connection?.status === 'connecting' || connectionCooldown > 0 || !s.settings.instruments.length, onClick: () => void run(async () => {
                                    await connectContestAccount();
                                    const result = await api('control', { action: 'connect' });
                                    setStatus(current => current ? { ...current, connection: result.connection } : current);
                                }), children: pending || s.connection?.status === 'connecting' ? '正在连接…' : s.connection?.status === 'needs_auth' ? '重新连接比赛行情' : '连接比赛行情' }), !s.settings.instruments.length && _jsx("p", { children: "\u5148\u5728\u300C\u8BBE\u7F6E \u2192 \u8D26\u6237\u4E0E\u5408\u7EA6\u300D\u4FDD\u5B58\u5B9E\u9645\u5408\u7EA6\uFF0C\u518D\u8FDE\u63A5\u884C\u60C5\u3002" })] }), _jsx(FlyHistory, { history: s.history, error: s.history_error, markets: s.markets, enabled: !!s.binding && !!s.settings.instruments.length, onRefresh: async () => {
                            const result = await waitForCompetition(() => api('control', { action: 'history' }), '历史数据获取', 15_000);
                            setStatus(current => current ? { ...current, history: result.history } : current);
                        } }), _jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u4EA4\u6613\u63A7\u5236\u4E0E\u9AD8\u7EA7\u53C2\u6570" }), _jsx("p", { children: "\u6682\u505C\u81EA\u52A8\u4EA4\u6613\u4E0D\u4F1A\u64A4\u9500\u5DF2\u63D0\u4EA4\u59D4\u6258\uFF1B\u4EC5\u5E73\u4ED3\u6A21\u5F0F\u81EA\u52A8\u63D0\u4EA4\u51CF\u4ED3\u59D4\u6258\u3002" }), _jsx("div", { className: "fv-actions", children: s.control.trading && _jsx("button", { type: "button", disabled: pending, "aria-pressed": !!s.control.close_only, onClick: () => void run(() => control(s.control.close_only ? 'trade' : 'close_only')), children: s.control.close_only ? '恢复开仓' : '本轮只平仓' }) })] })] }), setup && draft && _jsx(ActionDialog, { settings: true, title: "AI \u4EA4\u6613\u5458\u8FD0\u884C\u8BBE\u7F6E", busy: pending, onClose: () => setSetup(false), children: _jsxs("div", { className: "qs-settings-form", children: [_jsxs("div", { className: "qs-settings-layout", children: [_jsx(TradingSettingsNavigation, { current: step, onChange: setStep, items: [
                                        { id: 5, title: '决策引擎', detail: draft.decision_engine === 'llm' ? '大模型 · 交易要求' : '神经模型 · 本地运行' },
                                        { id: 2, title: '账户与合约', detail: `${draft.instruments.length} 个已选合约` },
                                        { id: 4, title: '运行与额度', detail: '交易开关与金额上限' },
                                        { id: 0, title: '运行环境', detail: s.environment.brain_ready ? '神经环境已就绪' : '准备运行环境' },
                                        { id: 3, title: '配置摘要', detail: '名称与本次设置' },
                                    ] }), _jsxs("div", { className: "qs-settings-content fv-setup-content", children: [_jsxs("div", { className: "qs-settings-intro", children: [_jsx("h3", { children: { 5: '决策引擎', 2: '账户与合约', 4: '运行与额度', 0: '运行环境', 3: '配置摘要' }[step] }), _jsx("p", { children: { 5: '选择谁来判断行情，执行仍由比赛 CLI 完成。', 2: '添加想交易的品种，填写各自的实际月份合约。', 4: '选择逐笔确认或自动下单，并设置本次交易额度。', 0: '神经模式需要本地依赖；大模型交易无需安装神经依赖。', 3: '查看已选合约和运行方式。' }[step] })] }), s.control.trading && _jsx("p", { className: "fv-runtime-note", children: "\u4EA4\u6613\u6B63\u5728\u8FD0\u884C\u3002\u6682\u505C\u540E\u53EF\u66F4\u6539\u5408\u7EA6\u4E0E\u8FD0\u884C\u53C2\u6570\u3002" }), _jsxs("fieldset", { className: "fv-settings-fields", disabled: pending || s.control.trading, children: [step === 5 && _jsx(TradingEngineSettings, { available: !!s.settings.decision_engine, value: draft, models: models?.profiles || [], onChange: value => setDraft({ ...draft, ...value }), openModels: openModelSettings ? () => { setSetup(false); openModelSettings(); } : undefined }), step === 0 && draft.decision_engine === 'llm' && _jsx("p", { children: "\u5927\u6A21\u578B\u4EA4\u6613\u4F7F\u7528\u5F53\u524D\u57FA\u7840\u8FD0\u884C\u73AF\u5883\uFF0C\u5DF2\u5C31\u7EEA\u3002\u4E0B\u65B9\u795E\u7ECF\u4F9D\u8D56\u53EA\u5728\u4F7F\u7528\u795E\u7ECF\u4EA4\u6613\u5458\u65F6\u9700\u8981\u3002" }), step === 0 && _jsxs("div", { className: "fv-setup-body", children: [_jsx("p", { children: "\u4F7F\u7528\u795E\u7ECF\u6A21\u5F0F\u65F6\uFF0C\u4E0B\u8F7D\u5E76\u6821\u9A8C\u4E13\u7528 Python \u4E0E MaleCNS\u3002\u4F9D\u8D56\u4FDD\u5B58\u5728\u7528\u6237\u76EE\u5F55\u3002" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "\u4E13\u7528 Python \u4E0E MaleCNS" }), _jsx("b", { children: s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备' })] }), _jsx("div", { className: "fv-actions", children: _jsx("button", { type: "button", className: "fv-primary", disabled: pending || preparing || s.environment.progress.status === 'running' || s.environment.brain_ready, onClick: () => void run(async () => { if (!onPrepare)
                                                                    throw new Error('准备服务未连接'); await onPrepare(); }), children: preparing || s.environment.progress.status === 'running' ? '正在准备…' : s.environment.brain_ready ? '神经环境已就绪' : '准备神经环境 / 重试' }) }), _jsx("p", { role: "status", children: s.environment.brain_ready ? '神经环境已就绪，可继续配置账户与合约。'
                                                                : s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}`
                                                                    : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}`
                                                                        : prepareMessage || '尚未开始；使用神经模式时点击上方按钮准备。' }), !!s.environment.progress.total && _jsx("progress", { value: s.environment.progress.done, max: s.environment.progress.total })] }), step === 2 && _jsx("div", { className: "fv-setup-body", children: _jsxs("fieldset", { children: [_jsx("legend", { children: "\u6BD4\u8D5B\u8D26\u6237\u4E0E\u5408\u7EA6" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "\u6BD4\u8D5B\u8D26\u6237" }), _jsx("b", { children: accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…' })] }), !accountKey && _jsx("button", { type: "button", disabled: pending || !contest, onClick: () => void run(connectContestAccount), children: accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户' }), contestError && _jsx("p", { role: "alert", children: contestError }), _jsx(FlyInstruments, { instruments: draft.instruments, contest: contest, accountKey: accountKey, invalid: !!setupError, onChange: instruments => { setSetupError(''); setDraft(current => current ? { ...current, instruments: typeof instruments === 'function' ? instruments(current.instruments) : instruments } : current); } })] }) }), step === 4 && _jsxs("div", { className: "fv-setup-body", children: [_jsx(ExecutionModeChoice, { value: draft.execution_mode ?? 'automatic', disabled: pending || s.control.trading, onChange: execution_mode => setDraft({ ...draft, execution_mode }) }), _jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: !draft.life_validation, onChange: e => setDraft({ ...draft, life_validation: !e.target.checked }) }), "\u542F\u7528\u4EA4\u6613\u529F\u80FD"] }), _jsx("p", { children: "\u6309\u6240\u9009\u6267\u884C\u65B9\u5F0F\u5904\u7406\u4EA4\u6613\u8BA1\u5212\uFF1B\u5173\u95ED\u540E\u4E0D\u751F\u6210\u4EA4\u6613\u8BA1\u5212\u3002" }), _jsxs("section", { className: "qs-settings-group", children: [_jsx("div", { className: "fv-form-grid", children: [['target_notional', '每品种名义上限 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => _jsxs("label", { children: [label, _jsx("input", { type: "number", min: "0", "aria-label": label, "aria-invalid": !draft.life_validation && !!setupError && draftIssues.some(i => i.key === key), disabled: draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key), value: draft[key], onChange: e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) }) }), !draft.life_validation && !!setupError && draftIssues.some(i => i.key === key) && _jsx("small", { className: "fv-field-help", children: draftIssues.find(i => i.key === key)?.label })] }, key)) }), _jsx("p", { children: "0 \u8868\u793A\u4E0D\u989D\u5916\u9650\u5236\u3002\u5DF2\u8BBE\u7F6E\u7684\u4E0A\u9650\u7EE7\u7EED\u751F\u6548\uFF0C\u6BD4\u8D5B\u8D26\u6237\u81EA\u8EAB\u89C4\u5219\u59CB\u7EC8\u6709\u6548\u3002" })] }), _jsx(TradeFilterControls, { decisionEngine: draft.decision_engine, settings: draft, onDraftChange: value => setDraft({ ...draft, ...value }), onApply: async () => { } })] }), step === 3 && _jsxs("div", { className: "fv-setup-body", children: [_jsx("h3", { children: "\u6838\u5BF9\u672C\u6B21\u914D\u7F6E" }), _jsxs("p", { children: [draft.decision_engine === 'llm' ? '大模型交易员' : '神经交易员', draft.decision_engine === 'llm' && ` · 每合约最多 ${draft.llm_max_lots} 手`] }), _jsx("p", { children: draft.instruments.map(i => i.symbol).join(' / ') || '未选择合约' }), _jsxs("p", { children: ["\u5355\u54C1\u79CD\u540D\u4E49\u4E0A\u9650 ", draft.target_notional || '不额外限制', " \u00B7 \u603B\u540D\u4E49\u5360\u7528 ", draft.total_notional || '不额外限制', " \u00B7 \u635F\u5931\u4E0A\u9650 ", draft.loss_limit || '不额外限制'] }), _jsxs("p", { children: [draft.life_validation ? '交易功能已关闭' : draft.execution_mode === 'manual' ? '逐笔确认后下单' : 'CLI 自动下单', " \u00B7 ", draft.trade_period_minutes || 1, " \u5206\u949F\u51B3\u7B56\u3002\u6682\u505C\u540E\u4E0D\u518D\u63D0\u4EA4\u65B0\u59D4\u6258\uFF0C\u5DF2\u6709\u59D4\u6258\u4E0E\u6301\u4ED3\u4FDD\u7559\u3002"] }), !draft.life_validation && _jsxs("div", { className: "fv-setup-checks", children: [_jsx("strong", { children: draftIssues.length ? '还有交易配置需要补齐' : '交易配置已齐全' }), draftIssues.map(issue => _jsxs("button", { type: "button", onClick: () => { setSetupError(issue.label); setStep(issue.step); }, children: [issue.label, " \u2197"] }, issue.key))] }), _jsxs("label", { children: ["\u7ED9\u5B83\u4E00\u4E2A\u540D\u5B57", _jsx("input", { maxLength: 24, value: draft.name, onChange: e => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("p", { children: ["\u5173\u95ED\u7F51\u9875\u540E\uFF0CQuantStudio \u540E\u53F0\u4ECD\u8FD0\u884C\u65F6\u4EA4\u6613\u5458\u4F1A\u6309\u5F53\u524D\u542F\u505C\u72B6\u6001\u7EE7\u7EED\u8FD0\u884C\u3002", _jsx("br", {}), "\u9000\u51FA\u5E94\u7528\u540E\u505C\u6B62\uFF1B\u91CD\u542F\u6062\u590D\u8BB0\u5FC6\u4E0E\u6B64\u524D\u7684\u4EA4\u6613\u542F\u505C\u72B6\u6001\uFF1B\u4E3B\u52A8\u6682\u505C\u540E\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\u3002"] })] })] }), setupError && _jsx("p", { role: "alert", className: "fv-error", children: setupError })] })] }), _jsxs("div", { className: "qs-settings-footer", children: [_jsx("span", { children: s.onboarding ? '首次设置' : s.settings.life_validation && !draft.life_validation ? '保存后将启用自动交易' : '更改后应用于下一次运行' }), _jsx("button", { type: "button", disabled: pending, onClick: () => setSetup(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || s.control.trading, onClick: () => {
                                        if (step !== 3 && (s.onboarding || s.settings.life_validation !== draft.life_validation)) {
                                            if (checkSetup())
                                                setStep(3);
                                        }
                                        else
                                            void run(() => saveSetup());
                                    }, children: pending ? '保存中…' : step === 3 && s.onboarding ? draft.life_validation ? '完成配置' : '保存并核对启动' : s.onboarding ? '核对并继续' : '保存配置' })] })] }) }), startReview && _jsxs(ActionDialog, { title: automatic ? '启动自动交易' : '启动逐笔确认', busy: pending, onClose: () => setStartReview(false), children: [_jsxs("p", { children: [_jsx("strong", { children: s.settings.instruments.map(i => i.symbol).join(' / ') }), " \u00B7 ", s.settings.trade_period_minutes || 1, " \u5206\u949F\u51B3\u7B56"] }), _jsxs("p", { children: ["\u6BCF\u54C1\u79CD\u540D\u4E49\u4E0A\u9650\uFF1A", s.settings.target_notional ? fmt(s.settings.target_notional) : '不额外限制', " \u5143", _jsx("br", {}), "\u603B\u540D\u4E49\u5360\u7528\u4E0A\u9650\uFF1A", s.settings.total_notional ? fmt(s.settings.total_notional) : '不额外限制', " \u5143", _jsx("br", {}), "\u8D26\u6237\u635F\u5931\u4E0A\u9650\uFF1A", s.settings.loss_limit ? fmt(s.settings.loss_limit) : '不额外限制', " \u5143"] }), _jsxs("p", { children: ["\u6A21\u62DF\u8D5B\u8D26\u6237 ", s.binding?.identity.accountId || s.settings.account, " \u00B7 ", isLLM ? '大模型决策' : '神经信号', " \u00B7 ", automatic ? '自动下单' : '逐笔确认'] }), _jsx(ExecutionDisclosure, { mode: executionMode, accepted: riskAccepted, onChange: setRiskAccepted }), _jsxs("div", { className: "qs-drawer-footer", children: [_jsx("button", { type: "button", onClick: () => setStartReview(false), children: "\u8FD4\u56DE" }), _jsx("button", { type: "button", "data-primary": true, disabled: pending || (automatic && !riskAccepted), onClick: () => { setStartReview(false); void run(() => control('trade', '', automatic && riskAccepted ? AUTOMATIC_TRADING_CONSENT : undefined)); }, children: automatic ? '确认并开始自动交易' : '确认并开始生成计划' })] })] })] });
}
//# sourceMappingURL=FlyV2Page.js.map