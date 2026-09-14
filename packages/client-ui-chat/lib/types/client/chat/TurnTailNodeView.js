import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { MessageIconActions } from "./MessageIconActions.js";
import { TurnTimePanel, TurnUsagePanel } from "./TurnUsagePanel.js";
import { assistantText } from "./turn-assistant.js";
import css from './TurnTailNodeView.module.css';
/** Turn-local actions and feature tail over the Location index, independent of Assistant placement. */
export const TurnTailNodeView = memo(function TurnTailNodeView({ node, openFile, forkAt, renderSlot, renderSlotChain, t, useChat, useSession, }) {
    const data = node.data;
    const sessionId = useSession(snapshot => snapshot.sessionId);
    const hasLaterChatNode = useChat(snapshot => snapshot.locations.getTurn(data.turn).at(-1) !== node.key);
    const isLatestTurn = useChat(snapshot => snapshot.timeline.turnOrder.at(-1) === data.turn);
    const turn = node.location.kind === 'turn' || node.location.kind === 'step'
        ? node.location.turn
        : undefined;
    if (turn === undefined)
        return null;
    const closing = data.closing;
    const owner = { sessionId, turn, seq: closing?.finalNode.seq ?? data.seq, openFile };
    const tail = renderSlotChain('conversation.chat.turnTail', owner);
    if (closing === null)
        return tail === null ? null : _jsx("div", { className: css.root, children: tail });
    const runMs = turn.start === undefined || turn.end === undefined
        ? undefined
        : Math.max(0, turn.end.time - turn.start.time);
    // Interruption-frozen partials carry no messageId, so they address no
    // durable message and contribute no per-message actions.
    const messageId = closing.finalNode.messageId;
    const assistantActions = messageId === undefined
        ? null
        : renderSlot('conversation.chat.assistant-actions', { messageId });
    return (_jsxs("div", { className: css.root, "data-turn-tail": data.turn, "data-actions-reveal": isLatestTurn ? 'always' : 'hover', children: [tail, _jsx(MessageIconActions, { text: assistantText(closing.blocks), time: closing.time, clock: "end", onBranch: () => { forkAt(closing.finalNode.seq); }, branchUnavailable: data.branchUnavailable || hasLaterChatNode, className: css.actions, extraActions: assistantActions, usageAction: (_jsxs(_Fragment, { children: [data.tokenUsage !== undefined && _jsx(TurnUsagePanel, { usage: data.tokenUsage, t: t }), runMs !== undefined && (_jsx(TurnTimePanel, { runMs: runMs, tokensPerSecond: data.tokensPerSecond, ttftMs: data.ttftMs, t: t }))] })), t: t })] }));
});
//# sourceMappingURL=TurnTailNodeView.js.map