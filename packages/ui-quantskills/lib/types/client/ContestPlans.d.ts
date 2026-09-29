import type { ContestStatus } from './plugin-types.ts';
import { type ContestAccess } from './contest.ts';
export declare function ContestPlans({ status, access, refresh, compact, autoOpen, automatic }: {
    status: ContestStatus;
    access: ContestAccess;
    refresh(): Promise<void>;
    compact?: boolean;
    autoOpen?: boolean;
    automatic?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=ContestPlans.d.ts.map