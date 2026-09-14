import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { QuantSkillsModelServices } from "./QuantSkillsModelServices.js";
// A vendor directory or saved route with a missing credential is not a configured model.
export const hasConfiguredModel = (data) => data.connections.some(connection => connection.configured && connection.modelIds.some(id => id.trim().length > 0));
/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export function ModelStartup({ access }) {
    const accessRef = useRef(access);
    accessRef.current = access;
    const [attempt, setAttempt] = useState(0);
    const [data, setData] = useState();
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let active = true;
        setError('');
        setBusy(true);
        void Promise.resolve().then(() => accessRef.current({ action: 'list' })).then(result => {
            if (!active)
                return;
            setData(result);
            setOpen(!hasConfiguredModel(result));
        }, () => {
            if (!active)
                return;
            setError('暂时无法检查模型配置，请重试。已有配置不会被修改。');
            setOpen(true);
        }).finally(() => { if (active)
            setBusy(false); });
        return () => { active = false; };
    }, [attempt]);
    if (!open)
        return null;
    return _jsx(ActionDialog, { title: ready ? '模型已配置' : '配置大模型', wide: true, busy: busy, onClose: () => setOpen(false), children: ready ? _jsxs(_Fragment, { children: [_jsx("p", { children: "\u6A21\u578B\u670D\u52A1\u5DF2\u4FDD\u5B58\uFF0C\u53EF\u4EE5\u5F00\u59CB\u4F7F\u7528\u6280\u80FD\u3001\u4E13\u5BB6\u548C\u4E13\u5BB6\u56E2\u3002" }), _jsx("footer", { children: _jsx("button", { "data-primary": true, onClick: () => setOpen(false), children: "\u5F00\u59CB\u4F7F\u7528" }) })] })
            : error ? _jsxs(_Fragment, { children: [_jsx("p", { role: "alert", children: error }), _jsxs("footer", { children: [_jsx("button", { disabled: busy, onClick: () => setOpen(false), children: "\u7A0D\u540E\u8BBE\u7F6E" }), _jsx("button", { "data-primary": true, disabled: busy, onClick: () => setAttempt(value => value + 1), children: "\u91CD\u65B0\u68C0\u67E5" })] })] }) : _jsxs(_Fragment, { children: [_jsx("p", { children: "\u8FD8\u6CA1\u6709\u914D\u7F6E\u5927\u6A21\u578B\u3002\u9009\u62E9\u670D\u52A1\u5546\u5E76\u4FDD\u5B58\u8FDE\u63A5\uFF0C\u5373\u53EF\u5F00\u59CB\u7814\u7A76\uFF1B\u4E5F\u53EF\u4EE5\u7A0D\u540E\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1\u300D\u4E2D\u5B8C\u6210\u3002" }), _jsx(QuantSkillsModelServices, { access: access, initialData: data, initialAdding: true, onBusyChange: setBusy, onSaved: result => { setData(result); setReady(hasConfiguredModel(result)); } }), _jsx("footer", { children: _jsx("button", { disabled: busy, onClick: () => setOpen(false), children: "\u7A0D\u540E\u8BBE\u7F6E" }) })] }) });
}
//# sourceMappingURL=ModelStartup.js.map