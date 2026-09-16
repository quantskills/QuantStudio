import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useFactorContest } from "./factor-contest.js";
import { FactorPlans } from "./FactorPlans.js";
import { CompetitionDock } from "./CompetitionDock.js";
import { asRecord, contestTime, display } from "./contest.js";
import css from './ContestPage.module.css';
import { waitForCompetition } from "./competition-async.js";
export function FactorContestReview({ useSessions, access, openContest }) {
    const session = useSessions(s => s.current ? s.byId[s.current] : undefined), binding = session?.projectionValues?.quantSkillsPlainSession;
    if (!session || binding?.purpose !== 'factor-contest')
        return null;
    return _jsx(SessionFactorReview, { sessionId: session.id, binding: binding, running: session.running, access: access, openContest: openContest }, session.id);
}
function SessionFactorReview({ sessionId, binding, running, access, openContest }) {
    const { status, error, busy, run, refresh } = useFactorContest(access, sessionId);
    const [inspection, setInspection] = useState(), [inspectError, setInspectError] = useState(''), serial = useRef(0);
    const [retry, setRetry] = useState(0);
    const identity = binding.factorContest;
    const ready = status?.enabled && status.phase === 'connected' && status.identity?.accountId === identity.accountId && status.identity?.contestId === identity.contestId;
    useEffect(() => {
        const current = ++serial.current;
        const controller = new AbortController();
        setInspection(undefined);
        setInspectError('');
        if (ready)
            void waitForCompetition(signal => access.inspect(sessionId, signal), '因子账户巡检', 30_000, controller.signal).then(next => { if (serial.current === current && next.identity.accountId === identity.accountId && next.identity.contestId === identity.contestId)
                setInspection(next); })
                .catch(e => { if (serial.current === current)
                setInspectError(e instanceof Error ? e.message : '巡检失败。'); });
        return () => { serial.current++; controller.abort(); };
    }, [ready, access, sessionId, retry]);
    return _jsxs(CompetitionDock, { kind: "factor-contest", label: "\u56E0\u5B50\u6BD4\u8D5B\u4E13\u7528\u5BF9\u8BDD", title: _jsxs(_Fragment, { children: ["\u7B2C\u56DB\u5C4A\u56E0\u5B50\u5927\u8D5B \u00B7 ", binding.contestConversation === 'topic' ? '专题研究' : '账户主对话'] }), subtitle: _jsxs(_Fragment, { children: ["\u8D26\u6237 ", identity.accountId] }), actions: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: openContest, children: "\u56E0\u5B50\u6BD4\u8D5B\u5DE5\u4F5C\u53F0" }), ready && status && _jsx(FactorPlans, { status: status, access: access, refresh: refresh, compact: true })] }), children: [!ready ? _jsx("p", { role: "status", children: "\u8BF7\u5728\u6BD4\u8D5B\u5DE5\u4F5C\u53F0\u5F00\u542F\u56E0\u5B50\u6A21\u5F0F\u5E76\u8FDE\u63A5\u672C\u5BF9\u8BDD\u5BF9\u5E94\u8D26\u6237\u3002" }) : _jsxs(_Fragment, { children: [_jsx("p", { children: inspection ? `算力 ${display(inspection.balance)} · 因子池 ${display(asRecord(inspection.pool).name)} · 快照 ${contestTime(inspection.fetchedAt)}` : inspectError ? '因子账户巡检未完成。' : '正在只读巡检因子账户…' }), inspectError && _jsx("button", { type: "button", onClick: () => setRetry(value => value + 1), children: "\u91CD\u8BD5\u8D26\u6237\u5DE1\u68C0" }), _jsxs("div", { className: css.conversationActions, children: [_jsx("button", { type: "button", disabled: running || Boolean(busy), onClick: () => { void run('research', () => access.requestResearch(sessionId, '请先巡检因子账户并说明比赛因子池状态，再帮我制定一批因子研究计划。先确定假设、日期、周期、运行次数和算力停止阈值，等待预算确认。')); }, children: "\u5236\u5B9A\u7814\u7A76\u8BA1\u5212" }), _jsx("button", { type: "button", disabled: running || Boolean(busy), onClick: () => { void run('research', () => access.requestResearch(sessionId, '请读取本会话已授权预算与回测记录，继续预算内的因子研究。遇到未知回执停止，不重复启动；没有有效预算时先说明。')); }, children: "\u7EE7\u7EED\u9884\u7B97\u5185\u7814\u7A76" }), _jsx("button", { type: "button", disabled: running || Boolean(busy), onClick: () => { void run('research', () => access.requestResearch(sessionId, '请复盘本账户已有因子回测结果，比较样本内外表现、多头超额和换手，筛选可入池候选。只做研究，不启动新回测或提交参赛。')); }, children: "\u590D\u76D8\u4E0E\u7B5B\u9009" }), status?.budgets.filter(b => b.status === 'active').map(b => _jsxs("button", { type: "button", onClick: () => { void run('stop', () => access.stopBudget(b.id)); }, children: ["\u505C\u6B62\u6279\u6B21\uFF08", b.runsUsed, "/", b.maxRuns, " \u6B21\uFF09"] }, b.id))] })] }), (error || inspectError) && _jsx("p", { role: "alert", children: error || inspectError })] });
}
//# sourceMappingURL=FactorContestReview.js.map