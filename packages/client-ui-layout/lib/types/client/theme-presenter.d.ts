/**
 * Global theme DOM applier: projects the resolved ThemeSnapshot onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), `body[data-ds-dark-theme]` for the token palette, the active
 * theme's alias-token overrides as inline CSS variables on body, the content
 * font-size axis (`--dsh-content-font-size`), the code and terminal sizes
 * (`--dsh-code-font-size`, `--dsh-terminal-font-size`), the user font lists
 * (`--dsh-font-family-<role>`), `html[data-ds-theme-source]`
 * for native-chrome mirroring, and one presenter-owned
 * `meta[name="theme-color"]` for surrounding browser UI. Pure DOM writes, no
 * React involvement; the presenter only ever retracts what it wrote itself,
 * so foreign attributes, metadata, and inline styles survive.
 */
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client';
/** Body attribute selecting the dark base palette in the token stylesheets. */
export declare const DARK_ATTRIBUTE = "data-ds-dark-theme";
/**
 * Root attribute publishing the theme source (`light`, `dark`, or `system`)
 * for host shells that mirror it into the native theme (the Electron preload
 * forwards it to `nativeTheme.themeSource`, so native chrome, renderer
 * `prefers-color-scheme` queries, and Platform login links follow the app
 * palette on every platform). `system` only when the preference is `system`;
 * a fixed preference (including registered theme ids) publishes its resolved
 * scheme.
 */
export declare const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";
/** Body variable carrying the user's content font size in px. */
export declare const CONTENT_FONT_SIZE_VARIABLE = "--dsh-content-font-size";
/** Applies theme snapshots to the document; one instance per plugin fiber. */
export declare class ThemePresenter {
    /** Token names this presenter wrote in the last apply (its retraction set). */
    private appliedTokens;
    /** The single metadata node this presenter inserts and removes. */
    private readonly themeColorMeta;
    /** Create the presenter-owned metadata node before the first snapshot arrives. */
    constructor();
    /**
     * Project a snapshot onto the document: set root `color-scheme` and the body
     * palette attribute from `active.colorScheme` (never the id — `system` is
     * resolved upstream), publish the font sizes and font lists, then replace the
     * previously applied token variables with `active.tokens`. Browser
     * theme-color metadata follows the computed body background after those
     * writes, so the rendered palette remains the color authority.
     * @param snapshot - resolved theme snapshot from ctx.theme.
     */
    apply(snapshot: ThemeSnapshot): void;
    /**
     * Retract root color-scheme, the theme-source attribute, the palette
     * attribute, token variables, the font sizes, font lists, and the owned metadata node.
     */
    dispose(): void;
}
//# sourceMappingURL=theme-presenter.d.ts.map