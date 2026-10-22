import { jsx as _jsx } from "react/jsx-runtime";
import { createElement as _createElement } from "react";
/** Ordered Chat rows, local echoes, and running status share the flow slot's parent. */
import { memo } from 'react';
import { assertNever } from '@deepseek-ai/dsh-util-values';
import { ChatNodeSeat } from "./ChatNodeSeat.js";
import { ChatGroupSeat } from "./ChatGroupSeat.js";
import { PendingSteeringBubble, PendingSubmissionBubble } from "./MessageItem.js";
import { chatRenderKey } from "./render-entry.js";
import { RunningStatus } from "./RunningStatus.js";
/** Render the flow without adding a DOM parent or changing keyed row positions. */
export const ChatFlow = memo(function ChatFlow({ entries, pendingInputs, lastInputTurn, deferCollapse, useSession, useChat, useChatNode, useChatNodeBottom, useChatNodeProcess, useChatGroup, usePresentation, useStore, actions, renderSlot, renderFactorySlot, t, useGroupAction, useGroupHeaderAction, cwd, openFile, inspectCall, forkAt, loadImage, fileMentions, }) {
    const nodeStore = useChat(snapshot => snapshot.nodes);
    const running = useSession(snapshot => snapshot.running);
    const latestTurnAnchor = useChat(snapshot => snapshot.navigation.items().at(-1)?.anchorKey);
    const runningStartTime = useChatNode(latestTurnAnchor ?? '', (node) => {
        const location = node?.location;
        return location?.kind === 'turn' || location?.kind === 'step'
            ? location.turn.status === 'open' ? location.turn.start?.time : undefined
            : undefined;
    });
    const seatProps = {
        nodeStore, useChatNode, useChatNodeBottom, useChatNodeProcess, usePresentation,
        useStore, actions, renderSlot, t, useGroupAction, deferCollapse,
        cwd, openFile, inspectCall, forkAt, loadImage, fileMentions,
    };
    const rows = entries.map((entry) => {
        switch (entry.kind) {
            case 'node':
                return _createElement(ChatNodeSeat, { ...seatProps, key: chatRenderKey(entry), nodeKey: entry.key, ...entry.groupPart === undefined ? {} : { groupPart: entry.groupPart } });
            case 'group':
                return _createElement(ChatGroupSeat, { ...seatProps, key: chatRenderKey(entry), groupKey: entry.key, useChatGroup: useChatGroup, useGroupHeaderAction: useGroupHeaderAction });
            default:
                return assertNever(entry);
        }
    });
    const pendingRows = pendingInputs.map(item => 'requestId' in item ? (_jsx(PendingSubmissionBubble, { submission: item, loadImage: loadImage, renderFactorySlot: renderFactorySlot, t: t }, item.requestId)) : (_jsx(PendingSteeringBubble, { content: item.content, loadImage: loadImage, renderFactorySlot: renderFactorySlot, t: t }, item.id)));
    const tail = entries.at(-1);
    const node = tail?.kind === 'node' ? nodeStore.get(tail.key) : undefined;
    // An empty opening control follows one local transcript echo, never steering.
    // All rows share this keyed list so inserting the control keeps the echo mounted.
    if (node?.kind === 'turn-process' && node.location.kind === 'turn'
        && node.location.turn.status === 'open' && node.location.turn.turn !== lastInputTurn) {
        const index = pendingInputs.findIndex(item => 'requestId' in item && item.placement === 'transcript');
        if (index !== -1)
            rows.splice(rows.length - 1, 0, ...pendingRows.splice(index, 1));
    }
    return [...rows, ...pendingRows, ...running ? [_jsx(RunningStatus, { renderSlot: renderSlot, startTime: runningStartTime, t: t }, "running")] : []];
});
//# sourceMappingURL=ChatFlow.js.map