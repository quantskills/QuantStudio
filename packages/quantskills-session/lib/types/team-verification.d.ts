import type { Agent } from '@deepseek-ai/dsh-agent';
import type { QuantSkillsResolvedInstalledSkill } from '@deepseek-ai/dsh-quantskills-host';
import type { QuantSkillsAgentTeamSessionMember } from './types.ts';
export declare const TEAM_MEMBER_INSTRUCTIONS = "read_team_member_instructions";
export declare const TEAM_CALCULATE = "quantskills_calculate";
export declare const TEAM_LEAD_VERIFICATION: string;
export declare const TEAM_MEMBER_VERIFICATION: string;
export interface Calculation {
    readonly label: string;
    readonly operation: 'sum' | 'subtract' | 'multiply' | 'divide';
    readonly values: readonly string[];
    readonly expected?: string;
}
/** Pure decimal/rational arithmetic. No eval, shell, filesystem, model or network.
 * Repeated operands are deliberately retained; correctness of source selection
 * remains the caller's responsibility and is never represented as verified. */
export declare function calculateBatch(calculations: readonly Calculation[], places?: number): {
    matchesExpected?: boolean;
    exact: {
        numerator: string;
        denominator: string;
    };
    value: string;
    rounded: boolean;
    label: any;
    operation: any;
    operandCount: number;
}[];
export declare const teamCalculationTool: import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function teamMemberInstructionReader(owner: Agent, resolve: (name: string) => {
    readonly member: QuantSkillsAgentTeamSessionMember;
    readonly resolved: readonly QuantSkillsResolvedInstalledSkill[];
} | undefined): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=team-verification.d.ts.map