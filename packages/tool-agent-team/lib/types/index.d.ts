/** Scoped model-facing tools for the opt-in Agent Teams runtime. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "tool-agent-team";
/** Services required by the Team tool plugin. */
export declare const inject: string[];
/** Tool routing configuration. */
export interface Config {
    /** Continuable-subagent provider used for fresh teammates. */
    readonly freshProvider?: string;
    /** Continuable-subagent provider used for completed-prefix fork teammates. */
    readonly forkProvider?: string;
    /** Whether the unrestricted model-facing teammate creation tool is installed. */
    readonly spawnToolEnabled?: boolean;
}
/** Loader schema for the opt-in Team tool plugin. */
export declare const Config: z<Config>;
/** Install Team tools in every live or subsequently published Team member scope. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map