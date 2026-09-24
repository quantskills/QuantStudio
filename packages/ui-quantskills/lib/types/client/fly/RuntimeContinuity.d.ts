export type Continuity = {
    persistence?: {
        ok?: boolean;
        at?: number;
        database?: string;
        backup_root?: string;
        daily_archive?: string;
        error?: string;
        free_bytes?: number;
    };
    runtime_health?: {
        at?: number;
        continuous?: boolean;
        neural_ready?: boolean;
    };
};
export declare function RuntimeContinuity({ status }: {
    status: Continuity;
}): import("react").JSX.Element;
//# sourceMappingURL=RuntimeContinuity.d.ts.map