import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { GearSixIcon } from '@phosphor-icons/react';
import { futuresProduct, futuresContractPattern, products } from '@deepseek-ai/dsh-quantskills-session/contracts';
import { FlyInstruments } from "./FlyInstruments.js";
import { ActionDialog } from "../ActionDialog.js";
import { FlyMarketView } from "./FlyMarketView.js";
import { TradingGuide } from "../TradingGuide.js";
import { flyFetch } from "./transport.js";
import { useEffect, useRef, useState } from 'react';
import FlyHomeV2 from './FlyHomeV2';
import { FlyReplayLab } from "./FlyReplay.js";
import './fly-v2.css';
import { collapseNeuralWaits } from './flyJournal';
import { LifeTrace, lifeGoals } from './LifeTrace';
import { TradeStatistics } from './TradeStatistics';
import { TradeLearning } from './TradeLearning';
import { TradeAnalytics } from './TradeAnalytics';
import { RuntimeContinuity } from './RuntimeContinuity';
import { TradeFilterControls } from './TradeFilterControls';
import { waitForCompetition } from "../competition-async.js";
import './fly-workspace.css';
import { FlyHistory, useRetryCountdown } from "./FlyHistory.js";
const goals = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' };
const actions = { turning: '按神经输出转向', avoiding: '碰撞边界已拦截，等待神经避障', idle: '等待有效神经运动信号', flying: '正在飞行', eating: '正在取食', resting: '正在休息', watching: '正在观察', touching: '正在互动', exploring: '正在探索' };
const environmentNames = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' };
const actors = { fly: '果蝇决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' };
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
        return `${p.provider === 'codex_cli' ? 'Codex CLI' : p.provider === 'jev' ? (p.service_provider === 'vercel' ? 'Jev · Vercel' : 'Jev · TypeSafe') : '语言 AI'} · ${p.status === 'ok' ? '调用完成' : '调用未完成'}${p.reason ? ' · ' + p.reason : ''}`;
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
export default function FlyV2Page({ active, contest, openContest, openModelSettings, preparing = false, prepareMessage, onPrepare, tradePlans }) {
    const [status, setStatus] = useState();
    const [tab, setTab] = useState('dashboard');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [setupError, setSetupError] = useState('');
    const connectionCooldown = useRetryCountdown(status?.connection?.retry_at);
    const [blenderPath, setBlenderPath] = useState('');
    const [setup, setSetup] = useState(false);
    const [step, setStep] = useState(2);
    const [details, setDetails] = useState(false), [selected, setSelected] = useState(''), [startReview, setStartReview] = useState(false);
    const reviewed = useRef('');
    const [contestStatus, setContestStatus] = useState(), [contestError, setContestError] = useState('');
    const contestRevision = useRef(0);
    const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : '';
    const [draft, setDraft] = useState();
    const [models, setModels] = useState();
    const [oracle, setOracle] = useState('');
    const [description, setDescription] = useState('');
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
                const result = await waitForCompetition(() => api('state'), '果蝇家园状态读取', 15_000);
                if (!disposed) {
                    setStatus(result);
                    if (!loaded.current) {
                        loaded.current = true;
                        setDraft(result.settings);
                        setSetup(false);
                        setBlenderPath(result.environment.blender);
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
    async function control(action, version = '') { await api('control', { action, version }); }
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
        setDraft(structuredClone(status.settings)); setSetupError(''); setSetup(true); setStep(status?.environment.brain_ready ? 2 : 0); }
    function checkInstruments() {
        const invalid = draft?.instruments.filter(item => !futuresContractPattern.test(item.symbol.trim())) ?? [];
        if (!invalid.length)
            return true;
        setSetupError(`请为已选品种填写实际合约代码（如 rb2610），或取消勾选：${invalid.map(item => names[item.product] || item.product).join('、')}`);
        setStep(2);
        return false;
    }
    if (!status)
        return _jsxs("div", { className: "fv-page fv-loading", children: [_jsx("div", { className: "fv-orbit", children: "\u2726" }), _jsx("h2", { children: "\u6B63\u5728\u8FDE\u63A5\u5C0F\u679C\u7684\u4E16\u754C" }), _jsx("p", { children: error || '恢复个体、记忆与家园…' })] });
    const s = status;
    const running = !s.control.paused && s.neural.status === 'ready';
    const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse();
    const waiting = s.world.wait_reason;
    const motionText = waiting ? waiting.message + (waiting.recovery_seconds != null ? `（约 ${waiting.recovery_seconds} 秒）` : '') : actions[s.world.action];
    const issueList = (value) => {
        const issues = [];
        if (!s.environment.brain_ready)
            issues.push({ key: 'environment', label: '准备神经运行环境', step: 0 });
        if (!(accountKey || (s.binding && s.connection?.status !== 'needs_auth')))
            issues.push({ key: 'account', label: '连接比赛账户', step: 2 });
        if (!value.instruments.length || value.instruments.some(i => !futuresContractPattern.test(i.symbol) || futuresProduct(i.symbol) !== i.product.toLowerCase()))
            issues.push({ key: 'instruments', label: '选择品种并填写有效实际合约', step: 2 });
        for (const [key, label, max] of [['target_notional', '每品种名义上限', 100000000], ['total_notional', '总名义占用上限', 500000000], ['loss_limit', '账户损失上限', 100000000]]) {
            if (!Number.isFinite(value[key]) || value[key] < 0)
                issues.push({ key, label: `设置${label}（0 表示不额外限制）`, step: 2 });
            else if (value[key] > max)
                issues.push({ key, label: `${label}不能超过 ${max.toLocaleString('zh-CN')} 元`, step: 2 });
        }
        if (value.total_notional > 0 && value.target_notional > value.total_notional)
            issues.push({ key: 'total_notional', label: '总名义占用上限不能小于每品种名义上限', step: 2 });
        return issues;
    };
    const missing = issueList(s.settings), draftIssues = draft ? issueList(draft) : [];
    const canStart = !s.settings.life_validation && !missing.length;
    function configureAt(index) { openSetup(); setStep(index); }
    function checkSetup() {
        if (!checkInstruments())
            return false;
        if (!s.environment.brain_ready) {
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
        await api('settings', { ...draft, onboarding_complete: !later });
        if (!later && !draft.life_validation && (s.onboarding || s.settings.life_validation))
            await control('trade');
        else if (!later && s.onboarding)
            await control('start');
        setSetup(false);
        setTab('dashboard');
    }
    const guide = _jsx(TradingGuide, { compact: true, name: "\u679C\u8747", steps: [
            { title: '准备运行环境', status: s.environment.brain_ready ? '神经环境已就绪' : '运行环境待准备', ready: s.environment.brain_ready,
                body: '打开设置，点击「一键准备果蝇」，等待下载、校验和神经环境准备完成。第一次想先熟悉界面，可以关闭「生成交易选择」，只体验生活；以后可随时回到设置开启。',
                note: '安装需要网络与本机磁盘空间，按进度提示等待。语言模型、Jev 和 AI 造景都是可选辅助，不是果蝇生成交易建议的必填项。', action: { label: '检查运行环境与用途', run: () => configureAt(0) } },
            { title: '连接账户与合约', status: s.settings.instruments.length ? `已保存 ${s.settings.instruments.length} 个合约 · 仍需核对行情` : '账户与合约待设置',
                body: '在设置中连接期货模拟赛账户，再选择品种并核对实际合约月份。可搜索全部品种或手动填写其他合约。初次先选一个熟悉的品种，便于观察行情、信号与回执是否连贯。',
                note: '实时报价来自比赛柜台，历史数据需先到「设置 → PandaData」连接授权。合约代码示例不代表当前可交易月份。名义金额不是保证金；额外风险上限填 0 表示不额外限制，请根据模拟账户资金设置。', action: { label: '设置账户、合约与限额', run: () => configureAt(2) } },
            { title: '完成设置并观察', status: s.control.trading ? s.connection?.status === 'ready' ? '交易建议已启用' : '已启用 · 等待行情' : '交易建议未启用', ready: s.control.trading && s.connection?.status === 'ready',
                body: '到「核对配置」核对配置，然后完成设置。首次启用交易选择会连接行情并开始生成建议；以后修改设置只保存，回到交易页按运行按钮启用。先观察行情就绪、神经信号和计划状态。',
                note: '无需为了出单打开 Jev 辅助：果蝇由神经读出生成交易建议，Jev 在这里辅助生活环境。独立的 Jev 持续盯盘在比赛页。语言模型测试、Jev 和造景会产生相应 API 用量。', action: { label: '检查完成前的配置', run: () => configureAt(3) } },
            { title: '确认计划与暂停', status: '每笔交易由你确认',
                body: '进入交易页的「待确认交易计划」，核对账户、合约、方向、手数和价格后确认或取消。提交后看柜台回执与成交记录，交易分析用于复查实际结果。没有信号时等待也是正常状态。',
                note: '「暂停交易建议」只停止新建议，不撤单、不平仓。关闭浏览器不代表后台停止；要停止请使用页面控制，并检查已有委托和持仓。', action: { label: '查看交易状态与计划', run: showTrading } },
        ], troubleshooting: [
            { title: '环境一直准备中或下载失败', body: '查看设置里的准备阶段和错误提示，确认网络可用后点击重试。已有 Blender 可以填写本机路径并验证；不要在安装进行中反复启动。' },
            { title: '账户已连接，行情仍未就绪', body: '核对实际合约月份、柜台是否开放该合约及当前是否交易时段。在比赛页查同一合约的最新行情，再看果蝇历史数据诊断。PandaData 授权和比赛账户授权互不替代。' },
            { title: '没有计划，或者额度不足', body: '先看是否开启交易建议、行情与神经状态是否就绪，再检查信号、冷却、待确认计划及柜台保证金。名义上限低于一手合约所需名义金额时可能无法开仓，不要盲目把上限清零。' },
        ] });
    const currentMarket = s.markets.find(m => m.product === selected) ?? s.markets[0];
    const reviewConfig = () => JSON.stringify(s.settings);
    function startSuggestions() {
        if (reviewed.current !== reviewConfig())
            setStartReview(true);
        else
            void run(() => control('trade'));
    }
    return _jsxs("div", { className: "fv-page fv-workspace", children: [_jsxs("header", { className: "fv-header", children: [_jsxs("div", { className: "fv-identity", children: [_jsx("div", { className: "fv-avatar", "aria-hidden": "true", children: "\u2726" }), _jsx("div", { children: _jsxs("h1", { children: ["\u679C\u8747\u4EA4\u6613\u5458", _jsxs("span", { children: [s.name, " \u00B7 \u4ECE\u795E\u7ECF\u4FE1\u53F7\u5230\u5F85\u786E\u8BA4\u8BA1\u5212"] })] }) })] }), _jsxs("div", { className: "fv-header-actions", children: [guide, _jsx("button", { type: "button", "aria-label": "\u679C\u8747\u8FD0\u884C\u8BBE\u7F6E", onClick: openSetup, children: _jsx(GearSixIcon, { size: 20 }) }), tab === 'home' && _jsx("button", { type: "button", disabled: pending, onClick: () => void run(() => control(s.control.paused ? 'start' : 'pause')), children: s.control.paused ? '唤醒小果' : '暂停个体' })] })] }), _jsx("nav", { className: "fv-nav", "aria-label": "\u679C\u8747\u680F\u76EE", children: [['dashboard', '交易'], ['home', '生活'], ['analysis', '表现'], ['talk', '记录']].map(([key, label]) => _jsx("button", { type: "button", className: tab === key ? 'selected' : '', "aria-current": tab === key ? 'page' : undefined, onClick: () => setTab(key), children: label }, key)) }), error && _jsxs("div", { role: "alert", className: "fv-error", children: [error, _jsx("button", { type: "button", onClick: () => setError(''), children: "\u5173\u95ED" })] }), s.persistence?.ok === false && _jsxs("div", { role: "alert", className: "fv-error", children: ["\u5B58\u6863\u5F02\u5E38 \u00B7 \u6682\u505C\u65B0\u589E\u5F00\u4ED3\u3002", s.persistence.error, _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u67E5\u770B\u8BCA\u65AD" })] }), s.neural.message && s.neural.status !== 'ready' && _jsx("p", { className: "fv-runtime-note", role: "status", children: s.neural.message }), s.history_error && _jsxs("div", { role: "alert", className: "fv-error", children: ["\u5386\u53F2\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF1A", s.history_error, _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u68C0\u67E5\u5386\u53F2\u6570\u636E" })] }), tab === 'dashboard' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-launch-row", ref: tradingRef, tabIndex: -1, children: [_jsxs("label", { children: ["\u89C2\u5BDF\u5408\u7EA6", _jsxs("select", { "aria-label": "\u89C2\u5BDF\u5408\u7EA6", value: currentMarket?.product ?? s.settings.instruments[0]?.product ?? '', onChange: e => setSelected(e.target.value), children: [_jsx("option", { value: "", disabled: true, children: "\u5C1A\u672A\u9009\u62E9\u5408\u7EA6" }), s.settings.instruments.map(i => _jsx("option", { value: i.product, children: i.symbol || i.product }, i.product))] })] }), _jsxs("button", { type: "button", className: "fv-contract-settings", onClick: () => configureAt(2), children: ["\u7BA1\u7406\u5408\u7EA6", s.settings.instruments.length > 1 ? ` · ${s.settings.instruments.length}` : ''] }), _jsxs("div", { className: "fv-launch-summary", children: [_jsxs("strong", { children: [s.settings.trade_period_minutes || 1, " \u5206\u949F\u51B3\u7B56 \u00B7 \u6BCF\u7B14\u8BA1\u5212\u7531\u4F60\u786E\u8BA4"] }), _jsxs("span", { children: ["\u5355\u54C1\u79CD\u540D\u4E49\u4E0A\u9650 ", s.settings.target_notional ? `¥${fmt(s.settings.target_notional)}` : '未额外限制', " \u00B7 \u635F\u5931\u4E0A\u9650 ", s.settings.loss_limit ? `¥${fmt(s.settings.loss_limit)}` : '未额外限制'] })] }), _jsx("button", { type: "button", className: s.control.trading ? 'fv-pause' : 'fv-primary', disabled: pending, onClick: () => {
                                    if (s.control.trading)
                                        void run(() => control('observe'));
                                    else if (!canStart)
                                        configureAt(s.settings.life_validation ? 0 : missing[0].step);
                                    else
                                        startSuggestions();
                                }, children: pending ? '处理中…' : s.control.trading ? '暂停交易建议' : canStart ? '开始观察' : '继续配置' })] }), !!missing.length && _jsxs("div", { className: "fv-setup-needed", role: "status", children: [_jsx("strong", { children: "\u5F00\u59CB\u524D\uFF0C\u8865\u9F50\u5FC5\u8981\u8BBE\u7F6E" }), _jsx("span", { children: missing.map(i => i.label).join(' · ') }), _jsx("button", { type: "button", onClick: () => configureAt(missing[0].step), children: "\u7EE7\u7EED\u8BBE\u7F6E \u2192" })] }), s.control.trading && s.connection?.status !== 'ready' && _jsxs("div", { className: "fv-runtime-note", role: "status", children: [s.connection?.message || '等待比赛行情恢复，暂不生成新计划。', _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u68C0\u67E5\u8FDE\u63A5" })] }), _jsx(FlyMarketView, { market: currentMarket, observing: !s.control.trading, onDetails: () => setDetails(true) }), _jsx("section", { className: "fv-plans-focus", "aria-label": "\u5F85\u786E\u8BA4\u4EA4\u6613\u8BA1\u5212", children: tradePlans || _jsxs(_Fragment, { children: [_jsx("h2", { children: "\u5F85\u786E\u8BA4\u4EA4\u6613\u8BA1\u5212" }), _jsx("p", { children: "\u6682\u65E0\u8BA1\u5212\u3002\u6709\u6709\u6548\u4FE1\u53F7\u540E\u5728\u8FD9\u91CC\u6838\u5BF9\u3002" })] }) }), s.account?.official && _jsxs("div", { className: "fv-account-strip", "aria-label": "\u8D26\u6237\u4E0A\u6B21\u5FEB\u7167", children: [_jsxs("div", { children: [_jsx("small", { children: "\u8D26\u6237\u6743\u76CA \u00B7 \u4E0A\u6B21\u5FEB\u7167" }), _jsx("strong", { children: fmt(s.account.official.Balance) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u53EF\u7528\u8D44\u91D1" }), _jsx("strong", { children: fmt(s.account.official.Available) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u7D2F\u8BA1\u624B\u7EED\u8D39" }), _jsx("strong", { children: fmt(s.account.official.Commission) })] })] }), _jsxs("div", { className: "fv-workspace-health", children: [_jsxs("span", { children: ["\u4E2A\u4F53", s.control.paused ? '已暂停' : '运行中', " \u00B7 \u5EFA\u8BAE", s.control.trading ? s.control.close_only ? '仅平仓' : '已启用' : '已暂停'] }), _jsxs("span", { children: ["\u5B58\u6863", s.persistence?.ok === false ? '异常' : s.persistence?.ok ? '已保存' : '待确认'] }), _jsx("button", { type: "button", onClick: () => setDetails(true), children: "\u8FDE\u63A5\u4E0E\u8BCA\u65AD \u2197" })] })] }), tab === 'home' && _jsxs(_Fragment, { children: [_jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u751F\u6D3B\u53CD\u9988\u4E0E\u795E\u7ECF\u6D3B\u52A8" }), _jsx(LifeTrace, { trace: s.world.life_trace, previous: s.world.last_life_feedback }), _jsxs("p", { children: ["\u751F\u6D3B\u5B66\u4E60 ", s.neural.updates?.life || 0, " \u6B21 \u00B7 \u795E\u7ECF\u7D2F\u8BA1 ", fmt((s.neural.sim_ms || 0) / 1000), " \u79D2"] }), _jsxs("div", { className: "fv-actions", children: [_jsx("button", { type: "button", onClick: () => setTab('replay'), children: "\u4E8B\u4EF6\u56DE\u653E" }), _jsx("button", { type: "button", disabled: pending || !running, onClick: () => void run(() => control('checkpoint')), children: "\u4FDD\u5B58\u68C0\u67E5\u70B9" })] })] }), _jsxs("div", { className: "fv-section-line", children: [_jsxs("div", { children: [_jsx("h2", { children: s.home.name }), _jsx("p", { children: "\u5B83\u7684\u7A7A\u95F4\uFF0C\u5B83\u6B63\u5728\u53D1\u751F\u7684\u751F\u6D3B" })] }), _jsxs("span", { className: "fv-pill", children: [goals[s.world.goal], " \u00B7 ", motionText] })] }), _jsxs("div", { className: "fv-home-layout", children: [_jsxs("div", { className: "fv-home-stage", children: [_jsx(FlyHomeV2, { body: s.world, version: s.home_version, paused: !running }), _jsxs("div", { className: "fv-home-footer", children: [_jsxs("div", { children: [_jsx("small", { children: "\u5F53\u524D\u4F4D\u7F6E" }), _jsx("strong", { children: s.world.position.map(v => v.toFixed(1)).join(' / ') })] }), _jsxs("div", { children: [_jsx("small", { children: "\u73AF\u5883\u4E8B\u4EF6" }), _jsx("strong", { children: { daylight: '柔和日光', breeze: '微风', quiet: '安静时刻', dew: '花园露水' }[s.world.event] })] }), _jsxs("div", { children: [_jsx("small", { children: "\u7CBE\u529B" }), _jsxs("strong", { children: [Math.round(s.world.energy * 100), "%"] })] })] })] }), _jsxs("aside", { className: "fv-home-editor", children: [_jsx("span", { className: "fv-kicker", children: "MAKE IT A HOME" }), _jsx("h2", { children: "\u4E3A\u5B83\u521B\u9020\u4E00\u4E2A\u4E16\u754C" }), _jsx("p", { children: "\u7528\u4E2D\u6587\u63CF\u8FF0\u7A7A\u95F4\u3002AI \u52A9\u624B\u4E0E Blender \u4F1A\u5B8C\u6210\u751F\u6210\u3001\u68C0\u67E5\u548C\u88C5\u5165\u3002" }), _jsx("textarea", { value: description, onChange: e => setDescription(e.target.value), maxLength: 3000, placeholder: "\u4F8B\u5982\uFF1A\u4E00\u5EA7\u6E29\u6696\u7684\u82D4\u85D3\u82B1\u56ED\uFF0C\u6709\u679C\u5B9E\u3001\u53F6\u7247\u7761\u5E8A\u548C\u4E00\u5F20\u5C0F\u5C0F\u7684\u884C\u60C5\u684C\u3002" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || !description.trim(), onClick: () => void run(async () => { await api('homes', { description }); setDescription(''); }), children: "\u521B\u9020\u5BB6\u56ED \u2197" }), _jsx("small", { className: "fv-note", children: "\u4F7F\u7528\u9996\u6B21\u8BBE\u7F6E\u4E2D\u9009\u62E9\u7684 QuantStudio \u6A21\u578B\u3002\u9020\u666F\u5931\u8D25\u65F6\u4FDD\u7559\u5F53\u524D\u5BB6\u56ED\u3002" }), _jsx("hr", {}), _jsx("h3", { children: "\u5BB6\u56ED\u7248\u672C" }), _jsxs("select", { "aria-label": "\u9009\u62E9\u5BB6\u56ED\u7248\u672C", value: s.home_version, onChange: e => void run(async () => { await api('homes/restore', { version: e.target.value }); }), children: [_jsx("option", { value: "default", children: "\u9ED8\u8BA4 \u00B7 \u6668\u5149\u6E29\u5BA4" }), s.versions.map(v => _jsx("option", { value: v.id, children: v.name }, v.id))] }), s.scene_jobs.slice(-3).reverse().map(j => _jsxs("div", { className: "fv-job", children: [_jsx("b", { children: { planning: '规划场景', building: 'Blender 构建中', checking: '检查交互与模型', complete: '家园已载入', failed: '生成未完成' }[j.status] }), _jsx("small", { children: j.description }), j.error && _jsx("p", { children: j.error })] }, j.id))] })] })] }), tab === 'talk' && _jsxs("div", { className: "fv-talk-layout", children: [_jsxs("section", { className: "fv-oracle", children: [_jsx("span", { className: "fv-kicker", children: "A MESSAGE FROM ABOVE" }), _jsx("h2", { children: "\u7ED9\u5C0F\u679C\u4E00\u6761\u795E\u8C15" }), _jsxs("p", { children: ["\u4FE1\u606F\u3001\u5EFA\u8BAE\u548C\u957F\u671F\u504F\u597D\u4F1A\u8FDB\u5165\u8BB0\u5FC6\u3002", _jsx("br", {}), "\u56E0\u679C\u9A8C\u8BC1\u671F\u95F4\uFF0C\u795E\u8C15\u4FDD\u5B58\u4E3A\u8BB0\u5FC6\uFF0C\u4E0D\u76F4\u63A5\u6539\u52A8\u4F5C\u5206\u6570\u3002"] }), _jsx("textarea", { value: oracle, onChange: e => setOracle(e.target.value), maxLength: 2000, placeholder: "\u4ECA\u5929\u4E5F\u53BB\u82B1\u56ED\u91CC\u63A2\u7D22\u4E00\u4E0B\u5427\u3002" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || !oracle.trim(), onClick: () => void run(async () => { await api('oracle', { text: oracle }); setOracle(''); }), children: "\u9001\u5165\u8BB0\u5FC6" }), _jsx("small", { className: "fv-note", children: "\u6682\u505C\u548C\u4EA4\u6613\u989D\u5EA6\u8BF7\u4F7F\u7528\u72EC\u7ACB\u63A7\u5236\u6309\u94AE\u3002" }), _jsx("hr", {}), _jsx("h3", { children: "\u6700\u8FD1\u53D1\u751F\u4E86\u4EC0\u4E48" }), _jsx("button", { type: "button", disabled: pending, onClick: () => void run(async () => setReport((await api('report', {})).text)), children: "\u751F\u6210\u4E8B\u5B9E\u62A5\u544A" }), report && _jsx("p", { className: "fv-report", children: report })] }), _jsxs("section", { className: "fv-journal", children: [_jsxs("header", { children: [_jsx("h2", { children: "\u751F\u6D3B\u4E0E\u4EA4\u6613\u8BB0\u5F55" }), _jsxs("select", { "aria-label": "\u8BB0\u5F55\u6765\u6E90", value: filter, onChange: e => setFilter(e.target.value), children: [_jsx("option", { value: "all", children: "\u6240\u6709\u6765\u6E90" }), Object.entries(actors).map(([id, label]) => _jsx("option", { value: id, children: label }, id))] })] }), events.length ? events.map(e => _jsxs("article", { children: [_jsx("div", { className: `fv-event-dot ${e.actor}` }), _jsxs("div", { children: [_jsxs("div", { className: "fv-event-meta", children: [_jsx("b", { children: actors[e.actor] || e.actor }), _jsx("time", { children: new Date(e.at * 1000).toLocaleTimeString() }), _jsxs("small", { children: ["#", e.seq] })] }), _jsx("p", { children: eventText(e) }), e.decision_id && _jsxs("small", { className: "fv-note", children: ["\u51B3\u7B56 ", e.decision_id.slice(0, 12)] })] })] }, e.seq)) : _jsx("div", { className: "fv-empty", children: "\u5524\u9192\u540E\uFF0C\u8FD9\u91CC\u4F1A\u8BB0\u5F55\u5B83\u7684\u9009\u62E9\u4E0E\u7ECF\u5386\u3002" })] })] }), tab === 'analysis' && _jsxs(_Fragment, { children: [_jsx(TradeStatistics, {}), _jsx(TradeAnalytics, { active: active }), _jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u5B66\u4E60\u53CD\u9988" }), _jsx(TradeLearning, {})] })] }), tab === 'replay' && _jsx(FlyReplayLab, { active: active }), details && _jsxs(ActionDialog, { drawer: true, title: "\u679C\u8747\u884C\u60C5\u4E0E\u8FD0\u884C\u8BE6\u60C5", busy: pending, onClose: () => setDetails(false), children: [openContest && _jsx("button", { type: "button", onClick: () => { setDetails(false); openContest(); }, children: "\u6253\u5F00\u6BD4\u8D5B\u8D26\u6237\u4E0E\u56DE\u6267" }), _jsx(RuntimeContinuity, { status: s }), _jsxs("div", { className: "fv-runtime-note", role: "status", "aria-label": "\u6BD4\u8D5B\u884C\u60C5\u8FDE\u63A5\u72B6\u6001", children: [_jsx("strong", { children: s.connection?.status === 'ready' ? '比赛行情已连接' : s.connection?.status === 'connecting' ? '正在连接比赛行情' : s.connection?.status === 'waiting' ? '行情暂不可用 · 自动恢复中' : '比赛行情未连接' }), s.connection?.message && _jsx("p", { children: s.connection.message }), connectionCooldown > 0 && _jsxs("p", { children: ["\u51B7\u5374\u4E2D\uFF0C", connectionCooldown, " \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5\u3002"] }), s.connection?.updated_at && _jsxs("small", { children: ["\u6700\u8FD1\u540C\u6B65\uFF1A", new Date(s.connection.updated_at * 1000).toLocaleString('zh-CN', { hour12: false })] }), !['ready', 'waiting'].includes(s.connection?.status || '') && _jsx("button", { type: "button", disabled: pending || s.connection?.status === 'connecting' || connectionCooldown > 0 || !s.settings.instruments.length, onClick: () => void run(async () => {
                                    await connectContestAccount();
                                    const result = await api('control', { action: 'connect' });
                                    setStatus(current => current ? { ...current, connection: result.connection } : current);
                                }), children: pending || s.connection?.status === 'connecting' ? '正在连接…' : s.connection?.status === 'needs_auth' ? '重新连接比赛行情' : '连接比赛行情' }), !s.settings.instruments.length && _jsx("p", { children: "\u5148\u5728\u300C\u884C\u60C5\u914D\u7F6E\u300D\u4FDD\u5B58\u5B9E\u9645\u5408\u7EA6\uFF0C\u518D\u8FDE\u63A5\u884C\u60C5\u3002" })] }), _jsx(FlyHistory, { history: s.history, error: s.history_error, markets: s.markets, enabled: !!s.binding && !!s.settings.instruments.length, onRefresh: async () => {
                            const result = await waitForCompetition(() => api('control', { action: 'history' }), '历史数据获取', 15_000);
                            setStatus(current => current ? { ...current, history: result.history } : current);
                        } }), _jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u4EA4\u6613\u63A7\u5236\u4E0E\u9AD8\u7EA7\u53C2\u6570" }), _jsx("p", { children: "\u6682\u505C\u5EFA\u8BAE\u4E0D\u4F1A\u64A4\u9500\u5DF2\u63D0\u4EA4\u59D4\u6258\uFF1B\u4EC5\u5E73\u4ED3\u6A21\u5F0F\u4ECD\u9700\u9010\u7B14\u786E\u8BA4\u3002" }), _jsx("div", { className: "fv-actions", children: s.control.trading && _jsx("button", { type: "button", disabled: pending, "aria-pressed": !!s.control.close_only, onClick: () => void run(() => control(s.control.close_only ? 'trade' : 'close_only')), children: s.control.close_only ? '恢复开仓' : '本轮只平仓' }) })] })] }), setup && draft && _jsx(ActionDialog, { drawer: true, title: "\u679C\u8747\u8FD0\u884C\u8BBE\u7F6E", busy: pending, onClose: () => setSetup(false), children: _jsxs("div", { className: "fv-setup-content", children: [_jsx("nav", { className: "fv-steps", "aria-label": "\u8BBE\u7F6E\u680F\u76EE", children: [{ label: '本次运行', i: 2 }, { label: '环境', i: 0 }, { label: '模型辅助', i: 1 }, { label: '核对配置', i: 3 }].map(({ label, i }) => _jsx("button", { type: "button", className: step === i ? 'current' : '', "aria-current": step === i ? 'step' : undefined, onClick: () => setStep(i), children: label }, i)) }), s.control.trading && _jsx("p", { className: "fv-runtime-note", children: "\u4EA4\u6613\u5EFA\u8BAE\u6B63\u5728\u8FD0\u884C\u3002\u6682\u505C\u540E\u53EF\u66F4\u6539\u5408\u7EA6\u4E0E\u8FD0\u884C\u53C2\u6570\u3002" }), _jsxs("fieldset", { className: "fv-settings-fields", disabled: pending || s.control.trading, children: [step === 0 && _jsxs("div", { className: "fv-setup-body", children: [_jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: !draft.life_validation, onChange: e => setDraft({ ...draft, life_validation: !e.target.checked }) }), "\u751F\u6210\u4EA4\u6613\u9009\u62E9"] }), _jsx("p", { children: "\u9ED8\u8BA4\u5F00\u542F\u3002\u5B8C\u6210\u4EA4\u6613\u914D\u7F6E\u540E\u751F\u6210\u5F85\u786E\u8BA4\u8BA1\u5212\uFF1B\u5173\u95ED\u540E\u4EC5\u4F53\u9A8C\u751F\u6D3B\u3002" }), _jsx("p", { children: "\u70B9\u51FB\u51C6\u5907\u540E\u81EA\u52A8\u4E0B\u8F7D\u5E76\u6821\u9A8C\u4E13\u7528 Python \u4E0E MaleCNS\uFF1B\u4F18\u5148\u590D\u7528\u4F60\u9009\u62E9\u7684\u672C\u673A Blender\uFF0C\u672A\u914D\u7F6E\u65F6\u4E0B\u8F7D\u4E13\u7528\u7248\u672C\u3002\u6570\u636E\u4FDD\u5B58\u5728\u7528\u6237\u76EE\u5F55\uFF0C\u5347\u7EA7\u4E0D\u4F1A\u6E05\u7A7A\u3002" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "\u4E13\u7528 Python \u4E0E MaleCNS" }), _jsx("b", { children: s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备' })] }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "Blender" }), _jsx("b", { children: s.environment.blender_ready ? '已就绪' : '尚未准备' })] }), _jsxs("details", { className: "fv-data-details", children: [_jsx("summary", { children: "\u590D\u7528\u672C\u673A Blender\uFF08\u53EF\u9009\uFF09" }), _jsxs("label", { children: ["\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84", _jsx("input", { "aria-label": "\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84", value: blenderPath, onChange: e => setBlenderPath(e.target.value), placeholder: "\u5B89\u88C5\u76EE\u5F55\u6216 blender.exe \u7684\u5B8C\u6574\u8DEF\u5F84" })] }), _jsx("button", { type: "button", disabled: pending || !blenderPath.trim() || s.environment.progress.status === 'running', onClick: () => void run(async () => { await api('environment/config', { blender_path: blenderPath.trim() }); }), children: "\u9A8C\u8BC1\u5E76\u4F7F\u7528\u672C\u673A Blender" }), _jsx("small", { children: s.environment.blender })] }), _jsx("div", { className: "fv-actions", children: _jsx("button", { type: "button", className: "fv-primary", disabled: pending || preparing || s.environment.progress.status === 'running' || (s.environment.brain_ready && s.environment.blender_ready), onClick: () => void run(async () => { if (!onPrepare)
                                                    throw new Error('准备服务未连接'); await onPrepare(blenderPath.trim()); }), children: preparing || s.environment.progress.status === 'running' ? '正在准备…' : s.environment.brain_ready && s.environment.blender_ready ? '运行环境已就绪' : '一键准备果蝇 / 重试' }) }), _jsx("p", { role: "status", children: s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}` : s.environment.brain_ready && s.environment.blender_ready ? '运行环境已就绪，可继续配置账户与合约。' : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}` : prepareMessage || '尚未开始；点击上方按钮准备。' }), !!s.environment.progress.total && _jsx("progress", { value: s.environment.progress.done, max: s.environment.progress.total })] }), step === 1 && _jsxs("div", { className: "fv-setup-body", children: [_jsxs("label", { children: ["QuantStudio \u5DF2\u63A5\u5165\u6A21\u578B", _jsxs("select", { value: draft.ai_provider, onChange: e => setDraft({ ...draft, ai_provider: e.target.value }), children: [_jsx("option", { value: "", children: "\u6682\u4E0D\u542F\u7528\u8BED\u8A00\u8F85\u52A9" }), (models?.profiles || []).map(m => _jsx("option", { value: m.provider_id, children: m.label }, m.provider_id))] })] }), _jsx("button", { type: "button", disabled: pending || !draft.ai_provider || draft.ai_provider !== s.settings.ai_provider, onClick: () => void run(async () => { await api('models/test', {}); setSetupError('已保存的语言模型连接成功'); }), children: "\u6D4B\u8BD5\u5DF2\u4FDD\u5B58\u6A21\u578B" }), _jsx("p", { children: "\u5207\u6362\u6A21\u578B\u8BF7\u5148\u4FDD\u5B58\u3002\u6D4B\u8BD5\u53EA\u4F7F\u7528\u5DF2\u4FDD\u5B58\u6A21\u578B\uFF0C\u5E76\u8BA1\u5165\u6BCF\u65E5\u8C03\u7528\u6B21\u6570\u3002" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "Jev \u00B7 \u7EDF\u4E00\u6A21\u578B\u670D\u52A1" }), _jsx("b", { children: models?.jev_configured ? '已配置' : 'API Key 未配置' })] }), _jsx("p", { children: "Jev API Key \u8BF7\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1 \u2192 Jev\u300D\u4E2D\u914D\u7F6E\uFF0C\u4E0E\u6BD4\u8D5B\u9875\u5171\u7528\u3002" }), openModelSettings && _jsx("button", { type: "button", onClick: () => { setSetup(false); openModelSettings(); }, children: "\u524D\u5F80\u6A21\u578B\u670D\u52A1\u914D\u7F6E Jev" }), _jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.jev_enabled, onChange: e => setDraft({ ...draft, jev_enabled: e.target.checked }) }), "\u542F\u7528 Jev \u751F\u6D3B\u73AF\u5883\u8F85\u52A9"] }), _jsx("button", { type: "button", disabled: pending || !models?.jev_configured, onClick: () => void run(async () => { await api('jev/test', {}); setSetupError('Jev 连接成功'); }), children: "\u6D4B\u8BD5 Jev \u8FDE\u63A5" }), _jsx("p", { children: "Jev \u8F85\u52A9\u751F\u6D3B\u73AF\u5883\uFF0C\u679C\u8747\u795E\u7ECF\u8BFB\u51FA\u51B3\u5B9A\u4EA4\u6613\u5EFA\u8BAE\u3002\u72EC\u7ACB\u7684 Jev \u76EF\u76D8\u4ECD\u5728\u6BD4\u8D5B\u9875\u3002" }), _jsxs("details", { children: [_jsx("summary", { children: "\u751F\u6D3B\u8F85\u52A9\u7528\u91CF" }), _jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.model_calls_unlimited, onChange: e => setDraft({ ...draft, model_calls_unlimited: e.target.checked }) }), "\u8BED\u8A00 AI\u3001Jev \u4E0E\u9020\u666F\u4E0D\u9650\u8C03\u7528\u6B21\u6570"] }), _jsx("small", { className: "fv-note", children: "\u4ECD\u7EDF\u8BA1\u5B9E\u9645\u7528\u91CF\uFF1B\u679C\u8747\u795E\u7ECF\u8FD0\u884C\u6CA1\u6709\u6BCF\u65E5\u6B21\u6570\u4E0A\u9650\u3002" }), _jsx("div", { className: "fv-form-grid", children: [['ai_daily_calls', '语言 AI / 日'], ['jev_daily_calls', 'Jev 调用 / 日'], ['scenes_daily', '造景次数 / 日']].map(([key = '', label]) => _jsxs("label", { children: [label, _jsx("input", { "aria-label": label, type: "number", min: "0", disabled: draft.model_calls_unlimited, value: draft[key], onChange: e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) }) })] }, key)) })] })] }), step === 2 && _jsxs("div", { className: "fv-setup-body", children: [_jsxs("fieldset", { children: [_jsx("legend", { children: "\u6BD4\u8D5B\u8D26\u6237\u4E0E\u5408\u7EA6" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "\u6BD4\u8D5B\u8D26\u6237" }), _jsx("b", { children: accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…' })] }), !accountKey && _jsx("button", { type: "button", disabled: pending || !contest, onClick: () => void run(connectContestAccount), children: accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户' }), contestError && _jsx("p", { role: "alert", children: contestError }), _jsx(FlyInstruments, { instruments: draft.instruments, contest: contest, accountKey: accountKey, invalid: !!setupError, onChange: instruments => { setSetupError(''); setDraft(current => current ? { ...current, instruments: typeof instruments === 'function' ? instruments(current.instruments) : instruments } : current); } })] }), _jsx("p", { children: "\u6309\u795E\u7ECF\u4FE1\u53F7\u751F\u6210\u5F85\u786E\u8BA4\u8BA1\u5212\uFF0C\u624B\u6570\u53D7\u8D26\u6237\u4E0E\u4E0B\u65B9\u989D\u5EA6\u7EA6\u675F\u3002" }), _jsxs("details", { children: [_jsx("summary", { children: "\u98CE\u9669\u4E0E\u989D\u5EA6 \u00B7 \u67E5\u770B\u5DF2\u4FDD\u5B58\u4E0A\u9650" }), _jsx("div", { className: "fv-form-grid", children: [['target_notional', '每品种名义上限 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => _jsxs("label", { children: [label, _jsx("input", { type: "number", min: "0", "aria-label": label, "aria-invalid": !draft.life_validation && !!setupError && draftIssues.some(i => i.key === key), disabled: draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key), value: draft[key], onChange: e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) }) }), !draft.life_validation && !!setupError && draftIssues.some(i => i.key === key) && _jsx("small", { className: "fv-field-help", children: draftIssues.find(i => i.key === key)?.label })] }, key)) }), _jsx("p", { children: "0 \u8868\u793A\u4E0D\u989D\u5916\u9650\u5236\u3002\u5DF2\u8BBE\u7F6E\u7684\u4E0A\u9650\u7EE7\u7EED\u751F\u6548\uFF0C\u6BD4\u8D5B\u8D26\u6237\u81EA\u8EAB\u89C4\u5219\u59CB\u7EC8\u6709\u6548\u3002" })] }), _jsx(TradeFilterControls, { settings: draft, onDraftChange: value => setDraft({ ...draft, ...value }), onApply: async () => { } })] }), step === 3 && _jsxs("div", { className: "fv-setup-body", children: [_jsx("h3", { children: "\u6838\u5BF9\u672C\u6B21\u914D\u7F6E" }), _jsx("p", { children: draft.instruments.map(i => i.symbol).join(' / ') || '未选择合约' }), _jsxs("p", { children: ["\u5355\u54C1\u79CD\u540D\u4E49\u4E0A\u9650 ", draft.target_notional || '不额外限制', " \u00B7 \u603B\u540D\u4E49\u5360\u7528 ", draft.total_notional || '不额外限制', " \u00B7 \u635F\u5931\u4E0A\u9650 ", draft.loss_limit || '不额外限制'] }), _jsxs("p", { children: [draft.life_validation ? '仅体验生活' : '生成待确认计划', " \u00B7 ", draft.trade_period_minutes || 1, " \u5206\u949F\u51B3\u7B56\u3002\u505C\u6B62\u5EFA\u8BAE\u4E0D\u4F1A\u64A4\u5355\u6216\u5E73\u4ED3\u3002"] }), !draft.life_validation && _jsxs("div", { className: "fv-setup-checks", children: [_jsx("strong", { children: draftIssues.length ? '还有交易配置需要补齐' : '交易配置已齐全' }), draftIssues.map(issue => _jsxs("button", { type: "button", onClick: () => { setSetupError(issue.label); setStep(issue.step); }, children: [issue.label, " \u2197"] }, issue.key))] }), _jsxs("label", { children: ["\u7ED9\u5B83\u4E00\u4E2A\u540D\u5B57", _jsx("input", { maxLength: 24, value: draft.name, onChange: e => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("p", { children: ["\u5173\u95ED\u7F51\u9875\u540E\uFF0CQuantStudio \u540E\u53F0\u4ECD\u8FD0\u884C\u65F6\u5B83\u4F1A\u7EE7\u7EED\u751F\u6D3B\u3002", _jsx("br", {}), "\u9000\u51FA\u5E94\u7528\u540E\u505C\u6B62\uFF1B\u91CD\u542F\u6062\u590D\u8BB0\u5FC6\u4E0E\u6B64\u524D\u7684\u4EA4\u6613\u542F\u505C\u72B6\u6001\uFF1B\u4E3B\u52A8\u6682\u505C\u540E\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\u3002"] })] })] }), setupError && _jsx("p", { role: "alert", className: "fv-error", children: setupError }), _jsxs("div", { className: "qs-drawer-footer", children: [_jsx("button", { type: "button", disabled: pending, onClick: () => setSetup(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || s.control.trading, onClick: () => {
                                        if (step !== 3 && (s.onboarding || s.settings.life_validation !== draft.life_validation)) {
                                            if (checkSetup())
                                                setStep(3);
                                        }
                                        else
                                            void run(() => saveSetup());
                                    }, children: pending ? '保存中…' : step === 3 && s.onboarding ? draft.life_validation ? '完成并进入生活' : '完成并开始观察' : s.onboarding ? '核对并继续' : '保存配置' })] })] }) }), startReview && _jsxs(ActionDialog, { title: "\u6838\u5BF9\u672C\u6B21\u89C2\u5BDF", busy: pending, onClose: () => setStartReview(false), children: [_jsxs("p", { children: [_jsx("strong", { children: s.settings.instruments.map(i => i.symbol).join(' / ') }), " \u00B7 ", s.settings.trade_period_minutes || 1, " \u5206\u949F\u51B3\u7B56"] }), _jsxs("p", { children: ["\u6BCF\u54C1\u79CD\u540D\u4E49\u4E0A\u9650\uFF1A", s.settings.target_notional ? fmt(s.settings.target_notional) : '不额外限制', " \u5143", _jsx("br", {}), "\u603B\u540D\u4E49\u5360\u7528\u4E0A\u9650\uFF1A", s.settings.total_notional ? fmt(s.settings.total_notional) : '不额外限制', " \u5143", _jsx("br", {}), "\u8D26\u6237\u635F\u5931\u4E0A\u9650\uFF1A", s.settings.loss_limit ? fmt(s.settings.loss_limit) : '不额外限制', " \u5143"] }), _jsxs("p", { children: ["\u5F00\u59CB\u540E\u8FDE\u63A5\u884C\u60C5\u5E76\u751F\u6210\u5EFA\u8BAE\uFF0C\u6BCF\u7B14\u8BA1\u5212\u4ECD\u7531\u4F60\u786E\u8BA4\u3002\u6682\u505C\u5EFA\u8BAE\u4FDD\u7559\u751F\u6D3B\uFF0C\u4E0D\u64A4\u5355\u3001\u4E0D\u5E73\u4ED3\u3002", s.settings.jev_enabled || s.settings.ai_provider ? '已开启模型辅助，调用产生 API 用量。' : ''] }), _jsxs("div", { className: "qs-drawer-footer", children: [_jsx("button", { type: "button", onClick: () => setStartReview(false), children: "\u8FD4\u56DE" }), _jsx("button", { type: "button", "data-primary": true, onClick: () => { reviewed.current = reviewConfig(); setStartReview(false); void run(() => control('trade')); }, children: "\u786E\u8BA4\u5E76\u5F00\u59CB\u89C2\u5BDF" })] })] })] });
}
//# sourceMappingURL=FlyV2Page.js.map