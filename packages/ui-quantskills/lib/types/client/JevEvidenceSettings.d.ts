import { type Dispatch, type SetStateAction } from 'react';
import type { ContestWatchConfig } from './plugin-types.ts';
import type { ContestAccess } from './contest.ts';
export declare function JevEvidenceSettings({ access, config, onChange, onBusy }: {
    access: NonNullable<ContestAccess['watch']>;
    config: ContestWatchConfig;
    onChange: Dispatch<SetStateAction<ContestWatchConfig>>;
    onBusy: (busy: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=JevEvidenceSettings.d.ts.map