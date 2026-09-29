import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { asRecord, display } from "./contest.js";
import { waitForCompetition } from "./competition-async.js";
import css from './FactorContestPage.module.css';
/** Updates are platform-owned versions of one factor, not arbitrary replacement IDs. */
export function FactorWorkflowUpdate({ factorId, workflowId, access, busy, submit }) {
    const [page, setPage] = useState(1), [value, setValue] = useState(), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setValue(undefined);
        void waitForCompetition(signal => access.query({ kind: 'workflows', page }, signal), '工作流版本查询', 30_000, controller.signal)
            .then(result => { if (!controller.signal.aborted)
            setValue(result); })
            .catch(error => { if (!controller.signal.aborted)
            setError(error instanceof Error ? error.message : '版本查询失败'); })
            .finally(() => { if (!controller.signal.aborted)
            setLoading(false); });
        return () => controller.abort();
    }, [access, factorId, workflowId, page]);
    const result = asRecord(value), items = Array.isArray(result.items) ? result.items.map(asRecord) : [];
    const related = items.filter(item => item.factor_instance_id === factorId || item.workflow_id === workflowId);
    const versions = related.filter(item => item.action === 'update' && item.action_enabled === true);
    const more = typeof result.total === 'number' ? page * 50 < result.total : items.length >= 50;
    return _jsxs("div", { className: css.form, children: [_jsx("p", { children: "\u66F4\u65B0\u5F53\u524D\u56E0\u5B50\u7684\u6210\u529F\u8FD0\u884C\u5FEB\u7167\u3002\u66F4\u6362\u4E3A\u53E6\u4E00\u53EA\u56E0\u5B50\uFF0C\u8BF7\u5148\u79FB\u9664\u539F\u56E0\u5B50\uFF0C\u518D\u4ECE\u53EF\u5165\u6C60\u5DE5\u4F5C\u6D41\u4E2D\u6DFB\u52A0\u3002" }), _jsxs("p", { children: ["\u5F53\u524D\u5DE5\u4F5C\u6D41\uFF1A", workflowId] }), loading ? _jsx("p", { role: "status", children: "\u6B63\u5728\u68C0\u67E5\u53EF\u66F4\u65B0\u7248\u672C\u2026" }) : error ? _jsx("p", { role: "alert", children: error }) : versions.length ? versions.map(item => _jsxs("div", { className: css.row, children: [_jsxs("div", { children: [_jsx("strong", { children: display(item.name) }), _jsx("p", { children: display(item.workflow_id) })] }), _jsx("button", { type: "button", disabled: busy, onClick: () => submit(String(item.workflow_id)), children: "\u4F7F\u7528\u6B64\u7248\u672C\u751F\u6210\u786E\u8BA4\u8BA1\u5212" })] }, String(item.workflow_id)))
                : _jsx("p", { children: related.length ? '当前已是最新版本，没有新的成功运行快照。' : more || page > 1 ? '本页没有当前因子的更新版本。' : '暂无可更新版本。请在平台完成当前工作流的新一次回测后再检查。' }), (page > 1 || more) && _jsxs("div", { className: css.pagination, children: [_jsx("button", { type: "button", disabled: loading || busy || page === 1, onClick: () => setPage(page - 1), children: "\u4E0A\u4E00\u9875" }), _jsxs("span", { children: ["\u7B2C ", page, " \u9875"] }), _jsx("button", { type: "button", disabled: loading || busy || !more, onClick: () => setPage(page + 1), children: "\u4E0B\u4E00\u9875" })] })] });
}
//# sourceMappingURL=FactorWorkflowUpdate.js.map