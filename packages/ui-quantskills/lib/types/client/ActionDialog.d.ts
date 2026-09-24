import { type ReactNode } from 'react';
import './TradingWorkspace.css';
/** Native modal: top-layer rendering, inert background and browser focus containment. */
export declare function ActionDialog({ title, children, busy, error, wide, drawer, onClose }: {
    title: string;
    children: ReactNode;
    busy?: boolean;
    error?: string | undefined;
    wide?: boolean;
    drawer?: boolean;
    onClose(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=ActionDialog.d.ts.map