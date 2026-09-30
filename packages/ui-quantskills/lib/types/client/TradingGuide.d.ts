import { type ReactNode } from 'react';
import './TradingGuide.css';
export type GuideStep = {
    title: string;
    status: string;
    ready?: boolean;
    body: string;
    note: string;
    action?: {
        label: string;
        run(): void;
    } | undefined;
};
/** Navigation and explanation only: opening a guide never starts a trading operation. */
export declare function TradingGuide({ name, steps, troubleshooting, compact, triggerIcon, inDrawer }: {
    name: string;
    steps: GuideStep[];
    troubleshooting: {
        title: string;
        body: string;
    }[];
    compact?: boolean;
    triggerIcon?: ReactNode;
    inDrawer?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=TradingGuide.d.ts.map