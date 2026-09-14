/** Typed Agent Teams failures. */
import { HarnessError } from '@deepseek-ai/dsh-llm';
/** Stable failure raised by the Team domain. */
export declare class TeamError extends HarnessError {
    constructor(message: string, code: string, options?: ErrorOptions);
}
/**
 * Render an arbitrary thrown value without replacing the original rejection.
 * @param error - caught value used in a diagnostic or durable failure record.
 * @returns one bounded single-line description.
 */
export declare function errorMessage(error: unknown): string;
//# sourceMappingURL=error.d.ts.map