type ChartViewport = {
    element: HTMLElement;
    width: number;
    height: number;
};
/** ECharts/zrender reads native offsetX/Y, which Chromium scales with CSS zoom.
 * Convert viewport coordinates to chart units before zrender normalizes the
 * event. Keep its wheel/button handling intact, and remeasure after scrolling,
 * resizing or changing the interface scale. Device pixels are not chart units.
 */
export declare function installChartPointerCoordinates(host: HTMLElement, viewport: () => ChartViewport): () => void;
export {};
//# sourceMappingURL=chart-pointer.d.ts.map