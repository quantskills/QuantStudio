import type { FactorContestAccess } from './factor-contest.ts';
/** Updates are platform-owned versions of one factor, not arbitrary replacement IDs. */
export declare function FactorWorkflowUpdate({ factorId, workflowId, access, busy, submit }: {
    factorId: string;
    workflowId: string;
    access: FactorContestAccess;
    busy: boolean;
    submit(id: string): void;
}): import("react").JSX.Element;
//# sourceMappingURL=FactorWorkflowUpdate.d.ts.map