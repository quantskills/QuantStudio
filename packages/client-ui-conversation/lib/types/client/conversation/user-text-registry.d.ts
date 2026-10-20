/** Effect-owned user-text rules and their revision; document caches belong only to evaluator callers. */
import type { UserTextEvaluator, UserTextRule } from '../contract/user-text.ts';
import { ConversationDefinitionRegistry } from './definition-registry.ts';
/** Observable rule revision with no retained documents or document subscriptions. */
export declare class UserTextRegistry extends ConversationDefinitionRegistry<UserTextRule> {
    private rules;
    private revision;
    /**
     * Register a uniquely named rule; invalid IDs, duplicate IDs and non-finite order throw before publication.
     * @param rule - readonly synchronous candidate matcher with a nonempty ID other than the reserved `text` ID.
     * @returns idempotent disposer; removal synchronously publishes a new revision.
     */
    register(rule: UserTextRule): () => void;
    /**
     * Create an independent document evaluator; it reads current rules at each call and never subscribes.
     * @returns callback owning its document cache, released when the caller releases the callback.
     */
    createEvaluator(): UserTextEvaluator;
    /**
     * Read the observable rule revision.
     * @returns monotonic revision, stable until a successful registration or disposal.
     */
    getSnapshot(): number;
    protected refresh(): void;
}
//# sourceMappingURL=user-text-registry.d.ts.map