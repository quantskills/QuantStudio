import type { MarketView } from './FlyMarketView.tsx';
export declare function FlyContractList({ markets, selected, trading, onSelect, onManage }: {
    markets: MarketView[];
    selected: string | undefined;
    trading: boolean;
    onSelect(product: string): void;
    onManage(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyContractList.d.ts.map