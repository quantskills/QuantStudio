import { resolveSubmitMode } from "../submission-policy.js";
import { registerComposerKeymap } from "./keymap.js";
/**
 * Reveal the DOM selection within the draft's own scrollport.
 * @param scrollRef - the InputBar-owned scrollport reference.
 */
export function revealDraftSelection(scrollRef) {
    const scrollEl = scrollRef.current;
    if (scrollEl === null || scrollEl.scrollHeight <= scrollEl.clientHeight)
        return;
    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0)
        return;
    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) {
        // A collapsed caret at an empty line reports a zero rect in some
        // engines; the anchor's element box is the line the caret sits on.
        const anchor = selection.anchorNode;
        const el = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
        if (el === undefined || el === null)
            return;
        rect = el.getBoundingClientRect();
    }
    const box = scrollEl.getBoundingClientRect();
    if (rect.bottom > box.bottom)
        scrollEl.scrollTop += rect.bottom - box.bottom;
    else if (rect.top < box.top)
        scrollEl.scrollTop -= box.top - rect.top;
}
/**
 * Focus the borrowed editor and reveal its restored selection.
 * @param editor - the Session-owned editor.
 * @param revealSelection - reveal the selection after Lexical restores it.
 */
export function focusDraftEditor(editor, revealSelection) {
    // Lexical's focus() restores the editor selection but never calls the DOM
    // focus itself; preventScroll keeps the conversation scrollport still.
    editor.getRootElement()?.focus({ preventScroll: true });
    editor.focus(() => { revealSelection(); });
}
/**
 * Forward wheel movement at the draft's edge to its conversation scrollport.
 * @param scrollRef - the InputBar-owned scrollport reference.
 * @returns the listener cleanup, or undefined when the element is absent.
 */
export function installDraftWheel(scrollRef) {
    const el = scrollRef.current;
    if (el === null)
        return;
    const onWheel = (e) => {
        const host = el.closest('[data-conversation-scroll]');
        if (!(host instanceof HTMLElement) || e.deltaY === 0)
            return;
        const atTop = el.scrollTop <= 0;
        const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atEnd))
            return;
        e.preventDefault();
        host.scrollTop += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); };
}
/**
 * Bind this view's file dialog through the existing keyboard face.
 * @param keyboard - the Session-owned composer operations.
 * @param gate - live intake availability retained by InputBar.
 * @param fileInputRef - the view's native file input.
 * @returns the picker unbind disposer.
 */
export function installDraftFilePicker(keyboard, gate, fileInputRef) {
    return keyboard.bindFilePicker({
        available: () => gate.current.canAcceptDrop && fileInputRef.current !== null && !fileInputRef.current.disabled,
        open: () => { fileInputRef.current?.click(); },
    });
}
/**
 * Bind editor gestures to the view's live guards and Session operations.
 * @param editor - the borrowed Session-owned editor.
 * @param keyboard - the existing composer keyboard operations.
 * @param gate - live view values read by the installed handlers.
 * @returns the keymap disposer.
 */
export function installDraftKeymap(editor, keyboard, gate) {
    return registerComposerKeymap(editor, {
        arbitrate: (key, composing) => keyboard.arbitrate(key, composing),
        space: () => {
            if (gate.current.machineBusy || gate.current.locked)
                return false;
            return keyboard.space();
        },
        dismissPopup: () => { keyboard.dismissPopup(); },
        canSubmit: () => !gate.current.locked && !gate.current.machineBusy,
        submit: (accelerated) => {
            const g = gate.current;
            // Empty-draft accelerated Enter acts on the queue instead of the
            // (empty) draft: the machine rejects empty drafts, so the gesture
            // steers every still-pending queued message into the running turn.
            if (accelerated && g.canSteerQueue) {
                keyboard.steerQueue();
                return;
            }
            if (g.uploadsPending) {
                g.showToast(g.t('file.stillUploading'));
                return;
            }
            keyboard.submit(resolveSubmitMode(g.busyEnter, g.running, accelerated ? 'accelerated' : 'enter', g.steeringAvailable), 'enter');
        },
        intakeFiles: (files, directories) => { gate.current.intakeFiles(files, directories); },
        pasteText: (text) => {
            if (gate.current.machineBusy || gate.current.locked)
                return;
            keyboard.paste(text);
        },
    });
}
/**
 * Keep a toolbar press from moving focus away from the draft.
 * @param event - the toolbar button's mouse event.
 * @param editor - the borrowed editor, absent in the inert view.
 */
export function keepDraftFocus(event, editor) {
    event.preventDefault();
    editor?.getRootElement()?.focus({ preventScroll: true });
}
//# sourceMappingURL=view-binding.js.map