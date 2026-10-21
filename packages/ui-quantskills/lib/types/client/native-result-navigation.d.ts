import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
export declare const QS_RESULTS_KIND = "quantskills-results";
/** Refuse stale session callbacks; never borrow the currently visible session's paths. */
export declare function openNativeResult(sidebar: ISidebarRight | undefined, sessionId: SessionId, cwd: string | undefined, path?: string): boolean;
//# sourceMappingURL=native-result-navigation.d.ts.map