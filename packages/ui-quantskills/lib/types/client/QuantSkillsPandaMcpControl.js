import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Compact PandaData MCP status and connection control for QuantSkills conversation surfaces. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { pandaMcpPhaseLabel, pandaMcpSignal } from "./panda-mcp-presentation.js";
import pandaMarkUrl from './assets/pandaai-mark.png';
import css from './QuantSkillsApp.module.css';
function QuantSkillsPandaMcpSurface({ visible, status, authenticate, refresh, logout, }) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [snapshot, setSnapshot] = useState();
    const [error, setError] = useState();
    const [busy, setBusy] = useState(false);
    const poll = useCallback(async () => {
        try {
            setSnapshot(await status());
            setError(undefined);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '无法读取 PandaData 连接状态。');
        }
    }, [status]);
    useEffect(() => {
        if (!visible)
            return;
        void poll();
        const timer = window.setInterval(() => { void poll(); }, open ? 4_000 : 10_000);
        return () => { window.clearInterval(timer); };
    }, [visible, open, poll]);
    useEffect(() => {
        if (!open)
            return;
        const dismiss = (event) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target))
                setOpen(false);
        };
        const escape = (event) => {
            if (event.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('pointerdown', dismiss, true);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', dismiss, true);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);
    if (!visible)
        return null;
    const phase = snapshot?.phase ?? 'disconnected';
    const connected = phase === 'connected';
    const enabled = phase !== 'disconnected';
    const signal = pandaMcpSignal(phase);
    const label = pandaMcpPhaseLabel(phase);
    const run = async (action) => {
        setBusy(true);
        try {
            setSnapshot(await action());
            setError(undefined);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'PandaData 操作失败。');
            await poll();
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs("div", { ref: rootRef, className: css.pandaMcpControl, children: [_jsxs("button", { type: "button", className: css.pandaMcpTrigger, "aria-label": `PandaData MCP：${label}`, "aria-haspopup": "dialog", "aria-expanded": open, title: `PandaData MCP：${label}`, onClick: () => { setOpen(current => !current); }, children: [_jsx("img", { src: pandaMarkUrl, alt: "", "aria-hidden": "true" }), _jsx("span", { className: css.pandaMcpSignal, "data-signal": signal, "aria-hidden": "true" })] }), open && _jsxs("section", { className: css.pandaMcpPopover, role: "dialog", "aria-label": "PandaData MCP \u8FDE\u63A5", children: [_jsxs("header", { children: [_jsxs("span", { children: [_jsx("img", { src: pandaMarkUrl, alt: "", "aria-hidden": "true" }), _jsx("strong", { children: "PandaData MCP" })] }), _jsx("button", { type: "button", role: "switch", "aria-label": "\u542F\u7528 PandaData MCP", "aria-checked": enabled, className: css.pandaMcpSwitch, disabled: busy || phase === 'authenticating', onClick: () => { void run(enabled ? logout : authenticate); }, children: _jsx("span", { "aria-hidden": "true" }) })] }), _jsxs("div", { className: css.pandaMcpState, role: "status", children: [_jsx("span", { className: css.pandaMcpSignal, "data-signal": signal, "aria-hidden": "true" }), _jsx("strong", { children: label })] }), _jsx("p", { role: error === undefined ? undefined : 'alert', children: error ?? snapshot?.message ?? '连接后即可在会话中调用 PandaData 数据能力。' }), _jsx("button", { type: "button", className: css.pandaMcpAction, disabled: busy || phase === 'authenticating', onClick: () => { void run(connected ? refresh : authenticate); }, children: busy || phase === 'authenticating' ? '连接中…' : connected ? '刷新连接' : '连接 PandaData' })] })] });
}
/** Render PandaData beside the blank-session preset selector. */
export function QuantSkillsPandaMcpHeroControl({ mode, useView, status, authenticate, refresh, logout, }) {
    const pluginConversationOpen = useView(state => state.pluginOpen && state.pluginConversationOpen);
    return _jsx(QuantSkillsPandaMcpSurface, { visible: mode === 'standalone' || pluginConversationOpen, status: status, authenticate: authenticate, refresh: refresh, logout: logout });
}
/** Render PandaData in the composer after conversation activity begins. */
export function QuantSkillsPandaMcpControl({ mode, useView, useConversation, session, status, authenticate, refresh, logout, }) {
    const conversation = useConversation(state => state);
    const pluginConversationOpen = useView(state => state.pluginOpen && state.pluginConversationOpen);
    const started = conversation.activeTargets.size > 0
        || session.promptAttempted || session.running
        || (!session.blank && !session.awaitingFirstTurn);
    return _jsx(QuantSkillsPandaMcpSurface, { visible: (mode === 'standalone' || pluginConversationOpen) && started, status: status, authenticate: authenticate, refresh: refresh, logout: logout });
}
//# sourceMappingURL=QuantSkillsPandaMcpControl.js.map