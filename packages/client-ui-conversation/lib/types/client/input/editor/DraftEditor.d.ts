/** Stateless text-area presentation over the InputBar's borrowed editor. */
import type { KeyboardEventHandler, ReactNode, RefObject } from 'react';
import type { LexicalEditor } from 'lexical';
import type { InputState } from '../../contract/input.ts';
/** Text-area values and the scrollport reference retained by InputBar. */
export interface DraftEditorProps {
    readonly classNames: Readonly<Record<string, string>>;
    readonly editor: LexicalEditor | null;
    readonly scrollRef: RefObject<HTMLDivElement>;
    readonly editable: boolean;
    readonly editorDisabled: boolean;
    readonly phase: InputState['phase'] | 'inert';
    readonly placeholderText: string;
    readonly ariaLabel: string;
    readonly workspaceTrigger: boolean;
    readonly workspacePickerOpen: boolean;
    readonly onWorkspaceKeyDown: KeyboardEventHandler<HTMLDivElement>;
    readonly hint: string | null;
    readonly showPlaceholder: boolean;
}
/**
 * Render the existing scrollport, editable surface, placeholder, and chip portals.
 * @param props - borrowed editor and presentation values; this component owns no Hooks.
 * @returns the existing text-area DOM without an additional wrapper.
 */
export declare function DraftEditor({ classNames: css, editor, scrollRef, editable, editorDisabled, phase, placeholderText, ariaLabel, workspaceTrigger, workspacePickerOpen, onWorkspaceKeyDown, hint, showPlaceholder, }: DraftEditorProps): ReactNode;
//# sourceMappingURL=DraftEditor.d.ts.map