/** Host-owned failure carrying a stable non-secret error code. */
export class QuantSkillsHostError extends Error {
    /** Stable non-secret failure category. */
    code;
    /**
     * @param message - non-secret explanation suitable for a trusted Client.
     * @param code - stable failure category.
     * @param options - optional causal error retained only on the Host.
     */
    constructor(message, code, options) {
        super(message, options);
        this.name = 'QuantSkillsHostError';
        this.code = code;
    }
}
//# sourceMappingURL=error.js.map