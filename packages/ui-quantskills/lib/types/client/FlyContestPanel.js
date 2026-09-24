import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { FlyHistory, marketReadiness } from "./fly/FlyHistory.js";
import { contestTime } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
export function sameFlyContest(state, contest) {
    const own = state?.binding?.identity, current = contest?.identity;
    return contest?.phase === 'connected' && !!own && !!current
        && own.contestId === current.contestId && own.accountId === current.accountId;
}
const amount = (value) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const fillAction = (fill) => fill.offset === '0' ? (fill.direction === '0' ? '开多' : '开空') : fill.direction === '0' ? '平空' : '平多';
export function FlyContestPanel({ access, contest, openFly }) {
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
                const next = await waitForCompetition(() => access.status(), '果蝇运行状态', 15_000);
                if (disposed || version !== revision.current)
                    return;
                setRuntime(next);
                if (next.installed && next.running) {
                    const state = await waitForCompetition(() => access.request({ path: 'state' }), '果蝇交易状态', 15_000);
                    const statistics = sameFlyContest(state, contest)
                        ? await waitForCompetition(() => access.request({ path: 'statistics' }), '果蝇成交统计', 15_000) : undefined;
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
                    setError(cause instanceof Error ? cause.message : '果蝇状态暂不可用');
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
    const pending = matched ? contest?.plans.filter(plan => plan.sessionId.startsWith('fly:') && plan.identity.accountId === contest.identity?.accountId
        && plan.identity.contestId === contest.identity?.contestId && plan.status === 'prepared') ?? [] : [];
    const ready = Boolean(state?.environment.brain_ready && state.environment.blender_ready);
    const preparing = runtime?.installing || state?.environment.progress.status === 'running';
    const mode = state?.control.trading ? state.control.close_only ? '仅生成平仓计划' : '交易建议运行中' : state?.settings.life_validation ? '生活验证 · 观察中' : '观察中';
    const message = !access ? '果蝇服务尚未连接，请重启 QuantStudio。' : !runtime || (runtime.installed && runtime.running && !state) ? '正在读取果蝇状态…'
        : !runtime.supported ? '当前果蝇版本支持 Windows。' : !ready ? preparing ? '运行环境正在准备，可进入果蝇交易员查看进度。' : '运行环境尚未准备，进入果蝇交易员可一键准备。'
            : contest?.phase !== 'connected' ? '请先在上方连接比赛账户。'
                : state?.binding && !matched ? '此果蝇属于另一个比赛账户。请切回原账户后查看交易，不会混用两边的成交。'
                    : !matched ? '进入果蝇设置选择实际合约并连接比赛行情。' : `${state?.name || '小果'} · ${mode} · ${state?.connection?.message || '账户状态待确认'}`;
    return _jsxs("section", { className: `${css.assistant} ${css.flyModule}`, "aria-label": "\u679C\u8747\u4EA4\u6613\u5458\u6BD4\u8D5B\u6A21\u5757", children: [_jsxs("div", { className: css.assistantHeading, children: [_jsxs("div", { children: [_jsx("span", { className: css.eyebrow, children: "FLY / \u671F\u8D27\u6A21\u62DF\u4EA4\u6613" }), _jsx("h2", { children: _jsxs("button", { type: "button", className: css.watchToggle, "aria-expanded": expanded, "aria-controls": contentId, onClick: () => setExpanded(value => !value), children: ["\u679C\u8747\u4EA4\u6613\u5458 ", _jsx("span", { children: expanded ? '▾ 收起' : '▸ 展开' })] }) }), _jsx("p", { children: message })] }), _jsx("button", { type: "button", onClick: openFly, children: runtime && (!runtime.installed || state) && !ready && !preparing ? '准备果蝇交易员' : '进入果蝇交易员' })] }), matched && _jsxs("div", { className: css.flySummary, "aria-label": "\u679C\u8747\u4EA4\u6613\u6458\u8981", children: [_jsx("span", { children: error ? '状态待同步' : mode }), _jsxs("span", { children: ["\u5F85\u786E\u8BA4 ", _jsx("b", { children: pending.length })] }), _jsxs("span", { children: ["\u5F53\u65E5\u6210\u4EA4 ", _jsx("b", { children: statistics?.summary.fill_count ?? '—' })] }), _jsxs("span", { children: ["\u5F53\u65E5\u5DF2\u5B9E\u73B0\u6BDB\u76C8\u4E8F ", _jsx("b", { children: amount(statistics?.summary.realized_gross) })] })] }), error && _jsxs("p", { className: css.error, role: "alert", children: ["\u540C\u6B65\u5931\u8D25\uFF0C", snapshot ? `当前为 ${contestTime(snapshot.at)} 的数据。` : '暂无法读取数据。', error] }), _jsx("div", { id: contentId, hidden: !expanded, children: matched ? _jsxs("div", { className: css.flyActivity, children: [_jsxs("small", { children: ["\u4E0E\u679C\u8747\u4EA4\u6613\u5458\u5171\u7528\u5B9E\u65F6\u72B6\u6001\uFF0C\u6BCF 3 \u79D2\u540C\u6B65\uFF1B\u6700\u8FD1\u540C\u6B65 ", snapshot ? contestTime(snapshot.at) : '—', "\u3002\u6BCF\u7B14\u8BA1\u5212\u4ECD\u9700\u4F60\u9010\u7B14\u786E\u8BA4\u3002"] }), _jsx(FlyHistory, { history: state?.history, error: state?.history_error, markets: state?.markets ?? [], enabled: !!access && !!state?.settings.instruments.length, onRefresh: async () => {
                                if (!access)
                                    return;
                                const version = ++revision.current;
                                const result = await waitForCompetition(() => access.request({ path: 'control', body: { action: 'history' } }), '历史数据获取', 15_000);
                                if (version === revision.current)
                                    setSnapshot(current => current ? { ...current, state: { ...current.state, history: result.history } } : current);
                            } }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "\u5408\u7EA6\u884C\u60C5\u4E0E\u6BD4\u8D5B\u8D26\u6237\u6301\u4ED3" }), state?.markets?.length ? _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5B9E\u9645\u5408\u7EA6" }), _jsx("th", { children: "\u884C\u60C5\u72B6\u6001" }), _jsx("th", { children: "\u591A\u5934 / \u7A7A\u5934\uFF08\u624B\uFF09" })] }) }), _jsx("tbody", { children: state.markets.map(market => _jsxs("tr", { children: [_jsx("td", { children: market.symbol || market.product }), _jsx("td", { children: marketReadiness[market.readiness] || '状态待确认' }), _jsx("td", { children: market.quote_at ? `${market.long ?? '—'} / ${market.short ?? '—'}` : '待同步' })] }, market.product)) })] }) }) : _jsx("p", { children: "\u5C1A\u672A\u9009\u62E9\u5B9E\u9645\u5408\u7EA6\uFF0C\u8BF7\u8FDB\u5165\u679C\u8747\u8BBE\u7F6E\u3002" }), _jsx("small", { children: "\u6301\u4ED3\u4E3A\u6240\u9009\u5408\u7EA6\u7684\u6BD4\u8D5B\u8D26\u6237\u6301\u4ED3\uFF0C\u53EF\u80FD\u5305\u542B\u5176\u4ED6\u7B56\u7565\u6216\u624B\u5DE5\u4EA4\u6613\u3002" })] }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "\u5F85\u786E\u8BA4\u8BA1\u5212" }), pending.length ? _jsxs(_Fragment, { children: [pending.slice(0, 5).map(plan => _jsxs("p", { children: [plan.summary, " \u00B7 ", contestTime(plan.createdAt)] }, plan.id)), _jsx("button", { type: "button", onClick: openFly, children: "\u67E5\u770B\u5E76\u786E\u8BA4\u8BA1\u5212" })] }) : _jsx("p", { children: "\u6682\u65E0\u679C\u8747\u5F85\u786E\u8BA4\u8BA1\u5212\u3002" })] }), _jsxs("div", { className: css.flyList, children: [_jsx("h3", { children: "\u679C\u8747\u5F53\u65E5\u6700\u8FD1\u6210\u4EA4" }), statistics?.fills.length ? _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65F6\u95F4" }), _jsx("th", { children: "\u5408\u7EA6" }), _jsx("th", { children: "\u64CD\u4F5C" }), _jsx("th", { children: "\u624B\u6570" }), _jsx("th", { children: "\u6210\u4EA4\u4EF7" }), _jsx("th", { children: "\u6210\u4EA4\u7F16\u53F7" })] }) }), _jsx("tbody", { children: statistics.fills.slice(0, 5).map(fill => _jsxs("tr", { children: [_jsx("td", { children: fill.time }), _jsx("td", { children: fill.symbol }), _jsx("td", { children: fillAction(fill) }), _jsx("td", { children: fill.volume }), _jsx("td", { children: fill.price }), _jsx("td", { children: fill.trade_id })] }, fill.seq)) })] }) }) : _jsx("p", { children: statistics ? '暂无归属于果蝇的柜台确认成交。' : '成交统计待同步。' })] }), _jsx("small", { children: statistics?.note || '盈亏仅按果蝇确认成交计算毛额；账户整体费用与净盈亏在上方比赛账户数据查看。' })] }) : _jsxs("div", { className: css.flyConnection, children: [_jsx("p", { children: state?.environment.progress.message || runtime?.message || message }), _jsx("p", { children: "\u5B89\u88C5\u3001\u5408\u7EA6\u914D\u7F6E\u53CA\u4EA4\u6613\u5EFA\u8BAE\u63A7\u5236\u5728\u679C\u8747\u4EA4\u6613\u5458\u4E2D\u7EDF\u4E00\u7BA1\u7406\u3002" })] }) })] });
}
//# sourceMappingURL=FlyContestPanel.js.map