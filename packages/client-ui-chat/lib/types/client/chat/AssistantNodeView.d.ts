import type { InjectFace, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChatNodeViewProps, PresentationInjected } from '../contract/slots.ts';
type AssistantNodeViewProps = ChatNodeViewProps<'assistant-step'> & InjectFace<PresentationInjected> & PropsRenderSlots<'conversation.chat.reasoning.body' | 'conversation.chat.message.images' | 'conversation.chat.deliverables'>;
/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export declare const AssistantNodeView: import("react").NamedExoticComponent<AssistantNodeViewProps>;
export {};
//# sourceMappingURL=AssistantNodeView.d.ts.map