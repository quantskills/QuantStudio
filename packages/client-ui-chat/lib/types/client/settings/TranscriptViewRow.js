import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { TRANSCRIPT_VIEW_MODES } from "../../chat-settings.js";
import { COLLAPSE_TIMINGS } from "../presentation-policy.js";
import { PreferenceRow } from "./PreferenceRow.js";
const LABELS = {
    compact: 'settings.transcript.compact',
    standard: 'settings.transcript.standard',
    detailed: 'settings.transcript.detailed',
    verbose: 'settings.transcript.verbose',
};
const COLLAPSE_LABELS = {
    completion: 'settings.collapse.completion',
    'next-input': 'settings.collapse.nextInput',
};
/**
 * Render the independent, Host-backed work-details and collapse-timing selectors.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function TranscriptViewRow({ useTranscriptView, setTranscriptView, useCollapseTiming, setCollapseTiming, t, }) {
    const mode = useTranscriptView(value => value);
    const timing = useCollapseTiming(value => value);
    return (_jsxs(_Fragment, { children: [_jsx(PreferenceRow, { title: t('settings.transcript.title'), description: t('settings.transcript.description'), value: mode, selectedLabel: t(LABELS[mode]), options: TRANSCRIPT_VIEW_MODES.map(id => ({ id, label: t(LABELS[id]) })), onSelect: (value) => { setTranscriptView(value); } }), _jsx(PreferenceRow, { title: t('settings.collapse.title'), description: t('settings.collapse.description'), value: timing, selectedLabel: t(COLLAPSE_LABELS[timing]), options: COLLAPSE_TIMINGS.map(id => ({ id, label: t(COLLAPSE_LABELS[id]) })), onSelect: (value) => { setCollapseTiming(value); } })] }));
}
//# sourceMappingURL=TranscriptViewRow.js.map