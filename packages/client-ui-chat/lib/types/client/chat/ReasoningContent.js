import { jsx as _jsx } from "react/jsx-runtime";
/** Official reasoning content and its default Body Slot adapter. */
import { memo, useMemo } from 'react';
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import { markdownLabels } from "../markdown-labels.js";
/**
 * Render compact reasoning with caller-supplied labels or Chat's defaults.
 * @param props - display text, streaming state, optional localized labels, and the Factory's locale seat; no Session is required.
 * @returns the standard reasoning content; supplied labels are used without merging defaults.
 */
export const ReasoningContent = memo(function ReasoningContent({ text, running, labels, t }) {
    const resolvedLabels = useMemo(() => labels ?? markdownLabels(t), [labels, t]);
    return _jsx(MarkdownText, { text: text, streaming: running, labels: resolvedLabels, variant: "compact" });
});
/**
 * Render the default Body through the same Factory available to third-party wrappers.
 * @param props - original reasoning and the framework's Factory renderer.
 * @returns an occurrence of the official reasoning Content Factory.
 */
export function DefaultReasoningBody({ text, running, renderFactorySlot }) {
    return renderFactorySlot('conversation.chat.reasoning.content', { text, running });
}
//# sourceMappingURL=ReasoningContent.js.map