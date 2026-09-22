import type { ContestData, ContestPlan, ContestQuery, ContestStatus, ContestInspection, ContestJevSettings, ContestJevUsage, ContestWatchConfig, ContestWatchDataset, ContestWatchTemplate, ContestWatchStatus } from './plugin-types.ts';
export interface ContestAccess {
    watch?: {
        varieties?(signal?: AbortSignal): Promise<ContestData>;
        settings(): Promise<ContestJevSettings>;
        usage(): Promise<ContestJevUsage>;
        templates(): Promise<ContestWatchTemplate[]>;
        saveTemplate(request: ContestWatchTemplate): Promise<ContestWatchTemplate[]>;
        datasets(): Promise<ContestWatchDataset[]>;
        prepareHistory(request: {
            symbol: string;
            barSeconds: number;
        }): Promise<NonNullable<ContestWatchConfig['history']>>;
        configure(request: {
            apiKey?: string;
            translator?: {
                provider: string;
                model: string;
            };
        }): Promise<ContestJevSettings>;
        status(): Promise<ContestWatchStatus>;
        start(config: ContestWatchConfig): Promise<ContestWatchStatus>;
        stop(): Promise<ContestWatchStatus>;
    };
    status(sessionId?: string): Promise<ContestStatus>;
    mode(enabled: boolean): Promise<ContestStatus>;
    connect(): Promise<ContestStatus>;
    disconnect(): Promise<ContestStatus>;
    checkUpdate(): Promise<ContestStatus>;
    update(): Promise<ContestStatus>;
    query(query: ContestQuery, signal?: AbortSignal): Promise<ContestData>;
    execute(plan: ContestPlan): Promise<ContestPlan>;
    dismiss(plan: ContestPlan): Promise<ContestStatus>;
    reconcile(plan: ContestPlan): Promise<ContestPlan>;
    inspect(sessionId: string, signal?: AbortSignal): Promise<ContestInspection>;
    requestResearch(sessionId: string, text: string): Promise<void>;
    startResearch(topic?: boolean, signal?: AbortSignal): Promise<void>;
}
/** Polls local status only while a contest surface is mounted. Late responses cannot restore old UI state. */
export declare function useContest(access: ContestAccess, sessionId?: string): {
    error: string;
    status: ContestStatus | undefined;
    busy: string;
    run: (name: string, work: (signal: AbortSignal) => Promise<unknown>) => Promise<boolean>;
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