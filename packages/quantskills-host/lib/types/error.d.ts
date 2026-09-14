import type { QuantSkillsHostErrorCode } from './types.ts';
/** Host-owned failure carrying a stable non-secret error code. */
export declare class QuantSkillsHostError extends Error {
    /** Stable non-secret failure category. */
    readonly code: QuantSkillsHostErrorCode;
    /**
     * @param message - non-secret explanation suitable for a trusted Client.
     * @param code - stable failure category.
     * @param options - optional causal error retained only on the Host.
     */
    constructor(message: string, code: QuantSkillsHostErrorCode, options?: ErrorOptions);
}
//# sourceMappingURL=error.d.ts.map