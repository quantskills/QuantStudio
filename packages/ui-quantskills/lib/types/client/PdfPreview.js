import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { artifactResourceUrl } from "./artifact-resource.js";
import css from './PdfPreview.module.css';
let workerUrl;
async function pdfLibrary() {
    const [pdf, source] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?raw')]);
    workerUrl ??= URL.createObjectURL(new Blob([source.default], { type: 'text/javascript' }));
    pdf.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdf;
}
/** Render one page at a time; never run document JavaScript or load remote resources. */
export function PdfPreview({ url, title, className }) {
    const canvas = useRef(null);
    const [document, setDocument] = useState();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('loading');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let live = true;
        let task;
        setDocument(undefined);
        setPage(1);
        setStatus('loading');
        void pdfLibrary().then(pdf => {
            if (!live)
                return;
            task = pdf.getDocument({ url: artifactResourceUrl(url), enableXfa: false,
                useSystemFonts: true, isOffscreenCanvasSupported: false });
            return task.promise.then(value => { if (live)
                setDocument(value); });
        }).catch((error) => {
            console.warn('QuantSkills PDF load:', error instanceof Error ? error.message.slice(0, 500) : String(error));
            if (live)
                setStatus('error');
        });
        return () => { live = false; void task?.destroy().catch(() => { }); };
    }, [url, attempt]);
    useEffect(() => {
        if (!document || !canvas.current)
            return;
        let live = true;
        let rendering;
        const element = canvas.current;
        setStatus('loading');
        void document.getPage(page).then(async (value) => {
            if (!live)
                return;
            const base = value.getViewport({ scale: 1 });
            const scale = Math.min(1.5, 1200 / base.width, Math.sqrt(4_000_000 / (base.width * base.height)));
            const viewport = value.getViewport({ scale });
            element.width = Math.ceil(viewport.width);
            element.height = Math.ceil(viewport.height);
            const context = element.getContext('2d');
            if (!context)
                throw new Error('Canvas unavailable');
            rendering = value.render({ canvas: element, canvasContext: context, viewport });
            await rendering.promise;
            if (live)
                setStatus('ready');
        }).catch((error) => {
            if (live) {
                console.warn('QuantSkills PDF render:', error instanceof Error ? error.message.slice(0, 500) : String(error));
                setStatus('error');
            }
        });
        return () => { live = false; rendering?.cancel(); };
    }, [document, page]);
    return _jsxs("div", { title: title, className: `${css.viewer} ${className ?? ''}`, children: [_jsxs("div", { className: css.toolbar, children: [_jsx("button", { type: "button", "aria-label": `${title} 上一页`, disabled: !document || page === 1, onClick: () => setPage(n => n - 1), children: "\u4E0A\u4E00\u9875" }), _jsx("span", { children: document ? `${page} / ${document.numPages}` : 'PDF' }), _jsx("button", { type: "button", "aria-label": `${title} 下一页`, disabled: !document || page === document.numPages, onClick: () => setPage(n => n + 1), children: "\u4E0B\u4E00\u9875" })] }), status === 'loading' && _jsx("p", { role: "status", children: "\u6B63\u5728\u7ED8\u5236 PDF\u2026" }), status === 'error' && _jsxs("p", { role: "status", children: ["PDF \u9884\u89C8\u6682\u4E0D\u53EF\u7528\uFF0C\u53EF\u4E0B\u8F7D\u539F\u6587\u4EF6\u3002", _jsx("button", { type: "button", onClick: () => setAttempt(n => n + 1), children: "\u91CD\u8BD5" })] }), _jsx("canvas", { ref: canvas, hidden: status !== 'ready', role: "img", "aria-label": `${title} 第 ${page} 页` })] });
}
//# sourceMappingURL=PdfPreview.js.map