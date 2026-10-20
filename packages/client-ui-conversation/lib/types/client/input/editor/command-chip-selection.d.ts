/**
 * Two-step command chip deletion. A character deletion whose direction
 * reaches the command chip from a collapsed caret first selects the chip; the
 * next deletion in that direction removes it. Deletions arrive as the
 * character-deletion command (Backspace, Delete, and the platform shortcuts
 * the engine maps to them) or as a deletion input event, which some platforms
 * apply without that command. A key that produces no character deletion, a
 * click, blur, or a caret that no longer touches the chip clears the
 * selection. The selected state is presentation on the chip's host and the
 * root element; the editor selection stays a collapsed range beside the chip,
 * so typing and arrows keep their plain-text behavior.
 */
import type { LexicalEditor } from 'lexical';
/**
 * Register two-step deletion for the command chip.
 * @param editor - the shell-owned editor.
 * @returns the unregister disposer, which also clears a selected chip.
 */
export declare function registerCommandChipSelection(editor: LexicalEditor): () => void;
//# sourceMappingURL=command-chip-selection.d.ts.map