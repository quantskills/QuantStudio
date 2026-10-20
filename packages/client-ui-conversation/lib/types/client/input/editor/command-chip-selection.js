import { $getAdjacentNode, $getSelection, $isRangeSelection, BEFORE_INPUT_COMMAND, BLUR_COMMAND, CLICK_COMMAND, COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_HIGH, DELETE_CHARACTER_COMMAND, KEY_DOWN_COMMAND, } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { $isCommandChipNode } from "./command-chip-node.js";
/**
 * Keys that never clear a selected chip by themselves: bare modifiers, and
 * IME or virtual-keyboard keys whose deletion arrives later as an input event.
 */
const PASSIVE_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Unidentified', 'Process']);
/** The chip a collapsed caret deletes next in one direction, or null. */
function $commandChipBesideCaret(isBackward) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed())
        return null;
    const node = $getAdjacentNode(selection.focus, isBackward);
    return $isCommandChipNode(node) ? node : null;
}
/** Deletion direction of an input event type; null for other input. */
function deletionDirection(inputType) {
    if (inputType === 'deleteContentBackward')
        return true;
    if (inputType === 'deleteContentForward')
        return false;
    return null;
}
/**
 * Register two-step deletion for the command chip.
 * @param editor - the shell-owned editor.
 * @returns the unregister disposer, which also clears a selected chip.
 */
export function registerCommandChipSelection(editor) {
    let selected = null;
    /** A keydown with a selected chip whose dispatch has produced no character deletion yet. */
    let keyWithoutDeletion = false;
    const paint = (next) => {
        if (selected !== null && selected.key !== next?.key) {
            editor.getElementByKey(selected.key)?.removeAttribute('data-selected');
        }
        selected = next;
        if (next !== null)
            editor.getElementByKey(next.key)?.setAttribute('data-selected', '');
        editor.getRootElement()?.toggleAttribute('data-composer-chip-selected', next !== null);
    };
    const clear = () => {
        if (selected !== null)
            paint(null);
        return false;
    };
    /**
     * Decide one character deletion.
     * @param isBackward - deletion direction.
     * @param clearOnPass - whether letting the deletion run clears the selection here;
     * an input event leaves it for the deletion that follows.
     * @returns true when the deletion only selected the chip and must be consumed.
     */
    const $decide = (isBackward, clearOnPass) => {
        keyWithoutDeletion = false;
        const chip = $commandChipBesideCaret(isBackward);
        if (chip === null)
            return clear();
        if (selected?.key === chip.getKey() && selected.isBackward === isBackward)
            return clearOnPass ? clear() : false;
        paint({ key: chip.getKey(), isBackward });
        return true;
    };
    return mergeRegister(editor.registerCommand(BEFORE_INPUT_COMMAND, (event) => {
        const isBackward = deletionDirection(event.inputType);
        if (isBackward === null || !$decide(isBackward, false))
            return false;
        event.preventDefault();
        return true;
    }, COMMAND_PRIORITY_HIGH), editor.registerCommand(DELETE_CHARACTER_COMMAND, isBackward => $decide(isBackward, true), COMMAND_PRIORITY_HIGH), editor.registerCommand(KEY_DOWN_COMMAND, (event) => {
        if (selected === null || PASSIVE_KEYS.has(event.key))
            return false;
        // Key bindings dispatch their deletion synchronously inside this
        // keydown, so the microtask sees whether the key deleted anything.
        keyWithoutDeletion = true;
        queueMicrotask(() => {
            if (!keyWithoutDeletion)
                return;
            keyWithoutDeletion = false;
            clear();
        });
        return false;
    }, COMMAND_PRIORITY_CRITICAL), editor.registerCommand(CLICK_COMMAND, clear, COMMAND_PRIORITY_CRITICAL), editor.registerCommand(BLUR_COMMAND, clear, COMMAND_PRIORITY_CRITICAL), editor.registerUpdateListener(({ editorState }) => {
        const current = selected;
        if (current === null)
            return;
        const touching = editorState.read(() => $commandChipBesideCaret(current.isBackward)?.getKey() === current.key);
        // A restore can remount the chip's host element; repaint keeps the mark on it.
        paint(touching ? current : null);
    }), () => { paint(null); });
}
//# sourceMappingURL=command-chip-selection.js.map