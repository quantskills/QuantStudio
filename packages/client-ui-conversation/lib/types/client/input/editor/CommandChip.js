import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Visual body of the claimed command chip: the CommandChipNode's React face.
 * Pure display with the reference chip's treatment; the claim and its
 * lifecycle live on the node and the shell.
 */
import clsx from 'clsx';
import css from './ReferenceChip.module.css';
import referenceCss from './composer-editor.module.css';
/**
 * Render the claimed command chip.
 * @param props - the token to display.
 * @returns the chip body.
 */
export function CommandChip({ token }) {
    return (_jsx("span", { className: clsx(referenceCss.reference, css.chip), children: _jsx("span", { className: css.label, children: token }) }));
}
//# sourceMappingURL=CommandChip.js.map