import z from '@deepseek-ai/schemastery';
import { BUSY_ENTER_FIELD } from "./submission-settings.js";
import { ConversationSettingsFields } from "./submission-settings.js";
export { BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, CONVERSATION_SETTINGS_NAMESPACE, DEFAULT_BUSY_ENTER_BEHAVIOR, } from "./submission-settings.js";
/** Live preferences projected to the browser. */
export const Config = z.object({
    [BUSY_ENTER_FIELD]: ConversationSettingsFields[BUSY_ENTER_FIELD].volatile(),
});
/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx) {
    ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
}
//# sourceMappingURL=index.js.map