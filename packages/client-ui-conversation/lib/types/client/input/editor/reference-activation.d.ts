import type { LexicalEditor } from 'lexical';
import type { ReferenceInsert } from '../../contract/draft-editor.ts';
/**
 * Install preview activation for atomic chips and editable reference tokens.
 * @param editor - composer editor.
 * @param open - live source routing; false preserves ordinary editor handling.
 * @returns command disposer.
 */
export declare function registerReferenceActivation(editor: LexicalEditor, open: (source: string | undefined, reference: Pick<ReferenceInsert, 'ref' | 'appearance'>) => boolean): () => void;
//# sourceMappingURL=reference-activation.d.ts.map