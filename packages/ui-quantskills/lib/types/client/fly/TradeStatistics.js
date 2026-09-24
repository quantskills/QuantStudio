import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { flyFetch } from "./transport.js";
import { useEffect, useState } from 'react';
import ResizableNativeTable from "./FlyTable.js";
const fmt = (v) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const pnl = (v) => _jsxs("span", { className: v == null || v === 0 ? '' : v > 0 ? 'fv-profit' : 'fv-loss', children: [v != null && v > 0 ? '+' : '', fmt(v)] });
const action = (f) => f.offset === '0' ? (f.direction === '0' ? '买入开多' : '卖出开空') : `${f.direction === '0' ? '买入平空' : '卖出平多'}${f.offset === '3' ? ' · 平今' : f.offset === '4' ? ' · 平昨' : ''}`;
export function TradeStatistics() {
    const [data, setData] = useState();
    const [error, setError] = useState('');
    const [tab, setTab] = useState('summary');
    const [symbol, setSymbol] = useState('');
    const [page, setPage] = useState(0);
    useEffect(() => {
        let stopped = false;
        let timer;
        const refresh = async () => {
            try {
                const response = await flyFetch('/api/fly/v2/statistics');
                if (!response.ok)
                    throw new Error('统计暂未刷新，等待服务恢复');
                const result = await response.json();
                if (!stopped) {
                    setData(result);
                    setError('');
                }
            }
            catch (e) {
                if (!stopped)
                    setError(e instanceof Error ? e.message : '统计暂不可用');
            }
            if (!stopped)
                timer = setTimeout(() => void refresh(), 5000);
        };
        void refresh();
        return () => { stopped = true; clearTimeout(timer); };
    }, []);
    if (!data)
        return _jsx("div", { className: "fv-empty", children: error || '正在读取柜台成交与持仓…' });
    const fills = data.fills.filter(f => !symbol || f.symbol === symbol);
    const pages = Math.max(1, Math.ceil(fills.length / 20));
    const shownPage = Math.min(page, pages - 1);
    return _jsxs("section", { className: "fv-trade-statistics", "aria-label": "\u6210\u4EA4\u4E0E\u76C8\u4E8F\u7EDF\u8BA1", children: [_jsxs("div", { className: "fv-statistics-caption", children: ["PandaAI \u6A21\u62DF\u8D5B \u00B7 \u7EDF\u8BA1\u65E5\u671F ", data.day, " \u00B7 \u91D1\u989D\u5355\u4F4D\uFF1A\u5143 \u00B7 \u6BCF 5 \u79D2\u5237\u65B0"] }), error && _jsxs("p", { role: "status", className: "fv-runtime-note", children: [error, "\uFF0C\u4EE5\u4E0B\u4FDD\u7559\u4E0A\u6B21\u6570\u636E\u3002"] }), _jsxs("div", { className: "fv-pnl-cards", children: [_jsxs("div", { children: [_jsx("small", { children: "\u67DC\u53F0\u8D26\u6237\u6743\u76CA" }), _jsx("strong", { children: fmt(data.official.Balance) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u67DC\u53F0\u4ECA\u65E5\u51C0\u76C8\u4E8F" }), _jsx("strong", { children: pnl(data.official.day_net) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u67DC\u53F0\u4ECA\u65E5\u624B\u7EED\u8D39" }), _jsx("strong", { children: fmt(data.official.Commission) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u679C\u8747\u5DF2\u5B9E\u73B0\u6BDB\u76C8\u4E8F" }), _jsx("strong", { children: pnl(data.summary.realized_gross) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u679C\u8747\u6D6E\u76C8\u4F30\u7B97" }), _jsx("strong", { children: pnl(data.summary.floating_gross) })] }), _jsxs("div", { children: [_jsx("small", { children: "\u786E\u8BA4\u6210\u4EA4\u7B14\u6570" }), _jsx("strong", { children: data.summary.fill_count })] })] }), _jsxs("div", { className: "fv-statistics-toolbar", children: [_jsx("button", { type: "button", "aria-pressed": tab === 'summary', onClick: () => setTab('summary'), children: "\u76C8\u4E8F\u6C47\u603B" }), _jsxs("button", { type: "button", "aria-pressed": tab === 'fills', onClick: () => setTab('fills'), children: ["\u6210\u4EA4\u660E\u7EC6\uFF08", data.fills.length, "\uFF09"] }), tab === 'fills' && _jsxs("select", { "aria-label": "\u6210\u4EA4\u5408\u7EA6\u7B5B\u9009", value: symbol, onChange: e => { setSymbol(e.target.value); setPage(0); }, children: [_jsx("option", { value: "", children: "\u5168\u90E8\u5408\u7EA6" }), data.rows.map(r => _jsx("option", { children: r.symbol }, r.symbol))] })] }), _jsx("div", { className: "fv-statistics-scroll", children: tab === 'summary' ? _jsxs(ResizableNativeTable, { resizeStorageKey: "fly-pnl-summary", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5408\u7EA6" }), _jsx("th", { children: "\u5F00\u4ED3 / \u5E73\u4ED3\u624B\u6570" }), _jsx("th", { children: "\u5F53\u524D\u6301\u4ED3" }), _jsx("th", { children: "\u6301\u4ED3\u5747\u4EF7" }), _jsx("th", { children: "\u6700\u65B0\u4EF7" }), _jsx("th", { children: "\u5DF2\u5B9E\u73B0\u6BDB\u76C8\u4E8F" }), _jsx("th", { children: "\u6D6E\u76C8\u4F30\u7B97" }), _jsx("th", { children: "\u5408\u8BA1\u6BDB\u76C8\u4E8F" })] }) }), _jsx("tbody", { children: data.rows.map(r => _jsxs("tr", { children: [_jsx("td", { children: _jsx("button", { type: "button", className: "fv-contract-link", onClick: () => { setSymbol(r.symbol); setPage(0); setTab('fills'); }, children: r.symbol }) }), _jsxs("td", { children: [r.opening_lots, " / ", r.closing_lots] }), _jsx("td", { children: r.long || r.short ? `多 ${r.long} / 空 ${r.short}` : '空仓' }), _jsx("td", { children: r.long ? fmt(r.long_entry) : r.short ? fmt(r.short_entry) : '—' }), _jsxs("td", { children: [fmt(r.last_price), r.valuation_stale && _jsx("small", { children: "\u672B\u6B21\u62A5\u4EF7" })] }), _jsx("td", { children: pnl(r.realized_gross) }), _jsxs("td", { children: [pnl(r.floating_gross), !r.position_reconciled && _jsx("small", { children: "\u6301\u4ED3\u6838\u5BF9\u4E2D" })] }), _jsx("td", { children: pnl(r.total_gross) })] }, r.symbol)) })] }) : _jsxs(ResizableNativeTable, { resizeStorageKey: "fly-fill-details", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65F6\u95F4" }), _jsx("th", { children: "\u5408\u7EA6" }), _jsx("th", { children: "\u6210\u4EA4\u64CD\u4F5C" }), _jsx("th", { children: "\u624B\u6570" }), _jsx("th", { children: "\u6210\u4EA4\u4EF7" }), _jsx("th", { children: "\u5DF2\u5B9E\u73B0\u6BDB\u76C8\u4E8F" }), _jsx("th", { children: "\u6210\u4EA4\u7F16\u53F7" }), _jsx("th", { children: "\u795E\u7ECF\u51B3\u7B56" })] }) }), _jsxs("tbody", { children: [fills.slice(shownPage * 20, (shownPage + 1) * 20).map(f => _jsxs("tr", { children: [_jsxs("td", { children: [f.time, f.time_source === 'receipt' && _jsx("small", { children: "\u56DE\u62A5\u65F6\u95F4" })] }), _jsx("td", { children: f.symbol }), _jsx("td", { children: action(f) }), _jsx("td", { children: f.volume }), _jsx("td", { children: fmt(f.price) }), _jsxs("td", { children: [pnl(f.realized_gross), f.unmatched_closing_lots > 0 && _jsx("small", { children: "\u7F3A\u5C11\u5F00\u4ED3\u8BB0\u5F55" })] }), _jsx("td", { title: f.order, children: f.trade_id }), _jsx("td", { title: f.decision_id, children: f.decision_id.slice(0, 10) || '待核对' })] }, f.seq)), !fills.length && _jsx("tr", { children: _jsx("td", { colSpan: 8, children: "\u6240\u9009\u5408\u7EA6\u6682\u65E0\u67DC\u53F0\u6210\u4EA4\u8BB0\u5F55" }) })] })] }) }), tab === 'fills' && _jsxs("div", { className: "fv-statistics-pagination", children: [_jsxs("span", { children: [fills.length, " \u7B14 \u00B7 \u7B2C ", shownPage + 1, " / ", pages, " \u9875"] }), _jsx("button", { type: "button", disabled: shownPage === 0, onClick: () => setPage(shownPage - 1), children: "\u4E0A\u4E00\u9875" }), _jsx("button", { type: "button", disabled: shownPage + 1 >= pages, onClick: () => setPage(shownPage + 1), children: "\u4E0B\u4E00\u9875" })] }), _jsxs("small", { className: "fv-note", children: [data.note, " \u67DC\u53F0\u4ECA\u65E5\u51C0\u76C8\u4E8F\uFF1D\u67DC\u53F0\u5E73\u4ED3\u76C8\u4E8F\uFF0B\u6301\u4ED3\u76C8\u4E8F\uFF0D\u624B\u7EED\u8D39\uFF1B\u62A5\u4EF7\u4E0E\u67DC\u53F0\u5237\u65B0\u65F6\u95F4\u4E0D\u540C\uFF0C\u6570\u503C\u53EF\u80FD\u6682\u6709\u5DEE\u5F02\u3002"] })] });
}
//# sourceMappingURL=TradeStatistics.js.map
