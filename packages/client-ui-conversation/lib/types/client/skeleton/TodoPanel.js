import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { IconChecklistOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, StateDot, } from '@deepseek-ai/dsh-client-ui-primitives';
import { NS } from "../locales.js";
import css from './TodoPanel.module.css';
/** Local exhaustiveness helper — client packages do not depend on `dsh-llm`. */
/* v8 ignore next 3 -- closed-union backstop; only reached if status is forged */
function assertNever(value) {
    throw new Error(`unreachable todo status: ${String(value)}`);
}
/** Map Todo lifecycle state onto the shared compact status language. */
function statusDotState(status) {
    switch (status) {
        case 'completed': return 'done';
        case 'in_progress': return 'ongoing';
        case 'pending': return 'idle';
        /* v8 ignore next -- closed TodoItem status union */
        default: return assertNever(status);
    }
}
/** Return the localized status announced beside one decorative marker. */
function statusLabel(status, t) {
    switch (status) {
        case 'completed': return t('todo.status.completed');
        case 'in_progress': return t('todo.status.inProgress');
        case 'pending': return t('todo.status.pending');
        /* v8 ignore next -- closed TodoItem status union */
        default: return assertNever(status);
    }
}
/** Header summary: "·"-joined per-status counts; zero-count segments are omitted as noise (a non-empty list keeps at least one). */
function progressLabel(todos, t) {
    const done = todos.filter(item => item.status === 'completed').length;
    const active = todos.filter(item => item.status === 'in_progress').length;
    const pending = todos.length - done - active;
    // En spaces (U+2002): HTML collapses runs of ASCII spaces, so widening the
    // separator breathing room needs a literal wide space.
    return [
        ...done > 0 ? [t('todo.progress.done', { done })] : [],
        ...active > 0 ? [t('todo.progress.active', { active })] : [],
        ...pending > 0 ? [t('todo.progress.pending', { pending })] : [],
    ].join('\u2002·\u2002');
}
export function TodoPanel({ todos, t }) {
    const [collapsed, setCollapsed] = useState(true);
    if (todos.length === 0)
        return null;
    return (_jsx("section", { className: css.root, "data-testid": "todo-panel", "aria-label": t('todo.title'), children: _jsxs("div", { className: css.body, children: [_jsxs("button", { type: "button", className: css.header, "aria-expanded": !collapsed, onClick: () => { setCollapsed(v => !v); }, children: [_jsx("span", { className: css.lead, "aria-hidden": true, children: _jsx(IconChecklistOutlineRegular, {}) }), _jsx("span", { className: css.title, children: t('todo.title') }), _jsx("span", { className: css.progress, children: progressLabel(todos, t) }), _jsx("span", { className: css.chevron, "aria-hidden": true, children: collapsed ? _jsx(IconChevronUpOutlineRegular, {}) : _jsx(IconChevronDownOutlineRegular, {}) })] }), !collapsed && (_jsx("ul", { className: css.list, children: todos.map(item => (_jsxs("li", { className: css.item, "data-status": item.status, children: [_jsx("span", { className: css.glyph, role: "img", "aria-label": statusLabel(item.status, t), children: _jsx(StateDot, { state: statusDotState(item.status) }) }), _jsx("span", { className: css.content, children: item.content })] }, item.content))) }))] }) }));
}
/** Renders the current todo projection, or nothing when it is absent. */
export function TodoDock({ useProjection, t }) {
    const todos = useProjection('todos');
    return _jsx(TodoPanel, { todos: todos ?? [], t: t });
}
/** Registers the projected todo dock. */
export const todoDockEntry = {
    name: 'conversation-todo-dock',
    inject: ['slots'],
    apply(ctx) {
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'todo', order: 0, locale: NS }, TodoDock));
    },
};
//# sourceMappingURL=TodoPanel.js.map