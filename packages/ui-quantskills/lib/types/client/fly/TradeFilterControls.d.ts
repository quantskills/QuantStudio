export type TradeFilterSettings = {
    trade_period_minutes: 1 | 5;
    signal_confirmations: number;
    min_signal_margin: number;
    reentry_cooldown_minutes: number;
    cost_filter_multiplier: number;
};
export declare function TradeFilterControls({ settings, onApply, onDraftChange, decisionEngine }: {
    decisionEngine?: 'neural' | 'llm' | undefined;
    settings: TradeFilterSettings;
    onApply: (value: TradeFilterSettings) => Promise<unknown>;
    onDraftChange?: (value: TradeFilterSettings) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=TradeFilterControls.d.ts.map