import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** Normalize the competition account, keeping unknown values distinct from zero. */
export declare function flyAccount(account: Record<string, JsonValue>, observedDay: string): {
    knownDay: boolean;
    official: {
        Balance: number | null;
        Available: number | null;
        Commission: number | null;
        Deposit: number | null;
        Withdraw: number | null;
        CloseProfit: number | null;
        PositionProfit: number | null;
        TradingDay: string;
        PnlSource: string;
    };
};
//# sourceMappingURL=fly-account.d.ts.map