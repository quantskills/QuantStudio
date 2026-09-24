declare const defaults: {
    equity: string;
    profit: string;
    loss: string;
    muted: string;
    blue: string;
    text: string;
    grid: string;
    surface: string;
    warning: string;
};
export type ChartPalette = typeof defaults;
/** Canvas charts cannot inherit CSS variables: resolve the current component palette. */
export declare function useChartPalette(): {
    ref: import("react").RefObject<HTMLElement>;
    palette: {
        equity: string;
        profit: string;
        loss: string;
        muted: string;
        blue: string;
        text: string;
        grid: string;
        surface: string;
        warning: string;
    };
};
export {};
//# sourceMappingURL=useChartPalette.d.ts.map