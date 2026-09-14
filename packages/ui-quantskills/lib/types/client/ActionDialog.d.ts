import { type ReactNode } from 'react';
/** Native modal: top-layer rendering, inert background and browser focus containment. */
export declare function ActionDialog({ title, children, busy, error, wide, onClose }: {
    title: string;
    children: ReactNode;
    busy?: boolean;
    error?: string | undefined;
    wide?: boolean;
    onClose(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=ActionDialog.d.ts.map