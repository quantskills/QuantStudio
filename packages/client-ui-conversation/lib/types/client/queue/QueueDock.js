import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useState } from 'react';
import { IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, FileTypeIcon, fileSizeText, IconEditOutlineRegular, InlineEditor, IconQueueOutlineRegular, IconSendOutlineRegular, IconTrashOutlineRegular, Tooltip, } from '@deepseek-ai/dsh-client-ui-primitives';
import { NS } from "../locales.js";
import css from './QueueDock.module.css';
const EMPTY_QUEUE = [];
const QUEUE_TEXT_FACTS = {
    collapseWhitespace: true,
    trimWhitespace: true,
};
function textOf(content) {
    if (!content.every(block => block.type === 'text'))
        return null;
    return content.map(block => block.text).join('');
}
/**
 * Durable references carried by one queued row. Inbox projections are wire data
 * despite their typed face, so an image block without a reference is skipped
 * rather than trusted.
 * @param content - the row's wire content blocks.
 * @returns the row's durable image references in block order.
 */
function queueAttachments(content) {
    const attachments = [];
    for (const block of content) {
        if (block.type === 'image') {
            const { attachment } = block;
            if (attachment !== undefined)
                attachments.push({ type: 'image', attachment });
        }
        if (block.type === 'file') {
            const { attachment } = block;
            if (attachment !== undefined)
                attachments.push({ type: 'file', attachment });
        }
    }
    return attachments;
}
/** Compact file identity used beside queue thumbnails. */
function QueueFile({ attachment, label }) {
    return (_jsxs("span", { className: css.file, "aria-label": label, title: attachment.name, children: [_jsx("span", { className: css.fileIcon, "aria-hidden": true, children: _jsx(FileTypeIcon, { path: attachment.name, size: 16 }) }), _jsx("span", { className: css.fileName, children: attachment.name }), _jsx("span", { className: css.fileSize, children: fileSizeText(attachment.bytes) })] }));
}
/** One durable queued image as a fixed-size thumbnail; a load failure keeps the empty placeholder. */
function QueueThumb({ attachment, loadImage, label }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        let alive = true;
        loadImage(attachment).then((resolved) => { if (alive)
            setUrl(resolved); }, () => { });
        return () => { alive = false; };
    }, [attachment, loadImage]);
    return url === null
        ? _jsx("span", { className: css.thumb, "aria-hidden": true })
        : _jsx("img", { className: css.thumb, src: url, alt: label });
}
/**
 * Queue strip: one item renders directly; multiple items default to a
 * collapsible count header; an empty queue renders nothing. Local queued submissions
 * show sending status and disabled actions until their Host queue rows arrive.
 */
