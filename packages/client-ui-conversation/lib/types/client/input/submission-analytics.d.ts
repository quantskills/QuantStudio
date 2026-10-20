/** Maps ordinary message occurrences to Desktop product events. */
import type { Context } from '@deepseek-ai/cordis';
import type { MessageSubmission } from '../contract/composer-submission.ts';
/**
 * Report the original message occurrence without reading newer Session facts.
 * @param ctx - client context.
 * @param submission - original occurrence and Session snapshot.
 */
export declare function reportMessageSubmission(ctx: Context, submission: MessageSubmission): void;
//# sourceMappingURL=submission-analytics.d.ts.map