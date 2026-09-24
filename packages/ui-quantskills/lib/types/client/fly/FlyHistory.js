import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import css from './FlyHistory.module.css';
export function useRetryCountdown(retryAt) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        setNow(Date.now());
        if (!retryAt || retryAt * 1000 <= Date.now())
            return;
        const timer = setInterval(() => { setNow(Date.now()); if (Date.now() >= retryAt * 1000)
            clearInterval(timer); }, 1000);
        return () => clearInterval(timer);
    }, [retryAt]);
    return Math.max(0, Math.ceil(((retryAt ?? 0) * 1000 - now) / 1000));
}
export const marketReadiness = { ready: '行情就绪', history_incomplete: '等待历史补齐', history_gap: '分钟线有缺口', quote_stale: '等待新鲜报价', bars_stale: '等待分钟线' };
const updated = (at) => at ? new Date(at * 1000).toLocaleString('zh-CN', { hour12: false }) : '尚未成功获取';
export function FlyHistory({ history, error, markets, enabled, onRefresh }) {
    const [pending, setPending] = useState(false), [failure, setFailure] = useState('');
    const submitting = useRef(false);
    const running = pending || history?.status === 'running';
    const cooldown = useRetryCountdown(history?.retry_at);
    useEffect(() => { if (history?.status === 'complete')
        setFailure(''); }, [history?.last_success_at, history?.status]);
    async function refresh() {
        if (submitting.current || running || cooldown || !enabled)
            return;
        submitting.current = true;
        setPending(true);
        setFailure('');
        try {
            await onRefresh();
        }
        catch (cause) {
            setFailure(cause instanceof Error ? cause.message : '历史获取未完成，请重试。');
        }
        finally {
            submitting.current = false;
            setPending(false);
        }
    }
    return _jsxs("section", { className: css.history, "aria-label": "PandaData \u5386\u53F2\u6570\u636E", "aria-busy": running, children: [_jsxs("div", { className: css.heading, children: [_jsxs("div", { children: [_jsx("strong", { children: "PandaData \u5386\u53F2\u6570\u636E" }), _jsx("p", { children: "\u9996\u6B21\u8865\u9F50 500 \u6839\uFF1B\u4E4B\u540E\u6309 1\uFF0F5 \u5206\u949F\u5468\u671F\u8865\u6700\u65B0\u6570\u636E\u4E0E\u7F3A\u53E3\uFF0C\u4F11\u5E02\u51CF\u5C11\u8BF7\u6C42\uFF0C\u91CD\u542F\u590D\u7528\u7F13\u5B58\u3002" })] }), _jsx("button", { type: "button", disabled: !enabled || running || cooldown > 0, onClick: () => void refresh(), children: running ? '正在获取历史数据…' : cooldown ? `冷却中 · ${cooldown} 秒` : '获取历史数据' })] }), _jsxs("p", { role: "status", children: [cooldown ? `${history?.source === 'competition' ? '比赛接口' : 'PandaData'}将在 ${cooldown} 秒后重试。` : running ? '正在后台获取，切换页面后继续。' : history?.blocked ? '请检查连接或授权，处理后点击获取历史数据。' : history?.status === 'error' ? '本次获取未完成，可重试。' : history?.status === 'complete' ? '本次获取完成，完整性见各合约状态。' : '等待自动补齐或手动获取。', " \u6700\u8FD1\u5168\u90E8\u6210\u529F\uFF1A", updated(history?.last_success_at)] }), !enabled && _jsx("p", { children: "\u8BF7\u5148\u4FDD\u5B58\u300C\u884C\u60C5\u914D\u7F6E\u300D\uFF0C\u518D\u70B9\u51FB\u300C\u8FDE\u63A5\u6BD4\u8D5B\u884C\u60C5\u300D\uFF1BPandaData \u6388\u6743\u5728 QuantStudio \u8BBE\u7F6E\u4E2D\u5B8C\u6210\u3002" }), markets.length > 0 && _jsx("ul", { children: markets.map(market => _jsxs("li", { children: [_jsxs("span", { children: [_jsx("b", { children: market.symbol || market.product }), " \u00B7 ", market.count, "/500 \u6839"] }), _jsxs("span", { children: ["\u6700\u8FD1\u6210\u529F\uFF1A", updated(market.history_source?.at)] }), market.history_source?.error && _jsx("span", { className: css.error, children: market.history_source.error })] }, market.product)) }), (failure || error) && _jsx("p", { role: "alert", className: css.error, children: failure || error })] });
}
//# sourceMappingURL=FlyHistory.js.map