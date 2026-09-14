export interface ArtifactTheme {
    scheme: 'light' | 'dark';
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    onAccent: string;
    success: string;
    warning: string;
    danger: string;
    series: string[];
}
export declare const DEFAULT_ARTIFACT_THEME: ArtifactTheme;
/** Only color values leave the app; never CSS rules, URLs, page contents or credentials. */
export declare function readArtifactTheme(): ArtifactTheme;
export declare function subscribeArtifactTheme(notify: () => void): () => void;
export declare function useArtifactTheme(): ArtifactTheme;
//# sourceMappingURL=artifact-theme.d.ts.map