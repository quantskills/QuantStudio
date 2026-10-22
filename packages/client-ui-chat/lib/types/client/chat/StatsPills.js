import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// Composer statistics pills, each its own 'conversation.composer.dock' list
// entry (activity, usage) so a plugin can replace or add one pill by id.
// Compact keeps speed and cache hit as plain readings; Detailed adds counts,
// token totals, and click-open dialogs. Settled-node identity prevents
// stream-delta updates from rerendering the pills.
import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IconDatabaseOutlineRegular, IconGaugeOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatTokensPerSecond } from "./message-chrome.js";
import { assistantStepReading } from "../contract/turn-metrics.js";
import { formatCacheHitPercent, formatExactTokens, formatTokens } from "./token-format.js";
import { MEASURE_STYLE, useStatDialog } from "./stat-dialog.js";
import css from './StatsPills.module.css';
import dialogCss from './stat-dialog.module.css';
/**
 * Fold assistant and tool-result nodes into window-scoped display totals —
 * the FALLBACK for assemblies without the `sessionStats` projection.
 *
 * Every displayed figure rides that durable whole-log projection (and token
 * accounting rides `tokenUsage`) because the window is paged and compaction
 * rewrites it; this fold answers "what is on screen" only when no projection
 * value is served. Its field names deliberately mirror the projection's so
 * the two swap wholesale.
 * @param nodes - snapshot nodes.
 * @returns fallback counts and summed wall times.
 */
export function deriveStats(nodes) {
    const turns = new Set();
    let steps = 0;
    let llmMs = 0;
    let toolMs = 0;
    let ttftMs = 0;
    let ttftSteps = 0;
    let decodeMs = 0;
    let decodeTokens = 0;
    for (const node of nodes) {
        if (node.kind === 'tool-result') {
            if (node.callTime !== null)
                toolMs += Math.max(0, node.time - node.callTime);
            continue;
        }
        if (node.kind !== 'assistant')
            continue;
        turns.add(node.turn);
        steps += 1;
        if (node.timing !== undefined && node.timing.stepStartTime !== null) {
            llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime);
        }
        const reading = assistantStepReading(node);
        if (reading.ttftMs !== null) {
            ttftMs += reading.ttftMs;
            ttftSteps += 1;
        }
        if (reading.decodeMs !== null && reading.outputTokens !== null) {
            decodeMs += reading.decodeMs;
            decodeTokens += reading.outputTokens;
        }
    }
    return { turns: turns.size, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens };
}
/**
 * Compact duration: 45.2s under a minute, 2m42s from there on.
 * @param ms - duration in milliseconds.
 * @returns display string.
 */
export function formatDuration(ms, t) {
    const s = ms / 1_000;
    if (s < 60)
        return t('duration.compactSeconds', { seconds: Math.round(s * 10) / 10 });
    const whole = Math.round(s);
    return t('duration.compactMinutes', {
        minutes: Math.floor(whole / 60),
        seconds: whole % 60,
    });
}
/**
 * Display-ready cache-hit share of prompt-side input over the whole durable log.
 * @param usage - the session's token-usage projection value.
 * @returns integer text when integer rounding stays below 100, otherwise the
 * minimum decimal precision that still rounds below 100; a full hit returns
 * 100, and no billed input returns null.
 */
export function cacheHitPercent(usage) {
    const denominator = billedInputTokens(usage);
    return formatCacheHitPercent(usage.cacheReadTokens, denominator);
}
/**
 * Sum the three disjoint prompt-side billing buckets.
 * @param usage - the session's token-usage projection value.
 * @returns billed input tokens.
 */
export function billedInputTokens(usage) {
    return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function exactCount(value, t) {
    return t('message.turnUsage.count', { count: formatExactTokens(value, t) });
}
function joined(first, second) {
    if (second === null)
        return first;
    return (_jsxs(_Fragment, { children: [first, _jsx("span", { className: css.sep, "aria-hidden": true, children: "\u00B7" }), second] }));
}
// Every figure rides the durable sessionStats projection, so paging and
// compaction cannot change any of them; an assembly without the unit falls
// back to the window-scoped fold wholesale (same field names), paid only
// while no projection value is served.
function useSessionStats(useChat, useProjection) {
    const settledNodes = useChat(s => s.legacy.nodes);
    const projected = useProjection('sessionStats');
    return useMemo(() => projected ?? deriveStats(settledNodes), [projected, settledNodes]);
}
function decodeSpeed(stats, t) {
    return t('message.tokensPerSecond', {
        tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)),
    });
}
/** A static reading: used when the pill has no dialog rows or the mode is Compact. */
function PlainPill({ stat, icon, label }) {
    return (_jsx("span", { className: css.anchor, "data-composer-stat": stat, children: _jsxs("span", { className: css.pill, children: [icon, _jsx("span", { className: css.label, children: label })] }) }));
}
/**
 * A pill button opening its own portaled dialog. Each pill owns its open
 * state; useStatDialog closes it on Escape or an outside pointerdown or click,
 * so at most one dialog is open across the dock.
 */
