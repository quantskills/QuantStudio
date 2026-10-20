import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { JsonBlock } from '@deepseek-ai/dsh-client-ui-primitives';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { isAtOrOutside } from "../contract/group-tree.js";
import { turnProcessAlwaysOpen } from "../contract/turn-process.js";
import { turnProcessOpen } from "../stores.js";
import { hiddenOrCollapsing } from "./flow-motion.js";
import css from './ChatView.module.css';
function turnDataOf(node) {
    const location = node?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.data : undefined;
}
function turnOf(node) {
    const location = node?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.turn : undefined;
}
/**
 * Subscribe, apply Turn-process visibility, and dispatch one stable Context key.
 * Policy reads select this seat's own conclusion, so a mode change re-renders
 * only seats whose visibility actually changes.
 */
export const ChatNodeSeat = memo(function ChatNodeSeat({ nodeKey, groupPart, useChatNode, useChatNodeProcess, usePresentation, cwd, openFile, inspectCall, forkAt, loadImage, fileMentions, useStore, actions, renderSlot, t, useChatNodeBottom, deferCollapse, useGroupAction, }) {
    const bottom = useChatNodeBottom(nodeKey);
    const node = useChatNode(nodeKey);
    const routedNode = node;
    const turn = turnOf(routedNode);
    const processPresentation = useChatNodeProcess(nodeKey);
    const processSpec = processPresentation?.spec;
    const storedOpen = useStore(state => processSpec !== undefined
        && turnProcessOpen(state, processSpec, bottom === true && deferCollapse));
    const liveProcess = processPresentation !== undefined && !processPresentation.turnClosed;
    const interleavedInput = processPresentation?.hasInterleavedInput === true;
    const alwaysOpen = liveProcess || interleavedInput || turnProcessAlwaysOpen(routedNode);
    const processOpen = alwaysOpen || storedOpen;
    const setOpen = useCallback((open) => {
        if (processSpec !== undefined && !alwaysOpen) {
            actions.setTurnProcessOpen(processSpec.turn, processSpec.answerStep ?? 0, open);
        }
    }, [actions, processSpec, alwaysOpen]);
    const foldCompleted = usePresentation(policy => policy.foldCompletedTurns);
    // A loaded end makes a partial historical Turn eligible without its start.
    const processWindowReady = processSpec !== undefined
        && processPresentation !== undefined
        && foldCompleted
        && processPresentation.turn === processSpec.turn
        && (processPresentation.turnStarted || processPresentation.turnClosed);
    const processMember = routedNode !== undefined
        && processWindowReady
        && !isAtOrOutside(routedNode, 'turn')
        && routedNode.anchorSeq >= processSpec.processStartSeq
        && (liveProcess || processSpec.answerAnchorSeq === null || routedNode.anchorSeq < processSpec.answerAnchorSeq
            || (groupPart === 'reasoning' && routedNode.kind === 'assistant-step' && routedNode.data.step === processSpec.answerStep));
    const processAnswer = routedNode !== undefined
        && processWindowReady
        && !liveProcess
        && groupPart !== 'reasoning'
        && routedNode.kind === 'assistant-step'
        && routedNode.data.step === processSpec.answerStep;
    const ownsDisclosure = routedNode?.kind === 'turn-process' || processAnswer;
    const foldable = processWindowReady
        && (liveProcess || processMember || ownsDisclosure);
    const turnProcess = useMemo(() => processSpec === undefined
        ? undefined
        : {
            spec: processSpec,
            foldable,
            hasContent: !interleavedInput && (processPresentation?.hasExternalProcess === true || processSpec.inlineReasoning),
            open: processOpen,
            setOpen,
        }, [
        foldable, interleavedInput, processOpen, processSpec, processPresentation?.hasExternalProcess, setOpen,
    ]);
    const controllerInactive = routedNode?.kind === 'turn-process'
        && foldCompleted && !foldable;
    const compactAnswer = processAnswer
        && foldable
        && processPresentation.compactAnswer
        && !processOpen;
    const processHidden = controllerInactive || (foldable && processMember && !processOpen);
    const revealProcess = useCallback(() => {
        if (processMember)
            setOpen(true);
    }, [processMember, setOpen]);
    const wrapperRef = useGroupAction(processHidden, revealProcess);
    const [disclosureReset] = useState(() => createSnapshotStore(0));
    const turnData = turnDataOf(routedNode);
    const hookContext = useMemo(() => ({ turnData, disclosureReset, useGroupAction }), [turnData, disclosureReset, useGroupAction]);
    useEffect(() => {
        if (processMember && processHidden && wrapperRef.current !== null && hiddenOrCollapsing(wrapperRef.current)) {
            disclosureReset.set(disclosureReset.getSnapshot() + 1);
        }
    }, [processMember, processHidden, wrapperRef, disclosureReset]);
    const owner = useMemo(() => node === undefined
        ? null
        : {
            ...groupPart === undefined ? {} : { groupPart },
            cwd,
            openFile,
            inspectCall,
            forkAt,
            loadImage,
            fileMentions,
            turnProcess,
        }, [
        node, groupPart, cwd, openFile, inspectCall, forkAt,
        loadImage, fileMentions, turnProcess,
    ]);
    if (routedNode === undefined || owner === null)
        return null;
    // Runtime dispatch owns the correlation: every Node's discriminant is the
    // keyed-slot entry passed alongside that same Node. TypeScript does not
    // distribute an object containing a union into a union of objects itself.
    const routedOwner = { ...owner, node: routedNode };
    const flowKey = groupPart === undefined || groupPart === 'response' ? routedNode.key : JSON.stringify([routedNode.key, groupPart]);
    return (_jsx("div", { ref: wrapperRef, className: css.flowItem, "data-chat-anchor-key": flowKey, "data-chat-flow-key": flowKey, "data-chat-paging-anchor": routedNode.kind !== 'turn-process' || undefined, "data-chat-node-key": routedNode.key, "data-chat-group-part": groupPart, "data-chat-flow-kind": routedNode.kind, "data-chat-turn": turn, "data-turn-process-member": processMember || undefined, "data-turn-process-hidden": processHidden || undefined, "data-turn-process-answer": compactAnswer || undefined, children: renderSlot('conversation.chat.node', routedOwner, {
            entryKey: routedNode.kind,
            hookContext,
            fallback: (_jsx(JsonBlock, { label: t('message.unknownSurface', { type: routedNode.kind }), payload: routedNode.data, truncatedLabel: total => t('json.truncated', { total }) })),
        }) }));
});
//# sourceMappingURL=ChatNodeSeat.js.map