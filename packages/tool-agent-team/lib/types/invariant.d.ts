/** Package-owned invariant companion for the Team tool adapter. */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "tool-team-invariant";
/** Invariant registry dependency. */
export declare const inject: string[];
/** Register this package's invariant ownership. */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map