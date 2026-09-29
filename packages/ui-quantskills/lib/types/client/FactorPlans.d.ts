import type { FactorContestStatus } from './plugin-types.ts';
import { type FactorContestAccess } from './factor-contest.ts';
export declare function FactorPlans({ status, access, refresh, compact, hideHeading, openPlanId }: {
    status: FactorContestStatus;
    access: FactorContestAccess;
    refresh(): Promise<void>;
    compact?: boolean;
    hideHeading?: boolean;
    openPlanId?: string | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=FactorPlans.d.ts.map