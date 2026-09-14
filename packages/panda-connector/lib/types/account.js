/** PandaData account validation and normalization. */
const VISUAL_PHONE_SEPARATOR = /[\s()-]/g;
const COUNTRY_CALLING_CODE = /^\+?[1-9]\d{0,2}$/;
const NATIONAL_NUMBER = /^\d{4,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Fixed account-validation error which never includes the rejected value. */
export class PandaAccountError extends Error {
    constructor() {
        super('The PandaData account is invalid.');
        this.name = 'PandaAccountError';
    }
}
function nonBlank(value) {
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 320)
        throw new PandaAccountError();
    return normalized;
}
function assertNever(_value) {
    throw new PandaAccountError();
}
/**
 * Normalize an explicit account form. Only `phone` receives the `+86` default;
 * email and username values are never prefixed or otherwise reinterpreted.
 * @param account - typed account form from the Remote request.
 * @returns the SDK login value and its original account kind.
 */
export function normalizePandaAccount(account) {
    switch (account.kind) {
        case 'phone': {
            const rawCode = (account.countryCallingCode ?? '+86').trim();
            const withoutInternationalPrefix = rawCode.startsWith('00') ? rawCode.slice(2) : rawCode;
            if (!COUNTRY_CALLING_CODE.test(withoutInternationalPrefix))
                throw new PandaAccountError();
            const code = `+${withoutInternationalPrefix.replace(/^\+/, '')}`;
            const nationalNumber = account.nationalNumber.replace(VISUAL_PHONE_SEPARATOR, '');
            if (!NATIONAL_NUMBER.test(nationalNumber) || code.length + nationalNumber.length > 16) {
                throw new PandaAccountError();
            }
            return { kind: 'phone', login: `${code}${nationalNumber}` };
        }
        case 'email': {
            const email = nonBlank(account.email);
            if (!EMAIL.test(email))
                throw new PandaAccountError();
            return { kind: 'email', login: email };
        }
        case 'username':
            return { kind: 'username', login: nonBlank(account.username) };
        default: return assertNever(account);
    }
}
//# sourceMappingURL=account.js.map