import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo } from 'react';
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { turnProcessAlwaysOpen } from "../contract/turn-process.js";
import { formatRunDuration } from "./message-chrome.js";
import a11yCss from './accessibility.module.css';
import css from './TurnProcessNodeView.module.css';
/** Settled Turn duration and process disclosure above its content. */
export const TurnProcessNodeView = memo(function TurnProcessNodeView({ node, turnProcess, t, }) {
    if (turnProcess === undefined)
        throw new Error('turn-process node requires Turn process owner state');
    const open = !turnProcess.foldable || turnProcess.open;
    const turn = node.location.kind === 'turn' || node.location.kind === 'step'
        ? node.location.turn
        : undefined;
    if (turn?.status !== 'closed')
        return null;
    const canCollapse = turnProcess.foldable && turnProcess.hasContent && !turnProcessAlwaysOpen(node);
    const reason = turn.end?.data.reason.kind;
    const stopped = reason === 'aborted' || reason === 'interrupted';
    const elapsedMs = turn.start === undefined || turn.end === undefined ? undefined
        : Math.max(1000, turn.end.time - turn.start.time);
    const duration = elapsedMs === undefined || stopped || reason === 'error' ? undefined
        : formatRunDuration(elapsedMs, t);
    // Other end reasons retain elapsed time; only stops and failure replace it.
    const label = stopped ? t('message.stopped')
        : reason === 'error' ? t('message.turnProcess.failed')
            : duration === undefined ? t('message.turnProcess.worked')
                : t('message.turnProcess.took');
    const announcement = stopped ? t('message.stopped')
        : reason === 'error' ? t('message.turnProcess.failed')
            : t('message.turnProcess.worked');
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: a11yCss.visuallyHidden, role: "status", "aria-live": "polite", "aria-atomic": "true", children: announcement }), _jsxs("button", { type: "button", className: css.root, "data-open": open || undefined, "data-turn-process": node.data.turn, "data-turn-process-messages": node.data.messageCount, "data-turn-process-tool-calls": node.data.toolCallCount, "data-turn-process-subagents": node.data.subagentCount, disabled: !canCollapse, "aria-expanded": turnProcess.hasContent ? open : undefined, onClick: (event) => {
                    event.currentTarget.focus();
                    turnProcess.setOpen(!open);
                }, children: [_jsxs("span", { className: css.label, children: [label, duration?.map((part, index) => (_jsx("span", { className: part.numeric ? css.durationNumber : undefined, children: part.text }, index)))] }), canCollapse && _jsx(IconChevronDownOutlineRegular, { className: css.chevron })] })] }));
});
//# sourceMappingURL=TurnProcessNodeView.js.map