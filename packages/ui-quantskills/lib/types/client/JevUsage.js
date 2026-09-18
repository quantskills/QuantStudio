import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { contestTime } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
const labels = { watch: '盯盘决策', 'connection-test': '连接测试', research: '研究评估', validation: '合成场景验证' };
export function JevUsage({ access }) {
    const [usage, setUsage] = useState(), [error, setError] = useState('');
    useEffect(() => {
        let disposed = false, timer;
        const refresh = async () => {
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
                if (!disposed)
                    timer = setTimeout(() => { void refresh(); }, 10000);
            }
        };
        void refresh();
        return () => { disposed = true; clearTimeout(timer); };
    }, [access]);
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
    return _jsxs("details", { className: css.jevHistory, children: [_jsxs("summary", { children: ["Jev \u8BF7\u6C42\u4E0E token \u7528\u91CF ", _jsx("span", { children: usage ? `${usage.requests} 次 · 已知输入 ${usage.inputTokens.toLocaleString()} token` : '正在读取' })] }), error && _jsx("p", { className: css.error, children: error }), usage && _jsxs("div", { className: css.jevAuditBody, children: [_jsxs("p", { children: ["\u7EDF\u8BA1\u81EA ", contestTime(usage.since), " \u8D77\u7684\u672C\u673A API \u8C03\u7528\uFF1AHTTP \u6210\u529F ", usage.responsesOk, " \u6B21\uFF0C\u5DF2\u77E5\u8F93\u5165 ", usage.inputTokens.toLocaleString(), " / \u8F93\u51FA ", usage.outputTokens.toLocaleString(), " token\uFF0C\u7528\u91CF\u672A\u77E5 ", usage.unknownUsage, " \u6B21\u3002"] }), _jsx("p", { className: css.jevFine, children: "\u6765\u81EA TypeSafe \u54CD\u5E94\u7684 usage \u5B57\u6BB5\uFF0C\u975E\u5B98\u7F51\u8D26\u5355\u3002\u65E7\u7248\u672C\u672A\u8BB0\u5F55\u7684\u8BF7\u6C42\u4E0D\u8BA1\u5165\uFF1B\u7528\u91CF\u672A\u77E5\u4E0D\u7B49\u4E8E\u96F6\u3002\u6C47\u603B\u7D2F\u8BA1\u4FDD\u5B58\uFF0C\u660E\u7EC6\u4FDD\u7559\u6700\u8FD1 200 \u6B21\uFF0C\u6BCF 10 \u79D2\u66F4\u65B0\u3002" }), _jsx("button", { type: "button", disabled: !usage.records.length, onClick: download, children: "\u5BFC\u51FA\u8131\u654F\u8C03\u7528\u8BB0\u5F55" }), [...usage.records].reverse().map(item => _jsxs("details", { className: css.jevHistoryItem, children: [_jsxs("summary", { children: [_jsx("time", { children: contestTime(item.startedAt) }), _jsx("strong", { children: labels[item.purpose] }), _jsx("span", { children: item.httpStatus ? `HTTP ${item.httpStatus}` : '未收到 HTTP 响应' })] }), _jsx("div", { children: _jsxs("dl", { children: [_jsx("dt", { children: "\u5B9E\u9645\u8FD4\u56DE\u6A21\u578B" }), _jsx("dd", { children: item.model ?? '未返回' }), _jsx("dt", { children: "\u8017\u65F6" }), _jsxs("dd", { children: [item.finishedAt - item.startedAt, " ms"] }), _jsx("dt", { children: "\u8F93\u5165 / \u8F93\u51FA token" }), _jsx("dd", { children: item.usage ? `${item.usage.input_tokens} / ${item.usage.output_tokens}` : '未知' }), _jsx("dt", { children: "\u5BC6\u94A5\u6307\u7EB9\uFF08\u975E\u5BC6\u94A5\uFF09" }), _jsx("dd", { children: item.keyFingerprint }), _jsx("dt", { children: "\u672C\u5730\u8BB0\u5F55 ID\uFF08\u975E\u5B98\u7F51\u8BF7\u6C42 ID\uFF09" }), _jsx("dd", { children: item.id })] }) })] }, item.id))] })] });
}
//# sourceMappingURL=JevUsage.js.map