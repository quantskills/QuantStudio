import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "../ActionDialog.js";
import { flyApi } from "./transport.js";
import './trader-journal.css';
export function TraderJournal({ actors, formatEvent }) {
    const [actor, setActor] = useState('all'), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
    const [data, setData] = useState(), [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [removal, setRemoval] = useState(), [busy, setBusy] = useState(false);
    const snapshot = useRef(undefined), request = useRef(0), deleting = useRef(false);
    const list = useRef(null);
    useEffect(() => {
        let disposed = false, timer;
        const load = async () => {
            if (disposed)
                return;
            if (deleting.current) {
                timer = setTimeout(load, 10_000);
                return;
            }
            const current = ++request.current;
            const query = new URLSearchParams({ actor, page: String(page) });
            if (snapshot.current !== undefined)
                query.set('snapshot', String(snapshot.current));
            try {
                const result = await flyApi(`journal?${query}`);
                if (disposed || current !== request.current)
                    return;
                snapshot.current = result.snapshot;
                setData(result);
                setError('');
                setSelected(previous => previous.filter(seq => result.events.some(event => event.seq === seq)));
            }
            catch (cause) {
                if (!disposed && current === request.current)
                    setError(cause instanceof Error ? cause.message : '记录读取失败，请重试。');
            }
            finally {
                if (!disposed) {
                    if (current === request.current)
                        setLoading(false);
                    timer = setTimeout(load, 10_000);
                }
            }
        };
        void load();
        return () => { disposed = true; clearTimeout(timer); };
    }, [actor, page, revision]);
    function navigate(next, fresh = false, source = actor) {
        request.current++;
        if (fresh)
            snapshot.current = undefined;
        setActor(source);
        setPage(next);
        setSelected([]);
        setLoading(true);
        setData(undefined);
        setError('');
        setMessage('');
        setRevision(value => value + 1);
        list.current?.scrollTo?.({ top: 0 });
    }
    function review(seqs) {
        if (!data)
            return;
        setRemoval({ actor, snapshot: data.snapshot, count: seqs?.length ?? data.total,
            label: seqs ? `选中的 ${seqs.length} 条记录` : `${actor === 'all' ? '所有来源' : actors[actor] || actor}中本次已加载范围的全部 ${data.total.toLocaleString()} 条记录`,
            ...(seqs ? { seqs } : { all_matching: true }) });
        setError('');
    }
    async function reviewAll() {
        if (deleting.current)
            return;
        deleting.current = true;
        request.current++;
        setBusy(true);
        setError('');
        try {
            // Count every source at confirmation time, independently of the current page/filter.
            const result = await flyApi('journal?actor=all&page=1');
            if (!result.total) {
                setMessage('暂无可删除的运行记录');
                return;
            }
            setRemoval({ actor: 'all', snapshot: result.snapshot, count: result.total, all_matching: true,
                label: `所有来源、全部分页中的 ${result.total.toLocaleString()} 条运行记录` });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '无法读取全部记录数量，请重试。');
        }
        finally {
            deleting.current = false;
            setBusy(false);
        }
    }
    async function remove() {
        if (!removal || deleting.current)
            return;
        deleting.current = true;
        request.current++;
        setBusy(true);
        setError('');
        try {
            const result = await flyApi('journal/delete', {
                actor: removal.actor, snapshot: removal.snapshot, confirm: true,
                ...(removal.seqs ? { seqs: removal.seqs } : { all_matching: true }),
            });
            setRemoval(undefined);
            setSelected([]);
            setData(undefined);
            setLoading(true);
            setMessage(`已删除 ${result.deleted.toLocaleString()} 条列表记录`);
            setRevision(value => value + 1);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '删除失败，请重试。');
        }
        finally {
            deleting.current = false;
            setBusy(false);
        }
    }
    const currentPage = data?.page ?? page;
    return _jsxs("section", { className: "fv-journal qs-trader-journal", "aria-label": "\u8FD0\u884C\u4E0E\u4EA4\u6613\u8BB0\u5F55", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("h2", { children: "\u8FD0\u884C\u4E0E\u4EA4\u6613\u8BB0\u5F55" }), _jsxs("p", { children: [data ? `共 ${data.total.toLocaleString()} 条` : '读取记录', " \u00B7 \u6BCF\u9875 20 \u6761"] })] }), _jsxs("div", { className: "qs-journal-tools", children: [_jsxs("select", { "aria-label": "\u8BB0\u5F55\u6765\u6E90", value: actor, disabled: busy, onChange: event => navigate(1, true, event.target.value), children: [_jsx("option", { value: "all", children: "\u6240\u6709\u6765\u6E90" }), Object.entries(actors).map(([id, label]) => _jsx("option", { value: id, children: label }, id))] }), _jsx("button", { type: "button", "aria-label": "\u5237\u65B0\u8BB0\u5F55", title: "\u5237\u65B0\u8BB0\u5F55", disabled: busy || loading, onClick: () => navigate(1, true), children: _jsx(ArrowClockwiseIcon, { size: 17 }) })] })] }), _jsxs("div", { className: "qs-journal-selection", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", "aria-label": "\u9009\u62E9\u672C\u9875\u5168\u90E8\u8BB0\u5F55", disabled: loading || busy || !data?.events.length, checked: !!data?.events.length && selected.length === data.events.length, onChange: event => setSelected(event.target.checked ? data.events.map(item => item.seq) : []) }), _jsx("span", { children: selected.length ? `已选 ${selected.length} 条` : '选择本页' })] }), selected.length > 0 && _jsx("button", { type: "button", disabled: busy || loading, onClick: () => review(selected), children: "\u5220\u9664\u6240\u9009" }), _jsxs("div", { className: "qs-journal-clear-actions", children: [actor !== 'all' && _jsx("button", { type: "button", disabled: busy || loading || !data?.total, onClick: () => review(), children: "\u6E05\u7406\u6B64\u6765\u6E90\u8BB0\u5F55" }), _jsxs("button", { type: "button", className: "qs-journal-clear", disabled: busy || loading || !data, onClick: () => void reviewAll(), children: [_jsx(TrashIcon, { size: 15, "aria-hidden": "true" }), "\u5220\u9664\u5168\u90E8"] })] })] }), data?.has_new && _jsx("button", { type: "button", className: "qs-journal-new", disabled: busy || loading, onClick: () => navigate(1, true), children: "\u6709\u65B0\u8BB0\u5F55\uFF0C\u70B9\u51FB\u5237\u65B0" }), error && !removal && _jsxs("p", { className: "qs-journal-error", role: "alert", children: [error, _jsx("button", { type: "button", onClick: () => navigate(currentPage), children: "\u91CD\u8BD5" })] }), message && _jsx("p", { role: "status", className: "qs-journal-message", children: message }), _jsx("div", { className: "qs-journal-list", ref: list, "aria-busy": loading, children: loading ? _jsx("div", { className: "fv-empty", role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u8BB0\u5F55\u2026" }) : data?.events.length ? data.events.map(event => _jsxs("article", { children: [_jsx("input", { type: "checkbox", "aria-label": `选择记录 #${event.seq}`, disabled: busy, checked: selected.includes(event.seq), onChange: e => setSelected(previous => e.target.checked ? [...previous, event.seq] : previous.filter(seq => seq !== event.seq)) }), _jsxs("div", { className: "qs-journal-entry", children: [_jsxs("div", { className: "fv-event-meta", children: [_jsx("b", { children: actors[event.actor] || event.actor }), _jsx("time", { dateTime: new Date(event.at * 1000).toISOString(), children: new Date(event.at * 1000).toLocaleString('zh-CN', { hour12: false }) }), _jsxs("small", { children: ["#", event.seq] })] }), _jsx("p", { children: formatEvent(event) }), event.decision_id && _jsxs("small", { className: "fv-note", children: ["\u51B3\u7B56 ", event.decision_id.slice(0, 12)] })] }), _jsx("button", { type: "button", className: "qs-journal-delete", "aria-label": `删除记录 #${event.seq}`, title: "\u5220\u9664\u6B64\u8BB0\u5F55", disabled: busy, onClick: () => review([event.seq]), children: _jsx(TrashIcon, { size: 16 }) })] }, event.seq)) : _jsx("div", { className: "fv-empty", children: error ? '暂时无法读取记录' : '暂无记录' }) }), _jsxs("footer", { className: "qs-journal-pagination", children: [_jsx("span", { children: data?.total ? `${(currentPage - 1) * 20 + 1}–${Math.min(currentPage * 20, data.total)} / ${data.total.toLocaleString()} 条` : '0 条记录' }), _jsxs("nav", { "aria-label": "\u8BB0\u5F55\u5206\u9875", children: [_jsx("button", { type: "button", "aria-label": "\u4E0A\u4E00\u9875", disabled: loading || busy || currentPage <= 1, onClick: () => navigate(currentPage - 1), children: _jsx(CaretLeftIcon, { size: 16 }) }), _jsxs("span", { children: ["\u7B2C ", currentPage, " / ", data?.pages ?? 1, " \u9875"] }), _jsx("button", { type: "button", "aria-label": "\u4E0B\u4E00\u9875", disabled: loading || busy || !data || currentPage >= data.pages, onClick: () => navigate(currentPage + 1), children: _jsx(CaretRightIcon, { size: 16 }) })] })] }), removal && _jsxs(ActionDialog, { title: removal.all_matching && removal.actor === 'all' ? '删除全部运行记录？' : '删除运行记录？', busy: busy, error: error || undefined, onClose: () => { setRemoval(undefined); setError(''); }, children: [_jsxs("p", { children: ["\u5C06\u5220\u9664", removal.label, "\u3002\u5220\u9664\u540E\u4E0D\u4F1A\u91CD\u65B0\u51FA\u73B0\u5728\u6B64\u5217\u8868\uFF0C\u65E0\u6CD5\u5728\u5217\u8868\u4E2D\u6062\u590D\u3002"] }), _jsx("p", { children: "\u6B64\u64CD\u4F5C\u53EA\u6E05\u7406\u8FD0\u884C\u8BB0\u5F55\u5217\u8868\u3002\u6210\u4EA4\u56DE\u6267\u3001\u6301\u4ED3\u3001\u76C8\u4E8F\u7EDF\u8BA1\u53CA\u7B56\u7565\u5BA1\u8BA1\u5E95\u8D26\u4F1A\u4FDD\u7559\uFF1B\u786E\u8BA4\u671F\u95F4\u4EA7\u751F\u7684\u65B0\u8BB0\u5F55\u4E0D\u4F1A\u88AB\u5220\u9664\u3002" }), _jsxs("div", { className: "qs-journal-confirm", children: [_jsx("button", { type: "button", disabled: busy, onClick: () => { setRemoval(undefined); setError(''); }, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "qs-journal-confirm-delete", disabled: busy, onClick: () => void remove(), children: busy ? '正在删除…' : `确认删除 ${removal.count.toLocaleString()} 条` })] })] })] });
}
//# sourceMappingURL=TraderJournal.js.map