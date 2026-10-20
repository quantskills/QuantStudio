import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// An enclosing `[data-conversation-scroll]` owns scrolling when present;
// otherwise this view owns it. Each row subscribes to one stable node key.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconChevronDownOutlineRegular, MarkdownDelegateProvider, Modal, } from '@deepseek-ai/dsh-client-ui-primitives';
import { isAtOrOutside } from "../contract/group-tree.js";
import { TurnNavigator } from "./TurnNavigator.js";
import { mergeTurnRailItems } from "./turn-rail-items.js";
import { useChatScroll } from "./use-chat-scroll.js";
import { fileMediaUrl, resolveWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path';
import css from './ChatView.module.css';
/** Host/OS refusal text for the file-open dialog; empty throws keep a locale fallback. */
function openFailureMessage(error, fallback) {
    const message = error instanceof Error ? error.message : String(error);
    return message === '' ? fallback : message;
}
/**
 * Durable input identities suppress matching echoes in the same render.
 * The last input's Turn also distinguishes an empty opening control from
 * one whose human input or trigger notice is already present.
 */
function observedInputs(order, nodes) {
    const observed = new Set();
    let lastInputTurn;
    for (const key of order) {
        const node = nodes.get(key);
        if (node === undefined || !isAtOrOutside(node, 'input'))
            continue;
        if (node.location.kind === 'turn' || node.location.kind === 'step')
            lastInputTurn = node.location.turn.turn;
        const data = node.data;
        const source = typeof data === 'object' && data !== null && 'source' in data ? data.source : undefined;
        if (typeof source === 'object' && source !== null && 'kind' in source && source.kind === 'user'
            && 'rpcId' in source && typeof source.rpcId === 'string')
            observed.add(source.rpcId);
    }
    return { rpcIds: observed, lastInputTurn };
}
/** How long fold transitions stay enabled after a Turn stops running. */
const MOTION_TAIL_MS = 800;
/**
 * The chat view slot entry: pure component over the composed props; each
 * ordered business Node crosses the keyed renderer seat.
 */
export function ChatView({ useSession, useChat, useConversation, useSessions, renderSlot, sessionId, openFile, openExternalLink, loadOlder, loadThrough, loadImage, inspectCall, chatScroll, forkAt, fileMentions, usePresentation, useProjection, t, }) {
    const order = useChat(s => s.order);
    const groupedEntries = useConversation(snapshot => snapshot.views.grouped('chat')?.entries);
    const entries = useMemo(() => groupedEntries
        ?? order.map(key => ({ kind: 'node', key: key })), [groupedEntries, order]);
    const nodeStore = useChat(s => s.nodes);
    const deferCompletedTurns = usePresentation(policy => policy.collapseTiming === 'next-input');
    const transcriptView = usePresentation(policy => policy.mode);
    // The rail's items are accumulated in the Chat snapshot, so this selector is
    // both the data and its change signal: the array identity moves only when a
    // Turn enters, leaves, or changes its preview.
    const turnNavigationItems = useChat(s => s.navigation.items());
    // Host-computed whole-log outline; the merge is view-layer only (the
    // conversation snapshot never carries projection values).
    const turnOutline = useProjection('turnOutline');
    const railItems = useMemo(() => mergeTurnRailItems(turnNavigationItems, turnOutline), [turnNavigationItems, turnOutline]);
    const inbox = useProjection('inbox');
    // Workspace root off the session list row: path summaries display relative to it.
    const cwd = useSessions(s => s.byId[sessionId]?.cwd);
    const fileImages = useMemo(() => ({
        resolve: (path) => fileMediaUrl(document.baseURI, resolveWorkspacePath(cwd, path)),
        labels: {
            open: t('image.open'), loading: t('image.loading'), failed: t('image.failed'),
            dialog: t('image.dialog'), close: t('image.close'),
        },
    }), [cwd, t]);
    const running = useSession(s => s.running);
    // Fold transitions run while a Turn is live, while an input is pending, and briefly after settling.
    const [motionTail, setMotionTail] = useState(false);
    useEffect(() => {
        if (!deferCompletedTurns) {
            setMotionTail(false);
            return;
        }
        if (running) {
            setMotionTail(true);
            return;
        }
        const timer = setTimeout(() => { setMotionTail(false); }, MOTION_TAIL_MS);
        return () => { clearTimeout(timer); };
    }, [running, deferCompletedTurns]);
    const openState = useSession(s => s.openState);
    const openError = useSession(s => s.openError);
    const hasMore = useSession(s => s.hasMore);
    const loadingOlder = useSession(s => s.loadingOlder);
    const [fileOpenError, setFileOpenError] = useState(null);
    const [fileOpenBusy, setFileOpenBusy] = useState(false);
    // Close/retry must ignore a settlement that started before the latest
    // gesture; otherwise a cancelled in-flight refusal reopens the dialog.
    const fileOpenRequest = useRef(0);
    const requestOpenFile = useCallback((path, options) => {
        const id = ++fileOpenRequest.current;
        setFileOpenBusy(true);
        void (options === undefined ? openFile(path) : openFile(path, options)).then(() => {
            if (id !== fileOpenRequest.current)
                return;
            setFileOpenError(null);
            setFileOpenBusy(false);
        }, (error) => {
            if (id !== fileOpenRequest.current)
                return;
            setFileOpenError({
                path,
                message: openFailureMessage(error, t('fileOpen.unknown')),
            });
            setFileOpenBusy(false);
        });
    }, [openFile, t]);
    const closeFileOpenError = useCallback(() => {
        fileOpenRequest.current += 1;
        setFileOpenError(null);
        setFileOpenBusy(false);
    }, []);
    const inboxSteering = useMemo(() => inbox?.['next-step'].filter(message => message.source.kind === 'user') ?? [], [inbox]);
    const pendingSubmissions = useSession(s => s.pendingSubmissions);
    // Submission echoes still awaiting their durable counterpart. `order` is the
    // recompute trigger: durable user material always arrives as an append, and
    // every append replaces the order array.
    const [visibleSubmissions, lastInputTurn] = useMemo(() => {
        if (pendingSubmissions.length === 0)
            return [pendingSubmissions, undefined];
        const observed = observedInputs(order, nodeStore);
        return [pendingSubmissions.filter(submission => (submission.placement !== 'queued' && !observed.rpcIds.has(submission.requestId))), observed.lastInputTurn];
    }, [pendingSubmissions, order, nodeStore]);
    const pendingInputs = useMemo(() => {
        const local = new Map(visibleSubmissions.map(submission => [submission.requestId, submission]));
        // Admitted local identities outlive their bubbles until the Inbox claim watermark.
        const localIds = new Set(pendingSubmissions.filter(submission => submission.placement !== 'queued')
            .map(submission => submission.requestId));
        const pending = inboxSteering.flatMap((item) => {
            const source = item.source;
            if (source.kind !== 'user' || !('rpcId' in source))
                return [item];
            const submission = local.get(source.rpcId);
            if (submission === undefined)
                return localIds.has(source.rpcId) ? [] : [item];
            local.delete(source.rpcId);
            return [submission];
        });
        return [...pending, ...local.values()];
    }, [inboxSteering, pendingSubmissions, visibleSubmissions]);
    const deferCollapse = deferCompletedTurns
        && !pendingInputs.some(item => 'requestId' in item && item.placement === 'transcript');
    const firstKey = order[0];
    const firstSeq = firstKey === undefined ? null : nodeStore.get(firstKey)?.anchorSeq ?? null;
    const lastKey = order.at(-1) ?? null;
    const latestSteering = pendingInputs.findLast(item => 'source' in item);
    const steeringId = latestSteering?.source.kind === 'user' && 'rpcId' in latestSteering.source
        ? latestSteering.source.rpcId : latestSteering?.id ?? null;
    const scroll = useChatScroll({
        ready: openState === 'open',
        order, firstSeq, lastKey, running, loadingOlder, hasMore, chatScroll, loadOlder, loadThrough, deferCompletedTurns,
        lastIsUser: lastKey !== null && nodeStore.get(lastKey)?.kind === 'user',
        steeringId,
        submissionId: visibleSubmissions.at(-1)?.requestId ?? null,
        loadedTurns: turnNavigationItems,
        transcriptView,
    });
    const flowContext = useMemo(() => ({ motion: scroll.motion }), [scroll.motion]);
    return (_jsxs("div", { className: css.frame, children: [scroll.initialized && (_jsx(TurnNavigator, { items: railItems, activeTurn: scroll.activeTurn, busyTurn: scroll.busyTurn, onNavigate: scroll.navigateToTurn, t: t })), _jsx("div", { className: css.root, "data-chat-following-tail": scroll.followingTail ? '' : undefined, children: _jsxs("div", { ref: scroll.listRef, className: css.scroll, children: [_jsxs("div", { ref: scroll.columnRef, className: css.column, "data-chat-flow": "", "data-chat-motion": deferCompletedTurns && scroll.initialized
                                && (running || motionTail || pendingInputs.length > 0) ? '' : undefined, children: [openState === 'loading' && _jsx("div", { className: css.hint, children: t('chat.loadingHistory') }), openState === 'error' && openError !== null && (_jsx("div", { className: css.openError, children: t('chat.loadError', { message: openError.message, code: openError.code }) })), hasMore && (_jsx("div", { className: css.older, children: _jsx("button", { type: "button", disabled: loadingOlder, onClick: scroll.loadEarlier, children: loadingOlder ? t('loading') : t('chat.loadOlder') }) })), _jsx(MarkdownDelegateProvider, { openFile: requestOpenFile, openExternalLink: openExternalLink, fileImages: fileImages, children: renderSlot('conversation.chat.flow', {
                                        entries, pendingInputs, lastInputTurn, deferCollapse,
                                        cwd, openFile: requestOpenFile, inspectCall, forkAt, loadImage, fileMentions,
                                    }, { hookContext: flowContext }) })] }), _jsx("div", { className: css.turnSpacer, "data-chat-turn-spacer": true, "aria-hidden": "true" })] }) }), !scroll.followingTail && (_jsx("div", { className: css.toBottomSlot, children: _jsx("button", { type: "button", className: css.toBottom, "aria-label": t('chat.toBottom'), onClick: scroll.returnToBottom, children: _jsx(IconChevronDownOutlineRegular, {}) }) })), fileOpenError !== null && (_jsx(FileOpenErrorDialog, { message: fileOpenError.message, busy: fileOpenBusy, onClose: closeFileOpenError, onRetry: () => { requestOpenFile(fileOpenError.path); }, t: t }))] }));
}
/** In-page Host open-path refusal: the wire reason plus a retry of the same path. */
function FileOpenErrorDialog({ message, busy, onClose, onRetry, t, }) {
    return (_jsx(Modal, { open: true, onClose: onClose, closeLabel: t('close'), title: t('fileOpen.title'), description: message, footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", className: css.modalAction, onClick: onClose, children: t('cancel') }), _jsx(Button, { variant: "primary", className: css.modalAction, disabled: busy, onClick: onRetry, children: t('retry') })] })) }));
}
//# sourceMappingURL=ChatView.js.map