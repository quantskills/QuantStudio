/** Route composer clicks through the live reference owner without editing the draft. */
import { $getNearestNodeFromDOMNode, $getSelection, $isRangeSelection, CLICK_COMMAND, COMMAND_PRIORITY_LOW, } from 'lexical';
import { $isReferenceChipNode } from "./chip-node.js";
import { TextRefNode } from "./text-ref.js";
/**
 * Install preview activation for atomic chips and editable reference tokens.
 * @param editor - composer editor.
 * @param open - live source routing; false preserves ordinary editor handling.
 * @returns command disposer.
 */
export function registerReferenceActivation(editor, open) {
    return editor.registerCommand(CLICK_COMMAND, (event) => {
        if (event.target === null || event.button !== 0 || event.detail > 1)
            return false;
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed())
            return false;
        const node = $getNearestNodeFromDOMNode(event.target);
        if ($isReferenceChipNode(node)) {
            if (node.isInvalid())
                return false;
            const appearance = node.getAppearance();
            return open(node.getSource(), { ref: node.getReference(), ...appearance === undefined ? {} : { appearance } });
        }
        return node instanceof TextRefNode && open(undefined, { ref: node.getTextContent() });
    }, COMMAND_PRIORITY_LOW);
}
//# sourceMappingURL=reference-activation.js.map