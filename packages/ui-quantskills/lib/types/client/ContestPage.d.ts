import type { QuantSkillsPlainSessionArchiveItem } from './plugin-types.ts';
import { type ContestAccess } from './contest.ts';
import type { FlyAccess } from './fly/transport.ts';
interface ContestPageProps {
    access?: ContestAccess | undefined;
    flyAccess?: FlyAccess | undefined;
    openFly?: (() => void) | undefined;
    openModelSettings?: (() => void) | undefined;
    researchSessions?: readonly QuantSkillsPlainSessionArchiveItem[] | undefined;
    openResearch?: ((sessionId: QuantSkillsPlainSessionArchiveItem['sessionId']) => void) | undefined;
}
export declare function ContestPage({ access, flyAccess, openFly, researchSessions, openResearch, openModelSettings }: ContestPageProps): import("react").JSX.Element;
export declare function ContestTable({ value }: {
    value: unknown;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=ContestPage.d.ts.map