import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { selectedSession } from "./selected-session.js";
import { ActionDialog } from "./ActionDialog.js";
import css from './QuantSkillsApp.module.css';
/** A distinct user continuation; viewing or restoring a Team never delivers historical messages. */
export function LegacyTeamRecovery({ useSessions, recover }) {
    const session = useSessions(state => { const id = selectedSession(state); return id === undefined ? undefined : state.byId[id]; });
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const [result, setResult] = useState(), [error, setError] = useState();
    useEffect(() => { setOpen(false); setResult(undefined); setError(undefined); }, [session?.id]);
    if (!session?.projectionValues?.quantSkillsAgentTeamSession)
        return null;
    const inspect = async (continuePending) => {
        setBusy(true);
        setError(undefined);
        try {
            setResult(await recover(session.id, continuePending));
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '历史消息核对失败。');
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: css.reviewTrigger, disabled: session.running, onClick: () => { setOpen(true); void inspect(false); }, children: "\u65E7\u56E2\u961F\u6D88\u606F" }), open && _jsxs(ActionDialog, { title: "\u6838\u5BF9\u65E7\u56E2\u961F\u6D88\u606F", busy: busy, error: error, onClose: () => { setOpen(false); }, children: [_jsx("p", { children: "\u5DF2\u63A5\u6536\u7684\u6D88\u606F\u4E0D\u4F1A\u91CD\u53D1\u3002\u53EA\u6709\u786E\u8BA4\u672A\u63A5\u6536\u7684\u6D88\u606F\uFF0C\u624D\u4F1A\u5728\u4F60\u70B9\u51FB\u7EE7\u7EED\u540E\u4EA4\u7ED9\u539F\u6210\u5458\u5904\u7406\uFF1B\u8FD9\u53EF\u80FD\u6062\u590D\u56E2\u961F\u4EFB\u52A1\u5E76\u8C03\u7528\u539F\u914D\u7F6E\u7684\u6A21\u578B\u3002" }), result && _jsxs("div", { role: "status", children: [_jsxs("p", { children: ["\u5DF2\u6295\u9012 ", result.delivered, " \u00B7 \u5F85\u6062\u590D ", result.pending, " \u00B7 \u5F85\u786E\u8BA4 ", result.uncertain] }), result.unknownEvents > 0 && _jsxs("p", { children: ["\u53E6\u6709 ", result.unknownEvents, " \u6761\u672A\u77E5\u5386\u53F2\u4E8B\u4EF6\uFF0C\u539F\u6587\u5DF2\u4FDD\u7559\uFF0C\u9700\u4EBA\u5DE5\u6838\u5BF9\u3002"] }), result.uncertain > 0 && _jsx("p", { children: "\u63A5\u6536\u8BB0\u5F55\u7F3A\u5931\u3001\u77DB\u76FE\u6216\u6295\u9012\u4E2D\u65AD\u7684\u6D88\u606F\u4E0D\u4F1A\u81EA\u52A8\u8865\u53D1\u3002" })] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: () => { setOpen(false); }, children: "\u5173\u95ED" }), _jsx("button", { type: "button", "data-primary": true, disabled: busy || !result?.pending, onClick: () => { void inspect(true); }, children: "\u7EE7\u7EED\u5F85\u6062\u590D\u6D88\u606F" })] })] })] });
}
//# sourceMappingURL=LegacyTeamRecovery.js.map