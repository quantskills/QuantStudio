import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { products } from '@deepseek-ai/dsh-quantskills-session/contracts';
import { flyFetch } from "./transport.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import ResizableNativeTable from "./FlyTable.js";
import './trade-analytics.css';
import { useChartPalette } from './useChartPalette';
const periodNames = { raw: '原始采样', '1m': '1 分钟', '3m': '3 分钟', '5m': '5 分钟', '1h': '1 小时', '1d': '日线' };
const dateInput = (day) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`;
const moveDay = (day, offset) => { const d = new Date(`${dateInput(day)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const names = Object.fromEntries(products.flatMap(p => [[p.product, p.name], [p.product.toUpperCase(), p.name]]));
const fmt = (v, digits = 2) => v == null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (v) => `${v != null && v > 0 ? '+' : ''}${fmt(v)}`;
const clock = (at) => at == null ? '尚未记录' : new Date(at * 1000).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
const stamp = (at) => at == null ? '尚未记录' : new Date(at * 1000).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
const tone = (value) => value == null || value === 0 ? '' : value > 0 ? 'positive' : 'negative';
function baseOption(colors) {
    return {
        animation: false, backgroundColor: 'transparent', color: [colors.equity, colors.profit, colors.loss],
        textStyle: { fontFamily: 'Inter, "Microsoft YaHei", sans-serif', color: colors.text, fontSize: 11 },
        aria: { enabled: true },
        tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: colors.surface, borderColor: colors.grid, textStyle: { color: colors.text, fontSize: 11 }, valueFormatter: value => typeof value === 'number' ? fmt(value) : String(value ?? '—') },
        grid: { left: 15, right: 23, top: 25, bottom: 25, containLabel: true },
        xAxis: { type: 'category', axisLine: { lineStyle: { color: colors.grid } }, axisTick: { show: false }, axisLabel: { color: colors.muted, hideOverlap: true } },
        yAxis: { type: 'value', scale: true, axisLabel: { color: colors.muted }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } } },
    };
}
function equityOption(points, field, period, bridge, gaps, multiDay, colors) {
    const data = [];
    const bridges = [];
    let previous;
    points.forEach(p => {
        if (p.gap_before && previous) {
            data.push([(previous.at + p.at) * 500, null]);
            if (bridge)
                bridges.push([previous.at * 1000, previous[field]], [p.at * 1000, p[field]], [p.at * 1000, null]);
        }
        data.push([p.at * 1000, p[field]]);
        if (p[field] != null)
            previous = p;
    });
    return {
        ...baseOption(colors),
        grid: { left: 18, right: 25, top: 25, bottom: 54, containLabel: true },
        xAxis: { type: 'time', minInterval: period === '1d' ? 86400000 : 0, axisLine: { lineStyle: { color: colors.grid } }, axisLabel: { color: colors.muted, hideOverlap: true, formatter: value => period === '1d' ? new Date(Number(value)).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : `${multiDay ? new Date(Number(value)).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) + '\n' : ''}${clock(Number(value) / 1000)}` } },
        yAxis: { type: 'value', scale: field !== 'cumulative_net', axisLabel: { color: colors.muted, formatter: value => field === 'Balance' || field === 'realized_equity' ? `${(value / 10000).toFixed(2)}万` : fmt(value, 0) }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } } },
        dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl' }, { type: 'slider', height: 17, bottom: 8, borderColor: colors.grid, textStyle: { color: colors.muted }, fillerColor: colors.grid, handleStyle: { color: colors.equity } }],
        series: [{ name: field === 'Balance' ? '账户权益（元）' : field === 'realized_equity' ? '固定基准＋累计平仓净盈亏（元）' : field === 'cumulative_net' ? '累计平仓净盈亏（已扣手续费 / 元）' : '距采样峰值（元）', type: 'line', data, step: field === 'cumulative_net' || field === 'realized_equity' ? 'end' : false, connectNulls: false, smooth: false, showSymbol: true, symbolSize: points.length < 3 ? 7 : 3,
                lineStyle: { width: 2, color: field !== 'drawdown' ? colors.equity : colors.loss }, itemStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss },
                areaStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss, opacity: .08 },
                markArea: ['raw', '1m', '3m', '5m'].includes(period) ? { silent: true, itemStyle: { color: colors.warning, opacity: .1 }, label: { color: colors.warning, fontSize: 10 }, data: gaps.map(g => [{ name: '无采样', xAxis: g.from * 1000 }, { xAxis: g.to * 1000 }]) } : { data: [] } },
            { name: '缺口连接（非采样）', type: 'line', data: bridges, connectNulls: false, showSymbol: false, lineStyle: { type: 'dashed', color: colors.warning, width: 1.5 }, itemStyle: { color: colors.warning } }],
    };
}
function Chart({ title, subtitle, option, empty, wide = false }) {
    const host = useRef(null);
    const instance = useRef();
    useEffect(() => {
        if (!host.current || empty)
            return;
        const chart = echarts.init(host.current, undefined, { renderer: 'canvas' });
        instance.current = chart;
        const resize = new ResizeObserver(() => chart.resize());
        resize.observe(host.current);
        return () => { resize.disconnect(); chart.dispose(); instance.current = undefined; };
    }, [empty]);
    useEffect(() => { instance.current?.setOption(option, { replaceMerge: ['series'] }); }, [option, empty]);
    return _jsxs("section", { className: `fv-analysis-chart ${wide ? 'wide' : ''}`, children: [_jsxs("header", { children: [_jsx("h3", { children: title }), _jsx("p", { children: subtitle })] }), empty ? _jsx("div", { className: "fv-analysis-empty", children: empty }) : _jsx("div", { className: "fv-analysis-canvas", ref: host, role: "img", "aria-label": `${title}。${subtitle}` })] });
}
export function TradeAnalytics({ active }) {
    const { ref: paletteRef, palette: colors } = useChartPalette();
    const [data, setData] = useState();
    const [range, setRange] = useState({ start: '', end: '' });
    const [draft, setDraft] = useState({ start: '', end: '' });
    const [period, setPeriod] = useState('1m');
    const [bridge, setBridge] = useState(false);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [page, setPage] = useState(0);
    const [bucketPage, setBucketPage] = useState(0);
    const applyRange = (start, end) => {
        if (!start || !end || start > end) {
            setError('请选择有效日期范围，开始日期不能晚于结束日期');
            return;
        }
        if (start < moveDay(end, -366)) {
            setError('每次最多查看一年，请缩小日期范围');
            return;
        }
        setRange({ start, end });
        setDraft({ start, end });
        setPage(0);
        setBucketPage(0);
        setData(undefined);
    };
    useEffect(() => {
        if (!active)
            return;
        let stopped = false;
        let timer;
        const controller = new AbortController();
        const refresh = async () => {
            try {
                const query = new URLSearchParams({ period, start_day: range.start, end_day: range.end });
                const response = await flyFetch(`/api/fly/v2/analytics?${query}`, { signal: controller.signal });
                if (!response.ok)
                    throw new Error('交易分析暂时无法刷新');
                const result = await response.json();
                if (!stopped) {
                    setData(result);
                    setError('');
                    setDraft(d => d.start && d.end ? d : { start: result.start_day, end: result.end_day });
                }
            }
            catch (e) {
                if (!stopped)
                    setError(e instanceof Error ? e.message : '连接暂不可用');
            }
            if (!stopped)
                timer = setTimeout(() => void refresh(), 15000);
        };
        void refresh();
        return () => { stopped = true; clearTimeout(timer); controller.abort(); };
    }, [range, period, active, reload]);
    const charts = useMemo(() => {
        if (!data)
            return null;
        const s = data.summary;
        const products = data.products;
        const closes = data.realized_curve;
        const raw = data.period === 'raw';
        const groups = data.periods;
        const categories = raw ? closes.map(c => `${c.time}\n${c.symbol}`) : groups.map(g => g.label);
        const equity = raw ? data.equity : groups.filter(g => g.Balance != null);
        const drawdown = raw ? data.equity : groups.filter(g => g.worst_drawdown != null).map(g => ({ ...g, drawdown: g.worst_drawdown }));
        const base = baseOption(colors);
        return {
            equity: equityOption(equity, 'Balance', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors), drawdown: equityOption(drawdown, 'drawdown', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
            products: { ...base, xAxis: { ...base.xAxis, axisLabel: { color: colors.muted, interval: 0, fontSize: 10 }, data: products.map(p => `${p.product}\n${names[p.product] || p.product}`) }, series: [{ name: '已实现毛盈亏（元）', type: 'bar', barMaxWidth: 38, data: products.map(p => ({ value: p.realized_gross, itemStyle: { color: (p.realized_gross ?? 0) >= 0 ? colors.profit : colors.loss, borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', color: colors.text, fontSize: 10, formatter: p => typeof p.value === 'number' ? fmt(p.value, 0) : '—' } }] },
            cumulative: equityOption(equity, 'cumulative_net', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
            realizedEquity: equityOption(equity, 'realized_equity', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
            distribution: { ...base, xAxis: [], yAxis: [], tooltip: { ...base.tooltip, trigger: 'item' }, legend: { bottom: 15, textStyle: { color: colors.text } }, series: [{ name: '平仓成交笔数', type: 'pie', radius: ['45%', '68%'], center: ['50%', '44%'], label: { color: colors.text, formatter: '{b}\n{c} 笔' }, data: [{ name: '盈利', value: s.wins, itemStyle: { color: colors.profit } }, { name: '亏损', value: s.losses, itemStyle: { color: colors.loss } }, { name: '持平', value: s.breakeven, itemStyle: { color: colors.muted } }].filter(p => p.value > 0) }] },
            closes: { ...base, xAxis: { ...base.xAxis, data: categories }, series: [{ name: raw ? '本次平仓毛盈亏（元）' : '周期平仓毛盈亏（元）', type: 'bar', barMaxWidth: 32, data: (raw ? closes : groups).map(c => ({ value: c.realized_gross, itemStyle: { color: (c.realized_gross ?? 0) >= 0 ? colors.profit : colors.loss } })) }] },
            activity: { ...base, xAxis: { ...base.xAxis, data: groups.map(g => g.label) }, yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: colors.grid } } }, series: [{ name: '成交笔数', type: 'bar', data: groups.map(g => g.fill_count), itemStyle: { color: colors.blue }, barMaxWidth: 30 }] },
        };
    }, [data, bridge, colors]);
    const s = data?.summary;
    const exportData = () => {
        if (!data)
            return;
        const rows = [['类别', '交易日', '时间（上海）', '合约', '数值（元）', '来源或口径']];
        data.equity.forEach(p => rows.push(['原始权益', p.day, new Date(p.at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), '', p.Balance, p.source === 'counter' ? '正式柜台快照' : '历史验收观测（记录时间）']));
        data.equity.forEach(p => rows.push(['累计平仓净盈亏', p.day, stamp(p.at), '', p.cumulative_net, `整个 PandaAI 模拟赛 账户；按有记录交易日累计；当日平仓盈亏 ${fmt(p.CloseProfit)} − 当日手续费 ${fmt(p.Commission)}；不含浮盈`]));
        data.equity.forEach(p => rows.push(['平仓权益曲线', p.day, stamp(p.at), '', p.realized_equity, `固定基准 ${fmt(data.equity_baseline?.value)} ＋ 累计平仓净盈亏；已扣手续费；非账户实时权益`]));
        data.realized_curve.forEach(c => rows.push(['平仓毛盈亏', c.trading_day, c.time, c.symbol, c.realized_gross, `${c.time_source === 'counter' ? '柜台时间' : '回报接收时间'}；成交 ${c.trade_id}；未扣费用`]));
        data.products.forEach(p => rows.push(['品种毛盈亏', `${data.start_day}—${data.end_day}`, '', p.symbol, p.realized_gross, '果蝇成交；未扣费用']));
        data.periods.forEach(g => { rows.push([`${periodNames[data.period]}末次权益`, g.day, g.label, '', g.Balance, `真实采样 ${g.sample_count} 条；末次观测 ${stamp(g.observed_at)}`]); rows.push([`${periodNames[data.period]}毛盈亏`, g.day, g.label, '', g.realized_gross, `成交 ${g.fill_count} 笔；平仓 ${g.closing_fills} 笔；毛胜率 ${fmt(g.win_rate)}%`]); });
        data.periods.forEach(g => rows.push([`${periodNames[data.period]}累计平仓净盈亏`, g.day, g.label, '', g.cumulative_net, `整个 PandaAI 模拟赛 账户；已扣开平仓手续费；不含浮盈；末次观测 ${stamp(g.observed_at)}`]));
        data.periods.forEach(g => rows.push([`${periodNames[data.period]}平仓权益曲线`, g.day, g.label, '', g.realized_equity, `固定基准 ${fmt(data.equity_baseline?.value)} ＋ 累计平仓净盈亏；非账户实时权益`]));
        rows.push(['累计平仓净盈亏', `${data.start_day}—${data.end_day}`, stamp(data.account_at), '', data.period_summary.realized_net, `整个 PandaAI 模拟赛 账户；${data.period_summary.recorded_days} 个有记录交易日；已扣开平仓手续费；不含浮盈`]);
        rows.push(['有记录交易日净收益', `${data.start_day}—${data.end_day}`, stamp(data.account_at), '', data.period_summary.day_net, `累计 ${data.period_summary.recorded_days} 个有记录交易日的末次日内净收益；含持仓浮盈亏`]);
        const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/^[=+@]/, "'$&").replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `小果-交易分析-${data.start_day}-${data.end_day}-${data.period}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return _jsxs("section", { ref: paletteRef, className: "fv-analysis", "aria-label": "\u4EA4\u6613\u5206\u6790\u770B\u677F", children: [_jsxs("header", { className: "fv-analysis-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "fv-kicker", children: "TRADING ANALYTICS" }), _jsx("h2", { children: "\u6BCF\u4E00\u6B21\u4EA4\u6613\uFF0C\u7559\u4E0B\u600E\u6837\u7684\u7ED3\u679C" }), _jsx("p", { children: "\u5E73\u4ED3\u76C8\u4E8F\u3001\u76C8\u4E8F\u6765\u6E90\u4E0E\u6210\u4EA4\u8868\u73B0 \u00B7 PandaAI \u6A21\u62DF\u8D5B" })] }), _jsxs("div", { className: "fv-analysis-tools", children: [_jsx("button", { type: "button", onClick: () => setReload(v => v + 1), children: "\u5237\u65B0" }), _jsx("button", { type: "button", disabled: !data, onClick: exportData, children: "\u5BFC\u51FA CSV \u2197" })] })] }), _jsxs("div", { className: "fv-analysis-controls", children: [_jsx("div", { className: "fv-period-switch", "aria-label": "\u56FE\u8868\u5468\u671F", children: Object.keys(periodNames).map(p => _jsx("button", { type: "button", "aria-pressed": period === p, onClick: () => { if (p === period)
                                return; setPeriod(p); setBucketPage(0); setData(undefined); }, children: periodNames[p] }, p)) }), _jsxs("div", { className: "fv-date-range", children: [_jsxs("label", { children: ["\u5F00\u59CB\u4EA4\u6613\u65E5", _jsx("input", { type: "date", "aria-label": "\u5F00\u59CB\u4EA4\u6613\u65E5", value: draft.start ? dateInput(draft.start) : '', onChange: e => setDraft(d => ({ ...d, start: e.target.value.replace(/-/g, '') })) })] }), _jsx("span", { children: "\u2014" }), _jsxs("label", { children: ["\u7ED3\u675F\u4EA4\u6613\u65E5", _jsx("input", { type: "date", "aria-label": "\u7ED3\u675F\u4EA4\u6613\u65E5", value: draft.end ? dateInput(draft.end) : '', onChange: e => setDraft(d => ({ ...d, end: e.target.value.replace(/-/g, '') })) })] }), _jsx("button", { type: "button", onClick: () => applyRange(draft.start, draft.end), children: "\u5E94\u7528\u65E5\u671F" })] }), _jsxs("div", { className: "fv-analysis-presets", children: [[['单日', 0], ['近 7 日', 6], ['近 30 日', 29], ['全部记录', -1]].map(([label, n]) => _jsx("button", { type: "button", disabled: !data, onClick: () => { if (!data)
                                    return; const end = data.days[0] || data.day; const earliest = data.days[data.days.length - 1] || end; applyRange(Number(n) < 0 ? (earliest < moveDay(end, -366) ? moveDay(end, -366) : earliest) : moveDay(end, -Number(n)), end); }, children: label }, label)), _jsxs("label", { children: ["\u8D26\u6237\u56DE\u64A4\u7F3A\u53E3", _jsxs("select", { "aria-label": "\u6743\u76CA\u7F3A\u53E3\u663E\u793A", value: bridge ? 'bridge' : 'break', onChange: e => setBridge(e.target.value === 'bridge'), children: [_jsx("option", { value: "break", children: "\u4FDD\u7559\u7A7A\u767D" }), _jsx("option", { value: "bridge", children: "\u865A\u7EBF\u8FDE\u63A5\uFF08\u975E\u91C7\u6837\uFF09" })] })] })] })] }), error && _jsxs("div", { className: "fv-analysis-alert", role: "status", children: [error, data ? '，以下保留上次成功结果。' : '，请检查后台连接。'] }), !data || !s || !charts ? _jsx("div", { className: "fv-analysis-empty", children: "\u6B63\u5728\u8BFB\u53D6\u8D26\u6237\u6743\u76CA\u4E0E\u6210\u4EA4\u8BB0\u5F55\u2026" }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: "fv-analysis-metrics", children: [_jsxs("div", { children: [_jsx("span", { children: "\u7D2F\u8BA1\u5E73\u4ED3\u51C0\u76C8\u4E8F" }), _jsx("strong", { className: tone(data.period_summary.realized_net), children: money(data.period_summary.realized_net) }), _jsx("small", { children: "\u6574\u4E2A\u8D26\u6237 \u00B7 \u5DF2\u6263\u5F00\u5E73\u4ED3\u624B\u7EED\u8D39 \u00B7 \u4E0D\u542B\u6D6E\u76C8 \u00B7 \u5143" })] }), _jsxs("div", { children: [_jsx("span", { children: "\u6709\u8BB0\u5F55\u4EA4\u6613\u65E5\u51C0\u6536\u76CA" }), _jsx("strong", { className: tone(data.period_summary.day_net), children: money(data.period_summary.day_net) }), _jsxs("small", { children: [data.period_summary.recorded_days, " \u4E2A\u4EA4\u6613\u65E5 \u00B7 \u5DF2\u6263\u8D39 \u00B7 \u542B\u6D6E\u76C8 \u00B7 \u5143"] })] }), _jsxs("div", { children: [_jsx("span", { children: "\u8D26\u6237\u91C7\u6837\u6700\u5927\u56DE\u64A4" }), _jsx("strong", { children: fmt(s.max_drawdown) }), _jsxs("small", { children: [fmt(s.max_drawdown_pct, 3), "% \u00B7 \u672A\u8C03\u6574\u51FA\u5165\u91D1"] })] }), _jsxs("div", { children: [_jsx("span", { children: "\u5E73\u4ED3\u6210\u4EA4\u80DC\u7387 \u00B7 \u6BDB\u6536\u76CA" }), _jsxs("strong", { children: [fmt(s.win_rate, 1), _jsx("em", { children: "%" })] }), _jsxs("small", { children: [s.wins, " \u76C8 / ", s.losses, " \u4E8F / ", s.breakeven, " \u5E73 \u00B7 ", s.matched_closes, " \u7B14\u5DF2\u914D\u5BF9"] })] })] }), _jsxs("div", { className: "fv-analysis-coverage", children: [_jsx("span", { className: "fv-analysis-dot" }), _jsxs("p", { children: [data.coverage.samples ? _jsxs(_Fragment, { children: [_jsxs("b", { children: [data.coverage.samples, " \u4E2A\u6743\u76CA\u91C7\u6837"] }), " \u00B7 ", stamp(data.coverage.first_at), "\u2014", stamp(data.coverage.last_at), " \u00B7 ", data.coverage.gaps, " \u5904\u95F4\u9694\u65AD\u7EBF", data.coverage.observation_samples > 0 && ` · ${data.coverage.observation_samples} 条历史验收观测，使用记录时间`] }) : '尚无该交易日的权益采样；后台收到新柜台快照后自动记录。', _jsxs("small", { children: [periodNames[data.period], " \u00B7 ", data.period === 'raw' ? data.coverage.samples : data.periods.filter(g => g.Balance != null).length, " \u4E2A\u6743\u76CA\u70B9\uFF1B\u56DE\u64A4\u6309\u539F\u59CB\u91C7\u6837\u8BA1\u7B97\u3002", s.unmatched_closes > 0 && ` ${s.unmatched_closes} 笔平仓缺少配对数据，不计入胜率。`, data.coverage.cash_flow_changed && ' 检测到出入金变化，原始权益回撤会受影响。'] })] }), _jsxs("span", { children: [s.fills, " \u7B14\u6210\u4EA4"] })] }), data.gaps.length > 0 && _jsxs("details", { className: "fv-analysis-gaps", children: [_jsxs("summary", { children: ["\u8D26\u6237\u56DE\u64A4\u6570\u636E\uFF1A", data.gaps.length, " \u6BB5\u6743\u76CA\u5FEB\u7167\u7F3A\u5931"] }), data.gaps.map(g => _jsxs("p", { children: [stamp(g.from), " \u2192 ", stamp(g.to), " \u00B7 ", Math.floor(g.seconds / 60), " \u5206 ", Math.round(g.seconds % 60), " \u79D2"] }, g.from)), _jsx("small", { children: "\u8FD9\u6BB5\u65F6\u95F4\u672A\u8BB0\u5F55\u5230\u6743\u76CA\u5FEB\u7167\uFF0C\u65E0\u6CD5\u8FD8\u539F\u5176\u95F4\u6D6E\u76C8\u6D6E\u4E8F\u3002\u865A\u7EBF\u4EC5\u8FDE\u63A5\u5DF2\u77E5\u7AEF\u70B9\uFF0C\u4E0D\u751F\u6210\u91C7\u6837\uFF0C\u4E5F\u4E0D\u6539\u53D8\u7EDF\u8BA1\u7ED3\u679C\u3002\u5C0F\u65F6\u3001\u65E5\u7EBF\u4ECD\u4F1A\u6807\u660E\u5468\u671F\u5185\u5305\u542B\u7F3A\u53E3\u3002" })] }), data.period === '1d' && _jsxs("p", { className: "fv-analysis-footnote", children: ["\u65E5\u7EBF\u6309\u67DC\u53F0\u4EA4\u6613\u65E5\u5F52\u6863\uFF0C\u591C\u76D8\u8DDF\u968F\u6240\u5C5E\u4EA4\u6613\u65E5\u3002\u5F53\u524D ", data.periods.filter(g => g.Balance != null).length, " \u4E2A\u4EA4\u6613\u65E5\u6709\u6743\u76CA\u89C2\u6D4B\uFF1B\u6BCF\u4E2A\u4EA4\u6613\u65E5\u4E00\u4E2A\u672B\u6B21\u89C2\u6D4B\u70B9\uFF0C\u4E0D\u628A\u76D8\u4E2D\u5FEB\u7167\u5F53\u4F5C\u6B63\u5F0F\u65E5\u7EC8\u7ED3\u7B97\u3002"] }), _jsxs("div", { className: "fv-analysis-grid", children: [_jsx(Chart, { title: "\u5E73\u4ED3\u6743\u76CA\u66F2\u7EBF", subtitle: `${periodNames[data.period]} · 固定基准 ${fmt(data.equity_baseline?.value)} 元 ＋ 累计平仓净盈亏 · 已扣手续费 · 不含浮盈变化及后续出入金`, option: charts.realizedEquity, empty: !data.equity.some(p => p.realized_equity != null) ? '等待可以确定基准权益及手续费的柜台快照。' : undefined, wide: true }), _jsx(Chart, { title: "\u7D2F\u8BA1\u5E73\u4ED3\u51C0\u76C8\u4E8F", subtitle: `${periodNames[data.period]} · 整个 PandaAI 模拟赛 账户 · 平仓盈亏 − 已发生开平仓手续费 · 不含浮盈 · 按有记录交易日累计 · 元`, option: charts.cumulative, empty: !data.equity.some(p => p.cumulative_net != null) ? '等待包含平仓盈亏和手续费的柜台快照；缺失费用不按零计算。' : undefined, wide: true }), _jsx(Chart, { title: "\u8D26\u6237\u56DE\u64A4", subtitle: `${data.period === 'raw' ? '距原始采样峰值' : '周期内最深原始采样回撤'} · 单位：元`, option: charts.drawdown, empty: data.equity.length < 2 ? '至少需要两个真实权益采样。' : undefined }), _jsx(Chart, { title: "\u54C1\u79CD\u76C8\u4E8F\u8D21\u732E", subtitle: "\u6240\u9009\u65E5\u671F\u8303\u56F4\u5185\u7684\u679C\u8747\u6BDB\u76C8\u4E8F \u00B7 \u4E0D\u5206\u644A\u8D26\u6237\u624B\u7EED\u8D39", option: charts.products, empty: !s.fills ? '该交易日尚无果蝇成交。' : undefined }), _jsx(Chart, { title: "\u5E73\u4ED3\u80DC\u8D1F\u5206\u5E03", subtitle: `以已配对平仓成交计数；不是手数或完整持仓周期 · 毛利润 / 毛亏损 ${fmt(s.profit_factor)}`, option: charts.distribution, empty: !s.matched_closes ? '尚无可配对的平仓成交。' : undefined }), _jsx(Chart, { title: data.period === 'raw' ? '逐次平仓结果' : '周期平仓盈亏', subtitle: `${periodNames[data.period]} · 每个柱形对应该周期的平仓毛盈亏 / 元`, option: charts.closes, empty: !s.closing_fills ? '等待第一笔平仓成交。' : undefined }), data.period !== 'raw' && _jsx(Chart, { title: "\u5468\u671F\u6210\u4EA4\u7B14\u6570", subtitle: `${periodNames[data.period]} · 开仓和平仓均计入 · 按回报接收时间汇总`, option: charts.activity, empty: !s.fills ? '所选范围尚无成交。' : undefined }), _jsxs("section", { className: "fv-analysis-reconcile", children: [_jsx("span", { className: "fv-kicker", children: "ACCOUNT RECONCILIATION" }), _jsx("h3", { children: "\u6536\u76CA\u4ECE\u54EA\u91CC\u6765" }), _jsxs("p", { children: [dateInput(data.start_day), "\u2014", dateInput(data.end_day), " \u00B7 ", data.period_summary.recorded_days, " \u4E2A\u6709\u8BB0\u5F55\u4EA4\u6613\u65E5"] }), _jsxs("dl", { children: [_jsxs("div", { children: [_jsx("dt", { children: "\u67DC\u53F0\u5E73\u4ED3\u76C8\u4E8F" }), _jsx("dd", { className: tone(data.period_summary.CloseProfit), children: money(data.period_summary.CloseProfit) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u2212 \u5F00\u4ED3\u53CA\u5E73\u4ED3\u624B\u7EED\u8D39" }), _jsx("dd", { children: fmt(data.period_summary.Commission) })] }), _jsxs("div", { className: "total", children: [_jsx("dt", { children: "\uFF1D \u5E73\u4ED3\u51C0\u76C8\u4E8F\uFF08\u4E3B\u66F2\u7EBF\uFF09" }), _jsx("dd", { className: tone(data.period_summary.realized_net), children: money(data.period_summary.realized_net) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\uFF0B \u6301\u4ED3\u6D6E\u76C8\u4E8F" }), _jsx("dd", { children: money(data.period_summary.PositionProfit) })] }), _jsxs("div", { className: "total", children: [_jsx("dt", { children: "\u6709\u8BB0\u5F55\u4EA4\u6613\u65E5\u51C0\u6536\u76CA" }), _jsx("dd", { className: tone(data.period_summary.day_net), children: money(data.period_summary.day_net) })] })] }), _jsxs("small", { children: ["\u6574\u4E2A PandaAI \u6A21\u62DF\u8D5B \u8D26\u6237\u53E3\u5F84\uFF0C\u5176\u4ED6\u7B56\u7565\u6216\u624B\u5DE5\u4EA4\u6613\u4E5F\u4F1A\u8BA1\u5165\u3002\u679C\u8747\u6210\u4EA4\u53E6\u8BA1\u7684\u6BDB\u76C8\u4E8F\u4E3A ", money(s.realized_gross), " \u5143\u3002"] })] })] }), _jsxs("p", { className: "fv-analysis-footnote", children: [data.note, " \u56FE\u8868\u6BCF 15 \u79D2\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u6570\u636E\uFF1B\u67DC\u53F0\u5237\u65B0\u9891\u7387\u72EC\u7ACB\u4E8E\u9875\u9762\u3002\u66F4\u65B0\u65F6\u95F4 ", clock(data.generated_at), "\u3002"] }), data.period !== 'raw' && _jsxs("details", { className: "fv-analysis-details", children: [_jsxs("summary", { children: ["\u67E5\u770B ", periodNames[data.period], " \u5468\u671F\u7EDF\u8BA1 \u00B7 ", data.periods.length, " \u4E2A\u6709\u8BB0\u5F55\u5468\u671F"] }), _jsx("div", { className: "fv-statistics-scroll", children: _jsxs(ResizableNativeTable, { resizeStorageKey: "fly-analysis-periods", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5468\u671F / \u4EA4\u6613\u65E5" }), _jsx("th", { children: "\u672B\u6B21\u771F\u5B9E\u6743\u76CA" }), _jsx("th", { children: "\u5468\u671F\u6700\u6DF1\u56DE\u64A4" }), _jsx("th", { children: "\u6210\u4EA4 / \u5E73\u4ED3\u7B14\u6570" }), _jsx("th", { children: "\u5E73\u4ED3\u6BDB\u76C8\u4E8F" }), _jsx("th", { children: "\u6BDB\u80DC\u7387" }), _jsx("th", { children: "\u91C7\u6837\u60C5\u51B5" })] }) }), _jsx("tbody", { children: data.periods.slice(bucketPage * 20, bucketPage * 20 + 20).map(g => _jsxs("tr", { children: [_jsxs("td", { children: [g.label, _jsxs("small", { children: ["\u4EA4\u6613\u65E5 ", dateInput(g.day)] })] }), _jsxs("td", { children: [fmt(g.Balance), g.observed_at != null && _jsx("small", { children: stamp(g.observed_at) })] }), _jsx("td", { children: fmt(g.worst_drawdown == null ? null : -g.worst_drawdown) }), _jsxs("td", { children: [g.fill_count, " / ", g.closing_fills] }), _jsx("td", { className: tone(g.realized_gross), children: money(g.realized_gross) }), _jsxs("td", { children: [fmt(g.win_rate, 1), "%"] }), _jsxs("td", { children: [g.sample_count, " \u6761", g.contains_gap && _jsx("small", { children: "\u542B\u91C7\u6837\u7F3A\u53E3" }), !g.sample_count && _jsx("small", { children: "\u6743\u76CA\u672A\u77E5" })] })] }, `${g.day}-${g.at}`)) })] }) }), _jsxs("div", { className: "fv-statistics-pagination", children: [_jsxs("span", { children: ["\u7B2C ", bucketPage + 1, " / ", Math.max(1, Math.ceil(data.periods.length / 20)), " \u9875"] }), _jsx("button", { type: "button", disabled: !bucketPage, onClick: () => setBucketPage(p => p - 1), children: "\u4E0A\u4E00\u9875" }), _jsx("button", { type: "button", disabled: (bucketPage + 1) * 20 >= data.periods.length, onClick: () => setBucketPage(p => p + 1), children: "\u4E0B\u4E00\u9875" })] })] }), _jsxs("details", { className: "fv-analysis-details", children: [_jsxs("summary", { children: ["\u67E5\u770B\u6240\u9009\u8303\u56F4\u7684 ", s.fills, " \u7B14\u6210\u4EA4\u660E\u7EC6"] }), _jsx("div", { className: "fv-statistics-scroll", children: _jsxs(ResizableNativeTable, { resizeStorageKey: "fly-analysis-fills", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65F6\u95F4" }), _jsx("th", { children: "\u5408\u7EA6" }), _jsx("th", { children: "\u52A8\u4F5C" }), _jsx("th", { children: "\u624B\u6570" }), _jsx("th", { children: "\u6210\u4EA4\u4EF7" }), _jsx("th", { children: "\u5E73\u4ED3\u6BDB\u76C8\u4E8F" }), _jsx("th", { children: "\u6210\u4EA4\u7F16\u53F7" })] }) }), _jsx("tbody", { children: data.fills.slice(page * 20, page * 20 + 20).map(f => _jsxs("tr", { children: [_jsxs("td", { children: [data.start_day !== data.end_day && _jsx("small", { children: dateInput(f.trading_day) }), f.time, f.time_source !== 'counter' && _jsx("small", { children: "\u56DE\u62A5\u65F6\u95F4" })] }), _jsx("td", { children: f.symbol }), _jsx("td", { children: f.offset === '0' ? (f.direction === '0' ? '开多' : '开空') : (f.direction === '0' ? '平空' : '平多') }), _jsx("td", { children: f.volume }), _jsx("td", { children: fmt(f.price) }), _jsx("td", { className: tone(f.realized_gross), children: money(f.realized_gross) }), _jsx("td", { children: f.trade_id })] }, f.seq)) })] }) }), _jsxs("div", { className: "fv-statistics-pagination", children: [_jsxs("span", { children: [s.fills, " \u7B14 \u00B7 \u7B2C ", page + 1, " / ", Math.max(1, Math.ceil(s.fills / 20)), " \u9875"] }), _jsx("button", { type: "button", disabled: !page, onClick: () => setPage(p => p - 1), children: "\u4E0A\u4E00\u9875" }), _jsx("button", { type: "button", disabled: (page + 1) * 20 >= s.fills, onClick: () => setPage(p => p + 1), children: "\u4E0B\u4E00\u9875" })] })] })] })] });
}
//# sourceMappingURL=TradeAnalytics.js.map