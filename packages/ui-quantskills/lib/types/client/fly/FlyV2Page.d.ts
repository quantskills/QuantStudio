import { type ReactNode } from 'react';
import './fly-v2.css';
import type { ContestAccess } from '../contest.ts';
import './fly-workspace.css';
import './trader-overview.css';
export default function FlyV2Page({ active, contest, openContest, openModelSettings, preparing, prepareMessage, onPrepare, tradePlans, initialTab }: {
    initialTab?: 'dashboard' | 'analysis' | 'talk';
    openContest?: (() => void) | undefined;
    tradePlans?: ReactNode;
    active: boolean;
    contest?: Pick<ContestAccess, 'query' | 'status' | 'mode' | 'connect'> | undefined;
    openModelSettings?: (() => void) | undefined;
    preparing?: boolean;
    prepareMessage?: string | undefined;
    onPrepare?: (() => Promise<unknown>) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyV2Page.d.ts.map