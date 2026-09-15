import type { ContestStatus } from './plugin-types.ts';
import { type ContestAccess } from './contest.ts';
export declare function ContestPlans({ status, access, refresh, compact, autoOpen }: {
    status: ContestStatus;
    access: ContestAccess;
    refresh(): Promise<void>;
    compact?: boolean;
    autoOpen?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=ContestPlans.d.ts.map