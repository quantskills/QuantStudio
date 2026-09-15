/** Client-safe contest state. Credentials never cross the Host boundary. */
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
export interface ContestIdentity {
    readonly accountId: string;
    readonly contestId: string;
}
export interface ContestQuery {
    readonly kind: 'account' | 'positions' | 'open-orders' | 'orders' | 'trades' | 'ranking' | 'ranking-me' | 'settlements' | 'quote';
    readonly symbol?: string;
    readonly date?: string;
    readonly lastId?: string;
    readonly board?: 'live' | 'settled';
}
export interface ContestOrder {
    readonly symbol: string;
    readonly direction: 'buy' | 'sell';
    readonly offset: 'open' | 'close';
    readonly volume: number;
    readonly price?: number | undefined;
}
export interface ContestPrepareRequest {
    readonly sessionId: string;
    readonly operation: 'place_order' | 'cancel_order';
    readonly order?: ContestOrder;
    readonly orderId?: string;
}
export interface ContestPlan {
    readonly id: string;
    readonly sessionId: string;
    readonly identity: ContestIdentity;
    readonly operation: 'place_order' | 'cancel_order';
    readonly createdAt: number;
    readonly expiresAt: number;
    readonly summary: string;
    readonly details: Record<string, JsonValue>;
    readonly clientRequestId: string;
    status: 'prepared' | 'executing' | 'queued' | 'submitted' | 'completed' | 'partial' | 'failed' | 'expired' | 'unknown' | 'cancelled';
    operationId?: string | undefined;
    result?: Record<string, JsonValue> | undefined;
}
export interface ContestStatus {
    readonly enabled: boolean;
    readonly phase: 'off' | 'disconnected' | 'installing' | 'authenticating' | 'connected' | 'error';
    readonly cliVersion?: string;
    readonly latestVersion?: string;
    readonly updateAvailable: boolean;
    readonly identity?: ContestIdentity;
    readonly message: string;
    readonly plans: readonly ContestPlan[];
}
/** A fresh, read-only account view; never inferred from conversation history. */
export interface ContestInspection {
    readonly identity: ContestIdentity;
    readonly fetchedAt: number;
    readonly account: ContestData;
    readonly positions: ContestData;
    readonly openOrders: ContestData;
    readonly pendingPlans: readonly ContestPlan[];
    readonly summary: readonly string[];
}
export interface ContestData {
    readonly data: JsonValue;
    readonly meta?: Record<string, JsonValue>;
    readonly fetchedAt: number;
}
//# sourceMappingURL=contest-types.d.ts.map