/** Target-indexed business grouping registrations with the existing effect lifecycle. */
import type { Context } from '@deepseek-ai/cordis';
import type { ConversationViewNode } from '../contract/conversation.ts';
import type { ConversationGroupData, ConversationGroupDefinition } from '../contract/groups.ts';
import { ConversationDefinitionRegistry } from './definition-registry.ts';
import type { ConversationViewRegistry } from './view-registry.ts';
/** One Group Definition per target; registration never instantiates its Builder. */
export declare class ConversationGroupRegistry extends ConversationDefinitionRegistry<ConversationGroupDefinition> {
    private readonly views;
    /**
     * @param ctx - owning plugin context.
     * @param views - registered target Builder definitions.
     */
    constructor(ctx: Context, views: ConversationViewRegistry);
    /**
     * Register grouping rules for an existing target.
     * @param definition - business State and grouping output for the declared target data.
     * @returns the effect-owned, idempotent registration disposer.
     */
    register<Node extends ConversationViewNode, State, Target extends string>(definition: ConversationGroupDefinition<Node, State, ConversationGroupData<Target>> & {
        readonly target: Target;
    }): () => void;
    /**
     * Find the grouping rules registered for one target.
     * @param target - View target.
     * @returns its grouping Definition, when registered.
     */
    forTarget(target: string): ConversationGroupDefinition | undefined;
}
//# sourceMappingURL=group-registry.d.ts.map