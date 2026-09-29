export type TradingEngineConfig = {
    decision_engine?: 'neural' | 'llm';
    trade_model?: string;
    trade_instructions?: string;
    llm_max_lots?: number;
    trade_daily_calls?: number;
};
export declare const defaultTradingInstructions = "\u6839\u636E\u6700\u8FD1\u884C\u60C5\u548C\u5F53\u524D\u6301\u4ED3\u5224\u65AD\u8D8B\u52BF\u3002\u8BC1\u636E\u4E0D\u8DB3\u65F6\u7B49\u5F85\uFF0C\u4E0D\u8FFD\u9010\u77ED\u6682\u6CE2\u52A8\uFF1B\u8D8B\u52BF\u5931\u6548\u65F6\u51CF\u4ED3\u6216\u5E73\u4ED3\u3002";
export declare function TradingEngineSettings({ value, models, onChange, openModels, available }: {
    available?: boolean;
    value: TradingEngineConfig;
    models: {
        provider_id: string;
        label: string;
    }[];
    onChange(value: TradingEngineConfig): void;
    openModels?: (() => void) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=TradingEngineSettings.d.ts.map