/** Performance detail preference, live immediately and reconciled with accepted Host settings. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { DEFAULT_PERFORMANCE_USAGE } from "../chat-settings.js";
/** Shared live preference for the settings row and chat statistics. */
export class PerformanceUsagePolicy {
    host;
    unsubscribe;
    /** Current choice, reconciled with accepted Host settings when available. */
    mode = createSnapshotStore(DEFAULT_PERFORMANCE_USAGE);
    /** @param host - Chat settings scope persisted through the Host. */
    constructor(host) {
        this.host = host;
        const adopt = () => {
            const accepted = host.getSnapshot().value?.performanceUsage;
            if (accepted !== undefined)
                this.mode.set(accepted);
        };
        this.unsubscribe = host.subscribe(adopt);
        adopt();
    }
    /** Release the accepted-value subscription. */
    dispose() { this.unsubscribe(); }
    /**
     * Publish a choice immediately and queue its Host write.
     * @param mode - Statistics detail selected by the user.
     */
    setMode(mode) {
        if (mode === this.mode.getSnapshot())
            return;
        this.mode.set(mode);
        void this.host.set('performanceUsage', mode);
    }
}
//# sourceMappingURL=performance-usage.js.map