import type { FlyAccess } from './fly/transport.ts';
import type { ContestAccess } from './contest.ts';
import './TradingWorkspace.css';
import './RefinedTrading.css';
export declare function FlyPage(props: Parameters<typeof FlyWorkspace>[0]): import("react").JSX.Element;
declare function FlyWorkspace({ access, contest, openContest, openModelSettings }: {
    embedded?: boolean;
    access?: FlyAccess | undefined;
    contest?: ContestAccess | undefined;
    openContest(): void;
    openModelSettings?: (() => void) | undefined;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=FlyPage.d.ts.map