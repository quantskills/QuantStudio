import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { asRecord, contestPhases, contestTime, display, useContest } from "./contest.js";
import { ContestPlans } from "./ContestPlans.js";
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
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
export function ContestPage({ access, researchSessions = [], openResearch }) {
    if (!access)
        return _jsxs("section", { className: css.page, children: [_jsx("h1", { children: "\u300C\u5DC5\u5CF0\u4EA4\u6613\u8005\u300D\u5168\u56FD\u671F\u8D27\u6A21\u62DF\u8D5B" }), _jsx("p", { children: "\u6BD4\u8D5B\u529F\u80FD\u6682\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u65B0\u542F\u52A8\u5E94\u7528\u3002" })] });
    return _jsx(ConnectedContestPage, { access: access, researchSessions: researchSessions, openResearch: openResearch });
}
function ConnectedContestPage({ access, researchSessions = [], openResearch }) {
    const { status, busy, error, run, refresh } = useContest(access);
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
    return _jsxs("section", { className: css.page, "aria-label": "\u671F\u8D27\u4EFF\u771F\u6BD4\u8D5B", children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("span", { className: css.eyebrow, children: "PANDAAI \u00B7 \u6BD4\u8D5B\u5DE5\u4F5C\u53F0" }), _jsx("h1", { children: "\u300C\u5DC5\u5CF0\u4EA4\u6613\u8005\u300D\u5168\u56FD\u671F\u8D27\u6A21\u62DF\u8D5B" }), _jsx("p", { children: "\u7814\u7A76\u3001\u9884\u6F14\u3001\u786E\u8BA4\uFF0C\u8DDF\u8E2A\u6BCF\u4E00\u7B14\u4EA4\u6613\u3002" })] }), _jsxs("button", { type: "button", role: "switch", "aria-label": "\u6BD4\u8D5B\u6A21\u5F0F", "aria-checked": enabled, disabled: !status || busy === 'mode', className: css.switch, "data-enabled": enabled, onClick: () => { void run('mode', () => access.mode(!enabled)); }, children: [_jsx("span", { "aria-hidden": "true" }), enabled ? '比赛模式已开启' : '开启比赛模式'] })] }), error && _jsxs("p", { className: css.error, role: "alert", children: [error, " ", _jsx("button", { type: "button", onClick: () => { void refresh(); }, children: "\u91CD\u65B0\u8BFB\u53D6\u72B6\u6001" })] }), !status ? _jsx("p", { role: "status", children: "\u8BFB\u53D6\u672C\u673A\u6BD4\u8D5B\u72B6\u6001\u2026" }) : !enabled ? _jsxs("div", { className: css.welcome, children: [_jsx("h2", { children: "\u51C6\u5907\u597D\u65F6\uFF0C\u518D\u8FDB\u5165\u6BD4\u8D5B\u3002" }), _jsx("p", { children: "\u5F00\u542F\u540E\u53EF\u8FDE\u63A5\u81EA\u5DF1\u7684\u53C2\u8D5B\u8D26\u6237\uFF0C\u67E5\u770B\u6301\u4ED3\u548C\u6218\u7EE9\uFF0C\u5E76\u4ECE\u8FD9\u91CC\u5F00\u59CB\u7814\u7A76\u3002" }), _jsx("p", { children: "\u666E\u901A\u5BF9\u8BDD\u3001\u6570\u636E\u3001\u6280\u80FD\u548C\u4E13\u5BB6\u7EE7\u7EED\u6309\u539F\u6709\u65B9\u5F0F\u4F7F\u7528\u3002" }), status.message && _jsx("p", { role: "status", children: status.message }), _jsx("a", { href: "https://www.pandaaiquant.com/contest/", target: "_blank", rel: "noreferrer", children: "\u67E5\u770B\u8D5B\u4E8B\u4E0E\u62A5\u540D \u2197" })] }) : _jsxs(_Fragment, { children: [_jsxs("section", { className: css.connection, "aria-label": "\u6BD4\u8D5B\u8FDE\u63A5", children: [_jsxs("div", { children: [_jsx("strong", { children: contestPhases[status.phase] }), _jsx("p", { role: "status", children: status.message || '首次连接将准备官方 CLI，再打开官网授权。' }), status.identity && _jsxs("small", { children: ["\u4EFF\u771F\u8D26\u6237 ", status.identity.accountId, " \u00B7 \u8D5B\u4E8B ", status.identity.contestId] }), status.cliVersion && _jsxs("small", { children: ["CLI ", status.cliVersion, status.updateAvailable ? ` · 可更新至 ${status.latestVersion}` : ''] })] }), _jsxs("div", { className: css.actions, children: [_jsx("a", { href: "https://www.pandaaiquant.com/contest/", target: "_blank", rel: "noreferrer", children: "\u8D5B\u4E8B\u62A5\u540D \u2197" }), _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('connect', () => access.connect()); }, children: busy === 'connect' ? '连接中…' : connected ? '检查连接' : '连接比赛' }), status.cliVersion && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('check-update', () => access.checkUpdate()); }, children: "\u68C0\u67E5\u66F4\u65B0" }), status.updateAvailable && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('update', () => access.update()); }, children: busy === 'update' ? '更新中…' : '更新 CLI' }), connected && _jsx("button", { type: "button", disabled: Boolean(busy), onClick: () => { void run('disconnect', () => access.disconnect()); }, children: "\u9000\u51FA\u8D26\u6237" })] })] }), _jsxs("section", { className: css.assistant, "aria-label": "AI \u4EA4\u6613\u52A9\u624B", children: [_jsxs("div", { className: css.assistantHeading, children: [_jsxs("div", { children: [_jsx("h2", { children: "\u8BA9 AI \u534F\u52A9\u4F60\u7684\u6BD4\u8D5B\u4EA4\u6613" }), _jsx("p", { children: "\u9ED8\u8BA4\u7EE7\u7EED\u672C\u8D26\u6237\u4E3B\u5BF9\u8BDD\uFF0C\u5148\u5DE1\u68C0\u8D44\u91D1\u3001\u6301\u4ED3\u4E0E\u59D4\u6258\uFF0C\u518D\u7814\u7A76\u3001\u9884\u6F14\uFF0C\u7531\u4F60\u786E\u8BA4\u63D0\u4EA4\u3002" })] }), _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", "data-primary": true, disabled: !connected || Boolean(busy), onClick: () => { void run('research', signal => access.startResearch(undefined, signal)); }, children: busy === 'research' ? '正在打开对话…' : '进入 AI 交易助手' }), _jsx("button", { type: "button", disabled: !connected || Boolean(busy), onClick: () => { void run('topic', signal => access.startResearch(true, signal)); }, children: "\u65B0\u5EFA\u4E13\u9898\u5BF9\u8BDD" }), recentResearch && openResearch && _jsx("button", { type: "button", disabled: !connected || Boolean(busy), onClick: () => openResearch(recentResearch.sessionId), children: "\u7EE7\u7EED\u6700\u8FD1\u5BF9\u8BDD" })] })] }), _jsxs("ol", { className: css.steps, "aria-label": "AI \u4EA4\u6613\u6B65\u9AA4", children: [_jsxs("li", { children: [_jsx("b", { children: "1" }), "\u5728\u5BF9\u8BDD\u4E2D\u63D0\u51FA\u9700\u6C42"] }), _jsxs("li", { children: [_jsx("b", { children: "2" }), "\u9009\u62E9\u65B9\u6848\u5E76\u9884\u6F14"] }), _jsxs("li", { children: [_jsx("b", { children: "3" }), "\u6838\u5BF9\u8BA1\u5212\uFF0C\u786E\u8BA4\u6267\u884C"] })] }), _jsx("p", { children: connected ? '可以这样问：查看我的持仓，分析下一步操作，先给出建议。' : '连接比赛账户后，即可进入 AI 交易助手。' }), recentResearch && _jsxs("p", { className: css.recent, children: ["\u6700\u8FD1\u5BF9\u8BDD\uFF1A", recentResearch.title || '比赛 · AI 交易助手', " \u00B7 ", contestTime(recentResearch.updatedAt)] })] }), connected && _jsxs(_Fragment, { children: [_jsxs("section", { className: css.dataPanel, "aria-label": "\u6BD4\u8D5B\u8D26\u6237\u6570\u636E", children: [_jsx("div", { className: css.tabs, role: "tablist", "aria-label": "\u6BD4\u8D5B\u6570\u636E\u5206\u7C7B", children: tabs.map(([kind, label]) => _jsx("button", { type: "button", role: "tab", "aria-selected": tab === kind, onClick: () => setTab(kind), children: label }, kind)) }), _jsxs("div", { className: css.toolbar, children: [['orders', 'trades'].includes(tab) && _jsxs("label", { children: ["\u8BB0\u5F55\u8303\u56F4 ", _jsxs("select", { value: date, onChange: event => setDate(event.target.value), children: [_jsx("option", { value: "today", children: "\u4ECA\u5929" }), _jsx("option", { value: "", children: "\u6700\u8FD1\u8BB0\u5F55" })] })] }), ['ranking', 'ranking-me'].includes(tab) && _jsxs("label", { children: ["\u699C\u5355 ", _jsxs("select", { value: board, onChange: event => setBoard(event.target.value), children: [_jsx("option", { value: "live", children: "\u5B9E\u65F6\u699C" }), _jsx("option", { value: "settled", children: "\u7ED3\u7B97\u699C" })] })] }), tab === 'quote' && _jsxs("label", { children: ["\u54C1\u79CD\u6216\u5B9E\u9645\u5408\u7EA6 ", _jsx("input", { value: symbol, maxLength: 32, placeholder: "\u4F8B\u5982\uFF1A\u9EC4\u91D1\u3001rb2610", onChange: event => { request.current++; queryController.current?.abort(); setSymbol(event.target.value); setData(undefined); setLoading(false); }, onKeyDown: event => { if (event.key === 'Enter')
                                                            void query(); } })] }), _jsx("button", { type: "button", disabled: loading || (tab === 'quote' && !symbol.trim()), onClick: () => { void query(); }, children: loading ? '读取中…' : '刷新数据' }), data && _jsxs("small", { children: ["\u8BFB\u53D6\u4E8E ", contestTime(data.fetchedAt), "\uFF08\u4E0A\u6D77\uFF09"] })] }), dataError && _jsx("p", { className: css.error, role: "alert", children: dataError }), loading && _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u6BD4\u8D5B\u6570\u636E\u2026" }), data && _jsx(ContestTable, { value: data.data }), data?.meta?.hasMore === true && typeof data.meta.nextLastId !== 'undefined' && _jsx("button", { type: "button", disabled: loading, onClick: () => { void query(String(data.meta?.nextLastId)); }, children: "\u4E0B\u4E00\u9875\u8BB0\u5F55" }), tab === 'quote' && !data && !loading && _jsx("p", { className: css.muted, children: "\u8F93\u5165\u4E00\u4E2A\u54C1\u79CD\u6216\u5B9E\u9645\u5408\u7EA6\uFF0C\u67E5\u8BE2\u6700\u65B0\u884C\u60C5\u5FEB\u7167\u3002" })] }), _jsx(ContestPlans, { status: status, access: access, refresh: refresh })] })] })] });
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