function DialogPill({ stat, icon, label, ariaLabel, title, titleValue, children }) {
    const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
    return (_jsxs("span", { ref: rootRef, className: css.anchor, "data-composer-stat": stat, children: [_jsxs("button", { type: "button", className: css.pill, "aria-haspopup": "dialog", "aria-expanded": open, "aria-label": ariaLabel, onClick: () => { setOpen(!open); }, children: [icon, _jsx("span", { className: css.label, children: label })] }), open && createPortal(_jsxs("div", { ref: panelRef, className: dialogCss.panel, role: "dialog", "aria-label": title, style: pos ?? MEASURE_STYLE, children: [_jsxs("div", { className: dialogCss.title, children: [_jsxs("span", { className: dialogCss.titleLabel, children: [icon, title] }), titleValue !== undefined && _jsx("span", { className: dialogCss.titleValue, children: titleValue })] }), _jsx("div", { className: dialogCss.titleRule, "aria-hidden": true }), children] }), document.body)] }));
}
/**
 * Turn and step counts with whole-session speed, opening the time and speed
 * dialog; Compact keeps only the speed reading.
 */
export const ActivityPill = memo(function ActivityPill({ useChat, useProjection, usePerformanceUsage, t }) {
    const mode = usePerformanceUsage(value => value);
    const stats = useSessionStats(useChat, useProjection);
    const speed = stats.decodeMs > 0 ? decodeSpeed(stats, t) : null;
    const icon = _jsx(IconGaugeOutlineRegular, {});
    if (mode === 'compact')
        return speed === null ? null : _jsx(PlainPill, { stat: "activity", icon: icon, label: speed });
    if (stats.steps === 0)
        return null;
    const counts = t('stats.counts', { turns: stats.turns, steps: stats.steps });
    const content = { stat: 'activity', icon, label: joined(counts, speed) };
    // A window without one timed figure has no dialog rows to show, so the pill
    // stays a plain reading instead of a button opening an empty dialog.
    if (stats.llmMs <= 0 && stats.toolMs <= 0 && stats.ttftSteps <= 0 && speed === null)
        return _jsx(PlainPill, { ...content });
    return (_jsx(DialogPill, { ...content, ariaLabel: speed === null ? counts : `${counts} · ${speed}`, title: t('stats.dialog.title'), children: _jsxs("dl", { className: dialogCss.details, "data-session-stats-details": true, children: [stats.llmMs > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.llmTime') }), _jsx("dd", { children: formatDuration(stats.llmMs, t) })] })), stats.toolMs > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.toolTime') }), _jsx("dd", { children: formatDuration(stats.toolMs, t) })] })), stats.ttftSteps > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.ttft') }), _jsx("dd", { children: formatDuration(stats.ttftMs / stats.ttftSteps, t) })] })), speed !== null && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('stats.dialog.speed') }), _jsx("dd", { children: speed })] }))] }) }));
});
/** Whole-log token total and cache hit; Compact keeps only the cache hit. */
export const UsagePill = memo(function UsagePill({ useProjection, usePerformanceUsage, t }) {
    const mode = usePerformanceUsage(value => value);
    const usage = useProjection('tokenUsage');
    // Gated on actual token activity: a session whose steps all settled without
    // billing (e.g. every request failed) shows no usage pill.
    if (usage === undefined || (billedInputTokens(usage) === 0 && usage.outputTokens === 0))
        return null;
    const cacheHit = cacheHitPercent(usage);
    const cacheHitText = cacheHit !== null ? t('stats.cacheHit', { percent: cacheHit }) : null;
    const icon = _jsx(IconDatabaseOutlineRegular, {});
    if (mode === 'compact') {
        return cacheHitText === null ? null : _jsx(PlainPill, { stat: "usage", icon: icon, label: cacheHitText });
    }
    // Same aggregate as the Turn pill's totalTokens: every prompt-side billing bucket plus output.
    const total = billedInputTokens(usage) + usage.outputTokens;
    const totalText = t('message.turnUsage.count', { count: formatTokens(total, t) });
    return (_jsx(DialogPill, { stat: "usage", icon: icon, label: joined(totalText, cacheHitText), ariaLabel: cacheHitText === null ? totalText : `${totalText} · ${cacheHitText}`, title: t('stats.dialog.usageTitle'), titleValue: exactCount(total, t), children: _jsxs("dl", { className: dialogCss.details, "data-session-stats-usage": true, children: [cacheHit !== null && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheHit') }), _jsx("dd", { children: `${cacheHit}%` })] })), _jsx("dt", { children: t('message.turnUsage.input') }), _jsx("dd", { children: exactCount(usage.uncachedInputTokens, t) }), _jsx("dt", { children: t('message.turnUsage.cacheRead') }), _jsx("dd", { children: exactCount(usage.cacheReadTokens, t) }), usage.cacheWriteTokens !== 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: t('message.turnUsage.cacheWrite') }), _jsx("dd", { children: exactCount(usage.cacheWriteTokens, t) })] })), _jsx("dt", { children: t('message.turnUsage.output') }), _jsx("dd", { children: exactCount(usage.outputTokens, t) })] }) }));
});
//# sourceMappingURL=StatsPills.js.map