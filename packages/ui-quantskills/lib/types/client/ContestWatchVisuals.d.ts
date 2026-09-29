import type { ContestWatchStatus, ContestWatchConfig } from './plugin-types.ts';
export declare const watchActions: Record<string, string>;
export declare function ContestWatchVisuals({ status: overall, active, config }: {
    status: ContestWatchStatus | undefined;
    active: boolean;
    config?: ContestWatchConfig;
}): import("react").JSX.Element;
//# sourceMappingURL=ContestWatchVisuals.d.ts.map