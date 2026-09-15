import type { QuantSkillsPlainSessionArchiveItem } from './plugin-types.ts';
import { type ContestAccess } from './contest.ts';
interface ContestPageProps {
    access?: ContestAccess | undefined;
    researchSessions?: readonly QuantSkillsPlainSessionArchiveItem[] | undefined;
    openResearch?: ((sessionId: QuantSkillsPlainSessionArchiveItem['sessionId']) => void) | undefined;
}
export declare function ContestPage({ access, researchSessions, openResearch }: ContestPageProps): import("react").JSX.Element;
export declare function ContestTable({ value }: {
    value: unknown;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=ContestPage.d.ts.map