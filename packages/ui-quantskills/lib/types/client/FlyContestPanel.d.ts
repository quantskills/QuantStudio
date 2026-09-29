import type { ContestStatus } from './plugin-types.ts';
import type { FlyAccess } from './fly/transport.ts';
import { type HistoryMarket, type HistoryStatus } from './fly/FlyHistory.tsx';
type FlyState = {
    name: string;
    binding?: {
        identity?: {
            contestId: string;
            accountId: string;
        };
    } | null;
    settings: {
        instruments: {
            symbol: string;
        }[];
        life_validation: boolean;
        decision_engine?: 'neural' | 'llm';
    };
    control: {
        paused?: boolean;
        trading: boolean;
        close_only?: boolean;
    };
    connection?: {
        status: string;
        message: string;
    };
    history?: HistoryStatus;
    history_error?: string;
    markets?: (HistoryMarket & {
        readiness: string;
        long?: number;
        short?: number;
        quote_at?: number;
    })[];
    environment: {
        brain_ready: boolean;
        progress: {
            status: string;
            message?: string;
        };
    };
};
export declare function sameFlyContest(state: FlyState | undefined, contest: ContestStatus | undefined): boolean;
export declare function FlyContestPanel({ access, contest, openFly, variant, available }: {
    variant?: 'detail' | 'entry';
    available?: boolean;
    access?: FlyAccess | undefined;
    contest?: ContestStatus | undefined;
    openFly(): void;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=FlyContestPanel.d.ts.map