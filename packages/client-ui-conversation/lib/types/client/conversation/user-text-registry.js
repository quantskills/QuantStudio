import { ConversationDefinitionRegistry } from "./definition-registry.js";
import { UserTextDocument } from "./user-text-document.js";
/** Observable rule revision with no retained documents or document subscriptions. */
export class UserTextRegistry extends ConversationDefinitionRegistry {
    rules = [];
    revision = 0;
    /**
     * Register a uniquely named rule; invalid IDs, duplicate IDs and non-finite order throw before publication.
     * @param rule - readonly synchronous candidate matcher with a nonempty ID other than the reserved `text` ID.
     * @returns idempotent disposer; removal synchronously publishes a new revision.
     */
    register(rule) {
        if (rule.id.length === 0)
            throw new Error('user-text rule ID must not be empty');
        if (rule.id === 'text')
            throw new Error('user-text rule "text" is reserved for original text');
        if (!Number.isFinite(rule.order))
            throw new Error(`user-text rule "${rule.id}" order must be finite`);
        return this.registerDefinition(rule.id, rule, `user-text rule "${rule.id}" is already registered`, `uiConversation.userText.register(${JSON.stringify(rule.id)})`);
    }
    /**
     * Create an independent document evaluator; it reads current rules at each call and never subscribes.
     * @returns callback owning its document cache, released when the caller releases the callback.
     */
    createEvaluator() {
        const document = new UserTextDocument();
        return input => document.evaluate(input, this.rules);
    }
    /**
     * Read the observable rule revision.
     * @returns monotonic revision, stable until a successful registration or disposal.
     */
    getSnapshot() {
        return this.revision;
    }
    refresh() {
        this.rules = [...this.definitions.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        this.revision++;
        super.refresh();
    }
}
//# sourceMappingURL=user-text-registry.js.map