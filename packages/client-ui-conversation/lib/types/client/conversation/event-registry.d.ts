import type { ConversationMatchHandler, ConversationNodeDefinition, ConversationNodeDefinitionInput } from '../contract/conversation.ts';
import { ConversationDefinitionRegistry } from './definition-registry.ts';
/** A registered Definition and its event-type-selected handler. */
export interface ConversationEventRoute {
    readonly definition: ConversationNodeDefinition;
    readonly match: ConversationMatchHandler;
}
/** Runtime registry of independently owned Conversation business Definitions. */
export declare class ConversationEventRegistry extends ConversationDefinitionRegistry<ConversationNodeDefinition> {
    private fallback;
    private routes;
    private unrestricted;
    private readonly tables;
    /**
     * Register a uniquely named business Definition for the caller's lifetime.
     * @param definition - Definition contribution.
     * @returns idempotent disposer.
     */
    register(definition: ConversationNodeDefinitionInput): () => void;
    /**
     * Register the sole fallback used only when no ordinary Definition matches.
     * @param input - fallback Definition.
     * @returns idempotent disposer.
     */
    registerFallback(input: ConversationNodeDefinitionInput): () => void;
    /**
     * Return the current unmatched-event fallback.
     * @returns installed fallback, when present.
     */
    fallbackEntry(): ConversationNodeDefinition | undefined;
    /**
     * Read precomputed candidates in registration order; the returned Set is borrowed read-only.
     * @param type - current event type.
     * @returns table handlers for this type together with all function-form handlers.
     */
    forEvent(type: string): ReadonlySet<ConversationEventRoute>;
    private resolve;
    protected refresh(): void;
}
//# sourceMappingURL=event-registry.d.ts.map