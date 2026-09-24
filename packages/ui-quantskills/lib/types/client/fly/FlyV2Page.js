import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { flyFetch } from "./transport.js";
import { useEffect, useRef, useState } from 'react';
import ResizableNativeTable from "./FlyTable.js";
import FlyHomeV2 from './FlyHomeV2';
import { FlyReplayLab } from "./FlyReplay.js";
import './fly-v2.css';
import { collapseNeuralWaits } from './flyJournal';
import { LifeTrace, lifeGoals } from './LifeTrace';
import { TradeLoop } from './TradeLoop';
import { TradeStatistics } from './TradeStatistics';
import { TradeLearning } from './TradeLearning';
import { TradeAnalytics } from './TradeAnalytics';
import { RuntimeContinuity } from './RuntimeContinuity';
import { TradeFilterControls } from './TradeFilterControls';
import { waitForCompetition } from "../competition-async.js";
import { FlyHistory, useRetryCountdown } from "./FlyHistory.js";
const labels = { trade_learning: '交易反馈学习', statistics: '成交与盈亏统计', life_trace: '生活因果链', markets: '市场观察', positions: '持仓与等价值', orders: '委托回报', trades: '确认成交', equity: '账户权益', intent: '当前目标', neural: '神经活动', learning: '学习与检查点', usage: '模型用量' };
const goals = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' };
const actions = { turning: '按神经输出转向', avoiding: '碰撞边界已拦截，等待神经避障', idle: '等待有效神经运动信号', flying: '正在飞行', eating: '正在取食', resting: '正在休息', watching: '正在观察', touching: '正在互动', exploring: '正在探索' };
const environmentNames = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' };
const actors = { fly: '果蝇决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' };
const names = { IF: '沪深 300', IM: '中证 1000', au: '黄金', ag: '白银', rb: '螺纹', m: '豆粕', sc: '原油' };
const fmt = (v) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
async function api(path, body) {
    const response = await flyFetch(`/api/fly/v2/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok)
        throw new Error(typeof result.detail === 'string' ? result.detail : '请求未完成，请检查输入');
    return result;
}
function contractCode(data, product) {
    const row = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    const raw = row.contractCode ?? row.symbol;
    const code = typeof raw === 'string' ? raw.split('.')[0].trim() : '';
    if (!new RegExp(`^${product}[0-9]{4}$`, 'i').test(code))
        throw new Error('比赛行情未返回该品种的实际合约代码。');
    return product + code.slice(product.length);
}
function deliveryMonths(product, main) {
    const year = Number(main.slice(product.length, -2)), month = Number(main.slice(-2));
    return Array.from({ length: 13 }, (_, offset) => {
        const date = new Date(Date.UTC(2000 + year, month - 1 + offset, 1));
        return `${product}${String(date.getUTCFullYear() % 100).padStart(2, '0')}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }).filter(code => code !== main);
}
function FlyInstrumentContract({ product, label, symbol, invalid, contest, accountKey, onSymbolChange }) {
    const [main, setMain] = useState(''), [message, setMessage] = useState(''), [checking, setChecking] = useState(false);
    const request = useRef(0);
    useEffect(() => {
        setMain('');
        setChecking(false);
        if (!contest || !accountKey) {
            setMessage('先点击上方「连接比赛账户」，无需填写合约。也可手动填写实际合约。');
            return;
        }
        const controller = new AbortController(), id = ++request.current;
        setChecking(true);
        setMessage('正在查询当前主力合约…');
        void waitForCompetition(signal => contest.query({ kind: 'quote', symbol: product }, signal), '主力合约查询', 30_000, controller.signal)
            .then(result => { if (id !== request.current)
            return; const code = contractCode(result.data, product); setMain(code); onSymbolChange(code, true); setMessage(`当前主力 ${code} · 来自比赛行情`); })
            .catch(error => { if (id === request.current)
            setMessage(`主力查询失败：${String(error).replace(/^(?:Error|RemoteFailure): /, '')} 可手动填写实际合约。`); })
            .finally(() => { if (id === request.current)
            setChecking(false); });
        return () => { request.current++; controller.abort(); };
    }, [contest, product, accountKey]);
    async function selectMonth(code) {
        if (!code)
            return;
        if (code === main) {
            onSymbolChange(code);
            setMessage(`当前主力 ${code} · 来自比赛行情`);
            return;
        }
        if (!contest)
            return;
        const id = ++request.current;
        setChecking(true);
        setMessage(`正在核对 ${code}…`);
        try {
            const result = await waitForCompetition(signal => contest.query({ kind: 'quote', symbol: code }, signal), '月份合约查询', 30_000);
            if (id !== request.current)
                return;
            if ((result.data && typeof result.data === 'object' && !Array.isArray(result.data) && result.data.ready === false) || contractCode(result.data, product).toLowerCase() !== code.toLowerCase())
                throw new Error('比赛行情未确认该月份合约。');
            onSymbolChange(code);
            setMessage(`${code} 已由比赛行情确认`);
        }
        catch (error) {
            if (id === request.current)
                setMessage(`${code} 无法确认：${String(error).replace(/^(?:Error|RemoteFailure): /, '')}`);
        }
        finally {
            if (id === request.current)
                setChecking(false);
        }
    }
    const months = main ? deliveryMonths(product, main) : [];
    return _jsxs("div", { className: "fv-contract-choice", children: [_jsx("input", { "aria-label": `${label}实际合约`, "aria-invalid": invalid, placeholder: "\u586B\u5199\u5B9E\u9645\u5408\u7EA6\u4EE3\u7801", value: symbol, onChange: e => { request.current++; setChecking(false); onSymbolChange(e.target.value.trim()); setMessage('手动填写的合约将在交易前核对。'); } }), _jsxs("select", { "aria-label": `${label}合约月份`, value: [main, ...months].includes(symbol) ? symbol : '', disabled: !main || checking, onChange: e => void selectMonth(e.target.value), children: [_jsx("option", { value: "", children: "\u9009\u62E9\u5408\u7EA6\u6708\u4EFD" }), main && _jsxs("option", { value: main, children: ["\u4E3B\u529B \u00B7 ", main] }), months.map(code => _jsxs("option", { value: code, children: [code, " \u00B7 \u5019\u9009\u6708\u4EFD"] }, code))] }), _jsx("small", { role: "status", children: message || '选择品种后查询主力合约' })] });
}
function Spark({ data }) {
    if (data.length < 2)
        return _jsx("div", { className: "fv-no-chart", children: "\u7B49\u5F85\u771F\u5B9E\u5206\u949F\u7EBF" });
    const min = Math.min(...data), span = Math.max(.01, Math.max(...data) - min);
    return _jsx("svg", { className: "fv-spark", viewBox: "0 0 200 60", preserveAspectRatio: "none", "aria-label": `最近 ${data.length} 根收盘价`, children: _jsx("polyline", { fill: "none", stroke: "currentColor", strokeWidth: "1.5", points: data.map((v, i) => `${i / (data.length - 1) * 200},${55 - (v - min) / span * 48}`).join(' ') }) });
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
export default function FlyV2Page({ active, contest, openModelSettings, preparing = false, prepareMessage, onPrepare }) {
    const [status, setStatus] = useState();
    const [tab, setTab] = useState('dashboard');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [setupError, setSetupError] = useState('');
    const connectionCooldown = useRetryCountdown(status?.connection?.retry_at);
    const [blenderPath, setBlenderPath] = useState('');
    const [setup, setSetup] = useState(false);
    const [step, setStep] = useState(0);
    const [contestStatus, setContestStatus] = useState(), [contestError, setContestError] = useState('');
    const contestRevision = useRef(0);
    const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : '';
    const [draft, setDraft] = useState();
    const [models, setModels] = useState();
    const [edit, setEdit] = useState(false);
    const [layout, setLayout] = useState([]);
    const [oracle, setOracle] = useState('');
    const [description, setDescription] = useState('');
    const [report, setReport] = useState('');
    const [filter, setFilter] = useState('all');
    const loaded = useRef(false);
    const dragging = useRef('');
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
                        setLayout(result.layout);
                        setSetup(result.onboarding);
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
    async function finishLayout() { await api('layout', layout); setEdit(false); }
    function openSetup() { if (status)
        setDraft(status.settings); setSetupError(''); setSetup(true); setStep(0); }
    function checkInstruments() {
        const invalid = draft?.instruments.filter(item => !/^[A-Za-z]{1,3}[0-9]{3,4}$/.test(item.symbol.trim())) ?? [];
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
    const account = s.account?.official || {};
    const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse();
    const waiting = s.world.wait_reason;
    const motionText = waiting ? waiting.message + (waiting.recovery_seconds != null ? `（约 ${waiting.recovery_seconds} 秒）` : '') : actions[s.world.action];
    function widget(id) {
        if (id === 'trade_learning')
            return _jsx(TradeLearning, {});
        if (id === 'statistics')
            return _jsx(TradeStatistics, {});
        if (id === 'life_trace')
            return _jsx(LifeTrace, { trace: s.world.life_trace, previous: s.world.last_life_feedback });
        if (id === 'markets')
            return _jsx("div", { className: "fv-markets", children: s.markets.map(m => _jsxs("div", { className: "fv-market", children: [_jsxs("div", { children: [_jsx("strong", { children: m.product }), _jsx("span", { children: names[m.product] })] }), _jsx("b", { children: fmt(m.price) }), _jsx(Spark, { data: m.chart }), _jsxs("small", { children: [m.symbol || '等待具体合约', " \u00B7 ", m.count, "/500"] }), _jsx("em", { className: m.readiness === 'ready' ? 'ready' : '', children: { ready: '行情就绪', history_incomplete: '等待历史补齐', history_gap: '分钟线有缺口', quote_stale: '等待新鲜报价', bars_stale: '等待分钟线' }[m.readiness] })] }, m.product)) });
        if (id === 'intent')
            return _jsxs(_Fragment, { children: [_jsx("span", { className: "fv-kicker", children: "\u5F53\u524D\u9009\u62E9" }), _jsx("h2", { className: "fv-goal", children: waiting?.code === 'food_depleted' ? '等待果实成熟' : goals[s.world.goal] }), _jsx("p", { children: motionText }), _jsx("div", { className: "fv-states", children: [['energy', '精力'], ['hunger', '饥饿'], ['curiosity', '好奇'], ['stress', '压力']].map(([key = '', label]) => _jsxs("div", { children: [_jsx("span", { children: label }), _jsx("meter", { min: "0", max: "1", value: s.world[key] }), _jsxs("small", { children: [Math.round(s.world[key] * 100), "%"] })] }, key)) }), _jsx("small", { className: "fv-note", children: "\u6A21\u62DF\u5185\u90E8\u72B6\u6001 \u00B7 \u6765\u6E90\u4E8E\u6D3B\u52A8\u6D88\u8017\u3001\u53D6\u98DF\u548C\u4F11\u606F\u53CD\u9988" })] });
        if (id === 'neural')
            return _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-stat", children: [_jsx("strong", { children: fmt(s.neural.total_spikes) }), _jsx("span", { children: "\u5168\u7F51\u653E\u7535\uFF08\u542B\u80CC\u666F\u9A71\u52A8\uFF09" })] }), s.neural.motor_controller && _jsxs("div", { className: "fv-neural-proof", children: [_jsx("b", { children: s.neural.life_controller ? '神经生活读出 · 无动作抽签' : '视觉神经反射 · 无动作抽签' }), _jsx("p", { children: "\u5DE5\u7A0B\u611F\u89C9 \u2192 L1/L2/L3/L5 \u653E\u7535 \u2192 \u76EE\u6807\u4E0E\u8FD0\u52A8\u8BFB\u51FA" }), _jsxs("span", { children: ["\u8BFB\u51FA\u6D3B\u8DC3 ", s.neural.motor?.active_readout_neurons || 0, " / ", s.neural.motor_controller.readout_neurons, " \u4E2A"] }), _jsxs("p", { children: ["\u6807\u5B9A\u5339\u914D\u5EA6 ", Math.round((s.neural.motor?.confidence || 0) * 100), "% \u00B7 \u53EF\u89C1\u98DF\u7269 ", s.neural.sensory?.visible_food || 0] }), _jsx("small", { children: "\u611F\u89C9\u3001\u76EE\u6807\u7ADE\u4E89\u548C\u8FD0\u52A8\u63A5\u53E3\u6709\u5DE5\u7A0B\u8BBE\u5B9A\uFF1B\u5C1A\u672A\u91CD\u5EFA\u5929\u7136\u76EE\u6807\u53CA\u4E0B\u884C\u8FD0\u52A8\u56DE\u8DEF\u3002\u5339\u914D\u5EA6\u4E0D\u662F\u795E\u7ECF\u5360\u6BD4\u3002" })] }), _jsx("div", { className: "fv-rate-list", children: Object.entries(s.neural.activity || {}).map(([k, v]) => _jsxs("div", { children: [_jsx("span", { children: k }), _jsxs("b", { children: [v.toFixed(2), " Hz"] })] }, k)) }), _jsxs("small", { className: "fv-note", children: ["MaleCNS \u8FDE\u63A5\u7EC4\u51BB\u7ED3 \u00B7 \u795E\u7ECF\u7D2F\u8BA1 ", fmt((s.neural.sim_ms || 0) / 1000), " \u79D2", _jsx("br", {}), "\u89C6\u89C9\u52A8\u753B\u91C7\u7528\u72EC\u7ACB\u65F6\u949F"] })] });
        if (id === 'positions')
            return _jsxs(ResizableNativeTable, { resizeStorageKey: "fly-v2-positions", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u54C1\u79CD" }), _jsx("th", { children: "\u591A / \u7A7A" }), _jsx("th", { children: "\u76EE\u6807\u540D\u4E49" }), _jsx("th", { children: "\u5B9E\u9645 / \u504F\u5DEE" })] }) }), _jsx("tbody", { children: s.markets.map(m => _jsxs("tr", { children: [_jsx("td", { children: m.product }), _jsxs("td", { children: [m.long, " / ", m.short] }), _jsx("td", { children: fmt(s.settings.target_notional) }), _jsx("td", { children: m.allocation ? `${fmt(m.allocation.actual_notional)} / ${m.allocation.deviation_pct.toFixed(1)}%` : '等待报价' })] }, m.product)) })] });
        if (id === 'trades' || id === 'orders') {
            const rows = (s.trade_events || s.events).filter(e => id === 'trades' ? e.kind === 'trade' : ['order_return', 'order_submitted', 'order_error', 'order_unknown', 'execution_gate'].includes(e.kind)).reverse();
            return rows.length ? _jsx("div", { className: "fv-mini-events", children: rows.map(e => _jsxs("div", { children: [_jsx("time", { children: new Date(e.at * 1000).toLocaleTimeString() }), _jsx("span", { children: eventText(e) }), _jsxs("small", { children: ["#", e.seq, " \u00B7 ", e.decision_id.slice(0, 8)] })] }, e.seq)) }) : _jsxs("div", { className: "fv-empty", children: [_jsx("span", { children: "\u25CC" }), _jsx("p", { children: id === 'trades' ? '暂无柜台确认成交' : '暂无委托记录' }), _jsx("small", { children: "\u5B9E\u9645\u56DE\u62A5\u5230\u8FBE\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC" })] });
        }
        if (id === 'equity')
            return _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-stat", children: [_jsx("strong", { children: fmt(account.balance ?? account.Balance) }), _jsx("span", { children: "\u67DC\u53F0\u8D26\u6237\u6743\u76CA" })] }), _jsxs("p", { children: ["\u603B\u540D\u4E49\u5360\u7528\u4E0A\u9650 \u00A5", fmt(s.settings.total_notional)] }), _jsxs("p", { children: ["\u635F\u5931\u4E0A\u9650 \u00A5", fmt(s.settings.loss_limit)] }), _jsxs("small", { className: "fv-note", children: ["\u8D26\u6237\u72B6\u6001\uFF1A", s.account?.engine?.state || '未连接'] })] });
        if (id === 'learning')
            return _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-learning-badges", children: [_jsx("span", { children: s.settings.learning ? '生活目标：读出层学习' : '生活目标：读出层冻结' }), _jsx("span", { children: "\u786E\u5B9A\u6027\u795E\u7ECF\u4EA4\u6613\u8BFB\u51FA v2" })] }), _jsxs("p", { children: ["\u672C\u7248\u751F\u6D3B\u8BFB\u51FA\u66F4\u65B0 ", _jsx("b", { children: s.neural.updates?.life || 0 }), " \u6B21 \u00B7 \u4EA4\u6613\u66F4\u65B0 ", _jsx("b", { children: s.neural.updates?.trade || 0 }), " \u6B21"] }), _jsxs("div", { className: "fv-actions", children: [_jsx("button", { type: "button", disabled: pending, onClick: () => void run(async () => { await api('settings', { ...s.settings, learning: !s.settings.learning }); }), children: s.settings.learning ? '冻结学习' : '恢复学习' }), _jsx("button", { type: "button", disabled: pending || !running, onClick: () => void run(() => control('checkpoint')), children: "\u4FDD\u5B58\u68C0\u67E5\u70B9" })] }), _jsxs("select", { "aria-label": "\u6062\u590D\u5B66\u4E60\u68C0\u67E5\u70B9", defaultValue: "", disabled: pending || !s.control.paused, onChange: e => { if (e.target.value)
                            void run(() => control('restore', e.target.value)); e.target.value = ''; }, children: [_jsx("option", { value: "", children: "\u6682\u505C\u540E\u6062\u590D\u68C0\u67E5\u70B9" }), s.checkpoints.slice().reverse().map(v => _jsx("option", { value: v, children: v }, v))] }), _jsx("small", { className: "fv-note", children: "\u5956\u52B1\u6309\u5DF2\u53D1\u751F\u7ED3\u679C\u8BB0\u8D26\uFF1B\u672A\u9A8C\u8BC1\u5168\u8111\u5B66\u4E60\u6216\u610F\u8BC6\u3002" })] });
        return _jsxs(_Fragment, { children: [_jsx("div", { className: "fv-rate-list", children: [['ai', '语言 AI', s.settings.ai_daily_calls], ['jev', 'Jev 辅助', s.settings.jev_daily_calls], ['scenes', '家园生成', s.settings.scenes_daily]].map(([key, label, max]) => _jsxs("div", { children: [_jsx("span", { children: label }), _jsxs("b", { children: [s.usage[String(key)] || 0, " \u6B21 \u00B7 ", s.settings.model_calls_unlimited ? '不限次数' : `上限 ${max} 次`] })] }, key)) }), _jsxs("small", { className: "fv-note", children: ["\u4ECA\u65E5\u679C\u8747\u81EA\u52A8\u8C03\u7528\uFF0C\u5931\u8D25\u8BF7\u6C42\u8BA1\u6570\u3002", _jsx("br", {}), "\u4E0D\u542B AI \u52A9\u624B\u5176\u4ED6\u5BF9\u8BDD\uFF1B\u672A\u4F30\u7B97\u670D\u52A1\u8D39\u7528\u3002"] }), _jsx("button", { type: "button", onClick: openSetup, children: "\u8C03\u6574\u989D\u5EA6" })] });
    }
    return _jsxs("div", { className: "fv-page", children: [_jsxs("header", { className: "fv-header", children: [_jsxs("div", { className: "fv-identity", children: [_jsx("div", { className: "fv-avatar", children: "\u2726" }), _jsxs("div", { children: [_jsx("div", { className: "fv-kicker", children: "QuantStudio \u00B7 AUTONOMOUS LIFE" }), _jsxs("h1", { children: [s.name, _jsx("span", { children: "\u4E00\u53EA\u6301\u7EED\u611F\u77E5\u7684\u6570\u5B57\u679C\u8747" })] })] })] }), _jsxs("div", { className: "fv-header-actions", children: [_jsxs("span", { className: `fv-status ${running ? 'on' : ''}`, children: [_jsx("i", {}), running ? '生活进行中' : s.neural.status === 'loading' ? '神经模型启动中' : '已暂停'] }), _jsx("button", { type: "button", onClick: openSetup, children: "\u8BBE\u7F6E" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending, onClick: () => void run(() => control(s.control.paused ? 'start' : 'pause')), children: s.control.paused ? '唤醒小果' : '暂停个体' })] })] }), !s.environment.brain_ready && _jsxs("div", { className: "fv-runtime-note", role: "status", children: ["\u4E13\u7528 Python \u4E0E MaleCNS \u5C1A\u672A\u51C6\u5907\u3002", preparing ? prepareMessage : '打开设置，点击「一键准备果蝇」后自动下载并校验。', " ", _jsx("button", { type: "button", onClick: openSetup, children: "\u6253\u5F00\u73AF\u5883\u8BBE\u7F6E" })] }), _jsxs("nav", { className: "fv-nav", "aria-label": "\u679C\u8747\u680F\u76EE", children: [[['dashboard', '看板', '01'], ['home', '家园', '02'], ['talk', '交流', '03'], ['analysis', '交易分析', '04']].map(([key, label, number]) => _jsxs("button", { type: "button", className: tab === key ? 'selected' : '', onClick: () => setTab(key), children: [_jsx("small", { children: number }), label] }, key)), _jsxs("div", { className: "fv-nav-right", children: [_jsx("span", { children: s.control.trading ? (s.control.close_only ? 'PANDAAI · 本轮只平仓' : 'PANDAAI · 交易建议') : 'PANDAAI · 观察模式' }), _jsx("button", { type: "button", onClick: () => setTab('replay'), children: "\u4E8B\u4EF6\u56DE\u653E \u2197" })] })] }), _jsx(RuntimeContinuity, { status: s }), _jsx(TradeFilterControls, { settings: s.settings, onApply: value => api('trade-filters', value) }), error && _jsxs("div", { role: "alert", className: "fv-error", children: [error, _jsx("button", { type: "button", onClick: () => setError(''), children: "\u5173\u95ED" })] }), s.neural.message && _jsx("p", { className: "fv-runtime-note", children: s.neural.message }), tab === 'dashboard' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-section-line", children: [_jsxs("div", { children: [_jsx("h2", { children: "\u89C2\u5BDF\u5B83\uFF0C\u4E5F\u89C2\u5BDF\u5E02\u573A" }), _jsxs("p", { children: ["\u5DF2\u9009\u54C1\u79CD \u00B7 ", s.settings.trade_period_minutes || 1, " \u5206\u949F \u00B7 PandaData \u539F\u751F\u5468\u671F \u00B7 \u5404 500 \u6839\u5DF2\u5B8C\u6210 K \u7EBF"] })] }), _jsxs("div", { className: "fv-actions", children: [_jsx("button", { type: "button", disabled: pending, onClick: () => { openSetup(); setStep(2); }, children: "\u884C\u60C5\u914D\u7F6E" }), _jsx("button", { type: "button", disabled: pending || s.settings.life_validation, onClick: () => void run(() => control(s.control.trading ? 'observe' : 'trade')), children: s.settings.life_validation ? '生活验证期间仅观察' : s.control.trading ? '停止交易建议' : '开始生成待确认计划' }), layout.some(item => item.id === 'trade_learning') && _jsx("button", { type: "button", onClick: () => document.getElementById('fly-trade-learning')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), children: "\u67E5\u770B\u4EA4\u6613\u5B66\u4E60" }), _jsx("button", { type: "button", onClick: () => { if (edit)
                                            void run(finishLayout);
                                        else
                                            setEdit(true); }, children: edit ? '完成布局' : '编辑看板' })] })] }), _jsxs("div", { className: "fv-runtime-note", role: "status", "aria-label": "\u6BD4\u8D5B\u884C\u60C5\u8FDE\u63A5\u72B6\u6001", children: [_jsx("strong", { children: s.connection?.status === 'ready' ? '比赛行情已连接' : s.connection?.status === 'connecting' ? '正在连接比赛行情' : s.connection?.status === 'waiting' ? '行情暂不可用 · 自动恢复中' : '比赛行情未连接' }), s.connection?.message && _jsx("p", { children: s.connection.message }), connectionCooldown > 0 && _jsxs("p", { children: ["\u51B7\u5374\u4E2D\uFF0C", connectionCooldown, " \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5\u3002"] }), s.connection?.updated_at && _jsxs("small", { children: ["\u6700\u8FD1\u540C\u6B65\uFF1A", new Date(s.connection.updated_at * 1000).toLocaleString('zh-CN', { hour12: false })] }), !['ready', 'waiting'].includes(s.connection?.status || '') && _jsx("button", { type: "button", disabled: pending || s.connection?.status === 'connecting' || connectionCooldown > 0 || !s.settings.instruments.length, onClick: () => void run(async () => {
                                    await connectContestAccount();
                                    const result = await api('control', { action: 'connect' });
                                    setStatus(current => current ? { ...current, connection: result.connection } : current);
                                }), children: pending || s.connection?.status === 'connecting' ? '正在连接…' : s.connection?.status === 'needs_auth' ? '重新连接比赛行情' : '连接比赛行情' }), !s.settings.instruments.length && _jsx("p", { children: "\u5148\u5728\u300C\u884C\u60C5\u914D\u7F6E\u300D\u4FDD\u5B58\u5B9E\u9645\u5408\u7EA6\uFF0C\u518D\u8FDE\u63A5\u884C\u60C5\u3002" })] }), _jsx(FlyHistory, { history: s.history, error: s.history_error, markets: s.markets, enabled: !!s.binding && !!s.settings.instruments.length, onRefresh: async () => {
                            const result = await waitForCompetition(() => api('control', { action: 'history' }), '历史数据获取', 15_000);
                            setStatus(current => current ? { ...current, history: result.history } : current);
                        } }), s.control.trading && _jsxs("div", { className: "fv-actions", children: [_jsx("button", { type: "button", disabled: pending, onClick: () => void run(() => control(s.control.close_only ? 'trade' : 'close_only')), children: s.control.close_only ? '恢复开仓' : '本轮只平仓' }), _jsx("small", { className: "fv-note", children: s.control.close_only ? '暂停新增仓位，已有仓位仍由神经模型选择平仓时机；全账户平仓后结算学习反馈。' : '结束本轮新增开仓后，可以等待现有仓位平仓并验证学习反馈。' })] }), _jsx(TradeLoop, { markets: s.markets, observing: !s.control.trading }), edit && _jsxs("div", { className: "fv-layout-tools", children: [_jsx("span", { children: "\u62D6\u52A8\u6807\u9898\u6392\u5E8F \u00B7 \u53F3\u4E0B\u89D2\u8C03\u9AD8 \u00B7 \u9009\u62E9\u5361\u7247\u5BBD\u5EA6" }), _jsxs("select", { "aria-label": "\u6DFB\u52A0\u770B\u677F\u7EC4\u4EF6", value: "", onChange: e => setLayout([...layout, { id: e.target.value, width: 6, height: 280 }]), children: [_jsx("option", { value: "", children: "\uFF0B \u6DFB\u52A0\u7EC4\u4EF6" }), Object.keys(labels).filter(k => !layout.some(x => x.id === k)).map(k => _jsx("option", { value: k, children: labels[k] }, k))] }), _jsx("button", { type: "button", onClick: () => void run(async () => { await api('layout', layout); setEdit(false); }), children: "\u4FDD\u5B58\u5E03\u5C40" }), _jsx("button", { type: "button", onClick: () => void run(async () => setLayout(await api('layout/reset', {}))), children: "\u6062\u590D\u9ED8\u8BA4" })] }), _jsx("div", { className: "fv-grid", children: layout.map(item => _jsxs("section", { className: `fv-widget ${edit ? 'editing' : ''}`, style: { gridColumn: `span ${item.width}`, height: item.height }, onDragOver: e => { if (edit)
                                e.preventDefault(); }, onDrop: () => { const next = layout.filter(x => x.id !== dragging.current), moved = layout.find(x => x.id === dragging.current); if (moved) {
                                next.splice(Math.max(0, next.findIndex(x => x.id === item.id)), 0, moved);
                                setLayout(next);
                            } }, onPointerUp: e => { if (edit) {
                                const height = Math.round(e.currentTarget.getBoundingClientRect().height);
                                if (height !== item.height)
                                    setLayout(layout.map(x => x.id === item.id ? { ...x, height: Math.max(180, Math.min(800, height)) } : x));
                            } }, children: [_jsxs("header", { draggable: edit, onDragStart: () => { dragging.current = item.id; }, children: [_jsxs("h3", { children: [edit ? '⠿ ' : '', labels[item.id]] }), edit && _jsxs("div", { children: [_jsx("select", { "aria-label": `${labels[item.id]}宽度`, value: item.width, onChange: e => setLayout(layout.map(x => x.id === item.id ? { ...x, width: Number(e.target.value) } : x)), children: [3, 4, 6, 8, 12].map(v => _jsxs("option", { value: v, children: [v, "/12"] }, v)) }), _jsx("button", { type: "button", "aria-label": `移除${labels[item.id]}`, onClick: () => setLayout(layout.filter(x => x.id !== item.id)), children: "\u00D7" })] })] }), _jsx("div", { className: "fv-widget-content", children: widget(item.id) })] }, item.id)) })] }), tab === 'home' && _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-section-line", children: [_jsxs("div", { children: [_jsx("h2", { children: s.home.name }), _jsx("p", { children: "\u5B83\u7684\u7A7A\u95F4\uFF0C\u5B83\u6B63\u5728\u53D1\u751F\u7684\u751F\u6D3B" })] }), _jsxs("span", { className: "fv-pill", children: [goals[s.world.goal], " \u00B7 ", motionText] })] }), _jsxs("div", { className: "fv-home-layout", children: [_jsxs("div", { className: "fv-home-stage", children: [_jsx(FlyHomeV2, { body: s.world, version: s.home_version, paused: !running }), _jsxs("div", { className: "fv-home-footer", children: [_jsxs("div", { children: [_jsx("small", { children: "\u5F53\u524D\u4F4D\u7F6E" }), _jsx("strong", { children: s.world.position.map(v => v.toFixed(1)).join(' / ') })] }), _jsxs("div", { children: [_jsx("small", { children: "\u73AF\u5883\u4E8B\u4EF6" }), _jsx("strong", { children: { daylight: '柔和日光', breeze: '微风', quiet: '安静时刻', dew: '花园露水' }[s.world.event] })] }), _jsxs("div", { children: [_jsx("small", { children: "\u7CBE\u529B" }), _jsxs("strong", { children: [Math.round(s.world.energy * 100), "%"] })] })] })] }), _jsxs("aside", { className: "fv-home-editor", children: [_jsx("span", { className: "fv-kicker", children: "MAKE IT A HOME" }), _jsx("h2", { children: "\u4E3A\u5B83\u521B\u9020\u4E00\u4E2A\u4E16\u754C" }), _jsx("p", { children: "\u7528\u4E2D\u6587\u63CF\u8FF0\u7A7A\u95F4\u3002AI \u52A9\u624B\u4E0E Blender \u4F1A\u5B8C\u6210\u751F\u6210\u3001\u68C0\u67E5\u548C\u88C5\u5165\u3002" }), _jsx("textarea", { value: description, onChange: e => setDescription(e.target.value), maxLength: 3000, placeholder: "\u4F8B\u5982\uFF1A\u4E00\u5EA7\u6E29\u6696\u7684\u82D4\u85D3\u82B1\u56ED\uFF0C\u6709\u679C\u5B9E\u3001\u53F6\u7247\u7761\u5E8A\u548C\u4E00\u5F20\u5C0F\u5C0F\u7684\u884C\u60C5\u684C\u3002" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || !description.trim(), onClick: () => void run(async () => { await api('homes', { description }); setDescription(''); }), children: "\u521B\u9020\u5BB6\u56ED \u2197" }), _jsx("small", { className: "fv-note", children: "\u4F7F\u7528\u9996\u6B21\u8BBE\u7F6E\u4E2D\u9009\u62E9\u7684 QuantStudio \u6A21\u578B\u3002\u9020\u666F\u5931\u8D25\u65F6\u4FDD\u7559\u5F53\u524D\u5BB6\u56ED\u3002" }), _jsx("hr", {}), _jsx("h3", { children: "\u5BB6\u56ED\u7248\u672C" }), _jsxs("select", { "aria-label": "\u9009\u62E9\u5BB6\u56ED\u7248\u672C", value: s.home_version, onChange: e => void run(async () => { await api('homes/restore', { version: e.target.value }); }), children: [_jsx("option", { value: "default", children: "\u9ED8\u8BA4 \u00B7 \u6668\u5149\u6E29\u5BA4" }), s.versions.map(v => _jsx("option", { value: v.id, children: v.name }, v.id))] }), s.scene_jobs.slice(-3).reverse().map(j => _jsxs("div", { className: "fv-job", children: [_jsx("b", { children: { planning: '规划场景', building: 'Blender 构建中', checking: '检查交互与模型', complete: '家园已载入', failed: '生成未完成' }[j.status] }), _jsx("small", { children: j.description }), j.error && _jsx("p", { children: j.error })] }, j.id))] })] })] }), tab === 'talk' && _jsxs("div", { className: "fv-talk-layout", children: [_jsxs("section", { className: "fv-oracle", children: [_jsx("span", { className: "fv-kicker", children: "A MESSAGE FROM ABOVE" }), _jsx("h2", { children: "\u7ED9\u5C0F\u679C\u4E00\u6761\u795E\u8C15" }), _jsxs("p", { children: ["\u4FE1\u606F\u3001\u5EFA\u8BAE\u548C\u957F\u671F\u504F\u597D\u4F1A\u8FDB\u5165\u8BB0\u5FC6\u3002", _jsx("br", {}), "\u56E0\u679C\u9A8C\u8BC1\u671F\u95F4\uFF0C\u795E\u8C15\u4FDD\u5B58\u4E3A\u8BB0\u5FC6\uFF0C\u4E0D\u76F4\u63A5\u6539\u52A8\u4F5C\u5206\u6570\u3002"] }), _jsx("textarea", { value: oracle, onChange: e => setOracle(e.target.value), maxLength: 2000, placeholder: "\u4ECA\u5929\u4E5F\u53BB\u82B1\u56ED\u91CC\u63A2\u7D22\u4E00\u4E0B\u5427\u3002" }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || !oracle.trim(), onClick: () => void run(async () => { await api('oracle', { text: oracle }); setOracle(''); }), children: "\u9001\u5165\u8BB0\u5FC6" }), _jsx("small", { className: "fv-note", children: "\u6682\u505C\u548C\u4EA4\u6613\u989D\u5EA6\u8BF7\u4F7F\u7528\u72EC\u7ACB\u63A7\u5236\u6309\u94AE\u3002" }), _jsx("hr", {}), _jsx("h3", { children: "\u6700\u8FD1\u53D1\u751F\u4E86\u4EC0\u4E48" }), _jsx("button", { type: "button", disabled: pending, onClick: () => void run(async () => setReport((await api('report', {})).text)), children: "\u751F\u6210\u4E8B\u5B9E\u62A5\u544A" }), report && _jsx("p", { className: "fv-report", children: report })] }), _jsxs("section", { className: "fv-journal", children: [_jsxs("header", { children: [_jsx("h2", { children: "\u751F\u6D3B\u4E0E\u4EA4\u6613\u8BB0\u5F55" }), _jsxs("select", { "aria-label": "\u8BB0\u5F55\u6765\u6E90", value: filter, onChange: e => setFilter(e.target.value), children: [_jsx("option", { value: "all", children: "\u6240\u6709\u6765\u6E90" }), Object.entries(actors).map(([id, label]) => _jsx("option", { value: id, children: label }, id))] })] }), events.length ? events.map(e => _jsxs("article", { children: [_jsx("div", { className: `fv-event-dot ${e.actor}` }), _jsxs("div", { children: [_jsxs("div", { className: "fv-event-meta", children: [_jsx("b", { children: actors[e.actor] || e.actor }), _jsx("time", { children: new Date(e.at * 1000).toLocaleTimeString() }), _jsxs("small", { children: ["#", e.seq] })] }), _jsx("p", { children: eventText(e) }), e.decision_id && _jsxs("small", { className: "fv-note", children: ["\u51B3\u7B56 ", e.decision_id.slice(0, 12)] })] })] }, e.seq)) : _jsx("div", { className: "fv-empty", children: "\u5524\u9192\u540E\uFF0C\u8FD9\u91CC\u4F1A\u8BB0\u5F55\u5B83\u7684\u9009\u62E9\u4E0E\u7ECF\u5386\u3002" })] })] }), tab === 'analysis' && _jsx(TradeAnalytics, { active: active }), tab === 'replay' && _jsx(FlyReplayLab, { active: active }), setup && draft && _jsx("div", { className: "fv-modal-backdrop", children: _jsxs("section", { className: "fv-setup", role: "dialog", "aria-modal": "true", "aria-label": "\u679C\u8747\u9996\u6B21\u8BBE\u7F6E", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsxs("span", { className: "fv-kicker", children: ["WELCOME HOME \u00B7 ", step + 1, " / 4"] }), _jsx("h2", { children: ['准备它的身体与世界', '连接你已有的模型', '设定可用额度', '一切从这里开始'][step] })] }), _jsx("button", { type: "button", onClick: () => setSetup(false), "aria-label": "\u5173\u95ED\u8BBE\u7F6E", children: "\u00D7" })] }), _jsx("div", { className: "fv-steps", children: ['环境', '模型', '额度', '进入'].map((label, i) => _jsxs("button", { type: "button", className: step === i ? 'current' : '', onClick: () => setStep(i), children: [i + 1, " ", label] }, label)) }), step === 0 && _jsxs("div", { className: "fv-setup-body", children: [_jsx("p", { children: "\u70B9\u51FB\u51C6\u5907\u540E\u81EA\u52A8\u4E0B\u8F7D\u5E76\u6821\u9A8C\u4E13\u7528 Python \u4E0E MaleCNS\uFF1B\u4F18\u5148\u590D\u7528\u4F60\u9009\u62E9\u7684\u672C\u673A Blender\uFF0C\u672A\u914D\u7F6E\u65F6\u4E0B\u8F7D\u4E13\u7528\u7248\u672C\u3002\u6570\u636E\u4FDD\u5B58\u5728\u7528\u6237\u76EE\u5F55\uFF0C\u5347\u7EA7\u4E0D\u4F1A\u6E05\u7A7A\u3002" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "\u4E13\u7528 Python \u4E0E MaleCNS" }), _jsx("b", { children: s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备' })] }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "Blender" }), _jsx("b", { children: s.environment.blender_ready ? '已就绪' : '尚未准备' })] }), _jsxs("label", { children: ["\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84", _jsx("input", { "aria-label": "\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84", value: blenderPath, onChange: e => setBlenderPath(e.target.value), placeholder: "\u5B89\u88C5\u76EE\u5F55\u6216 blender.exe \u7684\u5B8C\u6574\u8DEF\u5F84" })] }), _jsx("button", { type: "button", disabled: pending || !blenderPath.trim() || s.environment.progress.status === 'running', onClick: () => void run(async () => { await api('environment/config', { blender_path: blenderPath.trim() }); }), children: "\u9A8C\u8BC1\u5E76\u4F7F\u7528\u672C\u673A Blender" }), _jsx("small", { children: s.environment.blender }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || preparing || s.environment.progress.status === 'running' || (s.environment.brain_ready && s.environment.blender_ready), onClick: () => void run(async () => { if (!onPrepare)
                                        throw new Error('准备服务未连接'); await onPrepare(blenderPath.trim()); }), children: preparing || s.environment.progress.status === 'running' ? '正在准备…' : '一键准备果蝇 / 重试' }), _jsx("p", { role: "status", children: s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}` : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}` : prepareMessage || '尚未开始；点击上方按钮准备。' }), !!s.environment.progress.total && _jsx("progress", { value: s.environment.progress.done, max: s.environment.progress.total })] }), step === 1 && _jsxs("div", { className: "fv-setup-body", children: [_jsxs("label", { children: ["QuantStudio \u5DF2\u63A5\u5165\u6A21\u578B", _jsxs("select", { value: draft.ai_provider, onChange: e => setDraft({ ...draft, ai_provider: e.target.value }), children: [_jsx("option", { value: "", children: "\u6682\u4E0D\u542F\u7528\u8BED\u8A00\u8F85\u52A9" }), (models?.profiles || []).map(m => _jsx("option", { value: m.provider_id, children: m.label }, m.provider_id))] })] }), _jsx("button", { type: "button", disabled: pending || !draft.ai_provider, onClick: () => void run(async () => { await api('settings', draft); await api('models/test', {}); setError('语言模型连接成功'); }), children: "\u6D4B\u8BD5\u8BED\u8A00\u6A21\u578B\u8FDE\u63A5" }), _jsx("p", { children: "\u5217\u8868\u6765\u81EA\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1\u300D\u4E2D\u4F60\u63A5\u5165\u5E76\u9A8C\u8BC1\u6210\u529F\u7684\u6A21\u578B\uFF0C\u76F4\u63A5\u590D\u7528\u539F\u6709\u8FDE\u63A5\u548C\u5BC6\u94A5\u3002\u6D4B\u8BD5\u8BA1\u5165\u679C\u8747\u6BCF\u65E5\u8C03\u7528\u6B21\u6570\u3002" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "Jev \u00B7 \u7EDF\u4E00\u6A21\u578B\u670D\u52A1" }), _jsx("b", { children: models?.jev_configured ? '已配置' : 'API Key 未配置' })] }), _jsx("p", { children: "Jev API Key \u8BF7\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1 \u2192 Jev\u300D\u4E2D\u914D\u7F6E\uFF0C\u4E0E\u6BD4\u8D5B\u9875\u5171\u7528\u3002" }), openModelSettings && _jsx("button", { type: "button", onClick: openModelSettings, children: "\u524D\u5F80\u6A21\u578B\u670D\u52A1\u914D\u7F6E Jev" }), _jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.jev_enabled, onChange: e => setDraft({ ...draft, jev_enabled: e.target.checked }) }), "\u542F\u7528 Jev \u751F\u6D3B\u73AF\u5883\u8F85\u52A9"] }), _jsx("button", { type: "button", disabled: pending || !models?.jev_configured, onClick: () => void run(async () => { await api('settings', draft); await api('jev/test', {}); setError('Jev 连接成功'); }), children: "\u6D4B\u8BD5 Jev \u8FDE\u63A5" }), _jsx("p", { children: "Jev \u8F85\u52A9\u751F\u6D3B\u73AF\u5883\uFF0C\u679C\u8747\u795E\u7ECF\u8BFB\u51FA\u51B3\u5B9A\u4EA4\u6613\u5EFA\u8BAE\u3002\u72EC\u7ACB\u7684 Jev \u76EF\u76D8\u4ECD\u5728\u6BD4\u8D5B\u9875\u3002" })] }), step === 2 && _jsxs("div", { className: "fv-setup-body", children: [_jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.model_calls_unlimited, onChange: e => setDraft({ ...draft, model_calls_unlimited: e.target.checked }) }), "\u8BED\u8A00 AI\u3001Jev \u4E0E\u9020\u666F\u4E0D\u9650\u8C03\u7528\u6B21\u6570"] }), _jsx("small", { className: "fv-note", children: "\u4ECD\u7EDF\u8BA1\u5B9E\u9645\u7528\u91CF\uFF1B\u679C\u8747\u795E\u7ECF\u8FD0\u884C\u6CA1\u6709\u6BCF\u65E5\u6B21\u6570\u4E0A\u9650\u3002" }), _jsx("div", { className: "fv-form-grid", children: [['ai_daily_calls', '语言 AI / 日'], ['jev_daily_calls', 'Jev 调用 / 日'], ['scenes_daily', '造景次数 / 日'], ['target_notional', '每品种目标名义金额 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => _jsxs("label", { children: [label, _jsx("input", { type: "number", min: "0", disabled: draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key), value: draft[key], onChange: e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) }) })] }, key)) }), _jsxs("fieldset", { children: [_jsx("legend", { children: "\u89C2\u5BDF\u7684\u5B9E\u9645\u5408\u7EA6" }), _jsxs("div", { className: "fv-check-row", children: [_jsx("span", { children: "1 \u00B7 \u8FDE\u63A5\u6BD4\u8D5B\u8D26\u6237" }), _jsx("b", { children: accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…' })] }), _jsx("p", { children: "\u8FDE\u63A5\u8D26\u6237\u65E0\u9700\u5B9E\u9645\u5408\u7EA6\u3002\u9996\u6B21\u8FDE\u63A5\u4F1A\u6253\u5F00\u6BD4\u8D5B\u6388\u6743\u9875\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u67E5\u8BE2\u5DF2\u9009\u54C1\u79CD\u7684\u4E3B\u529B\u3002" }), _jsx("button", { type: "button", disabled: pending || !!accountKey || !contest, onClick: () => void run(connectContestAccount), children: accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户' }), contestError && _jsx("p", { role: "alert", children: contestError }), _jsx("p", { children: "2 \u00B7 \u52FE\u9009\u54C1\u79CD\uFF0C\u81EA\u52A8\u586B\u5165\u5F53\u524D\u4E3B\u529B\uFF1B\u5176\u4ED6\u6708\u4EFD\u9009\u62E9\u540E\u6838\u5BF9\u3002\u4FDD\u5B58\u914D\u7F6E\u540E\uFF0C\u5728\u770B\u677F\u5355\u72EC\u70B9\u51FB\u300C\u8FDE\u63A5\u6BD4\u8D5B\u884C\u60C5\u300D\u3002\u4EC5\u4F53\u9A8C\u751F\u6D3B\u53EF\u8DF3\u8FC7\u8FDE\u63A5\u3002" }), Object.entries(names).map(([product, label]) => {
                                            const configured = draft.instruments.find(i => i.product === product);
                                            const exchange = { IF: 'CFE', IM: 'CFE', au: 'SHF', ag: 'SHF', rb: 'SHF', m: 'DCE', sc: 'INE' }[product];
                                            return _jsxs("div", { className: "fv-instrument", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: !!configured, onChange: e => { setSetupError(''); setDraft({ ...draft, instruments: e.target.checked ? [...draft.instruments, { product, symbol: '', exchange }] : draft.instruments.filter(i => i.product !== product) }); } }), label, " \u00B7 ", product] }), configured && _jsx(FlyInstrumentContract, { product: product, label: label, symbol: configured.symbol, invalid: !!setupError && !/^[A-Za-z]{1,3}[0-9]{3,4}$/.test(configured.symbol), contest: contest, accountKey: accountKey, onSymbolChange: (value, onlyIfEmpty) => { setSetupError(''); setDraft(current => current ? { ...current, instruments: current.instruments.map(item => item.product === product && (!onlyIfEmpty || !item.symbol.trim()) ? { ...item, symbol: value } : item) } : current); } })] }, product);
                                        })] }), _jsxs("label", { className: "fv-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.life_validation, onChange: e => setDraft({ ...draft, life_validation: e.target.checked }) }), "\u4EC5\u9A8C\u8BC1\u751F\u6D3B\uFF08\u4E0D\u751F\u6210\u4EA4\u6613\u9009\u62E9\uFF09"] }), _jsx("p", { children: "\u4EA4\u6613\u989D\u5EA6\u4E3A 0 \u65F6\u53EA\u89C2\u5BDF\u3002\u6574\u6570\u624B\u9020\u6210\u7684\u7B49\u4EF7\u503C\u504F\u5DEE\u4F1A\u663E\u793A\u5728\u770B\u677F\u3002" }), _jsx("small", { className: "fv-note", children: "\u6A21\u578B\u7528\u91CF\u6309\u8C03\u7528\u6B21\u6570\u7EDF\u8BA1\uFF0C\u4E0D\u662F\u670D\u52A1\u5546\u8D26\u5355\u3002" })] }), step === 3 && _jsxs("div", { className: "fv-setup-body", children: [_jsx("div", { className: "fv-welcome-star", children: "\u2726" }), _jsxs("label", { children: ["\u7ED9\u5B83\u4E00\u4E2A\u540D\u5B57", _jsx("input", { maxLength: 24, value: draft.name, onChange: e => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("p", { children: ["\u5173\u95ED\u7F51\u9875\u540E\uFF0CQuantStudio \u540E\u53F0\u4ECD\u8FD0\u884C\u65F6\u5B83\u4F1A\u7EE7\u7EED\u751F\u6D3B\u3002", _jsx("br", {}), "\u9000\u51FA\u5E94\u7528\u540E\u505C\u6B62\uFF1B\u91CD\u542F\u6062\u590D\u8BB0\u5FC6\uFF0C\u4EA4\u6613\u5EFA\u8BAE\u4FDD\u6301\u5173\u95ED\u3002"] }), _jsx("p", { children: "\u5B83\u7684\u795E\u7ECF\u8FDE\u63A5\u7EC4\u4FDD\u6301\u51BB\u7ED3\uFF0C\u5728\u7EBF\u5B66\u4E60\u53D1\u751F\u5728\u51B3\u7B56\u8BFB\u51FA\u5C42\u3002\u5185\u90E8\u72B6\u6001\u662F\u6A21\u62DF\u53D8\u91CF\u3002" })] }), setupError && _jsx("p", { role: "alert", className: "fv-error", children: setupError }), _jsxs("footer", { children: [_jsx("button", { type: "button", onClick: () => { setSetupError(''); if (step > 0)
                                        setStep(step - 1);
                                    else
                                        setSetup(false); }, children: step ? '上一步' : '稍后设置' }), _jsx("button", { type: "button", className: "fv-primary", disabled: pending || (step === 3 && (!s.environment.brain_ready || !s.environment.blender_ready)), onClick: () => { if (step >= 2 && !checkInstruments())
                                        return; if (step < 3) {
                                        setSetupError('');
                                        setStep(step + 1);
                                    }
                                    else
                                        void run(async () => { await api('settings', { ...draft, onboarding_complete: true }); if (s.onboarding) {
                                            await control('start');
                                            setTab('home');
                                        } ; setSetup(false); }); }, children: step < 3 ? '下一步' : s.onboarding ? '进入家园' : '保存配置' })] })] }) })] });
}
//# sourceMappingURL=FlyV2Page.js.map
