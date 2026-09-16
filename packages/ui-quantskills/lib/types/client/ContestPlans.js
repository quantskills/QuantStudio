import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { asRecord, contestTime, display, planStates } from "./contest.js";
import css from './ContestPage.module.css';
import { waitForCompetition } from "./competition-async.js";
export function ContestPlans({ status, access, refresh, compact = false, autoOpen = false }) {
    const [selected, setSelected] = useState();
    const [historyOpen, setHistoryOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState();
    const locked = useRef(false);
    const controller = useRef(undefined), generation = useRef(0), submitted = useRef(new Set());
    const [returned, setReturned] = useState();
    const seen = useRef(new Set());
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
    useEffect(() => {
        if (!status.enabled) {
            setSelected(undefined);
            setBusy(false);
            locked.current = false;
        }
        return () => { generation.current++; controller.current?.abort(); };
    }, [status.enabled]);
    const original = status.plans.find(plan => plan.id === selected);
    const plan = returned?.value.id === original?.id && (original === returned?.source || original?.status === 'prepared') ? returned?.value : original;
    const ready = status.enabled && status.phase === 'connected';
    const pending = status.plans.filter(plan => plan.status === 'prepared' && plan.expiresAt > now);
    const newest = pending.at(-1)?.id;
    useEffect(() => {
        if (!autoOpen || !ready || !newest || seen.current.has(newest))
            return;
        seen.current.add(newest);
        setSelected(newest);
        setError(undefined);
    }, [autoOpen, ready, newest]);
    const work = async (task, submission, verificationId) => {
        if (locked.current)
            return;
        if (submission && submitted.current.has(submission.id))
            return;
        if (submission)
            submitted.current.add(submission.id);
        const current = generation.current;
        controller.current = new AbortController();
        locked.current = true;
        setBusy(true);
        setError(undefined);
        try {
            const result = await waitForCompetition(task, '比赛计划操作', 60_000, controller.current.signal);
            if (current === generation.current && result) {
                // Only a serialized, read-only server check can release an uncertain submission.
                if (result.id === verificationId && result.status === 'prepared' && !result.operationId)
                    submitted.current.delete(result.id);
                setReturned({ source: original, value: result });
            }
        }
        catch (error) {
            if (current === generation.current)
                setError(`${error instanceof Error ? error.message : '操作未完成。'}${submission ? '本次确认结果待核实，请勿重复提交。' : ''}`);
        }
        finally {
            if (current === generation.current) {
                locked.current = false;
                setBusy(false);
                void waitForCompetition(refresh, '比赛状态读取', 15_000).catch(error => {
                    if (current === generation.current)
                        setError(previous => previous || (error instanceof Error ? error.message : '请刷新状态。'));
                });
            }
        }
    };
    const list = _jsx(_Fragment, { children: status.plans.length === 0 ? _jsx("p", { className: css.muted, children: "\u7814\u7A76\u65B9\u6848\u7ECF\u4F60\u9009\u62E9\u540E\uFF0C\u9884\u6F14\u8BA1\u5212\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })
            : [...status.plans].reverse().slice(0, 30).map(item => _jsxs("button", { className: css.planRow, type: "button", disabled: busy, onClick: () => { setSelected(item.id); setError(undefined); }, children: [_jsxs("span", { children: [_jsx("strong", { children: item.summary }), _jsx("small", { children: contestTime(item.createdAt) })] }), _jsx("span", { children: item.status === 'prepared' && item.expiresAt <= now ? '已过期' : planStates[item.status] })] }, item.id)) });
    return _jsxs("section", { className: css.plans, "data-compact": compact || undefined, "aria-label": "\u6BD4\u8D5B\u4EA4\u6613\u8BA1\u5212", children: [compact ? _jsxs("button", { type: "button", onClick: () => { if (newest)
                    setSelected(newest);
                else
                    setHistoryOpen(true); }, children: ["\u6BD4\u8D5B\u8BA1\u5212", pending.length ? ` · ${pending.length} 笔待确认` : ''] })
                : _jsxs(_Fragment, { children: [_jsx("h2", { children: "\u4EA4\u6613\u8BA1\u5212\u4E0E\u56DE\u6267" }), list] }), compact && historyOpen && !plan && status.enabled && _jsx(ActionDialog, { title: "\u6BD4\u8D5B\u8BA1\u5212\u4E0E\u56DE\u6267", onClose: () => setHistoryOpen(false), children: list }), plan && status.enabled && _jsxs(ActionDialog, { title: "\u786E\u8BA4\u6BD4\u8D5B\u4EA4\u6613\u8BA1\u5212", busy: busy, error: error, onClose: () => setSelected(undefined), children: [_jsx(PlanDetails, { plan: plan }), _jsx("p", { role: "status", children: plan.status === 'prepared' && plan.expiresAt <= now ? '计划已过期，请回到研究会话重新预演。' : planStates[plan.status] }), plan.result && _jsxs("p", { className: css.muted, children: ["\u67DC\u53F0\u56DE\u62A5\uFF1A", display(plan.result.message ?? plan.result.status), plan.operationId ? ` · 操作号 ${plan.operationId}` : ''] }), _jsxs("footer", { className: css.actions, children: [plan.status === 'prepared' && _jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: busy || submitted.current.has(plan.id), onClick: () => { void work(async () => { await access.dismiss(plan); return { ...plan, status: 'cancelled' }; }); }, children: "\u53D6\u6D88\u8BA1\u5212" }), _jsx("button", { type: "button", "data-primary": true, disabled: busy || !ready || plan.expiresAt <= now || submitted.current.has(plan.id), onClick: () => { void work(() => access.execute(plan), plan); }, children: busy ? '正在提交…' : '确认执行这笔交易' }), submitted.current.has(plan.id) && !busy && _jsx("button", { type: "button", onClick: () => { void work(() => access.reconcile(plan), undefined, plan.id); }, children: "\u53EA\u8BFB\u6838\u5BF9\u786E\u8BA4\u7ED3\u679C" })] }), ['executing', 'queued', 'submitted', 'unknown', 'partial'].includes(plan.status) && _jsx("button", { type: "button", "data-primary": true, disabled: busy || !ready, onClick: () => { void work(() => access.reconcile(plan), undefined, plan.id); }, children: busy ? '查询中…' : '查询柜台回执' })] })] })] });
}
function PlanDetails({ plan }) {
    const parameters = asRecord(plan.details.parameters), quote = asRecord(plan.details.marketQuote);
    return _jsxs("div", { className: css.planDetails, children: [_jsx("h3", { children: plan.summary }), _jsxs("dl", { children: [_jsx("dt", { children: "\u4EFF\u771F\u8D26\u6237" }), _jsx("dd", { children: plan.identity.accountId }), _jsx("dt", { children: "\u8D5B\u4E8B\u7F16\u53F7" }), _jsx("dd", { children: plan.identity.contestId }), plan.operation === 'place_order' ? _jsxs(_Fragment, { children: [_jsx("dt", { children: "\u5B9E\u9645\u5408\u7EA6" }), _jsx("dd", { children: display(parameters.contractCode) }), _jsx("dt", { children: "\u624B\u6570" }), _jsxs("dd", { children: [display(parameters.volume), " \u624B"] }), _jsx("dt", { children: "\u59D4\u6258\u4EF7\u683C" }), _jsx("dd", { children: parameters.price === undefined ? '市价 IOC' : `${display(parameters.price)} · 限价 GFD` }), _jsx("dt", { children: "\u53C2\u8003\u6700\u65B0\u4EF7" }), _jsx("dd", { children: quote.ready === false ? '暂无行情快照' : display(quote.latestPrice) }), _jsx("dt", { children: "\u884C\u60C5\u65F6\u95F4" }), _jsx("dd", { children: display(quote.quoteTime) })] }) : _jsxs(_Fragment, { children: [_jsx("dt", { children: "\u59D4\u6258\u53F7" }), _jsx("dd", { children: display(parameters.orderId) }), _jsx("dt", { children: "\u5B9E\u9645\u5408\u7EA6" }), _jsx("dd", { children: display(quote.contractCode) }), _jsx("dt", { children: "\u65B9\u5411" }), _jsx("dd", { children: display(quote.tradeDirectionText) }), _jsx("dt", { children: "\u672A\u6210\u4EA4\u624B\u6570" }), _jsx("dd", { children: Number(quote.volume ?? quote.quantity ?? 0) - Number(quote.filledVolume ?? quote.filledQuantity ?? 0) })] }), _jsx("dt", { children: "\u8BA1\u5212\u6709\u6548\u671F\u81F3" }), _jsxs("dd", { children: [contestTime(plan.expiresAt), "\uFF08\u4E0A\u6D77\uFF09"] })] }), _jsx("p", { className: css.muted, children: "\u6267\u884C\u4F7F\u7528\u8FD9\u4EFD\u51BB\u7ED3\u8BA1\u5212\u3002\u4FEE\u6539\u53C2\u6570\u9700\u8981\u91CD\u65B0\u9884\u6F14\u3002" })] });
}
//# sourceMappingURL=ContestPlans.js.map