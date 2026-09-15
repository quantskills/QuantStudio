import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { ContestPlans } from "./ContestPlans.js";
import { CompetitionDock } from "./CompetitionDock.js";
import { ContestTable } from "./ContestPage.js";
import { asRecord, contestTime, display, useContest } from "./contest.js";
import css from './ContestPage.module.css';
/** Normal sessions never mount a contest poller or load account context. */
export function ContestReview({ useSessions, access, openContest }) {
    const session = useSessions(state => state.current ? state.byId[state.current] : undefined);
    const binding = session?.projectionValues?.quantSkillsPlainSession;
    if (!session || binding?.purpose !== 'contest')
        return null;
    return _jsx(SessionContestReview, { sessionId: session.id, binding: binding, running: session.running, access: access, openContest: openContest }, session.id);
}
function SessionContestReview({ sessionId, binding, running, access, openContest }) {
    const { status, refresh, error, busy, run } = useContest(access, sessionId);
    const [inspection, setInspection] = useState(), [inspectionError, setInspectionError] = useState('');
    const [checking, setChecking] = useState(false), [details, setDetails] = useState(false), [symbol, setSymbol] = useState('');
    const reads = useRef(0);
    const identity = binding.contest;
    const matches = status?.identity?.accountId === identity.accountId && status?.identity?.contestId === identity.contestId;
    const ready = Boolean(status?.enabled && status.phase === 'connected' && matches);
    const inspect = async () => {
        const id = ++reads.current;
        setChecking(true);
        setInspectionError('');
        try {
            const next = await access.inspect(sessionId);
            if (reads.current === id && next.identity.accountId === identity.accountId && next.identity.contestId === identity.contestId)
                setInspection(next);
        }
        catch (error) {
            if (reads.current === id)
                setInspectionError(error instanceof Error ? error.message : '账户巡检未完成。');
        }
        finally {
            if (reads.current === id)
                setChecking(false);
        }
    };
    useEffect(() => {
        setInspection(undefined);
        setInspectionError('');
        setChecking(false);
        if (ready)
            void inspect();
        return () => { reads.current++; };
    }, [ready, sessionId, access]);
    const research = (text) => { void run('research', () => access.requestResearch(sessionId, text)); };
    const account = asRecord(inspection?.account.data);
    return _jsxs(CompetitionDock, { kind: "contest", label: "\u6BD4\u8D5B\u4E13\u7528\u5BF9\u8BDD", title: _jsxs(_Fragment, { children: ["\u4EFF\u771F\u6BD4\u8D5B \u00B7 ", binding.contestConversation === 'topic' ? '专题研究' : binding.contestConversation === 'main' ? '账户主对话' : '比赛研究'] }), subtitle: _jsxs(_Fragment, { children: ["\u300C\u5DC5\u5CF0\u4EA4\u6613\u8005\u300D\u5168\u56FD\u671F\u8D27\u6A21\u62DF\u8D5B \u00B7 \u8D26\u6237 ", identity.accountId, " \u00B7 ", identity.contestId] }), actions: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: openContest, children: "\u6BD4\u8D5B\u5DE5\u4F5C\u53F0" }), ready && status && _jsx(ContestPlans, { status: status, access: access, refresh: refresh, compact: true, autoOpen: !running })] }), children: [!status ? _jsx("p", { role: "status", children: "\u8BFB\u53D6\u6BD4\u8D5B\u72B6\u6001\u2026" }) : !ready ? _jsx("p", { role: "status", children: !status.enabled ? '比赛模式已关闭，普通会话照常使用。已提交委托仍由柜台处理。'
                    : !matches && status.phase === 'connected' ? '当前登录账户与本会话不一致，请回比赛工作台进入对应账户主对话。' : '请在比赛工作台连接并验证账户。' }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: css.inspection, "aria-live": "polite", children: [checking && _jsx("span", { children: "\u6B63\u5728\u53EA\u8BFB\u5DE1\u68C0\u8D26\u6237\u2026" }), inspection && _jsxs(_Fragment, { children: [_jsxs("span", { children: ["\u52A8\u6001\u6743\u76CA ", display(account.equity ?? account.totalProfit), " \u00B7 \u53EF\u7528\u8D44\u91D1 ", display(account.availableFunds)] }), _jsx("p", { children: inspection.summary.join(' ') }), _jsxs("small", { children: ["\u5FEB\u7167\uFF1A", contestTime(inspection.fetchedAt), "\uFF08\u4E0A\u6D77\uFF09\uFF0C\u5206\u6790\u4E0E\u9884\u6F14\u524D\u91CD\u65B0\u6838\u5BF9\u3002"] })] }), inspectionError && _jsx("p", { role: "alert", children: inspectionError })] }), _jsxs("div", { className: css.conversationActions, children: [_jsx("button", { type: "button", disabled: checking, onClick: () => { void inspect(); }, children: "\u5237\u65B0\u5DE1\u68C0" }), _jsx("button", { type: "button", disabled: !inspection, onClick: () => setDetails(true), children: "\u8D26\u6237\u8BE6\u60C5" }), _jsx("button", { type: "button", disabled: running || Boolean(busy), onClick: () => research('请先巡检我的比赛账户，再研究现有持仓。展示数据时间、依据和候选方案，暂不生成交易预演。'), children: "\u7814\u7A76\u6301\u4ED3" }), _jsx("button", { type: "button", disabled: running || Boolean(busy), onClick: () => research('请复盘今天的比赛交易，对照本账户计划、委托、成交和结算，列出待核实事项。不要生成新订单。'), children: "\u4ECA\u65E5\u590D\u76D8" })] }), _jsxs("form", { className: css.symbolResearch, onSubmit: event => { event.preventDefault(); if (symbol.trim() && !running && !busy)
                            research(`请研究比赛品种/合约 ${symbol.trim()}，先巡检账户并核对数据覆盖与时间，再给依据和候选方案，暂不生成交易预演。`); }, children: [_jsx("input", { "aria-label": "\u7814\u7A76\u54C1\u79CD\u6216\u5408\u7EA6", value: symbol, maxLength: 80, placeholder: "\u7814\u7A76\u54C1\u79CD\u6216\u5408\u7EA6\uFF0C\u4F8B\u5982 rb2610", onChange: event => setSymbol(event.target.value) }), _jsx("button", { type: "submit", disabled: !symbol.trim() || running || Boolean(busy), children: "\u7814\u7A76\u54C1\u79CD" })] }), details && inspection && _jsxs(ActionDialog, { title: "\u6BD4\u8D5B\u8D26\u6237\u5DE1\u68C0", wide: true, onClose: () => setDetails(false), children: [_jsxs("p", { children: ["\u8D26\u6237 ", identity.accountId, " \u00B7 ", contestTime(inspection.fetchedAt), "\uFF08\u4E0A\u6D77\uFF09"] }), _jsx("h3", { children: "\u8D44\u91D1" }), _jsx(ContestTable, { value: inspection.account.data }), _jsx("h3", { children: "\u6301\u4ED3" }), _jsx(ContestTable, { value: inspection.positions.data }), _jsx("h3", { children: "\u6D3B\u52A8\u59D4\u6258" }), _jsx(ContestTable, { value: inspection.openOrders.data }), _jsxs("p", { children: ["\u5F85\u5904\u7406\u8BA1\u5212 ", inspection.pendingPlans.length, " \u7B14\u3002\u5F53\u524D\u4F1A\u8BDD\u8BA1\u5212\u53EF\u5728\u201C\u6BD4\u8D5B\u8BA1\u5212\u201D\u67E5\u770B\uFF0C\u5176\u4ED6\u4F1A\u8BDD\u8BA1\u5212\u53EF\u5728\u6BD4\u8D5B\u5DE5\u4F5C\u53F0\u67E5\u770B\u3002"] })] })] }), error && _jsx("p", { role: "alert", children: error })] });
}
//# sourceMappingURL=ContestReview.js.map