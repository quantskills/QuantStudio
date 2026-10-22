import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { ComposerContentEditable } from "./ComposerContentEditable.js";
import { DecoratorPortals } from "./DecoratorPortals.js";
/**
 * Render the existing scrollport, editable surface, placeholder, and chip portals.
 * @param props - borrowed editor and presentation values; this component owns no Hooks.
 * @returns the existing text-area DOM without an additional wrapper.
 */
export function DraftEditor({ classNames: css, editor, scrollRef, editable, editorDisabled, phase, placeholderText, ariaLabel, workspaceTrigger, workspacePickerOpen, onWorkspaceKeyDown, hint, showPlaceholder, }) {
    return (_jsx("div", { ref: scrollRef, className: css.scroll, "data-input-scroll": true, children: _jsxs("div", { className: css.grow, children: [_jsx(ComposerContentEditable, { editor: workspaceTrigger ? null : editor, editable: editable, className: clsx(css.input, editorDisabled && css.inputDisabled), "data-phase": phase, "aria-disabled": editorDisabled || undefined, "data-placeholder": placeholderText, "aria-label": ariaLabel, "aria-haspopup": workspaceTrigger ? 'menu' : undefined, "aria-expanded": workspaceTrigger ? workspacePickerOpen : undefined, tabIndex: workspaceTrigger ? 0 : undefined, onKeyDown: workspaceTrigger ? onWorkspaceKeyDown : undefined, style: hint === null ? undefined : { '--dsh-composer-hint': JSON.stringify(hint) } }), showPlaceholder && (_jsx("div", { "aria-hidden": true, className: css.placeholder, "data-composer-placeholder": true, children: placeholderText })), _jsx(DecoratorPortals, { editor: workspaceTrigger ? null : editor })] }) }));
}
//# sourceMappingURL=DraftEditor.js.map