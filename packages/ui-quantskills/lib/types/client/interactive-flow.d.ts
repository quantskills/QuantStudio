import type { MINIMAL_THEMES } from './minimal-themes.ts';
type Theme = typeof MINIMAL_THEMES[number];
/** Passive observers add decoration without intercepting application controls. */
export declare function createInteractiveFlow(layer: HTMLElement, canvas: HTMLCanvasElement, theme: Theme): {
    setActive(active: boolean): void;
    resize(w: number, h: number): void;
    draw(now: number): void;
    destroy(): void;
};
export {};
//# sourceMappingURL=interactive-flow.d.ts.map