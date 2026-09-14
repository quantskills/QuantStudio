import type { ModelSelectInjected } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Props supplied by the stock model-selection service and composer seat. */
export type QuantSkillsGravityLaneModelSelectProps = PropsRuntime<'conversation.input.model'> & InjectFace<ModelSelectInjected> & PropsLocale<'model'>;
/**
 * Render the QuantSkills-branded composer model seat and Gravity Lane slider.
 *
 * @param props - Shared model directory, model-selection action, lock state, and locale.
 * @returns The model trigger and its model/effort popover.
 */
export declare function QuantSkillsGravityLaneModelSelect({ locked, available, directory, load, select, t, }: QuantSkillsGravityLaneModelSelectProps): JSX.Element | null;
//# sourceMappingURL=QuantSkillsGravityLaneModelSelect.d.ts.map