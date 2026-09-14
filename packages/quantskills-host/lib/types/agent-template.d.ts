/** Parser for standard QuantSkills `AGENTS.md` declarations. */
import type { QuantSkillsAssetId } from './types.ts';
import type { QuantSkillsPromptFormResult } from './types.ts';
/** Parsed discovery metadata and execution instructions from an Agent declaration. */
export interface ParsedQuantSkillsAgent {
    readonly name: string;
    readonly description: string;
    readonly instructions: string;
    readonly requires: readonly QuantSkillsAssetId[];
    readonly promptForm?: QuantSkillsPromptFormResult;
}
/**
 * Parse and validate one standard QuantSkills Agent declaration.
 * @param raw - complete UTF-8 `AGENTS.md` text.
 * @returns validated template metadata and instruction body.
 */
export declare function parseQuantSkillsAgent(raw: string): ParsedQuantSkillsAgent;
//# sourceMappingURL=agent-template.d.ts.map