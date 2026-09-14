import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Icon-row Turn-stat actions: a database pill labelled with the turn total
// click-opens the per-Turn usage dialog, and a clock pill labelled with the
// turn wall time click-opens the Turn-time dialog. Both sit right of the
// branch action in the tail's IconActions row, ahead of the plain clock text.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClockOutline16, IconDatabaseOutline16, useAnchoredPosition, useDismissOnOutsidePointer, } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatLatencySeconds, formatRunDuration, formatTokensPerSecond } from "./message-chrome.js";
import { formatCacheHitPercent, formatExactTokens, formatTokens } from "./token-format.js";
import css from './TurnUsagePanel.module.css';
function formatCompactCount(value, t) {
    return t('message.turnUsage.count', { count: formatTokens(value, t) });
}
function formatExactCount(value, t) {
    return t('message.turnUsage.count', { count: formatExactTokens(value, t) });
}
/** Viewport margin the placement clamp keeps (the Menu portal margin). */
const PANEL_MARGIN = 12;
/** Distance between the trigger's top edge and the panel's bottom. */
const PANEL_GAP = 8;
/**
 * Unplaced portal panel: hidden but laid out so the clamp measures real
 * dimensions (the `useAnchoredPosition` measure pass).
 */
const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 };
/** One trigger-anchored dialog seat: open state, viewport-clamped placement, outside-close. */
function useStatDialog() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    // Portal placement: the dialog is fixed above the trigger and clamped inside
    // the viewport, so a trigger near the window edge cannot push it off-screen.
    const pos = useAnchoredPosition({
        open,
        anchorRef: rootRef,
        panelRef,
        side: 'top',
        gap: PANEL_GAP,
        margin: PANEL_MARGIN,
    });
    // Outside pointerdown closes through the shared primitive; the portaled
    // panel counts as inside. Escape close stays local, one listener while open.
    useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('keydown', onKeyDown); };
    }, [open]);
    return { open, setOpen, rootRef, panelRef, pos };
}
/**
 * Turn-usage IconActions pill with a click-open Turn-usage details dialog.
 * @param props - Turn usage buckets and locale seat.
 * @returns The trigger and, while open, its portaled dialog anchored above the trigger.
 */
export function TurnUsagePanel({ usage, t }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
    const cacheHit = usage.cacheReadTokens === undefined
        ? null
        : formatCacheHitPercent(usage.cacheReadTokens, usage.totalTokens - usage.outputTokens, 1);
    const total = formatCompactCount(usage.totalTokens, t);
    const routes = usage.routes?.map(route => `${route.provider}/${route.model}`).join(', ') ?? '';
    return (_jsxs("span", { ref: rootRef, className: css.root, children: [_jsxs("button", { type: "button", className: css.trigger, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsx(IconDatabaseOutline16, {}), _jsx("span", { className: css.label, children: t('message.turnUsage.consumed', { total }) })] }), open && createPortal(_jsxs("div", { ref: panelRef, className: css.panel, role: "dialog", "aria-label": t('message.turnUsage.title'), style: pos ?? MEASURE_STYLE, children: [_jsxs("div", { className: css.title, children: [_jsxs("span", { className: css.titleLabel, children: [_jsx(IconDatabaseOutline16, {}), t('message.turnUsage.title')] }), _jsx("span", { className: css.titleValue, children: formatExactCount(usage.totalTokens, t) })] }), _jsx("div", { className: css.titleRule, "aria-hidden": true }), _jsxs("dl", { className: css.details, "data-turn-usage-details": true, children: [routes !== '' && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.model') }), _jsx("dd", { className: css.route, children: routes })] })), cacheHit !== null && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheHit') }), _jsx("dd", { children: `${cacheHit}%` })] })), _jsx("dt", { children: t('message.turnUsage.input') }), _jsx("dd", { children: formatExactCount(usage.uncachedInputTokens, t) }), usage.cacheReadTokens !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheRead') }), _jsx("dd", { children: formatExactCount(usage.cacheReadTokens, t) })] })), usage.cacheWriteTokens !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheWrite') }), _jsx("dd", { children: formatExactCount(usage.cacheWriteTokens, t) })] })), _jsx("dt", { children: t('message.turnUsage.output') }), _jsxs("dd", { children: [formatExactCount(usage.outputTokens, t), usage.reasoningTokens !== undefined && (_jsx("span", { className: css.reasoning, children: t('message.turnUsage.reasoning', { tokens: formatExactCount(usage.reasoningTokens, t) }) }))] })] })] }), document.body)] }));
}
/**
 * Turn-time IconActions pill with a click-open Turn-time details dialog.
 * @param props - Turn timing facts and locale seat.
 * @returns The clock-and-duration trigger and, while open, its portaled dialog anchored above the trigger.
 */
export function TurnTimePanel({ runMs, tokensPerSecond, ttftMs, t }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
    return (_jsxs("span", { ref: rootRef, className: css.root, children: [_jsxs("button", { type: "button", className: css.trigger, "aria-haspopup": "dialog", "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsx(IconClockOutline16, {}), _jsx("span", { className: css.label, children: t('message.ranFor', { duration: formatRunDuration(runMs, t) }) })] }), open && createPortal(_jsxs("div", { ref: panelRef, className: css.panel, role: "dialog", "aria-label": t('message.turnTime.title'), style: pos ?? MEASURE_STYLE, children: [_jsx("div", { className: css.title, children: _jsxs("span", { className: css.titleLabel, children: [_jsx(IconClockOutline16, {}), t('message.turnTime.title')] }) }), _jsx("div", { className: css.titleRule, "aria-hidden": true }), _jsxs("dl", { className: css.details, "data-turn-time-details": true, children: [_jsx("dt", { children: t('message.turnTime.duration') }), _jsx("dd", { children: formatRunDuration(runMs, t) }), tokensPerSecond !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnTime.speed') }), _jsx("dd", { children: t('message.tokensPerSecond', { tps: formatTokensPerSecond(tokensPerSecond) }) })] })), ttftMs !== undefined && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnTime.ttft') }), _jsx("dd", { children: t('duration.seconds', { seconds: formatLatencySeconds(ttftMs) }) })] }))] })] }), document.body)] }));
}
//# sourceMappingURL=TurnUsagePanel.js.map