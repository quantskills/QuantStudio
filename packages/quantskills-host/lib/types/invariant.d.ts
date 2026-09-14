/** Package-owned invariant companion. @module @deepseek-ai/dsh-quantskills-host/invariant */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "quantskills-host-invariant";
/** Service required before package ownership can be reserved. */
export declare const inject: string[];
/**
 * Register this package's invariant companion.
 * @param ctx - Context carrying the invariant registry.
 * @returns the registration disposer.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map