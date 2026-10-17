/** Keep the stock subagent catalog opening upward from the composer icon. */
interface SubagentPopupAddress {
    readonly parentSessionId: string;
    readonly childSessionId: string;
    readonly mode: string;
}
interface SubagentPopupSessions {
    readonly list: {
        getSnapshot(): {
            current: string | undefined;
            byId: Record<string, {
                displayTitle?: string;
                origin?: string;
                parentId?: string;
            } | undefined>;
        };
    };
    open(id: string): void;
    openSubagent(address: SubagentPopupAddress): void;
}
/** Install composer click and upward placement for the stock subagent catalog. */
export declare function bindComposerSubagentMenu(documentRoot: Document, sessions: SubagentPopupSessions): () => void;
export {};
//# sourceMappingURL=composer-subagents.d.ts.map