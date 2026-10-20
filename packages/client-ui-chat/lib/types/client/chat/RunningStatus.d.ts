import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChatViewSlotProps } from '../contract/slots.ts';
interface RunningStatusProps extends Partial<PropsRenderSlots<'conversation.chat.turnStatus'>> {
    readonly startTime: number | undefined;
    readonly t: ChatViewSlotProps['t'];
}
/**
 * Show live elapsed time after the current Turn's content without announcing ticks.
 * @param props - Current Turn start time and localized copy.
 * @returns the blue running indicator; mount only while the Session is running.
 */
export declare const RunningStatus: import("react").NamedExoticComponent<RunningStatusProps>;
export {};
//# sourceMappingURL=RunningStatus.d.ts.map