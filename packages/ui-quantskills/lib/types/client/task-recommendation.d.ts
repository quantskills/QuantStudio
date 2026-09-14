/** Catalog fields supplied to the AI home-task guide. */
export interface QuantSkillsRecommendableSkill {
    readonly name: string;
    readonly title: string;
    readonly englishTitle?: string;
    readonly aliases?: readonly string[];
    readonly summary: string;
    readonly description: string;
    readonly category: string;
    readonly subcategory: string;
}
/** One exact catalog recommendation with a model-authored explanation. */
export interface QuantSkillsGuideRecommendation<T extends QuantSkillsRecommendableSkill> {
    readonly skill: T;
    readonly reason: string;
}
/** Validated decision returned by the AI home-task guide. */
export type QuantSkillsGuideDecision<T extends QuantSkillsRecommendableSkill> = Readonly<{
    readonly kind: 'clarify';
    readonly message: string;
    readonly question: string;
    readonly options: readonly string[];
} | {
    readonly kind: 'recommend';
    readonly message: string;
    readonly recommendations: readonly QuantSkillsGuideRecommendation<T>[];
} | {
    readonly kind: 'create';
    readonly message: string;
}>;
/**
 * Build the model-visible request for conversational Skill catalog guidance.
 * @param conversation - User requirement plus any answers to earlier guide questions.
 * @param skills - Trusted catalog Skills eligible for recommendation.
 * @returns A bounded prompt whose catalog entries are data rather than instructions.
 */
export declare function buildSkillGuidePrompt(conversation: string, skills: readonly QuantSkillsRecommendableSkill[]): string;
/**
 * Resolve one model answer into a validated guide decision.
 * @param answer - Assistant text returned by the temporary guide Session.
 * @param skills - Trusted catalog Skills that were offered to the model.
 * @returns A clarification, exact catalog recommendations, or a creation suggestion.
 */
export declare function parseSkillGuideDecision<T extends QuantSkillsRecommendableSkill>(answer: string, skills: readonly T[]): QuantSkillsGuideDecision<T>;
//# sourceMappingURL=task-recommendation.d.ts.map