/** Original-text Session candidates with explicit wire spelling and longest known labels. */
import type { UserTextRule } from '@deepseek-ai/dsh-client-ui-conversation/client';
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
    interface UserTextDataMap {
        session: {
            readonly label: string;
        };
    }
    interface UserTextFacts {
        sessionLabels: readonly string[];
    }
}
/** Find the nearest Session reference; bare labels read their Facts only at a non-wire @ position. */
export declare const sessionReferenceRule: UserTextRule<'session'>;
//# sourceMappingURL=session-reference-rule.d.ts.map