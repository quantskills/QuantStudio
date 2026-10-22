/** The Composer model's private Lexical editor, projections, and node operations. */
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { LexicalEditor } from 'lexical';
import type { DraftReference, ReferenceInsert } from '../../contract/draft-editor.ts';
import type { CommandClaim } from '../../contract/input.ts';
import type { EditorProjection } from './projection.ts';
import type { DetectSpan } from './span-map.ts';
type Lexicon = ReadonlyMap<'/' | '@', readonly string[]>;
/** Model callbacks read at the same editor registration and update points. */
interface DraftEditorRuntimeDeps {
    readonly onUpdate: () => void;
    readonly openReference: (source: string | undefined, reference: Pick<ReferenceInsert, 'ref' | 'appearance'>) => boolean;
    readonly lexicon: () => Lexicon;
    readonly resolveLexicon: () => ObservableSnapshot<Lexicon> | undefined;
}
/** One model-owned editor; registration and disposal remain with its model. */
export declare class DraftEditorRuntime {
    private readonly deps;
    /** The editor bound by the Composer's contenteditable host. */
    readonly editor: LexicalEditor;
    private projected;
    /** Stable occurrence ids per chip NodeKey (undo restores keys, so ids survive it too). */
    private readonly occurrenceIds;
    private occurrenceSeq;
    /** Live lexicon subscription disposer; undefined until the controller resolves. */
    private lexiconOff;
    private lexiconSource;
    /** @param deps - model callbacks used by editor listeners and transforms. */
    constructor(deps: DraftEditorRuntimeDeps);
    /**
     * Install editor behavior after the model holds this runtime.
     * @returns unregister callback that also detaches the editor root.
     */
    register(): () => void;
    /** The latest committed editor projection. */
    get projection(): EditorProjection;
    /**
     * Run one editor edit whose result is observable on return. At the top
     * level this is a discrete update. Inside this editor's own update —
     * command handlers land here synchronously (space/enter picks, paste) —
     * $-functions are already legal, and wrapping them in update() would DEFER
     * them past the synchronous bail answer (and a nested discrete throws);
     * the body runs directly and the outer update commits it.
     * @param fn - the $-edit body.
     */
    private applyEdit;
    /**
     * Reconnect decorations when the optional trigger provider changes.
     * The rescan reads the current editor and does not replace its content.
     */
    refreshLexiconSubscription(): void;
    /**
     * Re-project inside the existing editor update callback.
     * @returns the projection preceding this read.
     */
    refreshProjection(): EditorProjection;
    private occurrenceIdOf;
    /**
     * Replace the whole draft (persisted-draft seed and programmatic writes).
     * Placeholder-sanitized; newlines split paragraphs; the caret lands at the
     * end. Merged into history so a seed is not an undoable step of its own.
     * @param text - the full next draft.
     */
    setDraft(text: string): void;
    /**
     * Insert pasted plain text over the current editor selection
     * (placeholder-sanitized). The paste event's own default is suppressed by
     * the caller; PASTE_TAG makes the paste its own history boundary, so one
     * undo never removes both the paste and typing inside the merge window.
     * @param text - pasted plain text.
     */
    paste(text: string): void;
    /**
     * The live selection as a detect-coordinate span (menu-launcher synthetic
     * hits replace it on pick); an absent selection answers a collapsed span at
     * the document end.
     * @returns the ordered [start, end) span in detect coordinates.
     */
    caretSpan(): {
        start: number;
        end: number;
    };
    /**
     * Replace a mapped span without applying the model's phase or revision guards.
     * @param span - detect-coordinate range.
     * @param text - inserted text.
     * @returns whether the range mapped and the edit applied.
     */
    replaceText(span: DetectSpan, text: string): boolean;
    /**
     * Insert an asynchronous text result as one independent undo operation.
     * @param span - owner-validated insertion range.
     * @param text - text sanitized with the same rules as paste.
     * @returns whether the range mapped and the edit applied.
     */
    insertAsyncText(span: DetectSpan, text: string): boolean;
    /**
     * Insert a reference chip with the existing trailing-space rule.
     * @param span - detect-coordinate range.
     * @param ref - reference fields.
     * @param tail - the character following the range before editing.
     * @returns whether the range mapped and the edit applied.
     */
    insertReference(span: DetectSpan, ref: ReferenceInsert, tail: string): boolean;
    /**
     * Replace a span with a command chip followed by the claim token's
     * argument separator, unless the separator already follows.
     * @param span - detect-coordinate range.
     * @param claim - the command claim the chip anchors.
     * @param tail - the character following the range before editing.
     * @param mergeHistory - merge into the previous history entry (a restored
     * draft's chip is part of its seed, not an undoable step).
     * @returns whether the range mapped and the edit applied.
     */
    insertCommand(span: DetectSpan, claim: CommandClaim, tail: string, mergeHistory?: boolean): boolean;
    /**
     * Insert an ordered file-reference batch after the live selection without deleting it.
     * @param references - validated references in source order.
     * @returns whether the live insertion position accepted the batch.
     */
    insertFileReferences(references: readonly ReferenceInsert[]): boolean;
    /**
     * Clear committed content using the model's suffix decision inside the editor update.
     * @param prefixLength - returns the clipboard-prefix length to remove, or null to clear the root.
     */
    clearCommittedDraft(prefixLength: (clipboardText: string) => number | null): void;
    /**
     * Import semantic content or a model-selected failure snapshot with fresh reference nodes.
     * @param draft - clipboard text.
     * @param occurrences - reference occurrences in clipboard order.
     */
    restoreDraft(draft: string, occurrences: readonly DraftReference[]): void;
    /** Cut the editor's undo history after a committed clear or restoration. */
    clearHistory(): void;
}
export {};
//# sourceMappingURL=runtime.d.ts.map