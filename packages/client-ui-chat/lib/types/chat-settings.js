/** Chat display preferences stored in the Host user-settings document. */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the Chat target. */
export const CHAT_SETTINGS_NAMESPACE = 'ui-chat';
/** Field carrying the work-details presentation mode. */
export const TRANSCRIPT_VIEW_FIELD = 'transcriptView';
/** Field carrying the independent work-details collapse timing. */
export const COLLAPSE_TIMING_FIELD = 'collapseTiming';
/** Available points when a completed Turn returns to its historical presentation. */
export const COLLAPSE_TIMINGS = ['completion', 'next-input'];
/** Preserve completion-time folding when no timing preference is saved. */
export const DEFAULT_COLLAPSE_TIMING = 'completion';
/** Work-details presentation modes a user can choose. */
export const TRANSCRIPT_VIEW_MODES = ['compact', 'standard', 'detailed', 'verbose'];
/**
 * Saved value from the two-mode generation of this setting. Read as `detailed`;
 * never offered as a choice and never written back.
 */
export const LEGACY_TRANSCRIPT_VIEW_MODE = 'normal';
/** Saved `expanded` values read as `detailed`, without being offered or written back. */
export const LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE = 'expanded';
/** Every value the durable field accepts: current modes plus legacy saved values. */
const TRANSCRIPT_VIEW_SETTING_VALUES = [
    ...TRANSCRIPT_VIEW_MODES, LEGACY_TRANSCRIPT_VIEW_MODE, LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
];
/** Default work details for non-Desktop Web clients. */
export const DEFAULT_TRANSCRIPT_VIEW_MODE = 'detailed';
/** Performance and usage detail levels accepted by user settings. */
export const PERFORMANCE_USAGE_MODES = ['compact', 'detailed'];
/** Preserve detailed accounting for users without an explicit preference. */
export const DEFAULT_PERFORMANCE_USAGE = 'detailed';
/** Preserve the built-in browser for users without an explicit preference. */
export const DEFAULT_LINK_OPENING = 'sidebar';
/** Durable Chat schema; also the wire envelope the browser scope validates against. */
export const ChatSettingsFields = {
    [COLLAPSE_TIMING_FIELD]: z.union([...COLLAPSE_TIMINGS]).default(DEFAULT_COLLAPSE_TIMING),
    linkOpening: z.union(['sidebar', 'new-tab']).default(DEFAULT_LINK_OPENING),
    performanceUsage: z.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
    // Missing and unrecognized modes defer to the client's default.
    [TRANSCRIPT_VIEW_FIELD]: z.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).loose(),
};
/** Schema for shared configuration values. */
export const ChatSettingsSchema = z.object(ChatSettingsFields);
//# sourceMappingURL=chat-settings.js.map