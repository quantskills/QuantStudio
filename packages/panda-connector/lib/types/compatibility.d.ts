/** Audited PandaData SDK releases accepted by the QuantSkills plugin. */
/** One exact wheel and public API requirement admitted for managed installation. */
export interface PandaSdkCompatibility {
    readonly version: string;
    readonly wheelURL: string;
    readonly wheelSha256: string;
    readonly pythonMin: readonly [major: number, minor: number];
    readonly pythonMaxExclusive: readonly [major: number, minor: number];
    readonly requiredCallables: readonly string[];
    /** One bounded read-only request that proves the authenticated data path works. */
    readonly validationCall: PandaSdkValidationCall;
}
/** Matrix-owned read-only SDK request used only after an explicit first login. */
export interface PandaSdkValidationCall {
    readonly callable: 'get_market_data';
    readonly keywordArguments: Readonly<{
        symbol: string;
        start_date: string;
        end_date: string;
        type: 'stock';
    }>;
}
/** Fixed compatibility matrix; PyPI discovery can only select one of these exact wheels. */
export declare const PANDA_SDK_COMPATIBILITY: readonly PandaSdkCompatibility[];
/**
 * Resolve one exact supported SDK release.
 * @param version - release selected from the compatibility matrix.
 * @returns the immutable compatibility entry, or `undefined` when unsupported.
 */
export declare function pandaSdkCompatibility(version: string): PandaSdkCompatibility | undefined;
//# sourceMappingURL=compatibility.d.ts.map