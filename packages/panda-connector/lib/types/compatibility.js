/** Audited PandaData SDK releases accepted by the QuantSkills plugin. */
const REQUIRED_CALLABLES = Object.freeze([
    'get_index_indicator',
    'get_index_weights',
    'get_margin',
    'get_market_data',
    'init_token',
    'is_authenticated',
]);
const MARKET_DATA_VALIDATION = Object.freeze({
    callable: 'get_market_data',
    keywordArguments: Object.freeze({
        symbol: '000001.SZ',
        start_date: '20250102',
        end_date: '20250102',
        type: 'stock',
    }),
});
/** Fixed compatibility matrix; PyPI discovery can only select one of these exact wheels. */
export const PANDA_SDK_COMPATIBILITY = Object.freeze([
    Object.freeze({
        version: '0.0.12',
        wheelURL: 'https://files.pythonhosted.org/packages/91/b9/1660487a9f559925231091f4c88aac6d572e7c3e84b0ad9a372d8261f298/panda_data-0.0.12-py3-none-any.whl',
        wheelSha256: 'b657a17daed0a11794e85e37e0d917ce42c77516fea7af0fc8977d54674b75b8',
        pythonMin: [3, 10],
        pythonMaxExclusive: [3, 13],
        requiredCallables: REQUIRED_CALLABLES,
        validationCall: MARKET_DATA_VALIDATION,
    }),
    Object.freeze({
        version: '0.0.14',
        wheelURL: 'https://files.pythonhosted.org/packages/9e/c3/f074910e8e7809a2abc6d60124a4a4e4dd196e0bd2159416a41e30fd0c60/panda_data-0.0.14-py3-none-any.whl',
        wheelSha256: '514a50da95992aeb52ba53332ba825dd0dfd66c0793f59b6025f4e97ba6c2b59',
        pythonMin: [3, 10],
        pythonMaxExclusive: [3, 13],
        requiredCallables: REQUIRED_CALLABLES,
        validationCall: MARKET_DATA_VALIDATION,
    }),
]);
/**
 * Resolve one exact supported SDK release.
 * @param version - release selected from the compatibility matrix.
 * @returns the immutable compatibility entry, or `undefined` when unsupported.
 */
export function pandaSdkCompatibility(version) {
    return PANDA_SDK_COMPATIBILITY.find(entry => entry.version === version);
}
//# sourceMappingURL=compatibility.js.map