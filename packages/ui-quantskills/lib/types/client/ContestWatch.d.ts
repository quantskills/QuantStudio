import { type ReactNode } from 'react';
import type { ContestAccess } from './contest.ts';
export declare function ContestWatch({ access, connected, openModelSettings, plans }: {
    access: NonNullable<ContestAccess['watch']>;
    connected?: boolean;
    plans?: ReactNode;
    openModelSettings?: (() => void) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=ContestWatch.d.ts.map