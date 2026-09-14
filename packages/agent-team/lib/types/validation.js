/** Input normalization shared by Team roster and task commands. */
import { TeamError } from "./error.js";
/**
 * Normalize one required human-authored string.
 * @param value - raw input value.
 * @param field - diagnostic field name.
 * @param maxLength - maximum normalized character count.
 * @returns trimmed non-empty text.
 */
export function requiredText(value, field, maxLength) {
    const text = value.trim();
    if (text.length === 0)
        throw new TeamError(`${field} must be non-empty`, 'TEAM_INVALID_ARGUMENT');
    if (text.length > maxLength) {
        throw new TeamError(`${field} exceeds ${maxLength} characters`, 'TEAM_INVALID_ARGUMENT');
    }
    return text;
}
/**
 * Normalize one workspace-relative path prefix without treating it as a lock.
 * @param value - user-authored path prefix.
 * @returns normalized slash-separated prefix.
 */
export function writeScope(value) {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '');
    const segments = normalized.split('/');
    if (normalized.length === 0 || normalized.startsWith('/') || /^[a-z]:/iu.test(normalized)
        || segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
        throw new TeamError(`invalid workspace-relative write scope ${JSON.stringify(value)}`, 'TEAM_INVALID_WRITE_SCOPE');
    }
    return normalized;
}
//# sourceMappingURL=validation.js.map