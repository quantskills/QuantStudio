import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { contestTime } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import { JevConnection } from "./JevConnection.js";
import { JevUsage } from "./JevUsage.js";
import { JevStrategy } from "./JevStrategy.js";
import { JevEvidenceSettings } from "./JevEvidenceSettings.js";
import { ContestWatchVisuals } from "./ContestWatchVisuals.js";
import { makeTemplate, rangeTemplate, templates as builtIns, withInstrument } from "./jev-templates.js";
import { JevInstrument } from "./JevInstrument.js";
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
export function ContestWatch({ access, connected = true }) {
    const [expanded, setExpanded] = useState(true), contentId = useId();
    const [status, setStatus] = useState(), [config, setConfig] = useState(initial);
    const [tuning, setTuning] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
    const [templates, setTemplates] = useState([]), [templateName, setTemplateName] = useState(''), [templateMessage, setTemplateMessage] = useState('');
    const [saving, setSaving] = useState(false), [previousConfig, setPreviousConfig] = useState();
    const [creating, setCreating] = useState(false), [newKind, setNewKind] = useState('range'), [newName, setNewName] = useState('');
    const [statusError, setStatusError] = useState('');
    const [configured, setConfigured] = useState(false), [keyBusy, setKeyBusy] = useState(false);
    const [historyBusy, setHistoryBusy] = useState(false);
    const hydrated = useRef(false), epoch = useRef(0), pending = useRef(false);
    useEffect(() => {
        let disposed = false;
        void access.templates().then(items => { if (!disposed)
            setTemplates(items); }).catch(() => { if (!disposed)
            setTemplateMessage('模板列表读取失败，请重新进入页面；内置模板仍可使用。'); });
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
                        setPreviousConfig(next.config);
                        setConfig(next.running || next.config.autoHistory || next.config.rangeRules || next.config.signalRules || next.config.customStrategy ? { ...next.config, decisionIntervalSeconds: next.config.decisionIntervalSeconds ?? 30 } : rangeTemplate(next.config.symbol));
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
    const locked = Boolean(!status || status.running || busy || keyBusy || historyBusy || saving);
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
    const active = Boolean(status?.running && !statusError && !busy);
    const rules = config.rangeRules ?? config.signalRules;
    const phase = statusError ? 'unknown' : busy || !status ? 'pending' : status.running ? status.phase ?? 'sampling' : 'stopped';
    const label = statusError ? '连接中断 · 状态待确认' : busy === 'stop' ? '正在停止盯盘' : busy === 'start' ? '正在启动盯盘'
        : !status ? '正在读取盯盘状态' : status.running ? phases[status.phase ?? 'sampling'] : '盯盘未运行';
    return _jsxs("section", { className: `${css.assistant} ${css.watchWorkbench}`, "aria-label": "Jev \u6301\u7EED\u76EF\u76D8", children: [_jsxs("div", { className: css.assistantHeading, children: [_jsxs("div", { children: [_jsx("span", { className: css.jevCaption, children: "JEV / \u671F\u8D27\u6A21\u62DF\u4EA4\u6613" }), _jsx("h2", { children: _jsxs("button", { type: "button", className: css.watchToggle, "aria-expanded": expanded, "aria-controls": contentId, onClick: () => setExpanded(value => !value), children: ["Jev \u6301\u7EED\u76EF\u76D8 ", _jsx("span", { children: expanded ? '▾ 收起' : '▸ 展开' })] }) }), _jsx("p", { children: expanded ? '选一个模板即可开始，想调整时再展开微调。每笔交易仍由你确认。' : label })] }), (status?.running || busy === 'start') && _jsx("button", { type: "button", disabled: busy === 'stop', onClick: () => { void run('stop'); }, children: busy === 'stop' ? '停止中…' : '停止盯盘' })] }), _jsxs("div", { id: contentId, hidden: !expanded, children: [_jsx(JevConnection, { access: access, disabled: Boolean(status?.running || busy || saving || historyBusy), onConfigured: setConfigured, onBusy: setKeyBusy }), error && _jsx("p", { className: css.error, role: "alert", children: error }), statusError && _jsx("p", { className: css.error, role: "alert", children: statusError }), _jsxs("div", { className: css.watchStatus, role: "status", "data-phase": phase, "data-active": active, children: [_jsx("span", { className: css.watchIndicator, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("strong", { children: label }), _jsx("p", { children: statusError ? '暂时无法确认盯盘状态，正在重试连接。' : status?.message ?? '读取盯盘状态…' }), phase === 'waiting_quote' && _jsxs("p", { children: ["\u5B9E\u65F6\u62A5\u4EF7\u6765\u81EA\u6BD4\u8D5B\u67DC\u53F0\uFF0CPandaData \u7528\u4E8E\u5386\u53F2 K \u7EBF\uFF1BPandaData \u5DF2\u6388\u6743\u4E0D\u4EE3\u8868\u67DC\u53F0\u5DF2\u8FD4\u56DE\u6709\u6548\u62A5\u4EF7\u3002\u8BF7\u5728\u6BD4\u8D5B\u9875\u300C\u6700\u65B0\u884C\u60C5\u300D\u6838\u5BF9", status?.config?.symbol ? ` ${status.config.symbol} ` : '同一合约', "\u7684\u4EF7\u683C\u4E0E\u65F6\u95F4\u3002"] }), status?.lastQuoteCheckedAt && _jsxs("small", { children: ["\u6700\u8FD1\u884C\u60C5\u68C0\u67E5\uFF1A", contestTime(status.lastQuoteCheckedAt), status.running && status.config ? ` · 采样间隔 ${status.config.intervalSeconds} 秒` : ''] }), status?.nextRetryAt && status.running && _jsxs("p", { children: ["\u67DC\u53F0\u91CD\u8BD5\u65F6\u95F4\uFF1A", contestTime(status.nextRetryAt), "\uFF0C\u7B49\u5F85\u671F\u95F4\u4E0D\u8BF7\u6C42 Jev\u3002"] }), status?.accountCheckedAt && _jsxs("small", { children: ["\u6700\u8FD1\u8D26\u6237\u5DE1\u68C0\uFF1A", contestTime(status.accountCheckedAt)] })] })] }), _jsxs("form", { noValidate: true, onSubmit: event => { event.preventDefault(); if (!locked && configured && connected)
                            void run('start'); }, children: [_jsxs("fieldset", { className: css.jevLauncher, disabled: locked, children: [_jsx("legend", { children: "\u9009\u62E9\u8FD0\u884C\u6A21\u677F" }), _jsxs("div", { className: css.jevTemplateGrid, children: [builtIns.map(item => _jsxs("button", { type: "button", className: css.jevTemplateCard, "aria-pressed": config.builtInTemplate === item.id || (item.id === 'range' && config.builtInTemplate === 'rb-range'), onClick: () => { setConfig(makeTemplate(item.id, config)); setTemplateName(''); setCreating(false); setError(''); }, children: [_jsx("span", { className: css.jevCaption, children: "\u5185\u7F6E\u6A21\u677F \u00B7 \u54C1\u79CD\u53EF\u9009" }), _jsx("strong", { children: item.name }), _jsx("span", { children: item.description }), _jsx("small", { children: "1 \u5206\u949F\u884C\u60C5 \u00B7 \u9ED8\u8BA4 1 \u624B \u00B7 \u6BCF\u7B14\u786E\u8BA4" })] }, item.id)), templates.map(item => _jsxs("button", { type: "button", className: css.jevTemplateCard, "aria-pressed": !config.builtInTemplate && config.strategyName === item.name, onClick: () => {
                                                    const saved = structuredClone(item.config), applied = config.symbol && config.instrument ? { ...withInstrument(saved, config.instrument), symbol: config.symbol } : saved;
                                                    if (saved.symbol.toLowerCase() !== applied.symbol.toLowerCase())
                                                        applied.history = undefined;
                                                    setConfig(applied);
                                                    setTemplateName(item.name);
                                                    setCreating(false);
                                                    setError('');
                                                }, children: [_jsx("span", { className: css.jevCaption, children: "\u6211\u7684\u6A21\u677F" }), _jsx("strong", { children: item.name }), _jsxs("span", { children: [item.config.volume, " \u624B \u00B7 ", item.config.decisionIntervalSeconds ?? 30, " \u79D2\u51B3\u7B56 \u00B7 \u54C1\u79CD\u53EF\u9009"] })] }, item.name))] }), _jsx("button", { type: "button", className: css.jevReuse, onClick: () => { setCreating(true); setNewName(''); setError(''); }, children: "\uFF0B \u65B0\u5EFA\u6A21\u677F" }), creating && _jsxs("section", { className: css.jevCreator, "aria-label": "\u65B0\u5EFA\u6A21\u677F", children: [_jsxs("label", { children: ["\u65B0\u6A21\u677F\u540D\u79F0", _jsx("input", { maxLength: 80, value: newName, placeholder: "\u4F8B\u5982 \u6211\u7684\u5348\u540E\u7B56\u7565", onChange: event => setNewName(event.target.value) })] }), _jsxs("label", { children: ["\u521B\u5EFA\u65B9\u5F0F", _jsxs("select", { value: newKind, onChange: event => setNewKind(event.target.value), children: [builtIns.map(item => _jsxs("option", { value: item.id, children: ["\u57FA\u4E8E", item.name] }, item.id)), _jsx("option", { value: "blank", children: "\u4ECE\u7A7A\u767D\u521B\u5EFA" })] })] }), _jsx("p", { children: newKind === 'blank' ? '运行参数已预填；请填写策略目标和五种动作标准，再保存。' : '复制完整参数和条件，修改后保存即可使用。' }), _jsx("button", { type: "button", disabled: !newName.trim(), onClick: () => {
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
                                                }, children: "\u521B\u5EFA\u5E76\u7F16\u8F91" }), _jsx("button", { type: "button", onClick: () => setCreating(false), children: "\u53D6\u6D88" })] }), previousConfig && _jsx("button", { type: "button", className: css.jevReuse, onClick: () => { setConfig(structuredClone(previousConfig)); setTemplateName(''); }, children: "\u8F7D\u5165\u4E0A\u6B21\u8FD0\u884C\u914D\u7F6E" }), _jsxs("div", { className: css.jevQuickStart, children: [_jsxs("label", { children: ["\u51B3\u7B56\u65B9\u5F0F", _jsxs("select", { value: config.decisionMode ?? 'strict', onChange: event => setConfig({ ...config, decisionMode: event.target.value }), children: [_jsx("option", { value: "jev", children: "Jev \u81EA\u4E3B\u51B3\u7B56\uFF08\u63A8\u8350\uFF09" }), _jsx("option", { value: "strict", children: "\u4E25\u683C\u89C4\u5219\u6A21\u5F0F" })] })] }), _jsx(JevInstrument, { config: config, onChange: setConfig }), _jsxs("div", { className: css.jevRunSummary, children: [_jsxs("strong", { children: [config.strategyName ?? '自定义配置', " \u00B7 \u6BCF\u7B14\u6700\u591A ", config.volume, " \u624B"] }), _jsxs("span", { children: [config.decisionIntervalSeconds ?? 30, " \u79D2\u51B3\u7B56 \u00B7 \u8FD0\u884C ", config.durationMinutes, " \u5206\u949F \u00B7 \u6700\u591A ", config.maxPlans, " \u4E2A\u5F00\u4ED3\u8BA1\u5212"] }), _jsxs("span", { children: ["\u6743\u76CA\u56DE\u843D ", config.maxEquityDrop, " \u5143\u6682\u505C \u00B7 ", config.autoHistory ? 'PandaData 行情自动准备' : '使用手动行情配置'] })] }), !status?.running && _jsx("button", { type: "submit", "data-primary": true, disabled: !config.symbol || !configured || !connected, children: busy === 'start' ? '正在准备行情并启动…' : '开始盯盘' })] }), _jsxs("details", { className: css.jevControls, open: tuning, onToggle: event => setTuning(event.currentTarget.open), children: [_jsxs("summary", { children: ["\u5FAE\u8C03\u6A21\u677F", _jsx("span", { children: "\u9891\u7387\u3001\u98CE\u63A7\u3001\u7B56\u7565\u4E0E\u884C\u60C5" })] }), _jsx("p", { className: css.jevFine, children: config.decisionMode === 'jev' ? '策略条件作为参考发送给 Jev，由模型判断机会。历史不足也会请求分析并产生用量，但不允许新开仓；账户、方向、手数和风控限制仍生效。' : '严格规则模式：程序条件先筛选，全部可交易动作被拦截时不请求 Jev。旧配置沿用此模式，可在上方切换。' }), _jsx("p", { className: css.jevFine, children: rules ? '成本假设：每手双边手续费及滑点 ' + rules.roundTripCostTicks + ' tick，另计实际点差。默认值是可修改的模拟参数，未经收益回测。' : '使用自定义文字策略；行情有效后由 Jev 按你填写的条件判断。' }), _jsxs("div", { className: css.watchFields, children: [fields.map(([key, label, min, max, step]) => _jsxs("label", { children: [label, _jsx("input", { type: "number", required: true, min: min, max: max, step: step, value: key === 'openingCooldownSeconds' ? config[key] ?? 300 : config[key], onChange: event => setConfig({ ...config, [key]: Number(event.target.value) }) })] }, key)), _jsxs("label", { children: ["\u5141\u8BB8\u5F00\u4ED3\u65B9\u5411", _jsxs("select", { value: config.allowedSide ?? 'both', onChange: event => setConfig({ ...config, allowedSide: event.target.value }), children: [_jsx("option", { value: "both", children: "\u591A\u7A7A\u5747\u53EF" }), _jsx("option", { value: "long_only", children: "\u53EA\u5F00\u591A" }), _jsx("option", { value: "short_only", children: "\u53EA\u5F00\u7A7A" })] })] }), _jsx(JevEvidenceSettings, { access: access, config: config, onChange: setConfig, onBusy: setHistoryBusy }), _jsx(JevStrategy, { config: config, onChange: setConfig })] }), _jsx("p", { className: css.jevFine, children: "\u51B7\u5374\u4ECE\u6BCF\u6B21\u751F\u6210\u8BA1\u5212\u8D77\u8BA1\u65F6\uFF0C\u4EC5\u9650\u5236\u4E0B\u4E00\u6B21\u5F00\u4ED3\uFF1B\u5E73\u4ED3\u6309\u51B3\u7B56\u95F4\u9694\u8BC4\u4F30\uFF0C\u4E0D\u5360\u5F00\u4ED3\u540D\u989D\u3002\u8FD0\u884C\u5230\u671F\u6216\u89E6\u53CA\u6743\u76CA\u505C\u6B62\u7EBF\u4ECD\u4F1A\u505C\u6B62\u76EF\u76D8\uFF0C\u5E73\u4ED3\u8BA1\u5212\u4ECD\u9700\u786E\u8BA4\u3002" }), _jsxs("div", { className: css.jevSaveTemplate, children: [_jsxs("label", { children: ["\u4FDD\u5B58\u6A21\u677F\u540D\u79F0", _jsx("input", { maxLength: 80, placeholder: "\u4F8B\u5982 \u6211\u7684\u5348\u540E\u533A\u95F4", value: templateName, onChange: event => setTemplateName(event.target.value) })] }), _jsx("button", { type: "button", onClick: () => { void saveTemplate(); }, children: saving ? '保存中…' : '保存为我的模板' })] }), _jsx("p", { className: css.jevFine, children: "\u540C\u540D\u4FDD\u5B58\u4F1A\u66F4\u65B0\u5DF2\u6709\u6A21\u677F\uFF0C\u53EF\u4E0D\u586B\u5B9E\u9645\u5408\u7EA6\u5148\u4FDD\u5B58\u3002\u6362\u54C1\u79CD\u65F6\u6838\u5BF9\u4EA4\u6613\u6240\u3001tick \u4E0E\u6210\u672C\uFF1B\u542F\u52A8\u524D\u5FC5\u987B\u586B\u5199\u67DC\u53F0\u652F\u6301\u7684\u5B9E\u9645\u5408\u7EA6\u3002" })] })] }), templateMessage && _jsx("p", { className: css.jevFine, children: templateMessage }), !configured && _jsx("p", { className: css.jevFine, children: "\u9996\u6B21\u4F7F\u7528\uFF1A\u5728\u4E0A\u65B9\u914D\u7F6E Jev \u5BC6\u94A5\uFF0C\u540E\u7EED\u65E0\u9700\u91CD\u590D\u586B\u5199\u3002" }), !connected && _jsx("p", { className: css.jevFine, children: "\u5148\u8FDE\u63A5\u4E0A\u65B9\u6BD4\u8D5B\u8D26\u6237\uFF0C\u518D\u5F00\u59CB\u76EF\u76D8\u3002" }), _jsx("p", { className: css.jevFine, children: "\u5F00\u59CB\u540E\u5411 TypeSafe \u53D1\u9001\u7B56\u7565\u3001\u884C\u60C5\u4E0E\u6301\u4ED3\u6458\u8981\u5E76\u4EA7\u751F API \u7528\u91CF\u3002\u6743\u76CA\u505C\u6B62\u7EBF\u4EC5\u6682\u505C\u76EF\u76D8\uFF0C\u4E0D\u81EA\u52A8\u6E05\u4ED3\uFF1B\u6BCF\u7B14\u8BA1\u5212\u4ECD\u7531\u4F60\u786E\u8BA4\u3002" })] }), status?.strategyNotices?.map(note => _jsx("p", { className: css.jevFine, children: note }, note)), (status?.running || status?.analyses?.length) ? _jsx(ContestWatchVisuals, { status: status, active: active }) : null, _jsxs("details", { className: css.jevHistory, children: [_jsx("summary", { children: "\u63A5\u53E3\u7528\u91CF\u4E0E\u8BCA\u65AD" }), _jsx(JevUsage, { access: access })] }), status && _jsxs("div", { className: css.watchSummary, children: [_jsxs("span", { children: ["\u672C\u6B21\u5F00\u4ED3\u8BA1\u5212 ", status.openingPlanCount ?? status.planCount, "/", status.config?.maxPlans ?? '—', " \u00B7 \u603B\u8BA1\u5212 ", status.planCount] }), status.running && status.openingCooldownUntil && status.openingCooldownUntil > Date.now() && _jsxs("span", { children: ["\u5F00\u4ED3\u51B7\u5374\u81F3 ", contestTime(status.openingCooldownUntil), "\uFF08\u4E0D\u5F71\u54CD\u5E73\u4ED3\u5224\u65AD\uFF09"] }), status.running && status.nextDecisionAt && _jsxs("span", { children: ["\u4E0B\u6B21\u51B3\u7B56\u6700\u65E9 ", contestTime(status.nextDecisionAt), "\uFF08\u9700\u6709\u6548\u6837\u672C\u3001\u65E0\u5F85\u5904\u7406\u8BA1\u5212\uFF09"] })] }), status?.events.length ? _jsxs("details", { children: [_jsxs("summary", { children: ["\u8FD0\u884C\u8BB0\u5F55\uFF08", status.events.length, "\uFF09"] }), _jsx("ol", { className: css.watchLog, children: [...status.events].reverse().map((entry, index) => _jsxs("li", { children: [_jsx("time", { children: contestTime(entry.time) }), " ", entry.message] }, `${entry.time}-${index}`)) })] }) : null] })] });
}
//# sourceMappingURL=ContestWatch.js.map