import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Assistant reasoning disclosure, independent of Tool-call presentation. */
import { memo, useMemo } from 'react';
import { DisclosureRow, IconThinkOutlineRegular, TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives';
import a11yCss from './accessibility.module.css';
import css from './ReasoningRow.module.css';
const THINK_ICON = _jsx(IconThinkOutlineRegular, { size: 14 });
function firstLine(text) {
    const newline = text.indexOf('\n');
    return newline === -1 ? text : text.slice(0, newline);
}
function latestCompletedParagraphFirstLine(text) {
    let summary = '';
    let paragraphStart = 0;
    const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
    while (true) {
        const nextParagraph = separator.exec(text);
        const paragraphEnd = nextParagraph === null ? text.length
            : nextParagraph.index + nextParagraph[0].indexOf('\n');
        const newline = text.indexOf('\n', paragraphStart);
        if (newline !== -1 && newline <= paragraphEnd) {
            const candidate = text.slice(paragraphStart, newline).trim();
            if (candidate !== '')
                summary = candidate;
        }
        if (nextParagraph === null)
            return summary;
        paragraphStart = nextParagraph.index + nextParagraph[0].length;
    }
}
/**
 * Render one assistant reasoning block collapsed until the reader opens it. The
 * collapsed summary omits double-asterisk markers; expanded content renders
 * the complete Markdown with secondary typography. A streaming preview advances
 * when a paragraph's first line completes. Mode changes toggle CSS display without unmounting
 * collapsed summaries.
 * @param props.text - complete or streaming reasoning text.
 * @param props.running - whether this block is the streaming tail.
 * @param props.usePresentation - live display-policy selector for this reasoning row.
 * @param props.useDisclosure - independent open state with enclosing-Turn resets.
 * @param props.renderSlot - framework renderer for the standard reasoning Body Slot.
 * @param props.t - conversation locale seat for the disclosure and running status.
 * @returns the reasoning disclosure.
 */
export const ReasoningRow = memo(function ReasoningRow({ text, running, usePresentation, useDisclosure, renderSlot, t }) {
    const { expanded, toggle } = useDisclosure();
    const summaryText = running ? latestCompletedParagraphFirstLine(text) : firstLine(text);
    const summary = useMemo(() => summaryText.replaceAll('**', ''), [summaryText]);
    const preview = usePresentation(policy => !expanded && summary !== ''
        && (running || policy.settledReasoningPreview));
    const collapsedContent = useMemo(() => (_jsxs(_Fragment, { children: [_jsx("span", { className: css.separator, "data-shimmer-decoration": true, "aria-hidden": true }), _jsx("span", { className: css.summary, "data-streaming": running || undefined, children: _jsx("span", { className: css.summaryText, children: _jsx(TextShimmer, { children: summary }) }) })] })), [running, summary]);
    const content = useMemo(() => expanded ? (_jsx("div", { className: css.thinkBody, children: renderSlot('conversation.chat.reasoning.body', { text, running }) })) : undefined, [expanded, renderSlot, running, text]);
    return (_jsxs("div", { className: css.root, "data-variant": "think", "data-state": running ? 'running' : 'ok', "data-expanded": expanded || undefined, "data-preview": preview || undefined, children: [running && _jsx("span", { className: a11yCss.visuallyHidden, children: t('row.running') }), _jsx(DisclosureRow, { rowClassName: css.row, leadingClassName: css.leading, titleClassName: css.title, icon: THINK_ICON, title: t('message.think'), running: running, open: expanded, expandable: true, expandOnRowClick: true, onToggle: toggle, collapsedContent: collapsedContent, children: content })] }));
});
//# sourceMappingURL=ReasoningRow.js.map