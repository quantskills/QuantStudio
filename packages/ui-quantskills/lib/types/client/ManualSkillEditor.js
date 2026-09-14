import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import css from './capability-editor.module.css';
export function ManualSkillEditor({ source, save, onSaved, onClose }) {
    const [identity] = useState(() => `skill-user-${crypto.randomUUID()}`);
    const [markdown, setMarkdown] = useState(`---\nname: ${identity}\ndescription: 描述技能的用途和适用场景。\n---\n\n# 我的技能\n\n## 执行步骤\n1. 检查用户提供的输入。\n2. 按要求处理，并说明数据来源。\n\n## 交付与检查\n- 输出结果和检查依据；遇到缺失信息时明确说明。\n`);
    const [initial, setInitial] = useState(markdown);
    const [loading, setLoading] = useState(!!source), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [ready, setReady] = useState(!source);
    const [discard, setDiscard] = useState(false), [reload, setReload] = useState(0);
    const lock = useRef(false), live = useRef(true), back = useRef(null);
    useEffect(() => { live.current = true; back.current?.focus(); return () => { live.current = false; }; }, []);
    useEffect(() => {
        if (!source)
            return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        void source.read(controller.signal).then(value => {
            if (!controller.signal.aborted) {
                setMarkdown(value);
                setInitial(value);
                setLoading(false);
                setReady(true);
            }
        }, cause => { if (!controller.signal.aborted) {
            setError(String(cause));
            setLoading(false);
        } });
        return () => controller.abort();
    }, [source, reload]);
    const mode = !source ? 'create' : source.personal ? 'edit' : 'copy';
    const close = () => { if (!lock.current) {
        if (markdown !== initial)
            setDiscard(true);
        else
            onClose();
    } };
    return _jsxs("section", { className: css.editor, "aria-label": "\u624B\u52A8\u7F16\u8F91\u6280\u80FD", children: [_jsx("button", { ref: back, type: "button", className: css.back, disabled: busy, onClick: close, children: "\u2190 \u8FD4\u56DE\u6280\u80FD\u5E93" }), _jsxs("header", { children: [_jsx("small", { children: "\u6211\u7684\u521B\u5EFA \u00B7 \u6280\u80FD" }), _jsx("h1", { children: mode === 'create' ? '创建技能' : mode === 'copy' ? '另存为我的技能' : '编辑技能' }), _jsxs("p", { children: [source ? `基于「${source.name}」的固定版本，保留脚本和其他资源。` : '填写用途和执行说明，直接保存，无需调用模型或创建项目。', "\u5DF2\u6709\u4F1A\u8BDD\u548C\u5B89\u6392\u4E0D\u53D7\u5F71\u54CD\u3002"] })] }), _jsxs("form", { onSubmit: event => {
                    event.preventDefault();
                    if (lock.current || loading || !ready)
                        return;
                    lock.current = true;
                    setBusy(true);
                    setError('');
                    void save({ markdown, mode, ...(source?.versionId ? { sourceVersionId: source.versionId } : {}), ...(mode === 'copy' ? { copyAssetId: identity } : {}) })
                        .then(result => { if (live.current)
                        onSaved(result.assetId); }, cause => { if (live.current)
                        setError(cause instanceof Error ? cause.message : '保存失败，草稿已保留。'); })
                        .finally(() => { lock.current = false; if (live.current)
                        setBusy(false); });
                }, children: [_jsx("label", { htmlFor: "manual-skill-declaration", children: "\u6280\u80FD\u58F0\u660E \u00B7 SKILL.md" }), _jsxs("p", { className: css.hint, children: ["description \u5199\u9002\u7528\u573A\u666F\uFF1B\u4E0B\u65B9\u6B63\u6587\u5199\u6B65\u9AA4\u3001\u9650\u5236\u548C\u4EA4\u4ED8\u8981\u6C42\u3002", mode === 'copy' ? '副本标识会自动生成，不覆盖原技能。' : mode === 'edit' ? '保留 name 不变，保存为新的不可变版本。' : 'name 已自动生成，可以保留。'] }), loading ? _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u539F\u7248\u672C\u2026" }) : _jsx("textarea", { id: "manual-skill-declaration", spellCheck: false, value: markdown, disabled: busy, onChange: event => setMarkdown(event.target.value) }), error && _jsx("p", { className: css.error, role: "alert", children: error }), source && error && markdown === initial && _jsx("button", { type: "button", onClick: () => setReload(value => value + 1), children: "\u91CD\u65B0\u8BFB\u53D6" }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: close, children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", "data-primary": true, disabled: busy || loading || !ready || !markdown.trim(), children: busy ? '正在保存…' : mode === 'edit' ? '保存新版本' : '保存到我的创建' })] })] }), discard && _jsxs(ActionDialog, { title: "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F", onClose: () => setDiscard(false), children: [_jsx("p", { children: "\u4FEE\u6539\u5C1A\u672A\u4FDD\u5B58\uFF0C\u539F\u6280\u80FD\u4E0D\u4F1A\u6539\u53D8\u3002" }), _jsxs("footer", { children: [_jsx("button", { onClick: () => setDiscard(false), children: "\u7EE7\u7EED\u7F16\u8F91" }), _jsx("button", { "data-danger": true, onClick: onClose, children: "\u653E\u5F03\u4FEE\u6539" })] })] })] });
}
//# sourceMappingURL=ManualSkillEditor.js.map