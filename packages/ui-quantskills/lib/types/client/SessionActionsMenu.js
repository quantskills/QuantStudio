import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArchiveBoxIcon, DotsThreeVerticalIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import css from './SessionActionsMenu.module.css';
/** The top layer keeps the menu clear of the scrollable conversation sidebar. */
export function SessionActionsMenu({ title, running, onRename, onArchive, onRemove }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef(null);
    const panel = useRef(null);
    const id = useId();
    const close = (restoreFocus = false) => {
        if (restoreFocus)
            trigger.current?.focus({ preventScroll: true });
        setOpen(false);
    };
    useLayoutEffect(() => {
        if (!open)
            return;
        const menu = panel.current;
        // JSDOM does not implement popovers. Production browsers render in the top layer.
        if (typeof menu.showPopover === 'function') {
            menu.setAttribute('popover', 'manual');
            menu.showPopover();
        }
        const anchor = trigger.current.getBoundingClientRect();
        const bounds = menu.getBoundingClientRect();
        const scale = menu.offsetWidth > 0 ? bounds.width / menu.offsetWidth : 1;
        const left = Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8));
        const top = anchor.bottom + 6 + bounds.height <= window.innerHeight - 8
            ? anchor.bottom + 6 : Math.max(8, anchor.top - bounds.height - 6);
        menu.style.left = `${left / scale}px`;
        menu.style.top = `${top / scale}px`;
        menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        const dismiss = (event) => {
            if (!menu.contains(event.target) && !trigger.current?.contains(event.target))
                close();
        };
        const escape = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close(true);
            }
        };
        const leave = (event) => { if (!menu.contains(event.target))
            close(); };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape, true);
        window.addEventListener('resize', leave);
        document.addEventListener('scroll', leave, true);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape, true);
            window.removeEventListener('resize', leave);
            document.removeEventListener('scroll', leave, true);
        };
    }, [open]);
    const choose = (action) => { close(true); action(); };
    return _jsxs("div", { className: css.root, children: [_jsx("button", { ref: trigger, type: "button", className: css.trigger, title: "\u4F1A\u8BDD\u64CD\u4F5C", "aria-label": `会话操作 ${title}`, "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? id : undefined, onClick: () => setOpen(!open), onKeyDown: event => { if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setOpen(true);
                } }, children: _jsx(DotsThreeVerticalIcon, { size: 21, weight: "bold" }) }), open && _jsxs("div", { ref: panel, id: id, role: "menu", "aria-label": `会话操作 ${title}`, className: css.menu, onBlur: event => { if (event.relatedTarget && event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget))
                    close(); }, onKeyDown: event => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
                        return;
                    event.preventDefault();
                    const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
                    const current = items.indexOf(document.activeElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                        : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                    items[next]?.focus();
                }, children: [onRename && _jsxs("button", { type: "button", role: "menuitem", "aria-label": `重命名会话 ${title}`, onClick: () => choose(onRename), children: [_jsx(PencilSimpleIcon, { size: 17 }), "\u91CD\u547D\u540D"] }), onArchive && _jsxs("button", { type: "button", role: "menuitem", "aria-label": `归档会话 ${title}`, disabled: running, onClick: () => choose(onArchive), children: [_jsx(ArchiveBoxIcon, { size: 17 }), "\u5F52\u6863"] }), _jsx("div", { className: css.separator }), _jsxs("button", { type: "button", role: "menuitem", className: css.danger, "aria-label": `删除会话 ${title}`, disabled: running, onClick: () => choose(onRemove), children: [_jsx(TrashIcon, { size: 17 }), "\u5220\u9664"] }), running && _jsx("small", { children: "\u8FD0\u884C\u4E2D\uFF0C\u8BF7\u5148\u505C\u6B62\u518D\u5F52\u6863\u6216\u5220\u9664" })] })] });
}
//# sourceMappingURL=SessionActionsMenu.js.map