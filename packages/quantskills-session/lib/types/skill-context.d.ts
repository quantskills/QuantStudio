/** Lossless, opt-in loading of exact attached Skill versions. No model-based summaries. */
import type { QuantSkillsResolvedInstalledSkill } from '@deepseek-ai/dsh-quantskills-host';
export type SkillContextMode = 'full' | 'progressive';
export declare const ATTACHED_SKILL_READER = "read_attached_skills";
/** Conservative character-based gate, not a token/cost prediction. A deferred read
 * adds a round trip: single Skills and fixed all-Skill workflows stay inline. */
export declare function selectSkillContextMode(configured: SkillContextMode, skills: readonly QuantSkillsResolvedInstalledSkill[], fixedWorkflow?: boolean): SkillContextMode;
/** Shared guidance is emitted once per Agent, never once per attached Skill. */
export declare const PROGRESSIVE_SKILL_GUIDANCE: string;
export declare function renderSkillLoadingGuidance(skills: readonly QuantSkillsResolvedInstalledSkill[], mode: SkillContextMode, fixedWorkflow: boolean): string;
/** Communication policy changes neither saved team membership nor fresh/fork settings. */
export declare const EFFICIENT_TEAM_GUIDANCE: string;
/** Use full instructions for short or invocation-restricted Skills; never truncate a body. */
export declare function renderResidentSkillContext(skill: QuantSkillsResolvedInstalledSkill, mode: SkillContextMode): string;
/** Resolve only current Agent attachments, preserving complete contents and resource bases. */
export declare function attachedSkillReader(resolve: (assetId: string) => QuantSkillsResolvedInstalledSkill | undefined, ownerId?: string): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=skill-context.d.ts.map