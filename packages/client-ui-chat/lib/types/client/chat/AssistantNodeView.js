import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback, useMemo } from 'react';
import { AssistantMarkdown } from "./AssistantMarkdown.js";
import { projectFinalDeliverables } from "./final-deliverables.js";
/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export const AssistantNodeView = memo(function AssistantNodeView({ node, useTurnData, useSession, turnProcess, openFile, renderMessageImages, fileMentions, renderSlot, t, }) {
    const data = node.data;
    const sessionId = useSession(snapshot => snapshot.sessionId);
    const turn = node.location.kind === 'turn' || node.location.kind === 'step'
        ? node.location.turn
        : undefined;
    const tail = useTurnData('turn-tail');
    const owner = useMemo(() => {
        if (turn?.status !== 'closed' || data.finalNode === undefined)
            return undefined;
        if (tail?.closing?.finalNode.seq !== data.finalNode.seq)
            return undefined;
        return { sessionId, turn, seq: data.finalNode.seq, openFile };
    }, [data.finalNode, openFile, sessionId, tail, turn]);
    const delivery = useMemo(() => projectFinalDeliverables(data.blocks, data.status === 'running', {
        allowUnmarked: owner !== undefined && data.status === 'settled',
    }), [data.blocks, data.status, owner]);
    const mentions = useMemo(() => owner === undefined ? undefined : fileMentions(owner), [data.blocks, openFile, fileMentions, owner]);
    // A running reasoning block is the provider-authored stream itself. Keep it
    // live in the transcript; only a completed, foldable process may hide it.
    const reasoningHidden = turnProcess !== undefined
        && turnProcess.foldable
        && turnProcess.spec.answerStep === data.step
        && turnProcess.spec.inlineReasoning
        && !turnProcess.open;
    const revealProcess = useCallback(() => { turnProcess?.setOpen(true); }, [turnProcess]);
    return (_jsxs(_Fragment, { children: [_jsx(AssistantMarkdown, { blocks: delivery.blocks, streaming: data.status === 'running', interrupted: data.status === 'interrupted', renderMessageImages: renderMessageImages, reasoningHidden: reasoningHidden, revealProcess: revealProcess, mentions: mentions, t: t }), owner !== undefined && delivery.items.length > 0 && renderSlot('conversation.chat.deliverables', {
                items: delivery.items, openFile,
            }, { fallback: _jsx("ul", { children: delivery.items.map(item => _jsx("li", { children: _jsx("button", { type: "button", onClick: () => openFile(item.path), children: item.title }) }, item.path)) }) })] }));
});
//# sourceMappingURL=AssistantNodeView.js.map