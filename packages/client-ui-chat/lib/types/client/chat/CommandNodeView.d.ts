import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChatNodeViewProps } from '../contract/slots.ts';
type CommandNodeViewProps = ChatNodeViewProps<'command'> & PropsRenderSlots<'conversation.chat.commandview'>;
/** Ordinary command lifecycle renderer with command-name keyed specialization. */
export declare const CommandNodeView: import("react").NamedExoticComponent<CommandNodeViewProps>;
/** One integrated `/compact` command and compaction transaction renderer. */
export declare const ManualCompactionNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"manual-compaction">>;
export {};
//# sourceMappingURL=CommandNodeView.d.ts.map