/**
 * CommandChipNode: the claimed slash command as one atomic Lexical decorator
 * on the document's leading seat. The node carries the claim it was inserted
 * for, so a history restore of the node restores the claim with it.
 * `getTextContent()` answers the token without its argument separator; the
 * separator is an ordinary text node after the chip. The detect projection
 * counts the chip as one U+FFFC; see projection.ts.
 */
import type { JSX } from 'react';
import type { LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode } from 'lexical';
import type { CommandClaim } from '../../contract/input.ts';
/** JSON form of one command chip (Lexical node serialization contract). */
export type SerializedCommandChipNode = Spread<{
    text: string;
}, SerializedLexicalNode>;
/** One claimed command as an atomic decorator node. */
export declare class CommandChipNode extends DecoratorNode<JSX.Element> {
    /** The claim this chip anchors; its submit closure has no JSON form. */
    __claim: CommandClaim;
    /** Lexical node registry type tag. */
    static getType(): string;
    /**
     * Clone with identity (Lexical writable-copy contract).
     * @param node - node to clone.
     * @returns a copy carrying the same NodeKey and claim.
     */
    static clone(node: CommandChipNode): CommandChipNode;
    /**
     * Rebuild one chip from its JSON form. JSON cannot carry the claim's
     * submit closure, so an imported command is its literal token text.
     * @param json - serialized chip.
     * @returns a plain text node holding the token.
     */
    static importJSON(json: SerializedCommandChipNode): LexicalNode;
    /**
     * @param claim - the command claim the chip anchors.
     * @param key - Lexical clone-path key; absent for fresh nodes.
     */
    constructor(claim: CommandClaim, key?: NodeKey);
    /** Serialize to the JSON node form (the token text alone). */
    exportJSON(): SerializedCommandChipNode;
    /**
     * Mount the chip's host element; the decorator portal renders into it.
     * @returns an inline, non-editable span carrying the test/e2e anchor.
     */
    createDOM(): HTMLElement;
    /** Host element never changes shape. */
    updateDOM(): boolean;
    /** The chip sits in the text line. */
    isInline(): boolean;
    /**
     * Arrows step across the chip and the default character deletion removes
     * it whole, for the reason documented on ReferenceChipNode.isKeyboardSelectable;
     * registerCommandChipSelection inserts the selecting step before that deletion.
     */
    isKeyboardSelectable(): boolean;
    /** Clipboard / persistence projection: the token without its separator. */
    getTextContent(): string;
    /** The claim this chip anchors. */
    getClaim(): CommandClaim;
    /** React face rendered into the host element by the decorator portal. */
    decorate(): JSX.Element;
}
/**
 * Mint one chip node for a claim.
 * @param claim - the command claim.
 * @returns the fresh node.
 */
export declare function $createCommandChipNode(claim: CommandClaim): CommandChipNode;
/**
 * Command chip type guard.
 * @param node - any node or nullish.
 * @returns whether the node is a CommandChipNode.
 */
export declare function $isCommandChipNode(node: LexicalNode | null | undefined): node is CommandChipNode;
/**
 * Keep command chips on the leading seat. A chip anywhere but the first
 * child of the first block (text, a line break, or a block inserted before
 * it) becomes its literal token, which releases the claim. Inserting a
 * sibling before the chip or moving it to another block marks the chip dirty;
 * a block inserted before the chip's block marks only that block dirty.
 * @param editor - the shell-owned editor.
 * @returns the unregister disposer.
 */
export declare function registerCommandChipSeat(editor: LexicalEditor): () => void;
//# sourceMappingURL=command-chip-node.d.ts.map