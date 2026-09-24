import type { ModelConnection } from '@deepseek-ai/dsh-quantskills-session/types';
import type { ContestAccess } from './contest.ts';
export declare function JevConnection({ access, models }: {
    access: Pick<NonNullable<ContestAccess['watch']>, 'settings' | 'configure'>;
    models?: readonly ModelConnection[] | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=JevConnection.d.ts.map