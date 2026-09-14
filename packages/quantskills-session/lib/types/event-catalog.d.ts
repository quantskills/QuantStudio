/** Runtime compatibility registration for QuantSkills-owned durable Session events. */
/** Durable event types written by the QuantSkills plugin suite. */
export declare const QUANTSKILLS_SESSION_EVENT_TYPES: readonly ["quantskills/plain-session", "quantskills/session-bound", "quantskills/agent-session", "quantskills/agent-team-session", "quantskills/agent-team-member", "quantskills/resident-skill-changed", "quantskills/file-attached", "panda/runtime-bound", "quantskills/authoring-started", "quantskills/authoring-committed"];
/**
 * Extends the DSH rc.2 process-wide event catalog before QuantSkills sessions are restored.
 *
 * @returns Nothing.
 */
export declare function registerQuantSkillsSessionEventTypes(): void;
//# sourceMappingURL=event-catalog.d.ts.map