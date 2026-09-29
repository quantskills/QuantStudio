import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ChatCircleDotsIcon, DotsThreeIcon, PlusIcon, ClockCounterClockwiseIcon, WaveformIcon } from '@phosphor-icons/react';
import { asRecord, contestPhases, contestTime, display, useContest } from "./contest.js";
import { ContestPlans } from "./ContestPlans.js";
import { FlyPage } from "./FlyPage.js";
import { ContestWatch } from "./ContestWatch.js";
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
import './RefinedTrading.css';
const tabs = [['account', '资金'], ['positions', '持仓'], ['open-orders', '当前挂单'], ['orders', '委托记录'], ['trades', '成交记录'], ['ranking-me', '我的排名'], ['ranking', '排行榜'], ['settlements', '每日结算'], ['quote', '最新行情']];
const labels = { accountId: '账户', equity: '动态权益', totalProfit: '动态权益', availableFunds: '可用资金', margin: '保证金', riskRate: '风险度', dailyPnl: '当日盈亏', holdingPnl: '持仓盈亏', addProfit: '累计盈亏', cost: '手续费', contractCode: '实际合约', exchange: '交易所', symbol: '品种/合约', direction: '持仓方向', volume: '手数', position: '持仓', closable: '可平', sellable: '可平', openPrice: '开仓价', avgPrice: '均价', lastPrice: '最新价', latestPrice: '最新价', openMarketValue: '开仓市值', holdingPnlRate: '持仓收益率', orderId: '委托号', tradeId: '成交号', tradeDirectionText: '交易方向', tradeDirection: '方向代码', side: '买卖', offset: '开平', price: '价格', filledVolume: '已成手数', orderTime: '委托时间', tradeTime: '成交时间', status: '状态', statusText: '状态', rank: '名次', nickname: '昵称', score: '综合得分', totalScore: '综合得分', returnRate: '收益率', maxDrawdown: '最大回撤', netValue: '净值', settleDate: '结算日', quoteTime: '行情时间', changeRate: '涨跌幅', high: '日内高', low: '日内低', bidPrice1: '买一', askPrice1: '卖一', name: '名称', message: '说明' };
const valueLabels = { long: '多头', short: '空头', buy: '买', sell: '卖', open: '开仓', close: '平仓' };
Object.assign(labels, { playerName: '选手', netProfit: '累计净利', tradeCount: '交易笔数', dailyReturn: '当日收益率', cumNav: '累计净值', commission: '手续费', cumulativePnl: '累计盈亏', quantity: '手数', todayVolume: '今仓', total: '总人数', boardType: '榜单', period: '周期', bidVolume1: '买一量', askVolume1: '卖一量', openInterest: '持仓量' });
Object.assign(labels, { startCapital: '初始资金', staticProfit: '静态盈亏', frozenCapital: '冻结资金', positionPnl: '仓位盈亏', marketValue: '持仓市值', tradeDate: '交易日', tradingModes: '交易模式', tradingModeLabels: '交易模式' });
function cell(value, key) {
    if (/Rate$|Drawdown$|^dailyReturn$/.test(key) && typeof value === 'number')
        return `${(value * 100).toFixed(2)}%`;
    if (key === 'tradeDate' && /^\d{8}$/.test(String(value)))
        return String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    if (Array.isArray(value))
        return value.length ? value.map(item => display(item)).join('、') : '暂无';
    return valueLabels[String(value)] ?? display(value);
}
export function ContestPage({ access, flyAccess, openFly, researchSessions = [], openResearch, openModelSettings, onWorkspaceChange }) {
    if (!access)
        return _jsxs("section", { className: css.page, children: [_jsx("h1", { children: "\u300C\u5DC5\u5CF0\u4EA4\u6613\u8005\u300D\u5168\u56FD\u671F\u8D27\u6A21\u62DF\u8D5B" }), _jsx("p", { children: "\u6BD4\u8D5B\u529F\u80FD\u6682\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u65B0\u542F\u52A8\u5E94\u7528\u3002" })] });
    return _jsx(ConnectedContestPage, { access: access, flyAccess: flyAccess, openFly: openFly, researchSessions: researchSessions, openResearch: openResearch, openModelSettings: openModelSettings, onWorkspaceChange: onWorkspaceChange });
}
function ConnectedContestPage({ access, flyAccess, openFly, researchSessions = [], openResearch, openModelSettings, onWorkspaceChange }) {
    const { status, busy, error, run, refresh } = useContest(access);
    const [workspace, setWorkspace] = useState('entry');
    const [visited, setVisited] = useState({ jev: false, trader: false });
    const [researchMore, setResearchMore] = useState(false);
    const [researchMenuAbove, setResearchMenuAbove] = useState(false);
    const researchMoreRef = useRef(null);
    const researchMenuId = useId();
    const pageRef = useRef(null);
    useLayoutEffect(() => {
        if (!researchMore)
            return;
        const anchor = researchMoreRef.current?.getBoundingClientRect();
        const menu = researchMoreRef.current?.querySelector('.qs-research-menu')?.getBoundingClientRect();
        const page = pageRef.current?.getBoundingClientRect();
        if (!anchor || !menu || !page)
            return;
        const below = Math.min(window.innerHeight, page.bottom) - anchor.bottom;
        const above = anchor.top - Math.max(0, page.top);
        setResearchMenuAbove(below < menu.height + 16 && above > below);
    }, [researchMore]);
    useEffect(() => {
        if (!researchMore)
            return;
        const dismissOutside = (event) => {
            if (!researchMoreRef.current?.contains(event.target))
                setResearchMore(false);
        };
        const dismissEscape = (event) => {
            if (event.key !== 'Escape')
                return;
            setResearchMore(false);
            researchMoreRef.current?.querySelector('button')?.focus();
        };
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('keydown', dismissEscape);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('keydown', dismissEscape);
        };
    }, [researchMore]);
    function navigateWorkspace(next) {
        setResearchMore(false);
        setWorkspace(next);
        if (next !== 'entry')
            setVisited(current => ({ ...current, [next]: true }));
        pageRef.current?.scrollTo?.({ top: 0 });
    }
    useEffect(() => { onWorkspaceChange?.(workspace !== 'entry'); }, [workspace, onWorkspaceChange]);
    useEffect(() => { if (status && !status.enabled)
        setWorkspace('entry'); }, [status?.enabled]);
    const accountPanel = useRef(null);
    function revealAccount() {
        navigateWorkspace('entry');
        requestAnimationFrame(() => {
            if (!accountPanel.current)
                return;
            accountPanel.current.open = true;
            accountPanel.current.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
            accountPanel.current.querySelector('summary')?.focus({ preventScroll: true });
        });
    }
    const [tab, setTab] = useState('account');
    const [date, setDate] = useState('today'), [board, setBoard] = useState('live');
    const [symbol, setSymbol] = useState(''), [data, setData] = useState();
    const [loading, setLoading] = useState(false), [dataError, setDataError] = useState();
    const request = useRef(0), checked = useRef(false);
    const queryController = useRef(undefined);
    const connected = status?.enabled && status.phase === 'connected';
    const canRead = connected && !['connect', 'disconnect', 'update', 'mode'].includes(busy);
    const recentResearch = status?.identity && researchSessions.filter(session => !session.archived && !session.parentSessionId
        && session.binding.purpose === 'contest' && session.binding.contest?.accountId === status.identity.accountId
        && session.binding.contest?.contestId === status.identity.contestId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const query = async (lastId) => {
        if (!connected || (tab === 'quote' && !symbol.trim()))
            return;
        const id = ++request.current;
        queryController.current?.abort();
        queryController.current = new AbortController();
        setLoading(true);
        setDataError(undefined);
        setData(undefined);
        try {
            const next = await waitForCompetition(signal => access.query({ kind: tab, ...(tab === 'quote' ? { symbol: symbol.trim() } : {}),
                ...(['orders', 'trades'].includes(tab) && date ? { date } : {}), ...(['ranking', 'ranking-me'].includes(tab) ? { board } : {}), ...(lastId ? { lastId } : {}) }, signal), '比赛数据查询', 30_000, queryController.current.signal);
            if (id === request.current)
                setData(next);
        }
        catch (error) {
            if (id === request.current)
                setDataError(error instanceof Error ? error.message : '查询失败。');
        }
        finally {
            if (id === request.current)
                setLoading(false);
        }
    };
    useEffect(() => {
        request.current++;
        setData(undefined);
        setDataError(undefined);
        setLoading(false);
        if (canRead && tab !== 'quote')
            void query();
        return () => { request.current++; queryController.current?.abort(); };
    }, [tab, date, board, canRead, status?.identity?.accountId, status?.identity?.contestId]);
    useEffect(() => {
        if (!status?.enabled || !status.cliVersion) {
            checked.current = false;
            return;
        }
        if (!connected || busy)
            return;
        if (checked.current)
            return;
        checked.current = true;
        void waitForCompetition(() => access.checkUpdate(), 'CLI 更新检查').then(refresh).catch(() => { });
    }, [status?.enabled, status?.cliVersion, connected, busy, access, refresh]);
    const enabled = status?.enabled ?? false;
    return _jsxs("section", { ref: pageRef, className: `${css.page} qs-contest-workspace`, "data-workspace": workspace, "aria-label": "\u671F\u8D27\u4EFF\u771F\u6BD4\u8D5B", children: [_jsxs("header", { className: css.header, hidden: workspace !== 'entry', children: [_jsxs("div", { children: [_jsx("span", { className: css.eyebrow, children: "\u6BD4\u8D5B / \u671F\u8D27\u6A21\u62DF\u8D5B" }), _jsx("h1", { children: "\u4F60\u7684\u4EA4\u6613\u7A7A\u95F4" }), _jsx("p", { children: "\u9009\u62E9\u5DE5\u4F5C\u53F0\uFF0C\u5F00\u59CB\u7814\u7A76\u4E0E\u4EA4\u6613\u3002" })] }), _jsxs("button", { type: "button", role: "switch", "aria-label": "\u6BD4\u8D5B\u6A21\u5F0F", "aria-checked": enabled, disabled: !status || busy === 'mode', className: css.switch, "data-enabled": enabled, onClick: () => { void run('mode', () => access.mode(!enabled)); }, children: [_jsx("span", { "aria-hidden": "true" }), enabled ? '比赛模式已开启' : '开启比赛模式'] })] }), workspace !== 'entry' && _jsxs("div", { className: "qs-workspace-breadcrumb", children: [_jsxs("button", { type: "button", onClick: () => navigateWorkspace('entry'), children: [_jsx(ArrowLeftIcon, { size: 15 }), "\u8FD4\u56DE\u6BD4\u8D5B\u9996\u9875"] }), _jsx("span", { children: "/" }), _jsx("span", { children: workspace === 'jev' ? 'JEV 盯盘' : 'AI 交易员' }), _jsxs("div", { className: "qs-workspace-account", children: [_jsx("button", { type: "button", onClick: revealAccount, children: connected ? `仿真账户 ${status?.identity?.accountId ?? ''}` : '连接比赛账户' }), status && _jsx(ContestPlans, { status: status, access: access, refresh: refresh, compact: true })] })] }), error && _jsxs("p", { className: css.error, role: "alert", children: [error, " ", _jsx("button", { type: "button", onClick: () => { void refresh(); }, children: "\u91CD\u65B0\u8BFB\u53D6\u72B6\u6001" })] }), !status ? _jsx("p", { role: "status", children: "\u8BFB\u53D6\u672C\u673A\u6BD4\u8D5B\u72B6\u6001\u2026" }) : !enabled ? _jsxs("div", { className: css.welcome, children: [_jsx("h2", { children: "\u51C6\u5907\u597D\u65F6\uFF0C\u518D\u8FDB\u5165\u6BD4\u8D5B\u3002" }), _jsx("p", { children: "\u5F00\u542F\u540E\u53EF\u8FDE\u63A5\u81EA\u5DF1\u7684\u53C2\u8D5B\u8D26\u6237\uFF0C\u67E5\u770B\u6301\u4ED3\u548C\u6218\u7EE9\uFF0C\u5E76\u4ECE\u8FD9\u91CC\u5F00\u59CB\u7814\u7A76\u3002" }), _jsx("p", { children: "\u666E\u901A\u5BF9\u8BDD\u3001\u6570\u636E\u3001\u6280\u80FD\u548C\u4E13\u5BB6\u7EE7\u7EED\u6309\u539F\u6709\u65B9\u5F0F\u4F7F\u7528\u3002" }), status.message && _jsx("p", { role: "status", children: status.message }), _jsx("a", { href: "https://www.pandaaiquant.com/contest/", target: "_blank", rel: "noreferrer", children: "\u67E5\u770B\u8D5B\u4E8B\u4E0E\u62A5\u540D \u2197" })] }) : _jsxs(_Fragment, { children: [_jsxs("div", { hidden: workspace !== 'entry', children: [_jsxs("section", { className: css.connection, "data-compact": connected || undefined, "aria-label": "\u6BD4\u8D5B\u8FDE\u63A5", children: [_jsxs("div", { children: [_jsx("strong", { className: css.connectionState, "data-connected": Boolean(connected), children: contestPhases[status.phase] }), (!connected || status.message) && _jsx("p", { role: "status", children: status.message || '首次连接将准备官方 CLI，再打开官网授权。' }), status.identity && _jsxs("small", { children: ["\u4EFF\u771F\u8D26\u6237 ", status.identity.accountId] })] }), _jsxs("div", { className: css.connectionTools, children: [_jsx(ContestPlans, { status: status, access: access, refresh: refresh, compact: true }), _jsxs("details", { className: css.accountActions, open: !connected, children: [_jsx("summary", { children: "\u8D26\u6237\u7BA1\u7406" }), _jsxs("div", { className: css.actions, children: [status.identity && _jsxs("small", { children: ["\u8D5B\u4E8B ", status.identity.contestId] }), status.cliVersion && _jsxs("small", { children: ["CLI ", status.cliVersion, status.updateAvailable ? ` · 可更新至 ${status.latestVersion}` : ''] }), _jsx("a", { href: "https://www.pandaaiquant.com/contest/", target: "_blank", rel: "noreferrer", children: "\u8D5B\u4E8B\u62A5\u540D \u2197" }), _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('connect', () => access.connect()); }, children: busy === 'connect' ? '连接中…' : connected ? '检查连接' : '连接比赛' }), status.cliVersion && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('check-update', () => access.checkUpdate()); }, children: "\u68C0\u67E5\u66F4\u65B0" }), status.updateAvailable && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('update', () => access.update()); }, children: busy === 'update' ? '更新中…' : '更新 CLI' }), connected && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('disconnect', () => access.disconnect()); }, children: "\u9000\u51FA\u8D26\u6237" })] })] })] })] }), _jsxs("div", { className: "qs-workspace-entries", "aria-label": "\u4EA4\u6613\u5DE5\u4F5C\u53F0\u5165\u53E3", children: [access.watch && _jsxs("button", { type: "button", className: "qs-workspace-entry", onClick: () => navigateWorkspace('jev'), children: [_jsx("span", { className: "qs-workspace-avatar", children: _jsx(WaveformIcon, { size: 27 }) }), _jsxs("span", { children: [_jsx("strong", { children: "JEV \u76EF\u76D8" }), _jsx("small", { children: "\u6309\u4F60\u7684\u7B56\u7565\u76EF\u76D8\uFF0C\u81EA\u9009\u786E\u8BA4\u6216\u81EA\u52A8\u4E0B\u5355\u3002" })] }), _jsx(ArrowRightIcon, { size: 21 })] }), (flyAccess || openFly) && _jsxs("button", { type: "button", className: "qs-workspace-entry", onClick: () => flyAccess ? navigateWorkspace('trader') : openFly?.(), children: [_jsx("span", { className: "qs-workspace-avatar", children: _jsx("span", { className: "qs-trader-orb" }) }), _jsxs("span", { children: [_jsx("strong", { children: "AI \u4EA4\u6613\u5458" }), _jsx("small", { children: "\u540C\u65F6\u8DDF\u8E2A\u591A\u4E2A\u5408\u7EA6\uFF0C\u81EA\u9009\u786E\u8BA4\u6216\u81EA\u52A8\u4E0B\u5355\u3002" })] }), _jsx(ArrowRightIcon, { size: 21 })] }), _jsxs("article", { className: "qs-workspace-research", "aria-label": "Ai\u8F85\u52A9", children: [_jsxs("button", { type: "button", className: "qs-workspace-entry", "aria-label": busy === 'research' ? '正在打开对话…' : '进入 AI 交易助手', disabled: !connected || Boolean(busy), onClick: () => { setResearchMore(false); void run('research', signal => access.startResearch(undefined, signal)); }, children: [_jsx("span", { className: "qs-workspace-avatar", children: _jsx(ChatCircleDotsIcon, { size: 27 }) }), _jsxs("span", { children: [_jsx("strong", { children: "Ai\u8F85\u52A9" }), _jsx("small", { children: busy === 'research' ? '正在打开对话…' : connected ? '查持仓、研究行情，把想法整理成交易计划。' : '连接比赛账户后，即可进入 AI 交易助手。' })] }), _jsx(ArrowRightIcon, { size: 21 })] }), _jsxs("div", { className: "qs-research-more", ref: researchMoreRef, onBlur: event => { if (!event.currentTarget.contains(event.relatedTarget))
                                                    setResearchMore(false); }, children: [_jsx("button", { type: "button", className: "qs-research-more-trigger", "aria-label": "\u66F4\u591A\u5BF9\u8BDD\u9009\u9879", title: "\u66F4\u591A\u5BF9\u8BDD\u9009\u9879", "aria-expanded": researchMore, "aria-controls": researchMenuId, onClick: () => setResearchMore(open => !open), children: _jsx(DotsThreeIcon, { size: 24 }) }), researchMore && _jsxs("div", { id: researchMenuId, className: "qs-research-menu", "data-above": researchMenuAbove, children: [_jsxs("button", { type: "button", disabled: !connected || Boolean(busy), onClick: () => { setResearchMore(false); void run('topic', signal => access.startResearch(true, signal)); }, children: [_jsx(PlusIcon, { size: 18 }), "\u65B0\u5EFA\u4E13\u9898\u5BF9\u8BDD"] }), recentResearch && openResearch && _jsxs("button", { type: "button", disabled: !connected || Boolean(busy), onClick: () => { setResearchMore(false); openResearch(recentResearch.sessionId); }, children: [_jsx(ClockCounterClockwiseIcon, { size: 18 }), "\u7EE7\u7EED\u6700\u8FD1\u5BF9\u8BDD"] }), recentResearch && _jsxs("div", { className: "qs-research-recent", children: [_jsx("small", { children: "\u6700\u8FD1\u5BF9\u8BDD" }), _jsx("span", { children: recentResearch.title || '比赛 · AI 交易助手' }), _jsx("small", { children: contestTime(recentResearch.updatedAt) })] })] })] })] })] }), _jsxs("details", { className: css.methodGuide, children: [_jsx("summary", { children: "JEV \u548C AI \u4EA4\u6613\u5458\u6709\u4EC0\u4E48\u533A\u522B\uFF1F" }), _jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: "JEV \u76EF\u76D8" }), "\u6309\u4F60\u8BBE\u7F6E\u7684\u7B56\u7565\u548C\u884C\u60C5\u4F5C\u5224\u65AD\uFF0C\u652F\u6301\u9010\u7B14\u786E\u8BA4\u6216\u81EA\u52A8\u4E0B\u5355\u3002"] }), _jsxs("p", { children: [_jsx("strong", { children: "AI \u4EA4\u6613\u5458" }), "\u53EF\u9009\u62E9 QS \u5927\u6A21\u578B\u6216\u672C\u5730\u795E\u7ECF\u6A21\u578B\uFF0C\u652F\u6301\u591A\u5408\u7EA6\u548C\u4E24\u79CD\u6267\u884C\u65B9\u5F0F\u3002"] }), _jsx("p", { children: "\u4E24\u8005\u5171\u7528\u6BD4\u8D5B\u8D26\u6237\uFF0C\u914D\u7F6E\u4E0E\u8FD0\u884C\u72B6\u6001\u72EC\u7ACB\u3002\u4E3A\u907F\u514D\u91CD\u590D\u64CD\u4F5C\u540C\u4E00\u8D26\u6237\uFF0CJEV \u76EF\u76D8\u8FD0\u884C\u65F6\uFF0CAI \u4EA4\u6613\u5458\u4F1A\u7B49\u5F85\u3002AI \u4EA4\u6613\u5458\u91CC\u7684\u300C\u751F\u6D3B\u300D\u53EF\u5355\u72EC\u4F53\u9A8C\u3002" })] })] }), _jsxs("details", { ref: accountPanel, className: css.contestDetails, "aria-label": "\u6BD4\u8D5B\u8BE6\u60C5", children: [_jsxs("summary", { children: [_jsx("h2", { children: "\u8D26\u6237\u4E0E\u8D5B\u51B5" }), _jsx("span", { children: "\u8D44\u91D1 \u00B7 \u6301\u4ED3 \u00B7 \u59D4\u6258 \u00B7 \u6210\u4EA4 \u00B7 \u6392\u540D" })] }), _jsx("p", { className: css.muted, children: "\u5F53\u524D\u6BD4\u8D5B\u8D26\u6237\u7684\u6574\u4F53\u6570\u636E\uFF0C\u5305\u542B\u5404\u7B56\u7565\u4E0E\u624B\u5DE5\u4EA4\u6613\u3002" }), connected ? _jsx(_Fragment, { children: _jsxs("section", { className: css.dataPanel, "aria-label": "\u6BD4\u8D5B\u8D26\u6237\u6570\u636E", children: [_jsx("div", { className: css.tabs, role: "tablist", "aria-label": "\u6BD4\u8D5B\u6570\u636E\u5206\u7C7B", children: tabs.map(([kind, label]) => _jsx("button", { type: "button", role: "tab", "aria-selected": tab === kind, onClick: () => setTab(kind), children: label }, kind)) }), _jsxs("div", { className: css.toolbar, children: [['orders', 'trades'].includes(tab) && _jsxs("label", { children: ["\u8BB0\u5F55\u8303\u56F4 ", _jsxs("select", { value: date, onChange: event => setDate(event.target.value), children: [_jsx("option", { value: "today", children: "\u4ECA\u5929" }), _jsx("option", { value: "", children: "\u6700\u8FD1\u8BB0\u5F55" })] })] }), ['ranking', 'ranking-me'].includes(tab) && _jsxs("label", { children: ["\u699C\u5355 ", _jsxs("select", { value: board, onChange: event => setBoard(event.target.value), children: [_jsx("option", { value: "live", children: "\u5B9E\u65F6\u699C" }), _jsx("option", { value: "settled", children: "\u7ED3\u7B97\u699C" })] })] }), tab === 'quote' && _jsxs("label", { children: ["\u54C1\u79CD\u6216\u5B9E\u9645\u5408\u7EA6 ", _jsx("input", { value: symbol, maxLength: 32, placeholder: "\u4F8B\u5982\uFF1A\u9EC4\u91D1\u3001rb2610", onChange: event => { request.current++; queryController.current?.abort(); setSymbol(event.target.value); setData(undefined); setLoading(false); }, onKeyDown: event => { if (event.key === 'Enter')
                                                                        void query(); } })] }), _jsx("button", { type: "button", disabled: loading || (tab === 'quote' && !symbol.trim()), onClick: () => { void query(); }, children: loading ? '读取中…' : '刷新数据' }), data && _jsxs("small", { children: ["\u8BFB\u53D6\u4E8E ", contestTime(data.fetchedAt), "\uFF08\u4E0A\u6D77\uFF09"] })] }), dataError && _jsx("p", { className: css.error, role: "alert", children: dataError }), loading && _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u6BD4\u8D5B\u6570\u636E\u2026" }), data && _jsx(ContestTable, { value: data.data }), data?.meta?.hasMore === true && typeof data.meta.nextLastId !== 'undefined' && _jsx("button", { type: "button", disabled: loading, onClick: () => { void query(String(data.meta?.nextLastId)); }, children: "\u4E0B\u4E00\u9875\u8BB0\u5F55" }), tab === 'quote' && !data && !loading && _jsx("p", { className: css.muted, children: "\u8F93\u5165\u4E00\u4E2A\u54C1\u79CD\u6216\u5B9E\u9645\u5408\u7EA6\uFF0C\u67E5\u8BE2\u6700\u65B0\u884C\u60C5\u5FEB\u7167\u3002" })] }) }) : _jsx("p", { className: css.muted, children: "\u8FDE\u63A5\u6BD4\u8D5B\u8D26\u6237\u540E\uFF0C\u53EF\u67E5\u770B\u8D44\u91D1\u3001\u6301\u4ED3\u3001\u6210\u4EA4\u3001\u6392\u540D\u53CA\u4EA4\u6613\u8BA1\u5212\u3002" })] })] }), visited.jev && access.watch && _jsx("div", { hidden: workspace !== 'jev', className: "qs-independent-workspace", "aria-label": "JEV \u72EC\u7ACB\u5DE5\u4F5C\u53F0", children: _jsx(ContestWatch, { accountId: status?.identity?.accountId, access: access.watch, connected: Boolean(connected), openModelSettings: openModelSettings }) }), visited.trader && flyAccess && _jsx("div", { hidden: workspace !== 'trader', className: "qs-independent-workspace", "aria-label": "AI \u4EA4\u6613\u5458\u72EC\u7ACB\u5DE5\u4F5C\u53F0", children: _jsx(FlyPage, { embedded: true, access: flyAccess, contest: access, openContest: revealAccount, openModelSettings: openModelSettings }) })] })] });
}
export function ContestTable({ value }) {
    if (Array.isArray(value)) {
        if (value.length === 0)
            return _jsx("p", { className: css.empty, children: "\u5F53\u524D\u6CA1\u6709\u8BB0\u5F55\u3002" });
        const rows = value.map(asRecord);
        const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => labels[key] || ['netProfit', 'profitRate', 'quantity', 'todayVolume'].includes(key));
        const columns = keys.length ? keys : Object.keys(rows[0] ?? {});
        return _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: columns.map(key => _jsx("th", { scope: "col", children: labels[key] ?? key }, key)) }) }), _jsx("tbody", { children: rows.map((row, index) => _jsx("tr", { children: columns.map(key => _jsx("td", { children: cell(row[key], key) }, key)) }, index)) })] }) });
    }
    const object = asRecord(value);
    if (object.ready === false)
        return _jsx("p", { className: css.empty, children: display(object.message ?? '暂无行情快照') });
    if (Array.isArray(object.items))
        return _jsx(ContestTable, { value: object.items });
    if (object.item && typeof object.item === 'object') {
        const { item, ...summary } = object;
        return _jsx(ContestTable, { value: { ...summary, ...asRecord(item) } });
    }
    return _jsx("dl", { className: css.metrics, children: Object.entries(object).filter(([key, val]) => key !== 'ready'
            && !(['tradingModes', 'tradingModeLabels'].includes(key) && Array.isArray(val) && val.length === 0)
            && !(key === 'tradingModes' && Array.isArray(object.tradingModeLabels) && object.tradingModeLabels.length > 0))
            .map(([key, val]) => _jsxs("div", { children: [_jsx("dt", { children: labels[key] ?? key }), _jsx("dd", { children: cell(val, key) })] }, key)) });
}
//# sourceMappingURL=ContestPage.js.map