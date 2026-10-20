import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Reusable user contents inside a caller-owned message row. */
import { Fragment } from 'react';
import { fileExtension, FileTypeIcon, fileSizeText, JsonBlock } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './MessageItem.module.css';
const EMPTY_LABELS = [];
/**
 * Render prepared text, ordered attachments, and references without message chrome.
 * The caller owns row identity, pending/echo state, time, and message actions.
 * @param props - prepared content, facts, authorized image loader, and framework Factory/locale seats.
 * @returns the content stack using the existing user-message layout.
 */
export function UserContent({ content, loadImage, facts, interactive = false, ellipsis = false, renderSlot, renderFactorySlot, t }) {
    const { text, attachments, extraBlocks, referenceLabels = EMPTY_LABELS } = content;
    const compactImages = attachments.length > 1;
    const truncated = (total) => t('json.truncated', { total });
    const showBubble = text !== '' || extraBlocks.length > 0;
    return (_jsxs("div", { className: css.userStack, children: [attachments.length > 0 && (_jsx("div", { className: css.attachmentRow, "data-message-attachments": true, children: attachments.map((attachment, index) => attachment.type === 'image'
                    ? (_jsx(Fragment, { children: renderSlot('conversation.chat.user.images', {
                            images: [attachment.image], loadImage, align: 'end', compact: compactImages,
                        }) }, `image:${index}`))
                    : (_jsxs("span", { className: css.fileCard, title: attachment.file.name, children: [_jsx(FileTypeIcon, { path: attachment.file.name, className: css.fileIcon }), _jsxs("span", { className: css.fileContent, children: [_jsx("span", { className: css.fileName, children: attachment.file.name }), _jsx("span", { className: css.fileMeta, children: [fileExtension(attachment.file.name).toUpperCase().slice(0, 8), fileSizeText(attachment.file.bytes)]
                                            .filter(Boolean).join(' ') })] })] }, `file:${index}`))) })), showBubble && _jsxs("div", { className: css.bubble, children: [renderFactorySlot('conversation.user.text', { text, facts, interactive, ellipsis }), extraBlocks.map((block, index) => (_jsx(JsonBlock, { label: t('message.extraBlock'), payload: block, truncatedLabel: truncated }, index)))] }), referenceLabels.length > 0 && (_jsx("div", { className: css.referenceSummary, children: t('message.referenceSummary', { labels: referenceLabels.join(t('message.referenceSeparator')) }) }))] }));
}
//# sourceMappingURL=UserContent.js.map