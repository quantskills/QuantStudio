import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ArchiveBoxIcon, ArrowCounterClockwiseIcon, TrashIcon } from '@phosphor-icons/react';
import { ActionDialog } from "./ActionDialog.js";
import { SessionActionsMenu } from "./SessionActionsMenu.js";
import css from './ArchivedSessions.module.css';
const labels = { plain: '普通会话', skill: '技能', agent: '专家', team: '专家团' };
const message = (error) => error instanceof Error ? error.message : '操作失败，请重试。';
export function DeleteSessionConfirmation({ title, busy, error, onClose, onConfirm, heading = '删除会话？', confirmLabel = '会话删除', retainedRunningCount = 0, ids, filesAccess, onComplete }) {
    const [previews, setPreviews] = useState();
    const [loading, setLoading] = useState(false);
    const [filesError, setFilesError] = useState();
    const defaultButton = useRef(null);
    const reviewingFiles = Boolean(previews);
    // Focus after the native dialog opens; reviewing files defaults to going back.
    useEffect(() => { defaultButton.current?.focus(); }, [reviewingFiles]);
    const disabled = busy || loading;
    const preview = async () => {
        if (!filesAccess || !ids)
            return;
        setLoading(true);
        setFilesError(undefined);
        try {
            setPreviews(await filesAccess.preview(ids));
        }
        catch (cause) {
            setFilesError(message(cause));
        }
        finally {
            setLoading(false);
        }
    };
    const complete = async () => {
        if (!filesAccess || !previews)
            return;
        setLoading(true);
        setFilesError(undefined);
        try {
            await filesAccess.remove(previews);
            onComplete?.();
            onClose();
        }
        catch (cause) {
            setFilesError(message(cause));
            setPreviews(undefined);
        }
        finally {
            setLoading(false);
        }
    };
    const files = previews?.flatMap(preview => preview.files) ?? [];
    const retained = previews?.flatMap(preview => preview.retained) ?? [];
    return _jsxs(ActionDialog, { title: previews ? '再次确认完整删除' : heading, busy: disabled, error: filesError ?? error, onClose: onClose, children: [_jsxs("p", { children: ["\u300C", title, "\u300D\u7684\u5BF9\u8BDD\u8BB0\u5F55\u53CA\u5B50\u4EFB\u52A1\u8BB0\u5F55\u5C06\u88AB\u6C38\u4E45\u5220\u9664\uFF0C\u65E0\u6CD5\u6062\u590D\u3002"] }), previews ? _jsxs(_Fragment, { children: [_jsx("p", { children: files.length ? `完整删除还会永久删除以下 ${files.length} 个生成文件，文件删除后无法恢复。请核对清单后再确认。` : '未找到可安全清理的生成文件。本次仅删除会话记录，工作区文件保留。' }), files.length > 0 && _jsx("ul", { className: css.fileList, children: files.map(file => _jsxs("li", { children: [_jsx("code", { children: file.path }), _jsxs("small", { children: [Math.max(1, Math.ceil(file.bytes / 1024)), " KB"] })] }, file.path)) }), retained.length > 0 && _jsxs("details", { className: css.retained, children: [_jsxs("summary", { children: [retained.length, " \u4E2A\u6587\u4EF6\u6216\u8DEF\u5F84\u5C06\u4FDD\u7559"] }), _jsx("ul", { children: retained.map((file, index) => _jsxs("li", { children: [_jsx("code", { children: file.path }), _jsx("small", { children: file.reason })] }, index)) })] }), _jsx("p", { children: "\u4E0A\u4F20\u6587\u4EF6\u3001\u5DE5\u4F5C\u533A\u539F\u6709\u6587\u4EF6\u3001\u5176\u4ED6\u4F1A\u8BDD\u5F15\u7528\u7684\u6587\u4EF6\uFF0C\u4EE5\u53CA\u5DF2\u521B\u5EFA\u7684\u6280\u80FD\u3001\u4E13\u5BB6\u548C\u4E13\u5BB6\u56E2\u4F1A\u4FDD\u7559\u3002\u4E0D\u4F1A\u6E05\u7A7A\u6574\u4E2A\u5DE5\u4F5C\u533A\u3002" })] }) : _jsx("p", { children: "\u9ED8\u8BA4\u300C\u4F1A\u8BDD\u5220\u9664\u300D\u4EC5\u5220\u9664\u4F1A\u8BDD\u8BB0\u5F55\uFF0C\u4FDD\u7559\u751F\u6210\u6587\u4EF6\u3002\u9009\u62E9\u300C\u5B8C\u6574\u5220\u9664\u300D\u540E\uFF0C\u9700\u8981\u6838\u5BF9\u6587\u4EF6\u6E05\u5355\u5E76\u518D\u6B21\u786E\u8BA4\u3002\u5DF2\u521B\u5EFA\u7684\u6280\u80FD\u3001\u4E13\u5BB6\u3001\u4E13\u5BB6\u56E2\u4F1A\u4FDD\u7559\u3002" }), retainedRunningCount > 0 && _jsxs("p", { children: [retainedRunningCount, " \u4E2A\u8FD0\u884C\u4E2D\u7684\u4F1A\u8BDD\u4F1A\u4FDD\u7559\u3002"] }), _jsxs("footer", { className: css.actions, children: [_jsx("button", { type: "button", disabled: disabled, onClick: onClose, children: "\u53D6\u6D88" }), previews ? _jsxs(_Fragment, { children: [_jsx("button", { ref: defaultButton, type: "button", disabled: disabled, onClick: () => setPreviews(undefined), children: "\u8FD4\u56DE" }, "back"), _jsx("button", { type: "button", className: css.danger, disabled: disabled, onClick: () => { void complete(); }, children: loading ? '正在删除…' : '确认完整删除' }, "confirm-full")] }) : _jsxs(_Fragment, { children: [filesAccess && ids && _jsx("button", { type: "button", disabled: disabled, onClick: () => { void preview(); }, children: loading ? '正在核对文件…' : '完整删除' }, "preview-full"), _jsx("button", { ref: defaultButton, type: "button", className: css.primary, disabled: disabled, onClick: onConfirm, children: busy ? '正在删除…' : confirmLabel }, "session-only")] })] })] });
}
export function ArchiveSessionConfirmation({ title, busy, error, onClose, onConfirm }) {
    return _jsxs(ActionDialog, { title: "\u5F52\u6863\u4F1A\u8BDD\uFF1F", busy: busy, error: error, onClose: onClose, children: [_jsxs("p", { children: [title, "\u5C06\u4ECE\u5F53\u524D\u4F1A\u8BDD\u5217\u8868\u79FB\u51FA\uFF0C\u5BF9\u8BDD\u8BB0\u5F55\u4F1A\u4FDD\u7559\u3002"] }), _jsx("p", { children: "\u4E4B\u540E\u53EF\u5728\u300C\u8BBE\u7F6E \u2192 \u5F52\u6863\u4F1A\u8BDD\u300D\u4E2D\u67E5\u770B\u6216\u6062\u590D\uFF0C\u7EE7\u7EED\u539F\u6765\u7684\u5BF9\u8BDD\u3002" }), _jsxs("footer", { className: css.actions, children: [_jsx("button", { type: "button", disabled: busy, onClick: onClose, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: css.primary, disabled: busy, onClick: onConfirm, children: busy ? '正在归档…' : '确认归档' })] })] });
}
/** Cards and the conversation sidebar share the same compact action menu. */
export function SessionHistoryMenu({ id, title, running, access }) {
    const [archiving, setArchiving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState();
    if (!access)
        return null;
    const archive = async () => {
        setBusy(true);
        setError(undefined);
        try {
            await access.archive([id]);
            setArchiving(false);
        }
        catch (cause) {
            setError(message(cause));
        }
        finally {
            setBusy(false);
        }
    };
    const remove = async () => {
        setBusy(true);
        setError(undefined);
        try {
            await access.remove([id]);
            setDeleting(false);
        }
        catch (cause) {
            setError(message(cause));
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs(_Fragment, { children: [_jsx(SessionActionsMenu, { title: title, running: running, onArchive: () => { setArchiving(true); setError(undefined); }, onRemove: () => { setDeleting(true); setError(undefined); } }), archiving && _jsx(ArchiveSessionConfirmation, { title: `「${title}」`, busy: busy, error: error, onClose: () => setArchiving(false), onConfirm: () => { void archive(); } }), deleting && _jsx(DeleteSessionConfirmation, { title: title, busy: busy, error: error, ids: [id], filesAccess: access.files, onClose: () => setDeleting(false), onConfirm: () => { void remove(); } })] });
}
export function ArchivedSessions({ access }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState();
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState();
    const reload = async () => {
        if (!access) {
            setLoading(false);
            setError('归档服务暂不可用，请重新加载应用。');
            return;
        }
        setLoading(true);
        setError(undefined);
        try {
            setRows(await access.list());
        }
        catch (cause) {
            setError(message(cause));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void reload(); }, [access]);
    const change = async (row, action) => {
        if (!access)
            return;
        setBusy(true);
        setError(undefined);
        setNotice('');
        try {
            if (action === 'restore')
                await access.restore(row.sessionId);
            else
                await access.remove([row.sessionId]);
            setRows(previous => previous.filter(item => item.sessionId !== row.sessionId));
            setPending(undefined);
            setNotice(action === 'restore' ? '已恢复，可在会话列表继续原来的对话。' : '会话已永久删除。');
        }
        catch (cause) {
            setError(message(cause));
        }
        finally {
            setBusy(false);
        }
    };
    const filtered = rows.filter(row => `${row.title} ${labels[row.kind]}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    return _jsxs("div", { className: css.archives, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsxs("h2", { children: ["\u5F52\u6863\u4F1A\u8BDD ", _jsx("span", { children: rows.length })] }), _jsx("p", { children: "\u5F52\u6863\u4FDD\u7559\u5B8C\u6574\u5BF9\u8BDD\u3002\u6062\u590D\u540E\u53EF\u7EE7\u7EED\uFF0C\u6C38\u4E45\u5220\u9664\u540E\u65E0\u6CD5\u627E\u56DE\u3002" })] }), _jsx("button", { type: "button", disabled: loading || busy, onClick: () => { void reload(); }, children: "\u5237\u65B0" })] }), _jsx("input", { className: css.search, "aria-label": "\u641C\u7D22\u5F52\u6863\u4F1A\u8BDD", placeholder: "\u641C\u7D22\u4F1A\u8BDD\u540D\u79F0\u6216\u7C7B\u578B", value: search, onChange: event => setSearch(event.target.value) }), error && !pending && _jsx("p", { role: "alert", className: css.error, children: error }), notice && _jsx("p", { role: "status", children: notice }), loading ? _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u5F52\u6863\u2026" }) : filtered.length === 0 ? _jsxs("div", { className: css.empty, children: [_jsx(ArchiveBoxIcon, { size: 35 }), _jsx("h3", { children: search ? '没有匹配的归档会话' : '暂无归档会话' }), _jsx("p", { children: search ? '试试其他名称或会话类型。' : '在会话的操作菜单中选择“归档”，即可在这里管理。' })] }) : _jsx("ul", { className: css.list, children: filtered.map(row => _jsxs("li", { children: [_jsx(ArchiveBoxIcon, { size: 23 }), _jsxs("div", { className: css.description, children: [_jsx("b", { children: row.title }), _jsxs("small", { children: [labels[row.kind], " \u00B7 ", new Date(row.updatedAt).toLocaleString('zh-CN')] })] }), _jsxs("div", { className: css.actions, children: [_jsxs("button", { type: "button", disabled: busy || row.running, onClick: () => { void change(row, 'restore'); }, "aria-label": `恢复 ${row.title}`, children: [_jsx(ArrowCounterClockwiseIcon, { size: 17 }), "\u6062\u590D"] }), _jsxs("button", { type: "button", disabled: busy || row.running, onClick: () => { setPending(row); setError(undefined); }, "aria-label": `会话删除 ${row.title}`, children: [_jsx(TrashIcon, { size: 17 }), "\u5220\u9664"] })] })] }, row.sessionId)) }), pending && _jsx(DeleteSessionConfirmation, { title: pending.title, busy: busy, error: error, ids: [pending.sessionId], filesAccess: access?.files, onComplete: () => { void reload(); }, onClose: () => setPending(undefined), onConfirm: () => { void change(pending, 'delete'); } })] });
}
//# sourceMappingURL=ArchivedSessions.js.map