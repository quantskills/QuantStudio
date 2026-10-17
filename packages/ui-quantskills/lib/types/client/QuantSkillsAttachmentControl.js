import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** QuantSkills generic-file uploader mounted in the stock conversation tool row. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import css from './QuantSkillsApp.module.css';
/** Dropped non-image files dispatched by the stock composer. */
export const COMPOSER_FILE_EVENT = 'qs-composer-files';
/** Session-addressed bridge from the shared composer launcher to the hidden native file input. */
export class QuantSkillsAttachmentController {
    openers = new Map();
    /** Register the currently mounted file input for one Session. */
    register(sessionId, open) {
        this.openers.set(sessionId, open);
        return () => {
            if (this.openers.get(sessionId) === open)
                this.openers.delete(sessionId);
        };
    }
    /** Open the native file chooser for the addressed Session when its composer is mounted. */
    open(sessionId) {
        const open = this.openers.get(sessionId);
        if (open === undefined)
            return false;
        open();
        return true;
    }
}
function readCanonicalBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => { reject(reader.error ?? new Error(`Cannot read ${file.name}.`)); };
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                reject(new Error(`Cannot encode ${file.name}.`));
                return;
            }
            const comma = reader.result.indexOf(',');
            if (comma < 0) {
                reject(new Error(`Cannot encode ${file.name}.`));
                return;
            }
            resolve(reader.result.slice(comma + 1));
        };
        reader.readAsDataURL(file);
    });
}
function parsingLabel(attached) {
    switch (attached.parsing.status) {
        case 'ready': return attached.parsing.kind === 'utf8-text'
            ? '文本可读取'
            : `${attached.parsing.kind} 可提取文本`;
        case 'unsupported': return `已保留，暂不支持解析：${attached.parsing.reason}`;
        case 'failed': return `已保留，解析失败：${attached.parsing.reason}`;
    }
}
function referenceLine(item) {
    return [
        `- ${item.file.name}`,
        `媒体类型 ${item.file.mediaType}`,
        `附件 id ${item.file.attachmentId}`,
        parsingLabel(item),
    ].join('；');
}
/** Upload selected files and append only their durable references to the current draft. */
export function QuantSkillsAttachmentControl({ sessionId, controller, upload, appendDraft, editDraft, }) {
    const inputRef = useRef(null);
    const anchorRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState();
    const [chips, setChips] = useState([]);
    const [card, setCard] = useState(null);
    const choose = useCallback(() => {
        if (!busy)
            inputRef.current?.click();
    }, [busy]);
    useEffect(() => controller.register(sessionId, choose), [controller, sessionId, choose]);
    useEffect(() => {
        const found = anchorRef.current?.closest('[data-composer-card]');
        if (found instanceof HTMLElement)
            setCard(found);
    }, []);
    useEffect(() => {
        if (card === null)
            return;
        if (chips.length > 0)
            card.setAttribute('data-composer-files', 'true');
        else
            card.removeAttribute('data-composer-files');
        return () => { card.removeAttribute('data-composer-files'); };
    }, [card, chips.length]);
    const attach = useCallback(async (files) => {
        if (files.length === 0)
            return;
        setBusy(true);
        setStatus(`正在上传 ${String(files.length)} 个文件`);
        try {
            const attached = [];
            for (const file of files) {
                const data = await readCanonicalBase64(file);
                attached.push(await upload(sessionId, file, data));
            }
            const rows = attached.map(referenceLine);
            appendDraft(sessionId, [
                '',
                '[QuantSkills 附件]',
                ...rows,
                '需要读取可用文本时，请使用 quantskills_read_attachment，并传入上面的附件 id。',
            ].join('\n'));
            setChips(current => [
                ...current,
                ...attached.map((item, index) => ({
                    id: item.file.attachmentId,
                    name: item.file.name,
                    line: rows[index] ?? referenceLine(item),
                })),
            ]);
            setStatus(`已附加 ${String(attached.length)} 个文件`);
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : '附件上传失败');
        }
        finally {
            setBusy(false);
        }
    }, [appendDraft, sessionId, upload]);
    useEffect(() => {
        const onFiles = (event) => {
            const detail = event.detail;
            if (detail?.sessionId !== sessionId || detail.files === undefined || detail.files.length === 0)
                return;
            void attach(detail.files);
        };
        window.addEventListener(COMPOSER_FILE_EVENT, onFiles);
        return () => { window.removeEventListener(COMPOSER_FILE_EVENT, onFiles); };
    }, [attach, sessionId]);
    const changed = (event) => {
        const files = [...(event.target.files ?? [])];
        event.target.value = '';
        void attach(files);
    };
    const removeChip = (chip) => {
        setChips(current => current.filter(item => item.id !== chip.id));
        editDraft(sessionId, draft => draft.replace(chip.line, '').replace(/\n{3,}/g, '\n\n').trimEnd());
    };
    const chipRow = chips.length === 0 ? null : (_jsx("div", { className: css.composerFileChips, "data-composer-file-chips": "", children: chips.map(chip => (_jsxs("span", { className: css.composerFileChip, children: [_jsx("span", { children: chip.name }), _jsx("button", { type: "button", "aria-label": `移除文件 ${chip.name}`, onClick: () => { removeChip(chip); }, children: "\u00D7" })] }, chip.id))) }));
    return _jsxs(_Fragment, { children: [_jsx("span", { ref: anchorRef, hidden: true }), card !== null && chipRow !== null ? createPortal(chipRow, card) : chipRow, _jsx("input", { ref: inputRef, className: css.attachmentInput, type: "file", multiple: true, tabIndex: -1, "aria-hidden": true, onChange: changed }), status && _jsx("span", { className: css.attachmentStatus, role: "status", children: status })] });
}
//# sourceMappingURL=QuantSkillsAttachmentControl.js.map