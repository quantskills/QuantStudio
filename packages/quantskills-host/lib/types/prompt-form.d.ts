/** Parser for optional, non-executable QuantSkills `qsh-form` v1 metadata. */
import type { QuantSkillsPromptFormResult } from './types.ts';
/**
 * Parse the first optional `qsh-form` block without changing the surrounding declaration.
 * @param source - complete Skill or Agent instruction body.
 * @returns a ready or invalid form result, or `undefined` when no form is declared.
 */
export declare function parseQuantSkillsPromptForm(source: string): QuantSkillsPromptFormResult | undefined;
//# sourceMappingURL=prompt-form.d.ts.map