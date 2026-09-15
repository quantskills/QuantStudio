import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from 'react';
import css from './ContestPage.module.css';
/** Keep plan confirmation mounted and accessible even when account details are folded. */
export function CompetitionDock({ kind, label, title, subtitle, actions, children }) {
    const key = `quantskills:${kind}:dock-collapsed`;
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(key) === 'true';
        }
        catch {
            return false;
        }
    });
    const bodyId = useId();
    const toggle = () => {
        setCollapsed(!collapsed);
        try {
            localStorage.setItem(key, String(!collapsed));
        }
        catch { /* storage may be disabled */ }
    };
    return _jsxs("section", { className: css.conversation, "aria-label": label, "data-collapsed": collapsed, children: [_jsxs("div", { className: css.conversationHeader, children: [_jsx("strong", { children: title }), !collapsed && _jsx("small", { children: subtitle }), _jsxs("div", { className: css.conversationControls, children: [actions, _jsx("button", { type: "button", "aria-label": `${collapsed ? '展开' : '收起'}${label}`, "aria-expanded": !collapsed, "aria-controls": bodyId, onClick: toggle, children: collapsed ? '展开' : '收起' })] })] }), _jsx("div", { id: bodyId, className: css.conversationBody, hidden: collapsed, children: children })] });
}
//# sourceMappingURL=CompetitionDock.js.map