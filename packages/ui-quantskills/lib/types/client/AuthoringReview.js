import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import { CapabilityIcon } from "./CapabilityIcon.js";
import css from './QuantSkillsApp.module.css';
/** Always mounted in the session header, independent of collapsed tool history. */
export function AuthoringReview({ useSessions, commit, start, focusComposer, openLibrary }) {
    const session = useSessions(state => state.current === undefined ? undefined : state.byId[state.current]);
    const projected = session?.projectionValues?.quantSkillsAuthoringPending;
    const [dismissed, setDismissed] = useState();
    const [reopened, setReopened] = useState();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState();
    const [launch, setLaunch] = useState(false);
    const [saved, setSaved] = useState();
    const [completed, setCompleted] = useState();
    const pending = projected ?? (saved?.sessionId === session?.id ? saved?.draft : undefined);
    const identity = session?.id + ':' + pending?.toolCallId;
    useEffect(() => { setLaunch(false); setError(undefined); }, [identity]);
    if (!session || !pending)
        return session?.id === completed ? _jsx("span", { role: "status", className: css.reviewTrigger, children: "\u5DF2\u751F\u6210 \u00B7 \u5DF2\u52A0\u5165\u6211\u7684\u521B\u5EFA" }) : null;
    const key = session.id + ':' + pending.toolCallId + ':' + pending.treeDigest;
    const visible = !session.running && (dismissed !== key || reopened === key);
    const label = pending.kind === 'skill' ? '技能' : pending.kind === 'agent' ? '专家' : '专家团';
    const close = () => { setDismissed(key); setReopened(undefined); setError(undefined); setLaunch(false); setSaved(undefined); };
    const confirm = async () => {
        setBusy(true);
        setError(undefined);
        try {
            const result = saved?.key === key ? saved.result : await commit(session.id, pending.toolCallId, pending.treeDigest);
            setSaved({ key, sessionId: session.id, draft: pending, result });
            if (launch)
                await start(result);
            setCompleted(session.id);
            close();
            if (!launch)
                openLibrary(result.kind);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '暂时无法生成，请重试。');
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: css.reviewTrigger, disabled: session.running, onClick: () => { setReopened(key); setError(undefined); }, children: ["\u5F85\u786E\u8BA4 \u00B7 ", label] }), visible && _jsxs(ActionDialog, { title: '确认生成' + label, busy: busy, error: error, onClose: close, children: [_jsxs("div", { className: css.reviewIdentity, children: [_jsx(CapabilityIcon, { kind: pending.kind, size: 34 }), _jsxs("div", { children: [_jsx("small", { children: "\u5DF2\u51C6\u5907\u5C31\u7EEA" }), _jsx("h3", { children: pending.name })] })] }), _jsx("p", { children: pending.description }), pending.members.length > 0 && _jsxs("details", { className: css.reviewDetails, children: [_jsxs("summary", { children: ["\u67E5\u770B\u56E2\u961F\u5206\u5DE5 \u00B7 ", pending.members.length, " \u4F4D\u6210\u5458"] }), _jsx("ul", { children: pending.members.map((member, i) => _jsx("li", { children: member }, i)) })] }), _jsxs("label", { className: css.reviewLaunch, children: [_jsx("input", { type: "checkbox", checked: launch, disabled: busy, onChange: event => { setLaunch(event.target.checked); } }), "\u751F\u6210\u540E\u7ACB\u5373\u5F00\u59CB\u4F7F\u7528"] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: () => { close(); focusComposer(); }, children: "\u7EE7\u7EED\u8C03\u6574" }), _jsx("button", { type: "button", "data-primary": true, disabled: busy, onClick: () => { void confirm(); }, children: busy ? '正在处理…' : saved?.key === key ? '重试启动' : launch ? '生成并开始' : '确认生成' })] })] })] });
}
//# sourceMappingURL=AuthoringReview.js.map