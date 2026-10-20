/** Chat presentation derived from Host-backed detail and collapse timing. */
export { COLLAPSE_TIMINGS } from "../chat-settings.js";
const POLICIES = {
    compact: {
        mode: 'compact',
        foldCompletedTurns: true,
        stepGrouping: 'collapsed',
        liveProcessDetail: false,
        settledReasoningPreview: false,
    },
    standard: {
        mode: 'standard',
        foldCompletedTurns: true,
        stepGrouping: 'collapsed',
        liveProcessDetail: true,
        settledReasoningPreview: true,
    },
    detailed: {
        mode: 'detailed',
        foldCompletedTurns: true,
        stepGrouping: 'history',
        liveProcessDetail: true,
        settledReasoningPreview: true,
    },
    verbose: {
        mode: 'verbose',
        foldCompletedTurns: false,
        stepGrouping: 'none',
        liveProcessDetail: false,
        settledReasoningPreview: true,
    },
};
function withTiming(collapseTiming) {
    return {
        compact: { ...POLICIES.compact, collapseTiming },
        standard: { ...POLICIES.standard, collapseTiming },
        detailed: { ...POLICIES.detailed, collapseTiming },
        verbose: { ...POLICIES.verbose, collapseTiming },
    };
}
const TIMING_POLICIES = {
    completion: withTiming('completion'),
    'next-input': withTiming('next-input'),
};
/**
 * Resolve a stable policy for one detail mode and collapse timing.
 * @param mode - persisted work-details mode.
 * @param collapseTiming - persisted timing; defaults to immediate completion folding.
 * @returns the same policy object for the same pair of choices.
 */
export function presentationPolicyFor(mode, collapseTiming = 'completion') {
    return TIMING_POLICIES[collapseTiming][mode];
}
/**
 * Combine Host-backed detail and persisted timing without owning subscriptions.
 * @param mode - live work-details mode.
 * @param collapseTiming - live Host-backed collapse timing.
 * @returns observable policy whose subscriptions follow both preferences.
 */
export function derivePresentationPolicy(mode, collapseTiming) {
    return {
        getSnapshot: () => presentationPolicyFor(mode.getSnapshot(), collapseTiming.getSnapshot()),
        subscribe: (listener) => {
            const unsubscribeMode = mode.subscribe(listener);
            const unsubscribeTiming = collapseTiming.subscribe(listener);
            return () => { unsubscribeMode(); unsubscribeTiming(); };
        },
    };
}
//# sourceMappingURL=presentation-policy.js.map