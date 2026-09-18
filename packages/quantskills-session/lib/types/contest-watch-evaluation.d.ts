import type { ContestWatchDecision } from './contest-watch-types.ts';
export declare const watchAssessments: {
    readonly regime: {
        readonly type: "choice";
        readonly instructions: "Classify the observed market using `evidence.features`, `historicalBars` and `observedQuoteSnapshots`. Use unclear when coverage is inadequate. Do not infer a long-term trend from a short quote window.";
        readonly criteria: {
            readonly range: "Repeated movement between identifiable boundaries.";
            readonly rising: "Directional upward evidence dominates.";
            readonly falling: "Directional downward evidence dominates.";
            readonly unclear: "Insufficient or conflicting evidence.";
        };
    };
    readonly fit: {
        readonly type: "choice";
        readonly instructions: "Does the observed market support the user strategy? Read `strategy.decisionMode`, `strategy.userGoal`, `strategy.numericRules` and `evidence.checks`. In jev mode, numeric strategy thresholds and checks with enforcement=reference are context for your independent judgment: their failure alone does not force contradicted. In strict mode, failed hard checks constrain applicability. Missing required history and checks with enforcement=hard cannot be overridden. Evaluate direction-specific evidence independently; a failed short-only reference does not contradict a long opportunity. Use insufficient when supplied data cannot support a judgment.";
        readonly criteria: {
            readonly supported: "Required evidence supports applicability.";
            readonly contradicted: "Evidence or failed conditions contradict applicability.";
            readonly insufficient: "Required evidence is missing or ambiguous.";
        };
    };
    readonly blocker: {
        readonly type: "choice";
        readonly instructions: "Identify the main impediment to an eligible action from `hardLimits`, `evidence.allowedActions`, `evidence.checks`, `account` and `strategy`. check.actions lists the relevant directions. Only enforcement=hard checks prohibit actions. In jev mode, independently assess reference checks and the supplied raw evidence; an unmet reference threshold is not automatically a blocker. In strict mode, all hard strategy gates apply. If any permitted non-hold action is justified, choose none; failed opposite-direction references are not blockers. Missing required history forbids new openings but does not prevent assessing an existing position exit. If no entry is permitted due to missing history, identify data_missing. This assessment is independent: do not infer another question answer.";
        readonly criteria: {
            readonly none: "No identified impediment.";
            readonly data_missing: "Missing, stale, or insufficient evidence.";
            readonly regime_mismatch: "Market environment conflicts with strategy.";
            readonly entry_not_met: "Entry conditions are not met.";
            readonly cost_conflict: "Costs conflict with entry requirements.";
            readonly position_constraint: "Position or allowed-action constraints prevent entry.";
            readonly exit_not_met: "The supplied exit conditions are not met.";
        };
    };
};
export declare function parseAssessments(value: unknown): NonNullable<ContestWatchDecision['assessments']>;
//# sourceMappingURL=contest-watch-evaluation.d.ts.map