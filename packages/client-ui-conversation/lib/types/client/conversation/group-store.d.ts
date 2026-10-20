/** Keyed group publication and incremental validation of rendering positions. */
import { type ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { ConversationViewNode } from '../contract/conversation.ts';
import type { ConversationGroupedView, GroupKey, GroupSnapshot, GroupUpdate, NodeKey, RenderEntry } from '../contract/groups.ts';
/** Validates a complete batch before installing its group and root-list changes. */
export declare class ConversationGroupStore<Data> implements ConversationGroupedView<Data> {
    private root;
    private rootGroups;
    private readonly groups;
    private readonly placements;
    private readonly sources;
    private readonly dirty;
    /** @returns the identity-stable ordered root references. */
    get entries(): readonly RenderEntry[];
    groupSource(key: GroupKey): ObservableSnapshot<GroupSnapshot<Data> | undefined>;
    /**
     * Install one validated update without notifying readers.
     * @param update - root replacement and complete or incremental group records.
     * @param readNode - synchronous reader of the current target Nodes.
     */
    prepareAndInstall(update: GroupUpdate<Data>, readNode: (key: NodeKey) => ConversationViewNode | undefined): void;
    /** Publish changed group sources after all related target data has been installed. */
    publish(): void;
    /** Remove grouping without deleting its source Nodes; publication remains deferred. */
    clear(): void;
    private collectRootGroups;
    private collectChanges;
}
//# sourceMappingURL=group-store.d.ts.map