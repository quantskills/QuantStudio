import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots';
import type { UserTextNodeProps } from '../contract/slots.ts';
/**
 * Render original text through pure matching rules and business-owned node Slots.
 * A failed parse retains the entire original text and reports the rule error.
 * @param props - original text, confirmed facts, display policy, and framework seats.
 * @returns ordered inline nodes with raw-text fallbacks for missing registrations.
 */
export declare function UserText({ text, facts, interactive, ellipsis, useUserTextRevision, createUserTextEvaluator, reportTransformFailure, renderSlot, }: FactoryComponentPropsOf<'conversation.user.text'>): import("react").JSX.Element;
/**
 * Display an unmatched substring without business interpretation.
 * @param props - parser-produced plain-text node.
 * @returns its inline text.
 */
export declare function PlainUserText({ node }: UserTextNodeProps<'text'>): import("react").JSX.Element;
/**
 * Display a confirmed Session label without inventing navigation behavior.
 * @param props - Session reference JSON and its original spelling.
 * @returns the existing non-interactive Session chip.
 */
export declare function SessionReference({ node, raw }: UserTextNodeProps<'session'>): import("react").JSX.Element;
//# sourceMappingURL=UserText.d.ts.map