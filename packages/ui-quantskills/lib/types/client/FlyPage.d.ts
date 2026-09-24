import type { FlyAccess } from './fly/transport.ts';
import type { ContestAccess } from './contest.ts';
export declare function FlyPage({ access, contest, openContest, openModelSettings }: {
    access?: FlyAccess | undefined;
    contest?: ContestAccess | undefined;
    openContest(): void;
    openModelSettings?: (() => void) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyPage.d.ts.map