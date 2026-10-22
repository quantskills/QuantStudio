import type { ReactNode } from 'react';
/** Display inputs of the command chip. */
export interface CommandChipProps {
    /** Claimed token without its argument separator, e.g. `/goal`. */
    readonly token: string;
}
/**
 * Render the claimed command chip.
 * @param props - the token to display.
 * @returns the chip body.
 */
export declare function CommandChip({ token }: CommandChipProps): ReactNode;
//# sourceMappingURL=CommandChip.d.ts.map