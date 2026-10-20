/** Composes viewport operations, reading policy, and history navigation for Chat. */
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useChatNavigation } from "./use-chat-navigation.js";
import { useChatReading } from "./use-chat-reading.js";
import { useChatViewport } from "./use-chat-viewport.js";
/**
 * Coordinate scroll policy after Chat content commits. Initial history must be ready
 * before automatic scroll or resize handling can initialize reading state and fold motion.
 * New submitted input supersedes pending reader sampling.
 * @param input - current Chat content, scroll memory, and history operations.
 * @returns element refs, visible reading state, and navigation callbacks.
 */
export function useChatScroll(input) {
    const { ready, order, firstSeq, lastKey, lastIsUser, steeringId, submissionId, running, deferCompletedTurns, loadedTurns, chatScroll, hasMore, loadingOlder, loadOlder, loadThrough, transcriptView, } = input;
    const { viewport, listRef, columnRef } = useChatViewport();
    const { reading, state } = useChatReading(viewport, chatScroll, loadedTurns.at(-1)?.turn ?? null);
    const navigationInput = useMemo(() => ({
        firstSeq, loadingOlder, hasMore, loadOlder, loadThrough,
    }), [firstSeq, loadingOlder, hasMore, loadOlder, loadThrough]);
    const { navigation, busyTurn } = useChatNavigation(viewport, reading, navigationInput);
    const content = useRef({
        input, applied: null, opened: false,
    });
    // A fold batch owns layout and scrolling until it lands: at the tail for own input or a following
    // reader, otherwise with the reader's content still. Growth consumes any room the landing installed.
    const cancelPendingFollow = useCallback(() => { viewport.motion.cancelInput(); }, [viewport]);
    const processContent = useCallback(() => {
        const current = content.current.input;
        if (!current.ready && !content.current.opened)
            return;
        const previous = content.current.applied;
        const ownInput = (current.lastIsUser && current.lastKey !== previous?.lastKey)
            || (current.steeringId !== null && current.steeringId !== previous?.steeringId
                && current.steeringId !== previous?.submissionId)
            || (current.submissionId !== null && current.submissionId !== previous?.submissionId
                && current.submissionId !== previous?.steeringId);
        if (reading.pending && !ownInput)
            return;
        content.current.applied = current;
        if (current.ready && !content.current.opened) {
            content.current.opened = true;
            navigation.reset();
            reading.restore();
            return;
        }
        if (ownInput) {
            navigation.cancel();
            if (current.deferCompletedTurns && reading.followInputFold())
                return;
            reading.followTail(current.deferCompletedTurns ? 'smooth' : 'instant');
            return;
        }
        if (navigation.contentCommitted()) {
            navigation.reconcile();
            return;
        }
        const tipChanged = previous === null || current.ready !== previous.ready
            || current.firstSeq !== previous.firstSeq || current.lastKey !== previous.lastKey
            || current.order.length !== previous.order.length || current.running !== previous.running
            || current.steeringId !== previous.steeringId || current.submissionId !== previous.submissionId;
        if (tipChanged && reading.followingTail) {
            navigation.cancel();
            if (current.deferCompletedTurns && reading.followInputFold())
                return;
            reading.followTail();
        }
        else
            navigation.reconcile();
    }, [reading, navigation]);
    useLayoutEffect(() => {
        const disconnectViewport = viewport.connect({
            scroll: (event) => {
                if (!content.current.opened)
                    return;
                if (!event.movedByReader && viewport.motion.foldActive())
                    return;
                reading.onScroll(event);
            },
            scrollEnd: (outer) => {
                reading.onScrollEnd(outer);
                navigation.readerSettled();
            },
            interact: () => { navigation.cancel(); },
            intent: () => { cancelPendingFollow(); reading.interruptFollow(); },
            resize: () => {
                if (!content.current.opened)
                    return;
                if (navigation.contentCommitted()) {
                    navigation.reconcile();
                    return;
                }
                if (!content.current.input.deferCompletedTurns || !viewport.motion.foldActive())
                    reading.onResize();
                navigation.reconcile();
            },
        });
        const disconnectReading = reading.connect((sample) => {
            navigation.readerSampled(sample);
            processContent();
        });
        return () => {
            disconnectViewport();
            disconnectReading();
            content.current.opened = false;
            content.current.applied = null;
        };
    }, [viewport, reading, navigation, processContent, cancelPendingFollow]);
    useLayoutEffect(() => {
        const previous = content.current.input;
        content.current.input = {
            ready, order, lastKey, lastIsUser, steeringId, submissionId, running, loadedTurns, chatScroll,
            deferCompletedTurns, transcriptView, ...navigationInput,
        };
        if (!deferCompletedTurns) {
            cancelPendingFollow();
            reading.interruptFollow();
        }
        viewport.updateTurns(loadedTurns);
        const layoutChanged = previous.order !== order || previous.ready !== ready;
        if (layoutChanged)
            viewport.invalidate();
        viewport.reclaimBelow();
        processContent();
        if (layoutChanged && content.current.opened)
            reading.refreshActiveTurn();
    }, [
        viewport, reading, processContent, navigationInput, ready, order, lastKey, lastIsUser,
        steeringId, submissionId, running, loadedTurns, chatScroll, deferCompletedTurns, transcriptView, cancelPendingFollow,
    ]);
    const previousView = useRef(transcriptView);
    useLayoutEffect(() => {
        if (previousView.current === transcriptView)
            return;
        previousView.current = transcriptView;
        cancelPendingFollow();
        reading.interruptFollow();
        return viewport.motion.onFoldIdle(() => {
            viewport.resetBelow();
            if (content.current.opened)
                reading.onResize();
        });
    }, [transcriptView, viewport, reading, cancelPendingFollow]);
    const returnToBottom = useCallback(() => {
        cancelPendingFollow();
        navigation.cancel();
        reading.followTail();
    }, [navigation, reading, cancelPendingFollow]);
    return {
        listRef, columnRef, ...state, busyTurn, motion: viewport.motion,
        navigateToTurn: navigation.navigateToTurn,
        loadEarlier: navigation.loadEarlier,
        returnToBottom,
    };
}
//# sourceMappingURL=use-chat-scroll.js.map