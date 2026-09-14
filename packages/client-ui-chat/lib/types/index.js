/** Host registration for browser Chat preferences. */
import { CHAT_SETTINGS_NAMESPACE, ChatSettingsSchema } from "./chat-settings.js";
export { CHAT_SETTINGS_NAMESPACE, DEFAULT_TRANSCRIPT_VIEW_MODE, TRANSCRIPT_VIEW_FIELD, TRANSCRIPT_VIEW_MODES, } from "./chat-settings.js";
/** Register the durable Chat settings section when a provider exists. */
export function apply(ctx) {
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.register(CHAT_SETTINGS_NAMESPACE, ChatSettingsSchema);
    });
}
//# sourceMappingURL=index.js.map