export function QueueDock({ useSession, useProjection, updateQueue, notify, loadImage, renderFactorySlot, t }) {
    const inbox = useProjection('inbox');
    const pendingSubmissions = useSession(s => s.pendingSubmissions);
    const queue = useMemo(() => {
        const rows = inbox?.['next-turn'] ?? EMPTY_QUEUE;
        const inChat = new Set(pendingSubmissions.filter(item => item.placement === 'transcript').map(item => item.requestId));
        return inChat.size === 0 ? rows : rows.filter(({ source }) => (source.kind !== 'user' || !('rpcId' in source) || !inChat.has(source.rpcId)));
    }, [inbox, pendingSubmissions]);
    const pendingQueue = useMemo(() => {
        const admitted = new Set(queue.flatMap(({ source }) => (source.kind === 'user' && 'rpcId' in source ? [source.rpcId] : [])));
        return pendingSubmissions.filter(submission => (submission.placement === 'queued' && !admitted.has(submission.requestId)));
    }, [pendingSubmissions, queue]);
    const rowCount = queue.length + pendingQueue.length;
    const running = useSession(s => s.running);
    const queueMutable = useSession(s => s.subagent === null || s.subagent.address.mode === 'continuable');
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(null);
    const [collapsed, setCollapsed] = useState(true);
    const listId = useId();
    useEffect(() => {
        if (rowCount === 0 && !collapsed)
            setCollapsed(true);
        if (editing !== null && (!queueMutable || !queue.some(row => row.id === editing.id)))
            setEditing(null);
    }, [collapsed, editing, queue, queueMutable, rowCount]);
    if (rowCount === 0)
        return null;
    const interactionActive = queueMutable && (editing !== null || busy !== null);
    const expanded = !collapsed || interactionActive;
    const listVisible = rowCount === 1 || expanded;
    const applyAction = async (itemId, action, failure) => {
        setBusy(itemId);
        try {
            await updateQueue(itemId, action);
            return true;
        }
        catch {
            notify('error', failure);
            return false;
        }
        finally {
            setBusy(current => current === itemId ? null : current);
        }
    };
    const saveEdit = async () => {
        if (editing === null || editing.text.trim() === '')
            return;
        if (await applyAction(editing.id, { kind: 'edit', content: [{ type: 'text', text: editing.text }] }, t('queue.editFailed')))
            setEditing(null);
    };
    return (_jsx("div", { className: css.dock, "data-queue-dock": "", children: _jsxs("div", { className: css.panel, children: [rowCount > 1 && (_jsxs("button", { type: "button", className: css.header, "aria-controls": listId, "aria-expanded": expanded, disabled: interactionActive, onClick: () => { setCollapsed(value => !value); }, children: [_jsx("span", { className: css.lead, "aria-hidden": true, children: _jsx(IconQueueOutlineRegular, {}) }), _jsx("span", { className: css.count, children: t('queue.count', { n: rowCount }) }), !listVisible && pendingQueue.length > 0 && (_jsx("span", { className: css.status, role: "status", children: t('queue.sending') })), _jsx("span", { className: css.chevron, "aria-hidden": true, children: expanded ? _jsx(IconChevronDownOutlineRegular, {}) : _jsx(IconChevronUpOutlineRegular, {}) })] })), _jsxs("ul", { id: listId, className: css.list, hidden: !listVisible, children: [listVisible && queue.map((row) => {
                            const attachments = queueAttachments(row.content);
                            const text = textOf(row.content);
                            return (_jsxs("li", { className: css.row, children: [rowCount === 1 && _jsx("span", { className: css.lead, "aria-hidden": true, children: _jsx(IconQueueOutlineRegular, {}) }), editing?.id === row.id
                                        ? (_jsx(InlineEditor, { value: editing.text, label: t('queue.edit'), onChange: (text) => { setEditing({ id: row.id, text }); }, onSave: () => { void saveEdit(); }, onCancel: () => { setEditing(null); } }))
                                        : (_jsxs(_Fragment, { children: [attachments.length > 0 && (_jsx("span", { className: css.attachments, children: attachments.map((item, index) => item.type === 'image'
                                                        ? (_jsx(QueueThumb, { attachment: item.attachment, loadImage: loadImage, label: t('queue.image') }, `${item.attachment.attachmentId}:${index}`))
                                                        : (_jsx(QueueFile, { attachment: item.attachment, label: t('queue.file', { name: item.attachment.name }) }, `${item.attachment.attachmentId}:${item.attachment.name}:${index}`))) })), _jsx("span", { className: css.preview, children: renderFactorySlot('conversation.user.text', {
                                                        text: row.content.filter(block => block.type === 'text').map(block => block.text).join(''),
                                                        facts: QUEUE_TEXT_FACTS, interactive: false, ellipsis: true,
                                                    }) })] })), queueMutable && _jsx("div", { className: css.actions, children: editing?.id === row.id
                                            ? (_jsxs(_Fragment, { children: [_jsx(Tooltip, { portal: true, label: t('queue.save'), side: "bottom", delayMs: 500, children: _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.save'), disabled: busy !== null || editing.text.trim() === '', onClick: () => { void saveEdit(); }, children: _jsx(IconCheckOutlineRegular, { size: 14 }) }) }), _jsx(Tooltip, { portal: true, label: t('queue.cancelEdit'), side: "bottom", delayMs: 500, children: _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.cancelEdit'), disabled: busy !== null, onClick: () => { setEditing(null); }, children: _jsx(IconCloseOutlineRegular, { size: 14 }) }) })] }))
                                            : (_jsxs(_Fragment, { children: [_jsx(Tooltip, { portal: true, label: t('queue.edit'), side: "bottom", delayMs: 500, disabled: text === null, children: _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.edit'),
                                                            // Disabled buttons fire no hover events, so the
                                                            // unsupported hint stays a native title.
                                                            title: text === null ? t('queue.edit.unsupported') : undefined, disabled: busy !== null || text === null, onClick: () => {
                                                                if (text !== null)
                                                                    setEditing({ id: row.id, text: text });
                                                            }, children: _jsx(IconEditOutlineRegular, { size: 14 }) }) }), _jsx(Tooltip, { portal: true, label: t('queue.remove'), side: "bottom", delayMs: 500, children: _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.remove'), disabled: busy !== null, onClick: () => {
                                                                void applyAction(row.id, { kind: 'remove' }, t('queue.removeFailed'));
                                                            }, children: _jsx(IconTrashOutlineRegular, { size: 14 }) }) }), _jsx(Tooltip, { portal: true, label: t('queue.steer'), side: "bottom", delayMs: 500, disabled: !running, children: _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.steer'), title: running ? undefined : t('queue.steer.unavailable'), disabled: busy !== null || !running, onClick: () => {
                                                                void applyAction(row.id, { kind: 'steer' }, t('queue.steerFailed'));
                                                            }, children: _jsx(IconSendOutlineRegular, {}) }) })] })) })] }, row.id));
                        }), listVisible && pendingQueue.map((submission) => {
                            return (_jsxs("li", { className: `${css.row} ${css.pendingRow}`, "data-submission-echo": "", children: [rowCount === 1 && _jsx("span", { className: css.lead, "aria-hidden": true, children: _jsx(IconQueueOutlineRegular, {}) }), submission.attachments.length > 0 && (_jsx("span", { className: css.attachments, children: submission.attachments.map((attachment, index) => attachment.type === 'image'
                                            ? (_jsx("img", { className: css.thumb, src: attachment.value.previewUrl, alt: t('queue.image') }, `${attachment.value.previewUrl}:${index}`))
                                            : (_jsx(QueueFile, { attachment: attachment.value, label: t('queue.file', { name: attachment.value.name }) }, `${attachment.value.attachmentId}:${attachment.value.name}:${index}`))) })), _jsx("span", { className: css.preview, children: renderFactorySlot('conversation.user.text', {
                                            text: submission.text, facts: QUEUE_TEXT_FACTS, interactive: false, ellipsis: true,
                                        }) }), _jsx("span", { className: css.status, role: "status", children: t('queue.sending') }), queueMutable && _jsxs("div", { className: css.actions, children: [_jsx("button", { type: "button", className: css.action, "aria-label": t('queue.edit'), title: t('queue.sending'), disabled: true, children: _jsx(IconEditOutlineRegular, { size: 14 }) }), _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.remove'), title: t('queue.sending'), disabled: true, children: _jsx(IconTrashOutlineRegular, { size: 14 }) }), _jsx("button", { type: "button", className: css.action, "aria-label": t('queue.steer'), title: t('queue.sending'), disabled: true, children: _jsx(IconSendOutlineRegular, {}) })] })] }, submission.requestId));
                        })] })] }) }));
}
/** Registers queue actions backed by the session-scoped conversation service. */
export const queueDockEntry = {
    name: 'conversation-queue-dock',
    inject: ['slots', 'conversation', 'sessions', 'uiConversation'],
    apply(ctx) {
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
            name: 'conversation.input.dock',
            id: 'queue',
            order: 20,
            locale: NS,
            inject: (sessionId) => {
                const actx = ctx.sessions.scope(sessionId);
                if (actx === undefined)
                    throw new Error(`queue dock: session "${sessionId}" resolved no scope`);
                const conversation = actx.get('conversation');
                if (conversation === undefined)
                    throw new Error('queue dock: conversation service unavailable');
                return {
                    updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
                    notify: (level, text) => { conversation.input.for(actx).notify(level, text); },
                    loadImage: attachment => ctx.uiConversation.imageUrl(sessionId, attachment),
                };
            },
        }, QueueDock));
    },
};
//# sourceMappingURL=QueueDock.js.map