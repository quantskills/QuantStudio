import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { GearSixIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { contestTime } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import { JevUsage } from "./JevUsage.js";
import { JevStrategy } from "./JevStrategy.js";
import { JevEvidenceSettings } from "./JevEvidenceSettings.js";
import { ContestWatchVisuals } from "./ContestWatchVisuals.js";
import { instrumentIssue, makeTemplate, rangeTemplate, templates as builtIns, withInstrument } from "./jev-templates.js";
import { useJevProducts } from "./jev-catalog.js";
import { JevInstrument } from "./JevInstrument.js";
import { ActionDialog } from "./ActionDialog.js";
import { TradingGuide } from "./TradingGuide.js";
import css from './ContestPage.module.css';
const initial = rangeTemplate();
const phases = { sampling: '正在盯盘 · 采样中', waiting_quote: '正在盯盘 · 等待行情', deciding: '正在盯盘 · Jev 分析中', checking: '正在盯盘 · 风控检查', waiting_plan: '正在盯盘 · 等待计划处理' };
const fields = [
    ['volume', '手数及持仓上限', 1, 100, 1], ['intervalSeconds', '采样间隔（秒）', 3, 86400, 1], ['decisionIntervalSeconds', '决策间隔（秒）', 3, 86400, 1],
    ['durationMinutes', '运行时长（分钟）', 5, 1440, 1], ['minConfidence', '计划置信度下限', 0.5, 1, 0.01],
    ['maxEquityDrop', '权益回落停止线（元）', 1, undefined, 1], ['maxPlans', '本次开仓计划上限', 1, 100, 1],
    ['openingCooldownSeconds', '开仓冷却时间（秒，0 不冷却）', 0, 3600, 1],
    ['minSamples', '最少有效快照', 8, 60, 1], ['maxSpread', '开仓最大买卖价差（价格单位，0 不限制）', 0, undefined, 0.01],
];
export function ContestWatch({ access, connected = true, openModelSettings, plans }) {
    const [settingsOpen, setSettingsOpen] = useState(false), [diagnostics, setDiagnostics] = useState(false), [review, setReview] = useState(false);
    const savedDraft = useRef(initial), reviewed = useRef('');
    const { catalog, message: catalogMessage, loading: catalogLoading, refresh: refreshCatalog } = useJevProducts(access, connected);
    const [status, setStatus] = useState(), [config, setConfig] = useState(initial);
    const [tuning, setTuning] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
    const [templates, setTemplates] = useState([]), [templateName, setTemplateName] = useState(''), [templateMessage, setTemplateMessage] = useState('');
    const [saving, setSaving] = useState(false), [previousConfig, setPreviousConfig] = useState();
    const [creating, setCreating] = useState(false), [newKind, setNewKind] = useState('range'), [newName, setNewName] = useState('');
    const [statusError, setStatusError] = useState('');
    const [configured, setConfigured] = useState(), [connectionError, setConnectionError] = useState('');
    const [historyBusy, setHistoryBusy] = useState(false);
    const [refreshingSettings, setRefreshingSettings] = useState(false);
    const launcherRef = useRef(null);
    const connectionRef = useRef(null);
    const reviewRef = useRef(null);
    function openSettings(target = 'launcher') {
        savedDraft.current = structuredClone(config);
        setSettingsOpen(true);
        setTuning(target === 'review');
        requestAnimationFrame(() => {
            const element = target === 'connection' ? connectionRef.current : target === 'review' ? reviewRef.current : launcherRef.current;
            if (target === 'connection') {
                const disclosure = connectionRef.current?.closest('details');
                if (disclosure)
                    disclosure.open = true;
            }
            element?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        });
    }
    function cancelSettings() { setConfig(savedDraft.current); setSettingsOpen(false); setError(''); setCreating(false); }
    function reveal(target) { openSettings(target); }
    function requestStart() {
        const issue = instrumentIssue(config, catalog);
        if (issue) {
            setError(issue);
            openSettings();
            return;
        }
        if (reviewed.current !== JSON.stringify(config))
            setReview(true);
        else
            void run('start');
    }
    const hydrated = useRef(false), epoch = useRef(0), pending = useRef(false);
    useEffect(() => {
        let disposed = false;
        void access.templates().then(items => { if (!disposed)
            setTemplates(items); }).catch(() => { if (!disposed)
            setTemplateMessage('模板列表读取失败，请重新进入页面；内置模板仍可使用。'); });
        void waitForCompetition(() => access.settings(), 'Jev 配置').then(value => { if (!disposed)
            setConfigured(value.configured); })
            .catch(failure => { if (!disposed)
            setConnectionError(failure instanceof Error ? failure.message : 'Jev 配置读取失败。'); });
        return () => { disposed = true; };
    }, [access]);
    useEffect(() => {
        let disposed = false, timer;
        const poll = async () => {
            const version = epoch.current;
            try {
                if (pending.current)
                    return;
                const next = await waitForCompetition(() => access.status(), 'Jev 盯盘状态');
                if (disposed || version !== epoch.current || pending.current)
                    return;
                setStatus(next);
                setStatusError('');
                if (!hydrated.current) {
                    if (next.config) {
                        const restored = next.running || next.config.autoHistory || next.config.rangeRules || next.config.signalRules || next.config.customStrategy ? { ...next.config, decisionIntervalSeconds: next.config.decisionIntervalSeconds ?? 30 } : rangeTemplate(next.config.symbol);
                        setPreviousConfig(next.config);
                        setConfig(restored);
                        savedDraft.current = structuredClone(restored);
                    }
                    hydrated.current = true;
                }
            }
            catch (failure) {
                if (!disposed && version === epoch.current)
                    setStatusError(failure instanceof Error ? failure.message : '盯盘状态读取失败。');
            }
            finally {
                if (!disposed)
                    timer = setTimeout(() => { void poll(); }, 3000);
            }
        };
        void poll();
        return () => { disposed = true; clearTimeout(timer); epoch.current++; };
    }, [access]);
    const run = async (action) => {
        if (action === 'start' && pending.current)
            return;
        if (action === 'start') {
            const issue = instrumentIssue(config, catalog);
            if (issue) {
                setError(issue);
                return;
            }
        }
        const version = ++epoch.current;
        pending.current = true;
        setBusy(action);
        setError('');
        try {
            const next = await waitForCompetition(() => action === 'start' ? access.start(config) : access.stop(), action === 'start' ? '启动 Jev 盯盘' : '停止 Jev 盯盘', 120000);
            if (version === epoch.current) {
                setStatus(next);
                setStatusError('');
                if (next.config)
                    setConfig(next.config);
                setTuning(false);
            }
        }
        catch (failure) {
            if (version === epoch.current) {
                setError(failure instanceof Error ? failure.message : '盯盘操作失败。');
                setTuning(true);
            }
        }
        finally {
            if (version === epoch.current) {
                pending.current = false;
                setBusy('');
            }
        }
    };
    const locked = Boolean(!status || status.running || busy || historyBusy || saving);
    const saveTemplate = async () => {
        if (locked)
            return;
        setSaving(true);
        setTemplateMessage('');
        try {
            const items = await access.saveTemplate({ name: templateName.trim() || '我的策略', config });
            setTemplates(items);
            const saved = items.at(-1);
            setConfig(saved.config);
            setTemplateName(saved.name);
            setTemplateMessage('已保存至本机，同名模板会更新；重开页面后仍可使用。');
        }
        catch (failure) {
            setTemplateMessage(failure instanceof Error ? failure.message : '模板保存失败。');
        }
        finally {
            setSaving(false);
        }
    };
    function chooseTemplate(value) {
        const saved = templates.find(item => `saved:${item.name}` === value);
        if (saved) {
            const applied = config.symbol && config.instrument ? { ...withInstrument(structuredClone(saved.config), config.instrument), symbol: config.symbol } : structuredClone(saved.config);
            if (saved.config.symbol.toLowerCase() !== applied.symbol.toLowerCase())
                applied.history = undefined;
            setConfig(applied);
            setTemplateName(saved.name);
        }
        else {
            setConfig(makeTemplate(value, config));
            setTemplateName('');
        }
        setCreating(false);
        setError('');
    }
    const active = Boolean(status?.running && !statusError && !busy);
    const rules = config.rangeRules ?? config.signalRules;
    const phase = statusError ? 'unknown' : busy || !status ? 'pending' : status.running ? status.phase ?? 'sampling' : 'stopped';
    const label = statusError ? '连接中断 · 状态待确认' : busy === 'stop' ? '正在停止盯盘' : busy === 'start' ? '正在启动盯盘'
        : !status ? '正在读取盯盘状态' : status.running ? phases[status.phase ?? 'sampling'] : '盯盘未运行';
    const guide = _jsx(TradingGuide, { compact: true, name: "JEV", steps: [
            { title: '连接账户与模型', status: !connected ? '比赛账户待连接' : configured ? '账户已连接 · 密钥已配置' : '模型配置待核验', ready: connected && configured === true,
                body: '先在本页上方连接期货模拟赛账户，再到「设置 → 模型服务 → Jev」填写 TypeSafe API Key，点击测试并保存。比赛账户授权、Jev 密钥、PandaData 历史数据授权是三项独立配置。',
                note: 'Jev 连接测试会产生一次小型 API 请求。使用自定义中文策略时，还需要在同一设置页选择已验证的中文翻译模型；内置模板可先直接体验。', action: { label: '查看模型配置入口', run: () => reveal('connection') } },
            { title: '选择模板与合约', status: instrumentIssue(config, catalog) ? '合约参数待核对' : '合约格式已检查', ready: !instrumentIssue(config, catalog),
                body: '第一次先选一个内置模板和一个熟悉的品种，再填写实际月份合约。可以搜索六个交易所的品种，也可以选择其他品种／自定义。核对交易所和最小价格变动 tick。',
                note: '品种代码不等于实际合约。示例 rb2610 只是格式示例，需换成当前柜台开放的月份；选对品种不代表该月份一定有行情。', action: { label: '选择模板和实际合约', run: () => reveal('launcher') } },
            { title: '核对额度与行情', status: status?.running ? '正在运行，请先停止再调整' : '启动前由你核对',
                body: '检查手数、运行时长、决策间隔、最大开仓计划数与权益回落停止线。初次可以保留内置模板的 1 手设置，按自己的模拟账户资金核对。首次先到「设置 → PandaData」连接授权，再在「微调模板 → 历史行情与策略条件」检查数据准备状态。',
                note: '实时报价来自比赛柜台，历史 K 线来自 PandaData 或手动资料。Jev 自主决策及翻译可能产生 API 用量；历史不足时不会新开仓。权益停止线只暂停盯盘，不自动平仓。', action: { label: '检查参数与历史行情', run: () => reveal('review') } },
            { title: '运行与确认计划', status: label, ready: active,
                body: '配置核对后，点击「开始盯盘」。先等待有效行情与采样，再看 Jev 分析和运行记录。有机会时生成待确认计划：展开本页「比赛详情」，在「交易计划与回执」核对账户、合约、方向、手数及价格，再决定确认或取消。',
                note: '开始盯盘不等于下单，已提交也不等于已成交。停止盯盘不会撤销已提交委托或清空持仓；停止后仍要检查挂单、持仓与柜台回执。', action: { label: '查看运行区域', run: () => reveal('launcher') } },
        ], troubleshooting: [
            { title: '已授权 PandaData，为什么还在等待行情？', body: '先在本页「最新行情」核对同一实际合约的价格与时间，再检查比赛账户、合约月份及交易时段。PandaData 的历史授权不代表比赛柜台已经提供实时报价。休市时不要通过改参数强行启动。' },
            { title: '一直没有计划，是不是没运行？', body: '看状态和运行记录：可能正在积累样本、没有满足策略条件、处于冷却期，或已有待处理计划。先处理原计划，再看风控和历史诊断；不要为了出单盲目降低限制。' },
            { title: '密钥填好仍不能启动，或提示历史数据不足？', body: '返回模型服务测试并保存 Jev 密钥，再刷新配置状态。历史数据不足时在「微调模板 → 历史行情与策略条件」查看诊断并准备历史数据；检查 PandaData 授权或补充手动资料。不要把 API Key 填进策略内容。' },
        ] });
    return _jsxs("section", { className: `${css.assistant} ${css.watchWorkbench} qs-jev-workspace`, "aria-label": "Jev \u6301\u7EED\u76EF\u76D8", children: [_jsxs("header", { className: "qs-workspace-heading", children: [_jsxs("div", { children: [_jsx("h2", { children: "Jev \u6301\u7EED\u76EF\u76D8" }), _jsx("p", { children: "\u6301\u7EED\u89C2\u5BDF\u884C\u60C5\uFF0C\u6709\u673A\u4F1A\u65F6\u751F\u6210\u5F85\u786E\u8BA4\u8BA1\u5212\u3002" })] }), _jsxs("div", { className: "qs-workspace-actions", children: [guide, _jsx("button", { type: "button", "aria-label": "Jev \u8FD0\u884C\u8BBE\u7F6E", onClick: () => openSettings(), children: _jsx(GearSixIcon, { size: 20 }) })] })] }), error && !settingsOpen && _jsx("p", { className: css.error, role: "alert", children: error }), statusError && _jsx("p", { className: css.error, role: "alert", children: statusError }), connectionError && _jsx("p", { className: css.error, role: "alert", children: connectionError }), (!connected || configured !== true) && _jsxs("div", { className: "qs-compact-alert", role: "status", children: [_jsx("span", { children: !connected ? '请先连接比赛账户' : configured === undefined ? '正在核验模型配置' : 'Jev 密钥待配置' }), _jsx("button", { type: "button", onClick: () => openSettings('connection'), children: "\u68C0\u67E5\u8FDE\u63A5" })] }), _jsxs("div", { className: "qs-launch-row", children: [_jsxs("div", { className: "qs-launch-field", children: [_jsx("span", { children: "\u5B9E\u9645\u5408\u7EA6" }), _jsxs("button", { type: "button", "aria-label": "\u9009\u62E9\u5B9E\u9645\u5408\u7EA6", onClick: () => openSettings(), children: [config.symbol || '选择期货合约', " \u2304"] })] }), _jsxs("label", { children: ["\u5F53\u524D\u6A21\u677F", _jsxs("select", { "aria-label": "\u5F53\u524D\u8FD0\u884C\u6A21\u677F", disabled: locked, value: config.builtInTemplate === 'rb-range' ? 'range' : config.builtInTemplate || `saved:${config.strategyName}`, onChange: event => chooseTemplate(event.target.value), children: [builtIns.map(item => _jsx("option", { value: item.id, children: item.name }, item.id)), templates.map(item => _jsx("option", { value: `saved:${item.name}`, children: item.name }, item.name)), !config.builtInTemplate && !templates.some(item => item.name === config.strategyName) && _jsx("option", { value: `saved:${config.strategyName}`, children: config.strategyName || '自定义配置' })] })] }), _jsxs("div", { className: "qs-launch-summary", children: [_jsxs("strong", { children: ["\u6BCF\u7B14\u6700\u591A ", config.volume, " \u624B \u00B7 ", config.decisionIntervalSeconds ?? 30, " \u79D2\u51B3\u7B56"] }), "\u8FD0\u884C ", config.durationMinutes, " \u5206\u949F \u00B7 \u6700\u591A ", config.maxPlans, " \u4E2A\u5F00\u4ED3\u8BA1\u5212"] }), _jsx("button", { type: "button", "data-primary": !status?.running || undefined, disabled: busy === 'stop' || (!status?.running && busy !== 'start' && (locked || !connected || !configured)), onClick: () => status?.running || busy === 'start' ? void run('stop') : requestStart(), children: busy === 'stop' ? '停止中…' : busy === 'start' ? '取消启动' : status?.running ? '停止盯盘' : '开始盯盘' })] }), _jsxs("div", { className: css.watchStatus, role: "status", "data-phase": phase, "data-active": active, children: [_jsx("span", { className: css.watchIndicator, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("strong", { children: label }), _jsx("p", { children: statusError ? '暂时无法确认盯盘状态，正在重试连接。' : status?.message ?? '读取盯盘状态…' }), _jsxs("details", { children: [_jsx("summary", { children: "\u72B6\u6001\u8BE6\u60C5" }), phase === 'waiting_quote' && _jsxs("p", { children: ["\u5B9E\u65F6\u62A5\u4EF7\u6765\u81EA\u6BD4\u8D5B\u67DC\u53F0\uFF0CPandaData \u7528\u4E8E\u5386\u53F2 K \u7EBF\uFF1BPandaData \u5DF2\u6388\u6743\u4E0D\u4EE3\u8868\u67DC\u53F0\u5DF2\u8FD4\u56DE\u6709\u6548\u62A5\u4EF7\u3002\u8BF7\u5728\u6BD4\u8D5B\u9875\u300C\u6700\u65B0\u884C\u60C5\u300D\u6838\u5BF9", status?.config?.symbol ? ` ${status.config.symbol} ` : '同一合约', "\u7684\u4EF7\u683C\u4E0E\u65F6\u95F4\u3002"] }), status?.lastQuoteCheckedAt && _jsxs("small", { children: ["\u6700\u8FD1\u884C\u60C5\u68C0\u67E5\uFF1A", contestTime(status.lastQuoteCheckedAt), status.running && status.config ? ` · 采样间隔 ${status.config.intervalSeconds} 秒` : ''] }), status?.nextRetryAt && status.running && _jsxs("p", { children: ["\u67DC\u53F0\u91CD\u8BD5\u65F6\u95F4\uFF1A", contestTime(status.nextRetryAt), "\uFF0C\u7B49\u5F85\u671F\u95F4\u4E0D\u8BF7\u6C42 Jev\u3002"] }), status?.accountCheckedAt && _jsxs("small", { children: ["\u6700\u8FD1\u8D26\u6237\u5DE1\u68C0\uFF1A", contestTime(status.accountCheckedAt)] })] })] })] }), _jsx(ContestWatchVisuals, { status: status, active: active }), plans && _jsx("div", { className: "qs-watch-plans", children: plans }), status?.strategyNotices?.map(note => _jsx("p", { className: css.jevFine, children: note }, note)), status && _jsxs("div", { className: css.watchSummary, children: [_jsxs("span", { children: ["\u672C\u6B21\u5F00\u4ED3\u8BA1\u5212 ", status.openingPlanCount ?? status.planCount, "/", status.config?.maxPlans ?? '—', " \u00B7 \u603B\u8BA1\u5212 ", status.planCount] }), status.running && status.openingCooldownUntil && status.openingCooldownUntil > Date.now() && _jsxs("span", { children: ["\u5F00\u4ED3\u51B7\u5374\u81F3 ", contestTime(status.openingCooldownUntil), "\uFF08\u4E0D\u5F71\u54CD\u5E73\u4ED3\u5224\u65AD\uFF09"] }), status.running && status.nextDecisionAt && _jsxs("span", { children: ["\u4E0B\u6B21\u51B3\u7B56\u6700\u65E9 ", contestTime(status.nextDecisionAt), "\uFF08\u9700\u6709\u6548\u6837\u672C\u3001\u65E0\u5F85\u5904\u7406\u8BA1\u5212\uFF09"] })] }), _jsxs("div", { className: css.watchSummary, children: [_jsx("span", { children: "\u9010\u7B14\u786E\u8BA4 \u00B7 \u505C\u6B62\u76EF\u76D8\u4E0D\u64A4\u5355\u3001\u4E0D\u5E73\u4ED3" }), _jsx("button", { type: "button", onClick: () => setDiagnostics(true), children: "\u8FD0\u884C\u8BB0\u5F55\u4E0E\u8BCA\u65AD \u2197" })] }), settingsOpen && _jsxs(ActionDialog, { drawer: true, title: "Jev \u8FD0\u884C\u8BBE\u7F6E", busy: !!busy || historyBusy || saving, onClose: cancelSettings, children: [status?.running && _jsx("p", { className: css.jevFine, children: "\u6B63\u5728\u8FD0\u884C\uFF0C\u505C\u6B62\u76EF\u76D8\u540E\u53EF\u4FEE\u6539\u53C2\u6570\u3002" }), _jsxs("details", { className: "qs-connection-settings", open: configured !== true, children: [_jsxs("summary", { children: ["\u6A21\u578B\u8FDE\u63A5 \u00B7 ", configured ? '已配置' : '待核验'] }), _jsxs("div", { className: css.jevConnectionBody, ref: connectionRef, tabIndex: -1, children: [_jsxs("p", { children: ["Jev \u00B7 ", configured === undefined ? '配置状态待确认' : configured ? 'API Key 已配置' : 'API Key 未配置', "\u3002API Key \u8BF7\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1 \u2192 Jev\u300D\u4E2D\u914D\u7F6E\uFF0C\u4E0E\u679C\u8747\u5171\u7528\u3002"] }), openModelSettings && _jsx("button", { type: "button", onClick: () => { cancelSettings(); openModelSettings(); }, children: "\u524D\u5F80\u6A21\u578B\u670D\u52A1\u914D\u7F6E Jev" }), _jsx("button", { type: "button", disabled: refreshingSettings, onClick: async () => {
                                            setRefreshingSettings(true);
                                            setConnectionError('');
                                            try {
                                                setConfigured((await waitForCompetition(() => access.settings(), 'Jev 配置')).configured);
                                            }
                                            catch (failure) {
                                                setConnectionError(failure instanceof Error ? failure.message : '配置读取失败，请重试。');
                                            }
                                            finally {
                                                setRefreshingSettings(false);
                                            }
                                        }, children: "\u5237\u65B0\u914D\u7F6E\u72B6\u6001" }), connectionError && _jsx("p", { className: css.error, role: "alert", children: connectionError })] })] }), _jsxs("form", { noValidate: true, onSubmit: event => { event.preventDefault(); if (!locked) {
                            const issue = instrumentIssue(config, catalog);
                            if (issue)
                                setError(issue);
                            else {
                                setSettingsOpen(false);
                                setError('');
                            }
                        } }, children: [_jsxs("fieldset", { className: css.jevLauncher, disabled: locked, ref: launcherRef, tabIndex: -1, children: [_jsx("legend", { children: "\u9009\u62E9\u8FD0\u884C\u6A21\u677F" }), _jsxs("label", { children: ["\u8FD0\u884C\u6A21\u677F", _jsxs("select", { "aria-label": "\u8FD0\u884C\u6A21\u677F", value: config.builtInTemplate === 'rb-range' ? 'range' : config.builtInTemplate || `saved:${config.strategyName}`, onChange: event => chooseTemplate(event.target.value), children: [builtIns.map(item => _jsx("option", { value: item.id, children: item.name }, item.id)), templates.map(item => _jsx("option", { value: `saved:${item.name}`, children: item.name }, item.name)), !config.builtInTemplate && !templates.some(item => item.name === config.strategyName) && _jsx("option", { value: `saved:${config.strategyName}`, children: config.strategyName || '自定义配置' })] })] }), _jsx("button", { type: "button", className: css.jevReuse, onClick: () => { setCreating(true); setNewName(''); setError(''); }, children: "\uFF0B \u65B0\u5EFA\u6A21\u677F" }), creating && _jsxs("section", { className: css.jevCreator, "aria-label": "\u65B0\u5EFA\u6A21\u677F", children: [_jsxs("label", { children: ["\u65B0\u6A21\u677F\u540D\u79F0", _jsx("input", { maxLength: 80, value: newName, placeholder: "\u4F8B\u5982 \u6211\u7684\u5348\u540E\u7B56\u7565", onChange: event => setNewName(event.target.value) })] }), _jsxs("label", { children: ["\u521B\u5EFA\u65B9\u5F0F", _jsxs("select", { value: newKind, onChange: event => setNewKind(event.target.value), children: [builtIns.map(item => _jsxs("option", { value: item.id, children: ["\u57FA\u4E8E", item.name] }, item.id)), _jsx("option", { value: "blank", children: "\u4ECE\u7A7A\u767D\u521B\u5EFA" })] })] }), _jsx("p", { children: newKind === 'blank' ? '运行参数已预填；请填写策略目标和五种动作标准，再保存。' : '复制完整参数和条件，修改后保存即可使用。' }), _jsx("button", { type: "button", disabled: !newName.trim(), onClick: () => {
                                                    const name = newName.trim();
                                                    if (templates.some(item => item.name === name)) {
                                                        setError('已有同名模板，请换个名称，或选择原模板进行修改。');
                                                        return;
                                                    }
                                                    setConfig({ ...makeTemplate(newKind, config), builtInTemplate: undefined, strategyName: name });
                                                    setTemplateName(name);
                                                    setTuning(true);
                                                    setCreating(false);
                                                    setError('');
                                                    setTemplateMessage('正在编辑新模板，完成后点击「保存为我的模板」。');
                                                }, children: "\u521B\u5EFA\u5E76\u7F16\u8F91" }), _jsx("button", { type: "button", onClick: () => setCreating(false), children: "\u53D6\u6D88" })] }), previousConfig && _jsx("button", { type: "button", className: css.jevReuse, onClick: () => { setConfig(structuredClone(previousConfig)); setTemplateName(''); }, children: "\u8F7D\u5165\u4E0A\u6B21\u8FD0\u884C\u914D\u7F6E" }), _jsxs("div", { className: css.jevQuickStart, children: [_jsxs("label", { children: ["\u51B3\u7B56\u65B9\u5F0F", _jsxs("select", { value: config.decisionMode ?? 'strict', onChange: event => setConfig({ ...config, decisionMode: event.target.value }), children: [_jsx("option", { value: "jev", children: "Jev \u81EA\u4E3B\u51B3\u7B56\uFF08\u63A8\u8350\uFF09" }), _jsx("option", { value: "strict", children: "\u4E25\u683C\u89C4\u5219\u6A21\u5F0F" })] })] }), _jsx(JevInstrument, { compact: true, config: config, onChange: setConfig, catalog: catalog }), _jsxs("div", { className: css.jevRunSummary, children: [_jsxs("strong", { children: [config.strategyName ?? '自定义配置', " \u00B7 \u6BCF\u7B14\u6700\u591A ", config.volume, " \u624B"] }), _jsxs("span", { children: [config.decisionIntervalSeconds ?? 30, " \u79D2\u51B3\u7B56 \u00B7 \u8FD0\u884C ", config.durationMinutes, " \u5206\u949F \u00B7 \u6700\u591A ", config.maxPlans, " \u4E2A\u5F00\u4ED3\u8BA1\u5212"] }), _jsxs("span", { children: ["\u6743\u76CA\u56DE\u843D ", config.maxEquityDrop, " \u5143\u6682\u505C \u00B7 ", config.autoHistory ? 'PandaData 行情自动准备' : '使用手动行情配置'] })] })] }), _jsxs("div", { className: css.jevCatalogTools, children: [_jsx("span", { children: catalogMessage }), access.varieties && _jsx("button", { type: "button", disabled: !connected || catalogLoading, onClick: () => { void refreshCatalog(); }, children: catalogLoading ? '正在同步…' : '同步柜台品种' }), _jsx("span", { children: "\u81EA\u52A8\u8BC6\u522B\u4EA4\u6613\u6240\u5E76\u9884\u586B tick\uFF1B\u5408\u7EA6\u6708\u4EFD\u7531\u4F60\u586B\u5199\u3002\u9884\u586B\u53C2\u6570\u53EF\u4FEE\u6539\uFF0C\u5B9E\u9645\u884C\u60C5\u4E0E\u4EA4\u6613\u4EE5\u67DC\u53F0\u4E3A\u51C6\u3002" })] }), _jsxs("details", { className: css.jevControls, ref: reviewRef, tabIndex: -1, open: tuning, onToggle: event => setTuning(event.currentTarget.open), children: [_jsxs("summary", { children: ["\u5FAE\u8C03\u6A21\u677F", _jsx("span", { children: "\u9891\u7387\u3001\u98CE\u63A7\u3001\u7B56\u7565\u4E0E\u884C\u60C5" })] }), _jsx("p", { className: css.jevFine, children: config.decisionMode === 'jev' ? '策略条件作为参考发送给 Jev，由模型判断机会。历史不足也会请求分析并产生用量，但不允许新开仓；账户、方向、手数和风控限制仍生效。' : '严格规则模式：程序条件先筛选，全部可交易动作被拦截时不请求 Jev。旧配置沿用此模式，可在上方切换。' }), _jsx("p", { className: css.jevFine, children: rules ? '成本假设：每手双边手续费及滑点 ' + rules.roundTripCostTicks + ' tick，另计实际点差。默认值是可修改的模拟参数，未经收益回测。' : '使用自定义文字策略；行情有效后由 Jev 按你填写的条件判断。' }), _jsxs("div", { className: css.watchFields, children: [fields.map(([key, label, min, max, step]) => _jsxs("label", { children: [label, _jsx("input", { type: "number", required: true, min: min, max: max, step: step, value: config[key] ?? initial[key] ?? '', onChange: event => setConfig({ ...config, [key]: Number(event.target.value) }) })] }, key)), _jsxs("label", { children: ["\u5141\u8BB8\u5F00\u4ED3\u65B9\u5411", _jsxs("select", { value: config.allowedSide ?? 'both', onChange: event => setConfig({ ...config, allowedSide: event.target.value }), children: [_jsx("option", { value: "both", children: "\u591A\u7A7A\u5747\u53EF" }), _jsx("option", { value: "long_only", children: "\u53EA\u5F00\u591A" }), _jsx("option", { value: "short_only", children: "\u53EA\u5F00\u7A7A" })] })] }), _jsx(JevEvidenceSettings, { access: access, config: config, onChange: setConfig, onBusy: setHistoryBusy }), _jsx(JevStrategy, { config: config, onChange: setConfig })] }), _jsx("p", { className: css.jevFine, children: "\u51B7\u5374\u4ECE\u6BCF\u6B21\u751F\u6210\u8BA1\u5212\u8D77\u8BA1\u65F6\uFF0C\u4EC5\u9650\u5236\u4E0B\u4E00\u6B21\u5F00\u4ED3\uFF1B\u5E73\u4ED3\u6309\u51B3\u7B56\u95F4\u9694\u8BC4\u4F30\uFF0C\u4E0D\u5360\u5F00\u4ED3\u540D\u989D\u3002\u8FD0\u884C\u5230\u671F\u6216\u89E6\u53CA\u6743\u76CA\u505C\u6B62\u7EBF\u4ECD\u4F1A\u505C\u6B62\u76EF\u76D8\uFF0C\u5E73\u4ED3\u8BA1\u5212\u4ECD\u9700\u786E\u8BA4\u3002" }), _jsxs("div", { className: css.jevSaveTemplate, children: [_jsxs("label", { children: ["\u4FDD\u5B58\u6A21\u677F\u540D\u79F0", _jsx("input", { maxLength: 80, placeholder: "\u4F8B\u5982 \u6211\u7684\u5348\u540E\u533A\u95F4", value: templateName, onChange: event => setTemplateName(event.target.value) })] }), _jsx("button", { type: "button", onClick: () => { void saveTemplate(); }, children: saving ? '保存中…' : '保存为我的模板' })] }), _jsx("p", { className: css.jevFine, children: "\u540C\u540D\u4FDD\u5B58\u4F1A\u66F4\u65B0\u5DF2\u6709\u6A21\u677F\uFF0C\u53EF\u4E0D\u586B\u5B9E\u9645\u5408\u7EA6\u5148\u4FDD\u5B58\u3002\u6362\u54C1\u79CD\u65F6\u6838\u5BF9\u4EA4\u6613\u6240\u3001tick \u4E0E\u6210\u672C\uFF1B\u542F\u52A8\u524D\u5FC5\u987B\u586B\u5199\u67DC\u53F0\u652F\u6301\u7684\u5B9E\u9645\u5408\u7EA6\u3002" })] })] }), templateMessage && _jsx("p", { className: css.jevFine, children: templateMessage }), !configured && _jsx("p", { className: css.jevFine, children: "\u9996\u6B21\u4F7F\u7528\uFF1A\u8BF7\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1 \u2192 Jev\u300D\u914D\u7F6E API Key\uFF0C\u540E\u7EED\u65E0\u9700\u91CD\u590D\u586B\u5199\u3002" }), !connected && _jsx("p", { className: css.jevFine, children: "\u5148\u8FDE\u63A5\u4E0A\u65B9\u6BD4\u8D5B\u8D26\u6237\uFF0C\u518D\u5F00\u59CB\u76EF\u76D8\u3002" }), _jsx("p", { className: css.jevFine, children: "\u5F00\u59CB\u540E\u5411 TypeSafe \u53D1\u9001\u7B56\u7565\u3001\u884C\u60C5\u4E0E\u6301\u4ED3\u6458\u8981\u5E76\u4EA7\u751F API \u7528\u91CF\u3002\u6743\u76CA\u505C\u6B62\u7EBF\u4EC5\u6682\u505C\u76EF\u76D8\uFF0C\u4E0D\u81EA\u52A8\u6E05\u4ED3\uFF1B\u6BCF\u7B14\u8BA1\u5212\u4ECD\u7531\u4F60\u786E\u8BA4\u3002" }), error && _jsx("p", { className: css.error, role: "alert", children: error }), _jsxs("div", { className: "qs-drawer-footer", children: [_jsx("button", { type: "button", disabled: !!busy || historyBusy || saving, onClick: cancelSettings, children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", "data-primary": true, disabled: locked, children: "\u5E94\u7528\u672C\u6B21\u914D\u7F6E" })] })] })] }), diagnostics && _jsxs(ActionDialog, { drawer: true, title: "Jev \u8FD0\u884C\u8BB0\u5F55\u4E0E\u8BCA\u65AD", onClose: () => setDiagnostics(false), children: [_jsx(JevUsage, { access: access }), status?.events.length ? _jsxs("details", { children: [_jsxs("summary", { children: ["\u8FD0\u884C\u8BB0\u5F55\uFF08", status.events.length, "\uFF09"] }), _jsx("ol", { className: css.watchLog, children: [...status.events].reverse().map((entry, index) => _jsxs("li", { children: [_jsx("time", { children: contestTime(entry.time) }), " ", entry.message] }, `${entry.time}-${index}`)) })] }) : null] }), review && _jsxs(ActionDialog, { title: "\u6838\u5BF9\u672C\u6B21\u76EF\u76D8", busy: !!busy, onClose: () => setReview(false), children: [_jsx("p", { children: _jsxs("strong", { children: [config.symbol, " \u00B7 ", config.strategyName] }) }), _jsxs("p", { children: ["\u6BCF\u7B14\u6700\u591A ", config.volume, " \u624B \u00B7 ", config.durationMinutes, " \u5206\u949F \u00B7 \u6700\u591A ", config.maxPlans, " \u4E2A\u5F00\u4ED3\u8BA1\u5212"] }), _jsxs("p", { children: ["\u6743\u76CA\u56DE\u843D ", config.maxEquityDrop, " \u5143\u6682\u505C\u3002\u8C03\u7528 TypeSafe \u4F1A\u4EA7\u751F API \u7528\u91CF\uFF1B\u6BCF\u7B14\u8BA1\u5212\u4ECD\u7531\u4F60\u786E\u8BA4\uFF0C\u505C\u6B62\u4E0D\u64A4\u5355\u6216\u5E73\u4ED3\u3002"] }), _jsxs("div", { className: "qs-drawer-footer", children: [_jsx("button", { type: "button", onClick: () => setReview(false), children: "\u8FD4\u56DE" }), _jsx("button", { type: "button", "data-primary": true, onClick: () => { reviewed.current = JSON.stringify(config); setReview(false); void run('start'); }, children: "\u786E\u8BA4\u5E76\u5F00\u59CB\u76EF\u76D8" })] })] })] });
}
//# sourceMappingURL=ContestWatch.js.map