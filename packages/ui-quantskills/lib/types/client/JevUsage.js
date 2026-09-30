import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowClockwiseIcon, ArrowDownIcon, ArrowUpIcon, CaretDownIcon, ClockCounterClockwiseIcon, DownloadSimpleIcon, InfoIcon, PulseIcon } from '@phosphor-icons/react';
import { contestTime } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import './JevUsage.css';
const labels = { watch: '盯盘决策', 'connection-test': '连接测试', research: '研究评估', validation: '合成场景验证' };
export function JevUsage({ access, events }) {
    const [usage, setUsage] = useState(), [error, setError] = useState('');
    const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true);
    useEffect(() => {
        let disposed = false, timer;
        const refresh = async () => {
            if (!disposed)
                setLoading(true);
            try {
                const value = await waitForCompetition(() => access.usage(), 'Jev 调用记录');
                if (!disposed) {
                    setUsage(value);
                    setError('');
                }
            }
            catch {
                if (!disposed)
                    setError('调用记录暂时无法读取；请稍后重试。');
            }
            finally {
                if (!disposed) {
                    setLoading(false);
                    timer = setTimeout(() => { void refresh(); }, 10000);
                }
            }
        };
        void refresh();
        return () => { disposed = true; clearTimeout(timer); };
    }, [access, revision]);
    const download = () => {
        if (!usage)
            return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(usage, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'jev-request-audit.json';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return _jsxs("div", { className: "qs-jev-diagnostics", children: [_jsxs("section", { "aria-label": "Jev \u8C03\u7528\u6982\u89C8", children: [_jsxs("header", { className: "qs-diagnostics-heading", children: [_jsxs("div", { children: [_jsx("h3", { children: "\u8C03\u7528\u6982\u89C8" }), _jsx("p", { children: "\u672C\u673A\u7D2F\u8BA1\u7528\u91CF \u00B7 \u6BCF 10 \u79D2\u66F4\u65B0" })] }), _jsx("button", { type: "button", className: "qs-diagnostics-icon-button", "aria-label": "\u5237\u65B0\u8C03\u7528\u8BB0\u5F55", disabled: loading, onClick: () => setRevision(value => value + 1), children: _jsx(ArrowClockwiseIcon, { size: 17, "aria-hidden": "true" }) })] }), error && _jsx("p", { className: "qs-diagnostics-error", role: "alert", children: error }), _jsxs("dl", { className: "qs-diagnostics-metrics", children: [_jsxs("div", { children: [_jsxs("dt", { children: [_jsx(PulseIcon, { size: 15, "aria-hidden": "true" }), "API \u8C03\u7528"] }), _jsxs("dd", { children: [usage?.requests.toLocaleString() ?? '—', _jsx("small", { children: "\u6B21" })] }), _jsx("p", { children: usage ? `HTTP 成功 ${usage.responsesOk} 次` : '正在读取' })] }), _jsxs("div", { children: [_jsxs("dt", { children: [_jsx(ArrowUpIcon, { size: 15, "aria-hidden": "true" }), "\u8F93\u5165 token"] }), _jsx("dd", { children: usage?.inputTokens.toLocaleString() ?? '—' }), _jsx("p", { children: "\u5DF2\u77E5\u8F93\u5165\u7528\u91CF" })] }), _jsxs("div", { children: [_jsxs("dt", { children: [_jsx(ArrowDownIcon, { size: 15, "aria-hidden": "true" }), "\u8F93\u51FA token"] }), _jsx("dd", { children: usage?.outputTokens.toLocaleString() ?? '—' }), _jsx("p", { children: "\u5DF2\u77E5\u8F93\u51FA\u7528\u91CF" })] })] }), _jsxs("details", { className: "qs-diagnostics-method", children: [_jsxs("summary", { children: [_jsx(InfoIcon, { size: 16, "aria-hidden": "true" }), _jsxs("span", { children: ["\u7EDF\u8BA1\u53E3\u5F84", usage ? ` · ${usage.unknownUsage} 次用量未知` : ''] }), _jsx(CaretDownIcon, { size: 14, "aria-hidden": "true" })] }), _jsxs("div", { children: [usage && _jsxs("p", { children: ["\u7EDF\u8BA1\u81EA ", contestTime(usage.since), " \u8D77\u7684\u672C\u673A API \u8C03\u7528\u3002"] }), _jsx("p", { children: "\u6765\u81EA TypeSafe \u54CD\u5E94\u7684 usage \u5B57\u6BB5\uFF0C\u975E\u5B98\u7F51\u8D26\u5355\u3002\u65E7\u7248\u672C\u672A\u8BB0\u5F55\u7684\u8BF7\u6C42\u4E0D\u8BA1\u5165\uFF1B\u7528\u91CF\u672A\u77E5\u4E0D\u7B49\u4E8E\u96F6\u3002\u6C47\u603B\u7D2F\u8BA1\u4FDD\u5B58\uFF0C\u660E\u7EC6\u4FDD\u7559\u6700\u8FD1 200 \u6B21\uFF0C\u6BCF 10 \u79D2\u66F4\u65B0\u3002" })] })] })] }), _jsxs("section", { "aria-label": "\u6700\u8FD1\u8C03\u7528", children: [_jsxs("header", { className: "qs-diagnostics-heading", children: [_jsxs("h3", { children: ["\u6700\u8FD1\u8C03\u7528 ", _jsx("small", { children: usage?.records.length ?? '—' })] }), _jsxs("button", { type: "button", className: "qs-diagnostics-export", "aria-label": "\u5BFC\u51FA\u8131\u654F\u8C03\u7528\u8BB0\u5F55", disabled: !usage?.records.length, onClick: download, children: [_jsx(DownloadSimpleIcon, { size: 15, "aria-hidden": "true" }), "\u5BFC\u51FA\u8BB0\u5F55"] })] }), !usage ? _jsx("p", { className: "qs-diagnostics-empty", role: "status", children: error ? '调用记录暂不可用' : '正在读取调用记录…' }) : !usage.records.length ? _jsx("p", { className: "qs-diagnostics-empty", children: "\u6682\u65E0\u8C03\u7528\u8BB0\u5F55\uFF0C\u6A21\u578B\u8BF7\u6C42\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) : _jsx("div", { className: "qs-diagnostics-calls", children: [...usage.records].reverse().map(item => _jsxs("details", { className: "qs-diagnostics-call", children: [_jsxs("summary", { children: [_jsx("span", { className: "qs-diagnostics-call-icon", children: _jsx(PulseIcon, { size: 18, "aria-hidden": "true" }) }), _jsxs("span", { className: "qs-diagnostics-call-copy", children: [_jsx("strong", { children: labels[item.purpose] }), _jsx("time", { children: contestTime(item.startedAt) })] }), _jsx("span", { className: "qs-diagnostics-http", "data-ok": Boolean(item.httpStatus && item.httpStatus >= 200 && item.httpStatus < 300), children: item.httpStatus ? `HTTP ${item.httpStatus}` : '未收到响应' }), _jsx(CaretDownIcon, { className: "qs-diagnostics-caret", size: 14, "aria-hidden": "true" })] }), _jsx("div", { children: _jsxs("dl", { children: [_jsx("dt", { children: "\u5B9E\u9645\u8FD4\u56DE\u6A21\u578B" }), _jsx("dd", { children: item.model ?? '未返回' }), _jsx("dt", { children: "\u8017\u65F6" }), _jsxs("dd", { children: [item.finishedAt - item.startedAt, " ms"] }), _jsx("dt", { children: "\u8F93\u5165 / \u8F93\u51FA token" }), _jsx("dd", { children: item.usage ? `${item.usage.input_tokens} / ${item.usage.output_tokens}` : '未知' }), _jsx("dt", { children: "\u5BC6\u94A5\u6307\u7EB9\uFF08\u975E\u5BC6\u94A5\uFF09" }), _jsx("dd", { children: item.keyFingerprint }), _jsx("dt", { children: "\u672C\u5730\u8BB0\u5F55 ID\uFF08\u975E\u5B98\u7F51\u8BF7\u6C42 ID\uFF09" }), _jsx("dd", { children: item.id })] }) })] }, item.id)) })] }), _jsxs("section", { "aria-label": "Jev \u8FD0\u884C\u8BB0\u5F55", children: [_jsxs("header", { className: "qs-diagnostics-heading", children: [_jsxs("h3", { children: ["\u8FD0\u884C\u8BB0\u5F55 ", _jsx("small", { children: events?.length ?? '—' })] }), _jsx(ClockCounterClockwiseIcon, { size: 17, "aria-hidden": "true" })] }), !events ? _jsx("p", { className: "qs-diagnostics-empty", children: "\u6B63\u5728\u8BFB\u53D6\u8FD0\u884C\u72B6\u6001\u2026" }) : !events.length ? _jsx("p", { className: "qs-diagnostics-empty", children: "\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55\uFF0C\u76EF\u76D8\u72B6\u6001\u53D8\u5316\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) : _jsx("ol", { className: "qs-diagnostics-events", children: [...events].reverse().map((entry, index) => _jsxs("li", { children: [_jsx("time", { children: contestTime(entry.time) }), _jsx("p", { children: entry.message })] }, `${entry.time}-${index}`)) })] })] });
}
//# sourceMappingURL=JevUsage.js.map