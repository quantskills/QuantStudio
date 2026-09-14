/** Validated presentation context, read afresh each time a Session assembles its prompt. */
export function renderArtifactTheme(settings) {
    let palette;
    try {
        const raw = settings?.artifactPalette;
        if (typeof raw === 'string' && raw.length <= 2000) {
            const value = JSON.parse(raw);
            const keys = ['background', 'surface', 'text', 'muted', 'border', 'accent', 'onAccent', 'success', 'warning', 'danger'];
            if (value && ['light', 'dark'].includes(value.scheme) && keys.every(key => typeof value[key] === 'string' && /^#[a-f0-9]{6}$/i.test(value[key])) &&
                Array.isArray(value.series) && value.series.length === 6 && value.series.every((color) => typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color))) {
                palette = Object.fromEntries(['scheme', ...keys, 'series'].map(key => [key, value[key]]));
            }
        }
    }
    catch { /* Malformed or old preferences cannot inject instructions into the prompt. */ }
    return [
        'QuantSkills artifact presentation: follow the user’s explicit visual brief first. Otherwise match generated reports, dashboards, charts, SVGs, slides, PDFs, image illustrations and video titles to the current app palette.',
        palette ? `Current semantic palette (hex sRGB): ${JSON.stringify(palette)}` : 'No palette snapshot is available. Use readable semantic CSS variables with light/dark fallbacks for HTML; do not claim to know a specific selected theme.',
        'Use background for the page, surface for cards/tables, text/muted for typography, border for grids, accent/onAccent for controls and emphasis, and series for distinct chart series. Use more than one series color when comparing groups. Preserve explicit financial up/down conventions, risk meaning and consistent legends; never change data to fit a palette.',
        'Self-contained HTML: define :root variables --qs-report-background, --qs-report-surface, --qs-report-text, --qs-report-muted, --qs-report-border, --qs-report-accent, --qs-report-on-accent, --qs-report-success, --qs-report-warning, --qs-report-danger, and --qs-report-series-1 through -6 using the supplied colors as fallbacks. Use these variables throughout the report rather than hardcoded white cards and black text.',
        'For canvas charts, read window.QuantSkillsTheme when available and listen for window event "quantskills:themechange" (event.detail has the same palette object). Update chart axes, grid, tooltip, labels and series without resetting selections or zoom. Include the supplied palette in the actual saved file so downloads also match. All scripts, fonts and assets needed by HTML previews must be embedded; external network access is unavailable.',
        'Raster images, PDFs, slides and videos must be styled at generation/export time; switching the app theme cannot recolor their existing pixels. Preserve documentary photos, source screenshots and original media. Only adapt their surrounding presentation. Check contrast and layout before delivery.',
    ].join('\n');
}
//# sourceMappingURL=artifact-theme.js.map