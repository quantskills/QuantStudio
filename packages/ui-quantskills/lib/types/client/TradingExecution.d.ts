import type { TradingExecutionMode } from '@deepseek-ai/dsh-quantskills-session/src/trading-execution.ts';
export declare const AUTOMATIC_TRADING_CONSENT = "automatic-orders-v1";
export type { TradingExecutionMode };
export declare function ExecutionModeChoice({ value, onChange, disabled }: {
    value: TradingExecutionMode;
    onChange(value: TradingExecutionMode): void;
    disabled?: boolean;
}): import("react").JSX.Element;
export declare function ExecutionDisclosure({ mode, accepted, onChange }: {
    mode: TradingExecutionMode;
    accepted: boolean;
    onChange(value: boolean): void;
}): import("react").JSX.Element;
//# sourceMappingURL=TradingExecution.d.ts.map