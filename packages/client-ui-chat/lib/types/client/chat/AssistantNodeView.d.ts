/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export declare const AssistantNodeView: import("react").NamedExoticComponent<import("../index.ts").ChatNodeOwnerProps & {
    node: import("../index.ts").ChatConversationViewNode & {
        readonly kind: "assistant-step";
        readonly data: import("../index.ts").AssistantChatData;
    };
} & Omit<import("../index.ts").ChatNodeTurnDataInjected, "hooks"> & import("@deepseek-ai/dsh-client-ui-slots").PropsSlotHooks<{
    turnData: import("@deepseek-ai/dsh-client-ui-slots").SlotHookFactory<"conversation.chat.node", import("../index.ts").UseChatNodeTurnData>;
}> & import("@deepseek-ai/dsh-client-ui-slots").SessionStandardProps & import("@deepseek-ai/dsh-client-ui-slots").GlobalStandardProps & {
    t: import("@deepseek-ai/dsh-client-ui-slots").TranslateNS<"chat">;
} & {
    renderSlot: object & (<K extends "conversation.chat.deliverables", EntryKey extends import("@deepseek-ai/dsh-client-ui-slots").EntryKeyOf<K> = import("@deepseek-ai/dsh-client-ui-slots").EntryKeyOf<K>>(key: K, owner: import("@deepseek-ai/dsh-client-ui-slots").OwnerOf<K> & import("@deepseek-ai/dsh-client-ui-slots").KeyPropsOf<K, NoInfer<EntryKey>>, opts?: Omit<import("@deepseek-ai/dsh-client-ui-slots").RenderOpts<EntryKey>, "hookContext"> | undefined) => import("react").ReactNode);
    readonly __renders?: ((key: "conversation.chat.deliverables") => void) | undefined;
} & object & {
    SessionProvider: import("@deepseek-ai/dsh-client-ui-slots").SessionProviderComponent;
}>;
//# sourceMappingURL=AssistantNodeView.d.ts.map