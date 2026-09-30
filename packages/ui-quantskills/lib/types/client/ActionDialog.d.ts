import { type ReactNode } from 'react';
import './TradingWorkspace.css';
/** Native modal: top-layer rendering, inert background and browser focus containment. */
export declare function ActionDialog({ title, children, busy, error, wide, drawer, settings, dismissOnBackdrop, className, onClose }: {
    title: string;
    children: ReactNode;
    busy?: boolean;
    error?: string | undefined;
    wide?: boolean;
    drawer?: boolean;
    settings?: boolean;
    dismissOnBackdrop?: boolean;
    className?: string;
    onClose(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=ActionDialog.d.ts.map