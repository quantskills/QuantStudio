import { type ReactNode } from 'react';
import type { ContestAccess } from './contest.ts';
import './JevWorkspace.css';
export declare function ContestWatch({ access, connected, openModelSettings, plans, onSummary, accountId }: {
    accountId?: string | undefined;
    onSummary?: ((value: {
        label: string;
        active: boolean;
    }) => void) | undefined;
    access: NonNullable<ContestAccess['watch']>;
    connected?: boolean;
    plans?: ReactNode;
    openModelSettings?: (() => void) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=ContestWatch.d.ts.map