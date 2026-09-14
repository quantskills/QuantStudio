import type { PandaMcpStatus } from './plugin-types.ts';
/** Traffic-light color used by compact PandaData MCP status controls. */
export type PandaMcpSignal = 'red' | 'yellow' | 'green';
/** Resolve one Host phase to its concise Chinese status label. */
export declare function pandaMcpPhaseLabel(phase: PandaMcpStatus['phase']): string;
/** Resolve one Host phase to the user-visible red/yellow/green signal. */
export declare function pandaMcpSignal(phase: PandaMcpStatus['phase']): PandaMcpSignal;
//# sourceMappingURL=panda-mcp-presentation.d.ts.map