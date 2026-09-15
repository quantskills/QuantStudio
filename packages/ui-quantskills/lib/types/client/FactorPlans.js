import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { asRecord, contestTime, display } from "./contest.js";
import { factorStates } from "./factor-contest.js";
import css from './ContestPage.module.css';
import factorCss from './FactorContestPage.module.css';
import { FactorDataView } from "./FactorDataView.js";
export function FactorPlans({ status, access, refresh, compact = false }) {
    const [selected, select] = useState(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const active = useRef(false), generation = useRef(0);
    useEffect(() => () => { generation.current++; }, []);
    const plan = status.plans.find(p => p.id === selected);
    const ready = status.enabled && status.phase === 'connected';
    useEffect(() => { if (!ready) {
        select(undefined);
        setOpen(false);
        generation.current++;
    } }, [ready]);
    const perform = async (work) => {
        if (active.current)
            return;
        const current = generation.current;
        active.current = true;
        setBusy(true);
        setError('');
        try {
            await work();
            if (current === generation.current)
                await refresh();
        }
        catch (e) {
            if (current === generation.current)
                setError(e instanceof Error ? e.message : '操作未完成。');
        }
        finally {
            active.current = false;
            if (current === generation.current)
                setBusy(false);
        }
    };
    const list = _jsx("div", { className: css.plans, children: status.plans.length === 0 ? _jsx("p", { className: css.muted, children: "\u6682\u65E0\u8BA1\u5212\u3002\u5411 AI \u63D0\u51FA\u7814\u7A76\u76EE\u6807\uFF0C\u6216\u5728\u56E0\u5B50\u6C60\u9009\u62E9\u53C2\u8D5B\u64CD\u4F5C\u3002" }) : [...status.plans].reverse().slice(0, 50).map(p => _jsxs("button", { className: css.planRow, type: "button", onClick: () => { select(p.id); setError(''); }, children: [_jsxs("span", { children: [_jsx("strong", { children: p.summary }), _jsx("small", { children: contestTime(p.createdAt) })] }), _jsx("span", { children: factorStates[p.status] })] }, p.id)) });
    const action = plan?.action, pool = asRecord(asRecord(plan?.snapshot).pool);
    return _jsxs("div", { className: css.plans, "data-compact": compact, children: [compact ? _jsxs("button", { type: "button", onClick: () => setOpen(true), children: ["\u56E0\u5B50\u8BA1\u5212\uFF08", status.plans.filter(p => p.status === 'prepared').length, "\uFF09"] }) : _jsxs(_Fragment, { children: [_jsx("h2", { children: "\u64CD\u4F5C\u8BA1\u5212\u4E0E\u786E\u8BA4" }), list] }), compact && open && !plan && _jsx(ActionDialog, { title: "\u56E0\u5B50\u8BA1\u5212", wide: true, onClose: () => setOpen(false), children: list }), plan && action && _jsx(ActionDialog, { title: "\u786E\u8BA4\u56E0\u5B50\u6BD4\u8D5B\u64CD\u4F5C", wide: true, onClose: () => { if (!busy)
                    select(undefined); }, children: _jsxs("div", { className: css.planDetails, children: [_jsx("h3", { children: plan.summary }), _jsxs("dl", { children: [_jsx("dt", { children: "\u6BD4\u8D5B" }), _jsx("dd", { children: "\u7B2C\u56DB\u5C4A\u56E0\u5B50\u5927\u8D5B" }), _jsx("dt", { children: "\u8D26\u6237" }), _jsx("dd", { children: plan.identity.accountId }), _jsx("dt", { children: "\u72B6\u6001" }), _jsx("dd", { children: factorStates[plan.status] }), _jsx("dt", { children: "\u6709\u6548\u671F\u81F3" }), _jsx("dd", { children: contestTime(plan.expiresAt) })] }), action.kind === 'budget' ? _jsxs(_Fragment, { children: [_jsx("p", { children: action.batch.hypothesis }), _jsxs("dl", { children: [_jsx("dt", { children: "\u6700\u591A\u8FD0\u884C" }), _jsxs("dd", { children: [action.batch.maxRuns, " \u6B21"] }), _jsx("dt", { children: "\u7B97\u529B\u505C\u6B62\u9608\u503C" }), _jsx("dd", { children: action.batch.creditThreshold }), _jsx("dt", { children: "\u56DE\u6D4B\u533A\u95F4" }), _jsxs("dd", { children: [action.batch.startDate, " \u2014 ", action.batch.endDate] }), _jsx("dt", { children: "\u8C03\u4ED3\u5468\u671F" }), _jsxs("dd", { children: [action.batch.cycle, " \u4E2A\u4EA4\u6613\u65E5"] })] }), _jsx("p", { className: css.error, children: "\u8FD0\u884C\u6B21\u6570\u662F\u786C\u4E0A\u9650\u3002\u7B97\u529B\u9608\u503C\u4EC5\u963B\u6B62\u8FFD\u52A0\u56DE\u6D4B\uFF1B\u5DF2\u542F\u52A8\u7684\u56DE\u6D4B\u53EF\u80FD\u8D8A\u8FC7\u9608\u503C\u3002\u5173\u95ED\u6A21\u5F0F\u6216\u505C\u6B62\u6279\u6B21\u4E0D\u4F1A\u53D6\u6D88\u5E73\u53F0\u5DF2\u542F\u52A8\u4EFB\u52A1\u3002" }), plan.status === 'completed' && _jsx("p", { children: "\u9884\u7B97\u5DF2\u6388\u6743\u3002\u56DE\u5230\u672C\u5BF9\u8BDD\u53D1\u9001\u201C\u7EE7\u7EED\u7814\u7A76\u201D\uFF0CAI \u5373\u53EF\u5728\u6B64\u9884\u7B97\u5185\u8FD0\u884C\u3002" })] }) : _jsxs(_Fragment, { children: [_jsxs("dl", { children: [_jsx("dt", { children: "\u56E0\u5B50\u6C60" }), _jsx("dd", { children: 'name' in action ? action.name : display(pool.name) }), _jsx("dt", { children: "\u7EDF\u4E00\u5468\u671F" }), _jsxs("dd", { children: ['cycle' in action && action.cycle !== undefined ? action.cycle : display(pool.cycle), " \u4E2A\u4EA4\u6613\u65E5"] }), 'style' in action && _jsxs(_Fragment, { children: [_jsx("dt", { children: "\u98CE\u683C" }), _jsx("dd", { children: action.style || '未设置' })] }), 'workflowId' in action && _jsxs(_Fragment, { children: [_jsx("dt", { children: "\u5DE5\u4F5C\u6D41" }), _jsx("dd", { children: action.workflowId })] }), 'factorId' in action && _jsxs(_Fragment, { children: [_jsx("dt", { children: "\u76EE\u6807\u56E0\u5B50" }), _jsx("dd", { children: action.factorId })] })] }), action.kind === 'submit-pool' && _jsx("p", { className: css.error, children: "\u6B63\u5F0F\u63D0\u4EA4\u540E\uFF0C\u7EDF\u4E00\u8C03\u4ED3\u5468\u671F\u5C06\u9501\u5B9A\u3002\u8BF7\u6838\u5BF9\u6C60\u5185\u56E0\u5B50\u53CA\u5468\u671F\uFF1B\u63D0\u4EA4\u53D7\u7406\u540E\u4ECD\u9700\u7B49\u5F85\u8D5B\u4E8B\u521D\u59CB\u5316\u3002" }), action.kind === 'submit-pool' && Array.isArray(pool.factors) && _jsx(FactorDataView, { value: pool.factors.map(f => {
                                        const item = asRecord(f);
                                        return { factor_name: item.name, workflow_id: item.workflow, direction: item.direction, revision: item.revision };
                                    }) }), action.kind === 'remove-factor' && _jsx("p", { className: css.error, children: "\u5220\u9664\u540E\u6709\u6548\u56E0\u5B50\u4E0D\u8DB3 5 \u53EA\uFF0C\u53EF\u80FD\u5F71\u54CD\u5F53\u6708\u8BA1\u5206\u3002\u5DF2\u4EA7\u751F\u7684\u5386\u53F2\u6570\u636E\u6309\u8D5B\u4E8B\u89C4\u5219\u5904\u7406\u3002" }), _jsxs("details", { children: [_jsx("summary", { children: "\u6838\u5BF9\u56E0\u5B50\u6C60\u4E0E\u5DE5\u4F5C\u6D41\u5FEB\u7167" }), _jsx("pre", { className: factorCss.json, children: JSON.stringify(plan.snapshot, null, 2) })] })] }), plan.result !== undefined && _jsx("pre", { className: factorCss.json, children: JSON.stringify(plan.result, null, 2) }), error && _jsx("p", { role: "alert", className: css.error, children: error }), _jsxs("div", { className: css.actions, children: [plan.status === 'prepared' && _jsxs(_Fragment, { children: [_jsx("button", { type: "button", "data-primary": true, disabled: busy || !ready || plan.expiresAt <= Date.now()
                                                || plan.identity.accountId !== status.identity?.accountId || plan.identity.contestId !== status.identity?.contestId, onClick: () => { void perform(() => access.confirm(plan)); }, children: action.kind === 'budget' ? '确认授权本批次' : '确认执行此操作' }), _jsx("button", { type: "button", disabled: busy, onClick: () => { void perform(() => access.dismiss(plan)); }, children: "\u53D6\u6D88\u8BA1\u5212" })] }), plan.status === 'unknown' && _jsx("button", { type: "button", disabled: busy || !ready, onClick: () => { void perform(() => access.reconcilePlan(plan.id)); }, children: "\u53EA\u8BFB\u6838\u5BF9\u7ED3\u679C" })] })] }) })] });
}
//# sourceMappingURL=FactorPlans.js.map