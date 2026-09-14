import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowUpRight, DownloadSimple, FileText, CaretDown, CaretRight } from '@phosphor-icons/react';
import { InteractiveHtml } from "./InteractiveHtml.js";
import { PdfPreview } from "./PdfPreview.js";
import { ZoomableImage } from "./ZoomableImage.js";
import { artifactResourceUrl } from "./artifact-resource.js";
import css from './FinalDeliverables.module.css';
const sizeLabel = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
function Delivery({ item, previewFile, openWorkbench, downloadFile }) {
    const inlinePreview = /\.(png|jpe?g|gif|webp|svg|html?|mp[34]|wav|ogg|webm|m4a|pdf)$/i.test(item.path);
    const [expanded, setExpanded] = useState(/\.(png|jpe?g|gif|webp|html?|mp[34]|wav|ogg|webm|m4a)$/i.test(item.path));
    const [state, setState] = useState({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [mediaFailed, setMediaFailed] = useState(false);
    useEffect(() => {
        if (!expanded)
            return;
        let live = true;
        setState({ status: 'loading' });
        setMediaFailed(false);
        void Promise.resolve().then(() => previewFile(item.path)).then(value => {
            if (live)
                setState(value.path === item.path ? { status: 'ready', value } : { status: 'error' });
        }, () => { if (live)
            setState({ status: 'error' }); });
        return () => { live = false; };
    }, [item.path, previewFile, expanded, attempt]);
    const value = state.status === 'ready' ? state.value : undefined;
    let resource;
    if (value?.kind === 'resource') {
        try {
            resource = artifactResourceUrl(value.url);
        }
        catch { /* Recoverable preview error. */ }
    }
    const image = value?.kind === 'binary' && value.mediaType.startsWith('image/') ? `data:${value.mediaType};base64,${value.data}`
        : value?.kind === 'resource' && value.presentation === 'image' ? resource : undefined;
    const html = value?.kind === 'text' && value.mediaType === 'text/html' ? value.text : undefined;
    const title = item.title;
    return _jsxs("article", { className: `${css.card} ${item.presentation === 'interactive' ? css.interactive : ''}`, "data-delivery-path": item.path, children: [_jsxs("header", { className: css.header, children: [_jsxs("button", { className: css.toggle, type: "button", "aria-expanded": inlinePreview ? expanded : undefined, onClick: () => inlinePreview ? setExpanded(!expanded) : openWorkbench(item.path), title: inlinePreview ? title : `在右侧打开 ${title}`, children: [inlinePreview ? expanded ? _jsx(CaretDown, { size: 16 }) : _jsx(CaretRight, { size: 16 }) : _jsx(ArrowUpRight, { size: 16 }), _jsx(FileText, { size: 18 }), _jsx("span", { children: title })] }), _jsx("button", { className: css.open, type: "button", "aria-label": `在右侧展开 ${title}`, onClick: () => openWorkbench(item.path), title: "\u5728\u53F3\u4FA7\u5C55\u5F00", children: _jsx(ArrowUpRight, { size: 18 }) }), downloadFile && _jsx("button", { className: css.open, type: "button", "aria-label": `下载 ${title}`, onClick: () => downloadFile(item.path), title: "\u4E0B\u8F7D\u539F\u6587\u4EF6", children: _jsx(DownloadSimple, { size: 18 }) })] }), expanded && _jsxs("div", { className: css.body, children: [state.status === 'loading' ? _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u9884\u89C8\u2026" })
                        : state.status === 'error' || mediaFailed || (value?.kind === 'resource' && !resource) ? _jsxs("div", { className: css.feedback, role: "status", children: ["\u6682\u65F6\u65E0\u6CD5\u9884\u89C8\u3002", _jsx("button", { type: "button", onClick: () => setAttempt(n => n + 1), children: "\u91CD\u8BD5" })] })
                            : html !== undefined ? _jsx(InteractiveHtml, { source: html, title: `${title} 交互预览`, className: css.frame })
                                : image ? _jsx(ZoomableImage, { className: css.image, src: image, loading: "lazy", alt: title, onError: () => setMediaFailed(true) })
                                    : value?.kind === 'resource' && value.presentation === 'audio' ? _jsx("audio", { className: css.audio, controls: true, preload: "none", "aria-label": title, src: resource, onError: () => setMediaFailed(true) }, attempt)
                                        : value?.kind === 'resource' && value.presentation === 'video' ? _jsx("video", { className: css.video, controls: true, playsInline: true, preload: "none", "aria-label": title, src: resource, onError: () => setMediaFailed(true) }, attempt)
                                            : value?.kind === 'resource' && value.presentation === 'pdf' && resource ? _jsx(PdfPreview, { className: css.frame, title: `${title} PDF 预览`, url: resource }, attempt)
                                                : _jsx("p", { children: "\u5728\u53F3\u4FA7\u67E5\u770B\u5B8C\u6574\u5185\u5BB9\uFF0C\u6216\u4E0B\u8F7D\u539F\u6587\u4EF6\u3002" }), value && _jsxs("p", { className: css.caption, children: [item.path.split('.').at(-1)?.toUpperCase(), " \u00B7 ", sizeLabel(value.bytes), html !== undefined ? ' · 可交互，外部网络已隔离' : ''] })] })] });
}
export function FinalDeliverables({ items, openWorkbench, previewFile, downloadFile }) {
    const [limit, setLimit] = useState(6);
    return _jsxs("section", { className: css.deliveries, "aria-label": "\u672C\u8F6E\u4EA4\u4ED8", children: [items.slice(0, limit).map(item => _jsx(Delivery, { item: item, openWorkbench: openWorkbench, previewFile: previewFile, downloadFile: downloadFile }, item.path)), items.length > limit && _jsxs("button", { type: "button", className: css.more, onClick: () => setLimit(n => n + 6), children: ["\u663E\u793A\u66F4\u591A\u6587\u4EF6\uFF08\u8FD8\u6709 ", items.length - limit, " \u4E2A\uFF09"] })] });
}
//# sourceMappingURL=FinalDeliverables.js.map