/** Input normalization shared by Team roster and task commands. */
/**
 * Normalize one required human-authored string.
 * @param value - raw input value.
 * @param field - diagnostic field name.
 * @param maxLength - maximum normalized character count.
 * @returns trimmed non-empty text.
 */
export declare function requiredText(value: string, field: string, maxLength: number): string;
/**
 * Normalize one workspace-relative path prefix without treating it as a lock.
 * @param value - user-authored path prefix.
 * @returns normalized slash-separated prefix.
 */
export declare function writeScope(value: string): string;
//# sourceMappingURL=validation.d.ts.map