import type { ContestWatchConfig } from './plugin-types.ts';
import type { FuturesProduct } from './jev-products.ts';
export declare function JevInstrument({ config, onChange, catalog, compact }: {
    config: ContestWatchConfig;
    onChange: (value: ContestWatchConfig) => void;
    catalog?: readonly FuturesProduct[];
    compact?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=JevInstrument.d.ts.map