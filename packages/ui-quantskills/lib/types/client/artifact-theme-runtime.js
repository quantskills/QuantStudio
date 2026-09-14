/** Serialized into the opaque artifact frame. Keep this function self-contained. */
export function artifactThemeRuntime(initial) {
    const scope = window;
    let theme = initial;
    const legacy = new Map();
    const parse = (value) => {
        const match = /^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\)$/.exec(value);
        return !match || (match[4] !== undefined && Number(match[4]) < .5) ? undefined : match.slice(1, 4).map(Number);
    };
    const luminance = (rgb) => rgb.reduce((sum, channel, i) => {
        const c = channel / 255;
        return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    const updateLegacy = () => {
        const surface = theme.surface.slice(1).match(/../g).map(c => parseInt(c, 16));
        const base = luminance(surface);
        for (const entry of legacy.values()) {
            let rgb = entry.rgb;
            if (entry.kind === 'background')
                rgb = rgb.map((c, i) => Math.round(c * .12 + surface[i] * .88));
            else {
                const target = theme.scheme === 'dark' ? 255 : 0;
                for (let step = 0; step <= 20; step++) {
                    rgb = entry.rgb.map(c => Math.round(c + (target - c) * step / 20));
                    const light = luminance(rgb);
                    if ((Math.max(light, base) + .05) / (Math.min(light, base) + .05) >= 4.8)
                        break;
                }
            }
            document.documentElement.style.setProperty(entry.name, `rgb(${rgb.join(',')})`);
        }
    };
    const legacyColor = (value, kind) => {
        const rgb = parse(value);
        if (!rgb)
            return undefined;
        const key = kind + value;
        let entry = legacy.get(key);
        if (!entry) {
            entry = { name: '--qs-report-legacy-' + legacy.size, kind, rgb };
            legacy.set(key, entry);
        }
        return `var(${entry.name})`;
    };
    const setTheme = (next) => {
        if (!next || !['light', 'dark'].includes(next.scheme))
            return;
        const keys = ['background', 'surface', 'text', 'muted', 'border', 'accent', 'onAccent', 'success', 'warning', 'danger'];
        if (keys.some(key => !/^#[a-f0-9]{6}$/i.test(next[key])) || !Array.isArray(next.series) || next.series.length !== 6 || next.series.some(c => !/^#[a-f0-9]{6}$/i.test(c)))
            return;
        theme = next;
        scope.QuantSkillsTheme = structuredClone(next);
        document.documentElement.style.colorScheme = next.scheme;
        for (const key of keys)
            document.documentElement.style.setProperty('--qs-report-' + key.replace('onAccent', 'on-accent'), next[key]);
        next.series.forEach((value, index) => document.documentElement.style.setProperty('--qs-report-series-' + (index + 1), value));
        updateLegacy();
        window.dispatchEvent(new CustomEvent('quantskills:themechange', { detail: structuredClone(next) }));
    };
    setTheme(initial);
    window.addEventListener('message', event => {
        if (event.source === parent && event.data?.type === 'quantskills:artifact-theme')
            setTheme(event.data.theme);
    });
    const neutral = (value) => {
        const rgb = parse(value);
        return rgb !== undefined && Math.max(...rgb) - Math.min(...rgb) < 34;
    };
    // Adapt legacy neutral surfaces; preserve categorical/status colors, images,
    // canvases and SVG fills. New charts use the published theme-change event.
    const adapted = new WeakSet();
    const adapt = (element) => {
        if (!(element instanceof HTMLElement) || adapted.has(element) || element.closest('[data-qs-theme="preserve"],svg') || ['SCRIPT', 'STYLE', 'IMG', 'VIDEO', 'CANVAS', 'IFRAME'].includes(element.tagName))
            return;
        adapted.add(element);
        const style = getComputedStyle(element);
        const background = style.backgroundColor, foreground = style.color, border = style.borderTopColor;
        if (neutral(background))
            element.style.setProperty('background-color', 'var(--qs-report-surface)', 'important');
        else if (style.backgroundImage === 'none') {
            const tint = legacyColor(background, 'background');
            if (tint)
                element.style.setProperty('background-color', tint, 'important');
        }
        if (neutral(foreground)) {
            const brightness = Number(foreground.match(/[\d.]+/)?.[0] ?? 0);
            element.style.setProperty('color', brightness > 55 && brightness < 195 ? 'var(--qs-report-muted)' : 'var(--qs-report-text)', 'important');
        }
        else {
            const readable = legacyColor(foreground, 'text');
            if (readable)
                element.style.setProperty('color', readable, 'important');
        }
        if (neutral(border))
            element.style.setProperty('border-color', 'var(--qs-report-border)', 'important');
    };
    const start = () => {
        document.querySelectorAll('body,body *').forEach(adapt);
        const styles = document.createElement('style');
        styles.textContent = `
      html,body{background:var(--qs-report-background)!important;color:var(--qs-report-text)!important;max-width:100%;margin:0;overflow-wrap:anywhere}
      body{box-sizing:border-box;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65}
      :where(main,article,.container,.report,.report-container){box-sizing:border-box;max-width:100%!important;min-width:0!important}
      :where(h1,h2,h3,h4){color:var(--qs-report-text)}
      :where(a){color:var(--qs-report-accent)}
      :where(hr,th,td){border-color:var(--qs-report-border)}
      :where(input,select,textarea,button){font:inherit;color:var(--qs-report-text);background:var(--qs-report-surface);border:1px solid var(--qs-report-border);border-radius:6px}
      :where(button[type=submit],.btn-primary,.button-primary){background:var(--qs-report-accent)!important;color:var(--qs-report-on-accent)!important}
      :where(pre){max-width:100%;overflow:auto;background:var(--qs-report-surface)}
      :where(img,video,canvas,svg){max-width:100%}
      ::selection{background:var(--qs-report-accent);color:var(--qs-report-on-accent)}
      @media(max-width:600px){body{padding:14px}:where(main,article,.container,.report){padding:16px!important}}
    `;
        document.head.append(styles);
        new MutationObserver(records => {
            for (const record of records)
                for (const node of record.addedNodes)
                    if (node instanceof Element) {
                        adapt(node);
                        node.querySelectorAll('*').forEach(adapt);
                    }
            updateLegacy();
        }).observe(document.body, { childList: true, subtree: true });
        // Notify authored chart listeners after their own scripts have initialized.
        setTheme(theme);
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
}
//# sourceMappingURL=artifact-theme-runtime.js.map