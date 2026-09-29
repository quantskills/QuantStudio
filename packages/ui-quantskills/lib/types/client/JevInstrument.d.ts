import type { ContestWatchConfig } from './plugin-types.ts';
import type { ContestAccess } from './contest.ts';
import type { FuturesProduct } from './jev-products.ts';
export declare function JevInstrument({ config, onChange, catalog, quote, accountKey }: {
    config: ContestWatchConfig;
    onChange: (value: ContestWatchConfig) => void;
    catalog?: readonly FuturesProduct[];
    compact?: boolean;
    quote?: NonNullable<ContestAccess['watch']>['quote'];
    accountKey?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=JevInstrument.d.ts.map