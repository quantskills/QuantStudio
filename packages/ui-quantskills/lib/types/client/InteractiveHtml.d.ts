import { type ArtifactTheme } from './artifact-theme.ts';
export declare const INTERACTIVE_HTML_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
export declare function isolatedHtmlDocument(source: string, title: string, theme?: ArtifactTheme): string;
/** One shared isolation boundary for inline delivery and the right workbench. */
export declare function InteractiveHtml({ source, title, className }: {
    source: string;
    title: string;
    className?: string | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=InteractiveHtml.d.ts.map