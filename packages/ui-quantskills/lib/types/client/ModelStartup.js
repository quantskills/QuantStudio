import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { QuantSkillsModelServices } from "./QuantSkillsModelServices.js";
function FlyStartupPrepare({ access }) {
    const [runtime, setRuntime] = useState();
    const [environment, setEnvironment] = useState();
    const [blenderPath, setBlenderPath] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let disposed = false, timer;
        const poll = async () => {
            try {
                const next = await access.status();
                if (disposed)
                    return;
                setRuntime(next);
                if (next.installed && next.running) {
                    const state = await access.request({ path: 'state' });
                    if (!disposed)
                        setEnvironment(state.environment);
                }
            }
            catch (cause) {
                if (!disposed)
                    setError(cause instanceof Error ? cause.message : '果蝇状态暂不可用');
            }
            finally {
                if (!disposed)
                    timer = setTimeout(() => void poll(), 3000);
            }
        };
        void poll();
        return () => { disposed = true; clearTimeout(timer); };
    }, [access]);
    const ready = environment?.brain_ready && environment.blender_ready;
    const progress = environment?.progress;
    return _jsxs("section", { "aria-label": "\u679C\u8747\u4EA4\u6613\u5458\u8FD0\u884C\u73AF\u5883", children: [_jsx("h3", { children: "\u679C\u8747\u4EA4\u6613\u5458\u8FD0\u884C\u73AF\u5883" }), _jsx("p", { children: "\u9996\u6B21\u4F7F\u7528\u53EF\u5728\u8FD9\u91CC\u4E00\u952E\u4E0B\u8F7D\u5E76\u6821\u9A8C\u4E13\u7528 Python \u4E0E MaleCNS\u3002\u5DF2\u6709 Blender \u53EF\u586B\u5199\u5B89\u88C5\u8DEF\u5F84\u590D\u7528\u3002" }), _jsxs("p", { role: "status", children: [ready ? '神经环境与 Blender 已就绪。' : progress?.status === 'error' ? `准备失败：${progress.message || '请重试'}` : runtime?.message || '正在检查果蝇环境…', progress?.status === 'running' && progress.message ? ` ${progress.message}` : ''] }), !!progress?.total && _jsx("progress", { value: progress.done ?? 0, max: progress.total }), !ready && runtime?.supported && _jsxs(_Fragment, { children: [_jsxs("label", { children: ["\u5DF2\u6709 Blender \u5B89\u88C5\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09", _jsx("input", { value: blenderPath, onChange: event => setBlenderPath(event.target.value), disabled: busy || runtime.installing, placeholder: "\u5B89\u88C5\u76EE\u5F55\u6216 blender.exe \u7684\u5B8C\u6574\u8DEF\u5F84" })] }), _jsx("button", { type: "button", disabled: busy || runtime.installing || progress?.status === 'running', onClick: () => {
                            setBusy(true);
                            setError('');
                            void access.install({ blenderPath: blenderPath.trim() }).then(setRuntime).catch(cause => setError(cause instanceof Error ? cause.message : '准备失败，请重试')).finally(() => setBusy(false));
                        }, children: runtime.installing || progress?.status === 'running' ? '正在准备…' : '一键准备果蝇 / 重试' })] }), error && _jsx("p", { role: "alert", children: error })] });
}
// A vendor directory or saved route with a missing credential is not a configured model.
export const hasConfiguredModel = (data) => data.connections.some(connection => connection.configured && connection.modelIds.some(id => id.trim().length > 0));
/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export function ModelStartup({ access, flyAccess }) {
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
    return _jsxs(ActionDialog, { title: ready ? '模型已配置' : '配置大模型', wide: true, busy: busy, onClose: () => setOpen(false), children: [ready ? _jsx("p", { children: "\u6A21\u578B\u670D\u52A1\u5DF2\u4FDD\u5B58\uFF0C\u53EF\u4EE5\u5F00\u59CB\u4F7F\u7528\u6280\u80FD\u3001\u4E13\u5BB6\u548C\u4E13\u5BB6\u56E2\u3002" })
                : error ? _jsx("p", { role: "alert", children: error })
                    : _jsx("p", { children: "\u8FD8\u6CA1\u6709\u914D\u7F6E\u5927\u6A21\u578B\u3002\u9009\u62E9\u670D\u52A1\u5546\u5E76\u4FDD\u5B58\u8FDE\u63A5\uFF0C\u5373\u53EF\u5F00\u59CB\u7814\u7A76\uFF1B\u4E5F\u53EF\u4EE5\u7A0D\u540E\u5728\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u670D\u52A1\u300D\u4E2D\u5B8C\u6210\u3002" }), flyAccess && _jsx(FlyStartupPrepare, { access: flyAccess }), !ready && !error && _jsx(QuantSkillsModelServices, { access: access, initialData: data, initialAdding: true, onBusyChange: setBusy, onSaved: result => { setData(result); setReady(hasConfiguredModel(result)); } }), _jsx("footer", { children: ready ? _jsx("button", { "data-primary": true, onClick: () => setOpen(false), children: "\u5F00\u59CB\u4F7F\u7528" }) : _jsxs(_Fragment, { children: [_jsx("button", { disabled: busy, onClick: () => setOpen(false), children: "\u7A0D\u540E\u8BBE\u7F6E" }), error && _jsx("button", { "data-primary": true, disabled: busy, onClick: () => setAttempt(value => value + 1), children: "\u91CD\u65B0\u68C0\u67E5" })] }) })] });
}
//# sourceMappingURL=ModelStartup.js.map