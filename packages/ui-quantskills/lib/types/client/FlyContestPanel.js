import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowRightIcon, AtomIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { FlyHistory, marketReadiness } from "./fly/FlyHistory.js";
import { contestTime, planStates } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
export function sameFlyContest(state, contest) {
    const own = state?.binding?.identity, current = contest?.identity;
    return contest?.phase === 'connected' && !!own && !!current
        && own.contestId === current.contestId && own.accountId === current.accountId;
}
const amount = (value) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const fillAction = (fill) => fill.offset === '0' ? (fill.direction === '0' ? '开多' : '开空') : fill.direction === '0' ? '平空' : '平多';
export function FlyContestPanel({ access, contest, openFly, variant = 'detail', available = true }) {
    const [expanded, setExpanded] = useState(false), contentId = useId(), revision = useRef(0);
    const [runtime, setRuntime] = useState();
    const [snapshot, setSnapshot] = useState();
    const [error, setError] = useState('');
    useEffect(() => {
        if (!access)
            return;
        let disposed = false, timer;
        const poll = async () => {
            const version = revision.current;
            try {
                const next = await waitForCompetition(() => access.status(), 'AI 交易员运行状态', 15_000);
                if (disposed || version !== revision.current)
                    return;
                setRuntime(next);
                if (next.installed && next.running) {
                    const state = await waitForCompetition(() => access.request({ path: 'state' }), 'AI 交易员交易状态', 15_000);
                    const statistics = sameFlyContest(state, contest)
                        ? await waitForCompetition(() => access.request({ path: 'statistics' }), 'AI 交易员成交统计', 15_000) : undefined;
                    if (disposed || version !== revision.current)
                        return;
                    setSnapshot({ state, statistics, at: Date.now() });
                }
                else
                    setSnapshot(undefined);
                setError('');
            }
            catch (cause) {
                if (!disposed && version === revision.current)
                    setError(cause instanceof Error ? cause.message : 'AI 交易员状态暂不可用');
            }
            finally {
                if (!disposed)
                    timer = setTimeout(() => void poll(), 3000);
            }
        };
        void poll();
        return () => { disposed = true; revision.current++; clearTimeout(timer); };
    }, [access, contest?.phase, contest?.identity?.accountId, contest?.identity?.contestId]);
    const state = snapshot?.state, statistics = snapshot?.statistics;
    const matched = sameFlyContest(state, contest);
    const receipts = matched ? contest?.plans.filter(plan => plan.sessionId.startsWith('fly:') && plan.identity.accountId === contest.identity?.accountId
        && plan.identity.contestId === contest.identity?.contestId) ?? [] : [];
    const pending = receipts.filter(plan => ['executing', 'queued', 'submitted', 'unknown', 'partial'].includes(plan.status));
    const ready = Boolean(state && (state.settings.decision_engine === 'llm' || state.environment.brain_ready));
    const preparing = runtime?.installing || state?.environment.progress.status === 'running';
    const mode = state?.control.paused ? '已暂停' : state?.control.trading ? state.control.close_only ? '仅自动平仓' : '自动交易运行中' : state?.settings.life_validation ? '生活验证 · 观察中' : '自动交易已暂停';
    const message = !access ? 'AI 交易员服务尚未连接，请重启 QuantStudio。' : !runtime || (runtime.installed && runtime.running && !state) ? '正在读取AI 交易员状态…'
        : !runtime.supported ? '当前AI 交易员版本支持 Windows。' : !ready ? preparing ? '运行环境正在准备，可进入AI 交易员查看进度。' : '交易环境尚未准备。进入 AI 交易员可完成配置，也可以先体验生命花园。'
            : contest?.phase !== 'connected' ? '请先在上方连接比赛账户。'
                : state?.binding && !matched ? '此AI 交易员属于另一个比赛账户。请切回原账户后查看交易，不会混用两边的成交。'
                    : !matched ? '进入AI 交易员设置选择实际合约并连接比赛行情。' : `${state?.name || '小果'} · ${mode} · ${state?.connection?.message || '账户状态待确认'}`;
    if (variant === 'entry')
        return _jsxs("article", { className: css.entryCard, "aria-label": "AI \u4EA4\u6613\u5458\u5165\u53E3", children: [_jsxs("div", { className: css.entryTop, children: [_jsx("span", { className: css.entryIcon, children: _jsx(AtomIcon, { size: 25 }) }), _jsx("span", { children: "\u5927\u6A21\u578B / \u795E\u7ECF\u51B3\u7B56" })] }), _jsx("h3", { children: "AI \u4EA4\u6613\u5458" }), _jsx("p", { className: css.entryDescription, children: "\u9009\u62E9\u5927\u6A21\u578B\u6216\u672C\u5730\u795E\u7ECF\u6A21\u578B\uFF0C\u540C\u65F6\u8DDF\u8E2A\u591A\u4E2A\u5408\u7EA6\uFF0C\u901A\u8FC7\u6BD4\u8D5B CLI \u6267\u884C\u4EA4\u6613\u5E76\u67E5\u770B\u56DE\u6267\u3002" }), _jsxs("div", { className: css.entryStatus, "data-active": Boolean(matched && state?.control.trading && !state.control.paused && !error), children: [_jsx("i", { "aria-hidden": "true" }), !access ? '服务未连接' : error ? '状态待同步' : matched ? `${mode}${pending.length ? ` · ${pending.length} 笔处理中` : ''}` : !runtime ? '正在读取状态' : preparing ? '正在准备交易环境' : !ready ? '交易环境待准备 · 生活可直接体验' : state?.binding ? '绑定了其他比赛账户' : '交易账户待连接'] }), _jsxs("button", { type: "button", className: css.entryAction, disabled: !available, onClick: openFly, children: ["\u8FDB\u5165 AI \u4EA4\u6613\u5458", _jsx(ArrowRightIcon, { size: 17 })] }), _jsx("small", { className: css.entryHint, children: "\u4EA4\u6613 \u00B7 \u751F\u6D3B \u00B7 \u8868\u73B0 \u00B7 \u8BB0\u5F55" })] });
    return _jsxs("section", { className: `${css.assistant} ${css.flyModule}`, "aria-label": "AI \u4EA4\u6613\u5458\u6BD4\u8D5B\u6A21\u5757", children: [_jsxs("div", { className: css.assistantHeading, children: [_jsxs("div", { children: [_jsx("span", { className: css.eyebrow, children: "AI TRADER / \u671F\u8D27\u6A21\u62DF\u4EA4\u6613" }), _jsx("h2", { children: _jsxs("button", { type: "button", className: css.watchToggle, "aria-expanded": expanded, "aria-controls": contentId, onClick: () => setExpanded(value => !value), children: ["AI \u4EA4\u6613\u5458 ", _jsx("span", { children: expanded ? '▾ 收起' : '▸ 展开' })] }) }), _jsx("p", { children: message })] }), _jsx("button", { type: "button", onClick: openFly, children: "\u8FDB\u5165 AI \u4EA4\u6613\u5458" })] }), matched && _jsxs("div", { className: css.flySummary, "aria-label": "AI \u4EA4\u6613\u5458\u4EA4\u6613\u6458\u8981", children: [_jsx("span", { children: error ? '状态待同步' : mode }), _jsxs("span", { children: ["\u5904\u7406\u4E2D ", _jsx("b", { children: pending.length })] }), _jsxs("span", { children: ["\u5F53\u65E5\u6210\u4EA4 ", _jsx("b", { children: statistics?.summary.fill_count ?? '—' })] }), _jsxs("span", { children: ["\u5F53\u65E5\u5DF2\u5B9E\u73B0\u6BDB\u76C8\u4E8F ", _jsx("b", { children: amount(statistics?.summary.realized_gross) })] })] }), error && _jsxs("p", { className: css.error, role: "alert", children: ["\u540C\u6B65\u5931\u8D25\uFF0C", snapshot ? `当前为 ${contestTime(snapshot.at)} 的数据。` : '暂无法读取数据。', error] }), _jsx("div", { id: contentId, hidden: !expanded, children: matched ? _jsxs("div", { className: css.flyActivity, children: [_jsxs("small", { children: ["\u4E0EAI \u4EA4\u6613\u5458\u5171\u7528\u5B9E\u65F6\u72B6\u6001\uFF0C\u6BCF 3 \u79D2\u540C\u6B65\uFF1B\u6700\u8FD1\u540C\u6B65 ", snapshot ? contestTime(snapshot.at) : '—', "\u3002\u4FE1\u53F7\u89E6\u53D1\u540E\u81EA\u52A8\u63D0\u4EA4\uFF0C\u7ED3\u679C\u4EE5\u67DC\u53F0\u56DE\u6267\u4E3A\u51C6\u3002"] }), _jsx(FlyHistory, { history: state?.history, error: state?.history_error, markets: state?.markets ?? [], enabled: !!access && !!state?.settings.instruments.length, onRefresh: async () => {
                                if (!access)
                                    return;
                                const version = ++revision.current;
                                const result = await waitForCompetition(() => access.request({ path: 'control', body: { action: 'history' } }), '历史数据获取', 15_000);
                                if (version === revision.current)
                                    setSnapshot(current => current ? { ...current, state: { ...current.state, history: result.history } } : current);
                            } }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "\u5408\u7EA6\u884C\u60C5\u4E0E\u6BD4\u8D5B\u8D26\u6237\u6301\u4ED3" }), state?.markets?.length ? _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5B9E\u9645\u5408\u7EA6" }), _jsx("th", { children: "\u884C\u60C5\u72B6\u6001" }), _jsx("th", { children: "\u591A\u5934 / \u7A7A\u5934\uFF08\u624B\uFF09" })] }) }), _jsx("tbody", { children: state.markets.map(market => _jsxs("tr", { children: [_jsx("td", { children: market.symbol || market.product }), _jsx("td", { children: marketReadiness[market.readiness] || '状态待确认' }), _jsx("td", { children: market.quote_at ? `${market.long ?? '—'} / ${market.short ?? '—'}` : '待同步' })] }, market.product)) })] }) }) : _jsx("p", { children: "\u5C1A\u672A\u9009\u62E9\u5B9E\u9645\u5408\u7EA6\uFF0C\u8BF7\u8FDB\u5165AI \u4EA4\u6613\u5458\u8BBE\u7F6E\u3002" }), _jsx("small", { children: "\u6301\u4ED3\u4E3A\u6240\u9009\u5408\u7EA6\u7684\u6BD4\u8D5B\u8D26\u6237\u6301\u4ED3\uFF0C\u53EF\u80FD\u5305\u542B\u5176\u4ED6\u7B56\u7565\u6216\u624B\u5DE5\u4EA4\u6613\u3002" })] }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "\u81EA\u52A8\u4EA4\u6613\u56DE\u6267" }), receipts.length ? _jsxs(_Fragment, { children: [receipts.slice(-5).reverse().map(plan => _jsxs("p", { children: [plan.summary, " \u00B7 ", plan.status === 'prepared' ? '尚未提交' : planStates[plan.status], " \u00B7 ", contestTime(plan.createdAt)] }, plan.id)), _jsx("button", { type: "button", onClick: openFly, children: "\u67E5\u770B\u4EA4\u6613\u8BB0\u5F55" })] }) : _jsx("p", { children: "\u6682\u65E0 AI \u4EA4\u6613\u5458\u59D4\u6258\u8BB0\u5F55\u3002" })] }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "AI \u4EA4\u6613\u5458\u5F53\u65E5\u6700\u8FD1\u6210\u4EA4" }), statistics?.fills.length ? _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65F6\u95F4" }), _jsx("th", { children: "\u5408\u7EA6" }), _jsx("th", { children: "\u64CD\u4F5C" }), _jsx("th", { children: "\u624B\u6570" }), _jsx("th", { children: "\u6210\u4EA4\u4EF7" }), _jsx("th", { children: "\u6210\u4EA4\u7F16\u53F7" })] }) }), _jsx("tbody", { children: statistics.fills.slice(0, 5).map(fill => _jsxs("tr", { children: [_jsx("td", { children: fill.time }), _jsx("td", { children: fill.symbol }), _jsx("td", { children: fillAction(fill) }), _jsx("td", { children: fill.volume }), _jsx("td", { children: fill.price }), _jsx("td", { children: fill.trade_id })] }, fill.seq)) })] }) }) : _jsx("p", { children: statistics ? '暂无归属于AI 交易员的柜台确认成交。' : '成交统计待同步。' })] }), _jsx("small", { children: statistics?.note || '盈亏仅按AI 交易员确认成交计算毛额；账户整体费用与净盈亏在上方比赛账户数据查看。' })] }) : _jsxs("div", { className: css.flyConnection, children: [_jsx("p", { children: state?.environment.progress.message || runtime?.message || message }), _jsx("p", { children: "\u5B89\u88C5\u3001\u5408\u7EA6\u914D\u7F6E\u53CA\u81EA\u52A8\u4EA4\u6613\u63A7\u5236\u5728AI \u4EA4\u6613\u5458\u4E2D\u7EDF\u4E00\u7BA1\u7406\u3002" })] }) })] });
}
//# sourceMappingURL=FlyContestPanel.js.map