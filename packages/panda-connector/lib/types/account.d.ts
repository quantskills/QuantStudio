/** PandaData account validation and normalization. */
import type { PandaAccount } from './types.ts';
/** Normalized identity sent only inside the private worker's one-shot stdin request. */
export interface NormalizedPandaAccount {
    readonly kind: PandaAccount['kind'];
    readonly login: string;
}
/** Fixed account-validation error which never includes the rejected value. */
export declare class PandaAccountError extends Error {
    constructor();
}
/**
 * Normalize an explicit account form. Only `phone` receives the `+86` default;
 * email and username values are never prefixed or otherwise reinterpreted.
 * @param account - typed account form from the Remote request.
 * @returns the SDK login value and its original account kind.
 */
export declare function normalizePandaAccount(account: PandaAccount): NormalizedPandaAccount;
//# sourceMappingURL=account.d.ts.map