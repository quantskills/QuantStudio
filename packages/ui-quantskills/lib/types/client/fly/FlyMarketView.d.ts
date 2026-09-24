import { type TradeMarket } from './TradeLoop.tsx';
export type MarketView = TradeMarket & {
    price?: number;
    chart?: number[];
    quote_at?: number;
    last_bar?: string;
};
/** A view of received market data only; an empty or stale feed is never animated as live. */
export declare function FlyMarketView({ market, observing, onDetails }: {
    market?: MarketView | undefined;
    observing: boolean;
    onDetails(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyMarketView.d.ts.map