import type { ContestAccess } from './contest.ts';
export declare function JevConnection({ access, disabled, onConfigured, onBusy }: {
    access: NonNullable<ContestAccess['watch']>;
    disabled: boolean;
    onConfigured: (configured: boolean) => void;
    onBusy: (busy: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=JevConnection.d.ts.map