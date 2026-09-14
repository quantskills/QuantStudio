import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef } from 'react';
import css from './ActionDialog.module.css';
/** Native modal: top-layer rendering, inert background and browser focus containment. */
export function ActionDialog({ title, children, busy = false, error, wide = false, onClose }) {
    const ref = useRef(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // DOM-only test runners do not implement showModal; browsers always use the top layer.
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        else
            dialog.setAttribute('open', '');
        return () => {
            if (typeof dialog.close === 'function')
                dialog.close();
            if (trigger?.isConnected)
                trigger.focus();
        };
    }, []);
    return _jsxs("dialog", { ref: ref, className: css.dialog, "data-wide": wide || undefined, "aria-labelledby": titleId, "aria-modal": "true", "aria-busy": busy, onKeyDown: event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                return;
            }
            if (event.key !== 'Tab')
                return;
            const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
                .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'));
            const first = items[0], last = items.at(-1);
            if (!first || !last) {
                event.preventDefault();
                return;
            }
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }, onCancel: event => { event.preventDefault(); if (!busy)
            onClose(); }, children: [_jsxs("header", { className: css.header, children: [_jsx("h2", { id: titleId, children: title }), _jsx("button", { type: "button", "aria-label": `关闭${title}`, disabled: busy, onClick: onClose, children: "\u00D7" })] }), _jsxs("div", { className: css.body, children: [children, error && _jsx("p", { role: "alert", className: css.error, children: error })] })] });
}
//# sourceMappingURL=ActionDialog.js.map