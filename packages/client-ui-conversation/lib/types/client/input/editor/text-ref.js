/** Editable reference tokens share chip hover styling while retaining ordinary text semantics. */
import clsx from 'clsx';
import { TextNode } from 'lexical';
import { registerLexicalTextEntity } from '@lexical/text';
import { mergeRegister } from '@lexical/utils';
import { $getRoot, HISTORY_MERGE_TAG } from 'lexical';
import { scanTextRefs } from "../decorations.js";
import css from './composer-editor.module.css';
/** One matched plain-text reference as a styled, fully editable text node. */
export class TextRefNode extends TextNode {
    /** Lexical node registry type tag. */
    static getType() {
        return 'composer-text-ref';
    }
    /**
     * Clone with identity (Lexical writable-copy contract).
     * @param node - node to clone.
     * @returns a copy carrying the same NodeKey.
     */
    static clone(node) {
        return new TextRefNode(node.__text, node.__key);
    }
    /**
     * Rebuild one text-ref from its JSON form.
     * @param json - serialized node.
     * @returns a fresh node.
     */
    static importJSON(json) {
        const node = new TextRefNode(json.text);
        node.setFormat(json.format);
        node.setDetail(json.detail);
        node.setMode(json.mode);
        node.setStyle(json.style);
        return node;
    }
    /** Serialize to the JSON node form. */
    exportJSON() {
        return {
            ...super.exportJSON(),
            type: 'composer-text-ref',
        };
    }
    /** Style the span the base TextNode mounts. */
    createDOM(config) {
        const el = super.createDOM(config);
        el.className = clsx(el.className, css.reference, css.textRef, this.getTextContent().startsWith('/') && css.openable);
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('data-composer-text-ref', '');
        return el;
    }
    /** Entity nodes never merge with plain siblings (the transform owns their bounds). */
    isTextEntity() {
        return true;
    }
    /** Editing continues inside; the transform re-evaluates match shape per edit. */
    canInsertTextBefore() {
        return true;
    }
}
/**
 * Register the plain-text reference entity transform.
 * @param editor - the shell-owned editor.
 * @param lexiconOf - live per-trigger name-roll accessor (the controller's aggregated store).
 * @returns the unregister disposer.
 */
export function registerTextRefDecoration(editor, lexiconOf) {
    const getMatch = (text) => {
        const range = scanTextRefs(text, lexiconOf())[0];
        return range === undefined ? null : { start: range.start, end: range.end };
    };
    return mergeRegister(...registerLexicalTextEntity(editor, getMatch, TextRefNode, node => new TextRefNode(node.getTextContent())));
}
/**
 * Force a re-scan of the whole document (transforms only visit dirty nodes;
 * a lexicon roll change dirties nothing on its own). Queued, not discrete —
 * the caller may sit inside an update listener.
 * @param editor - the shell-owned editor.
 */
export function rescanTextRefs(editor) {
    editor.update(() => {
        for (const node of $getRoot().getAllTextNodes())
            node.markDirty();
    }, { tag: HISTORY_MERGE_TAG });
}
//# sourceMappingURL=text-ref.js.map