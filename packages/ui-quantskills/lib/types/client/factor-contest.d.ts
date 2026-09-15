import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { FactorContestStatus, FactorCredentials, FactorInspection, FactorPlan, FactorPlanAction, FactorQuery, FactorRun } from './plugin-types.ts';
export interface FactorContestAccess {
    status(sessionId?: string): Promise<FactorContestStatus>;
    mode(enabled: boolean): Promise<FactorContestStatus>;
    connect(credentials?: FactorCredentials): Promise<FactorContestStatus>;
    disconnect(): Promise<FactorContestStatus>;
    checkUpdate(): Promise<FactorContestStatus>;
    update(): Promise<FactorContestStatus>;
    inspect(sessionId?: string, signal?: AbortSignal): Promise<FactorInspection>;
    query(query: FactorQuery, signal?: AbortSignal): Promise<JsonValue>;
    prepare(action: FactorPlanAction, sessionId?: string): Promise<FactorPlan>;
    confirm(plan: FactorPlan): Promise<FactorPlan>;
    dismiss(plan: FactorPlan): Promise<void>;
    stopBudget(budgetId: string): Promise<void>;
    reconcileRun(runId: string): Promise<FactorRun>;
    reconcilePlan(planId: string): Promise<FactorPlan>;
    startResearch(topic?: boolean, signal?: AbortSignal): Promise<void>;
    requestResearch(sessionId: string, text: string): Promise<void>;
}
export declare const factorPhases: {
    off: string;
    disconnected: string;
    installing: string;
    connected: string;
    error: string;
};
export declare const factorStates: Record<string, string>;
/** Local polling only. Invalidates late reads and actions on session changes or mode changes. */
export declare function useFactorContest(access: FactorContestAccess, sessionId?: string): {
    status: FactorContestStatus | undefined;
    error: string;
    busy: string;
    run: (name: string, work: (signal: AbortSignal) => Promise<unknown>) => Promise<boolean>;
    refresh: () => Promise<void>;
};
//# sourceMappingURL=factor-contest.d.ts.map