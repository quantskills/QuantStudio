import type { ViewTab } from './contract/views.ts';
/** Fallback View selected when no stored preference resolves to a registered View. */
export declare const DEFAULT_VIEW_ID = "chat";
/** Registered identity of the trajectory View. */
export declare const TRAJECTORY_VIEW_ID = "trajectory";
/**
 * Resolve a preferred registered View, then Chat, without choosing another View.
 * @param tabs - currently registered Views.
 * @param selectedId - preferred View identity, when one is stored.
 * @returns the selected View, Chat fallback, or undefined when neither is registered.
 */
export declare function resolveActiveView(tabs: readonly ViewTab[], selectedId: string | null): ViewTab | undefined;
//# sourceMappingURL=view-selection.d.ts.map