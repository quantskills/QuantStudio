import { z } from 'zod'
import type { ContestWatchDecision } from './contest-watch-types.ts'

export const watchAssessments = {
  regime: { type: 'choice', instructions: 'Classify the observed market using `evidence.features`, `historicalBars` and `observedQuoteSnapshots`. Use unclear when coverage is inadequate. Do not infer a long-term trend from a short quote window.',
    criteria: { range: 'Repeated movement between identifiable boundaries.', rising: 'Directional upward evidence dominates.', falling: 'Directional downward evidence dominates.', unclear: 'Insufficient or conflicting evidence.' } },
  fit: { type: 'choice', instructions: 'Does the observed market support the user strategy? Read `strategy.decisionMode`, `strategy.userGoal`, `strategy.numericRules` and `evidence.checks`. In jev mode, numeric strategy thresholds and checks with enforcement=reference are context for your independent judgment: their failure alone does not force contradicted. In strict mode, failed hard checks constrain applicability. Missing required history and checks with enforcement=hard cannot be overridden. Evaluate direction-specific evidence independently; a failed short-only reference does not contradict a long opportunity. Use insufficient when supplied data cannot support a judgment.',
    criteria: { supported: 'Required evidence supports applicability.', contradicted: 'Evidence or failed conditions contradict applicability.', insufficient: 'Required evidence is missing or ambiguous.' } },
  blocker: { type: 'choice', instructions: 'Identify the main impediment to an eligible action from `hardLimits`, `evidence.allowedActions`, `evidence.checks`, `account` and `strategy`. check.actions lists the relevant directions. Only enforcement=hard checks prohibit actions. In jev mode, independently assess reference checks and the supplied raw evidence; an unmet reference threshold is not automatically a blocker. In strict mode, all hard strategy gates apply. If any permitted non-hold action is justified, choose none; failed opposite-direction references are not blockers. Missing required history forbids new openings but does not prevent assessing an existing position exit. If no entry is permitted due to missing history, identify data_missing. This assessment is independent: do not infer another question answer.',
    criteria: { none: 'No identified impediment.', data_missing: 'Missing, stale, or insufficient evidence.', regime_mismatch: 'Market environment conflicts with strategy.', entry_not_met: 'Entry conditions are not met.', cost_conflict: 'Costs conflict with entry requirements.', position_constraint: 'Position or allowed-action constraints prevent entry.', exit_not_met: 'The supplied exit conditions are not met.' } },
} as const

export function parseAssessments(value: unknown): NonNullable<ContestWatchDecision['assessments']> {
  const answer = z.object({ type: z.literal('choice'), choice: z.string(), confidence: z.number().min(0).max(1), probabilities: z.record(z.string(), z.number().min(0).max(1)) })
  const parsed = z.object({ regime: answer, fit: answer, blocker: answer }).safeParse(value)
  if (!parsed.success) throw new Error('Jev 分项判断缺失或无效。')
  for (const name of ['regime', 'fit', 'blocker'] as const) {
    const result = parsed.data[name], options = Object.keys(watchAssessments[name].criteria), keys = Object.keys(result.probabilities)
    if (!options.includes(result.choice) || keys.length !== options.length || keys.some(key => !options.includes(key))
      || Math.abs(Object.values(result.probabilities).reduce((a, b) => a + b, 0) - 1) > .01
      || result.probabilities[result.choice]! < Math.max(...Object.values(result.probabilities))) throw new Error('Jev 分项判断选项或概率无效。')
  }
  return parsed.data
}
