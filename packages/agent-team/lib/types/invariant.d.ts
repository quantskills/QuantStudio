/** Package-owned relational checks for Agent Teams durable records. */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "team-invariant";
/** Invariant registry required by the companion. */
export declare const inject: string[];
/** Register the package invariant companion. */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map