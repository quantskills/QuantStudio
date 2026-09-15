import type { ContestData, ContestPlan, ContestQuery, ContestStatus, ContestInspection } from './plugin-types.ts';
export interface ContestAccess {
    status(sessionId?: string): Promise<ContestStatus>;
    mode(enabled: boolean): Promise<ContestStatus>;
    connect(): Promise<ContestStatus>;
    disconnect(): Promise<ContestStatus>;
    checkUpdate(): Promise<ContestStatus>;
    update(): Promise<ContestStatus>;
    query(query: ContestQuery): Promise<ContestData>;
    execute(plan: ContestPlan): Promise<ContestPlan>;
    dismiss(plan: ContestPlan): Promise<ContestStatus>;
    reconcile(plan: ContestPlan): Promise<ContestPlan>;
    inspect(sessionId: string): Promise<ContestInspection>;
    requestResearch(sessionId: string, text: string): Promise<void>;
    startResearch(topic?: boolean): Promise<void>;
}
/** Polls local status only while a contest surface is mounted. Late responses cannot restore old UI state. */
export declare function useContest(access: ContestAccess, sessionId?: string): {
    status: ContestStatus | undefined;
    error: string | undefined;
    busy: string;
    run: (name: string, work: () => Promise<unknown>) => Promise<void>;
    refresh: () => Promise<void>;
};
export declare const contestPhases: {
    off: string;
    disconnected: string;
    installing: string;
    authenticating: string;
    connected: string;
    error: string;
};
export declare const planStates: Record<ContestPlan['status'], string>;
export declare function asRecord(value: unknown): Record<string, unknown>;
export declare function display(value: unknown): string;
export declare function contestTime(time: number): string;
//# sourceMappingURL=contest.d.ts.map