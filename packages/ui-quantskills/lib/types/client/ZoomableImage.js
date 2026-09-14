import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import css from './ZoomableImage.module.css';
const initialView = { scale: 1, x: 0, y: 0, fit: true };
const fitScale = (image, area) => Math.min(1, Math.max(1, area.width - 48) / image.width, Math.max(1, area.height - 48) / image.height);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function constrain(view, image, area) {
    const x = Math.max(0, (image.width * view.scale - area.width) / 2 + 24);
    const y = Math.max(0, (image.height * view.scale - area.height) / 2 + 24);
    return { ...view, x: clamp(view.x, -x, x), y: clamp(view.y, -y, y) };
}
/** Shared by inline deliveries and the workbench; the viewer escapes scaled panels. */
export function ZoomableImage({ alt = '', className, ...props }) {
    const [expanded, setExpanded] = useState(false);
    return _jsxs(_Fragment, { children: [_jsx("img", { ...props, alt: alt, className: `${className ?? ''} ${css.thumbnail}`, tabIndex: 0, "aria-haspopup": "dialog", title: "\u53CC\u51FB\u653E\u5927\u56FE\u7247\uFF1B\u4E5F\u53EF\u6309 Enter \u6253\u5F00", onDoubleClick: event => { event.currentTarget.focus(); setExpanded(true); }, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setExpanded(true);
                } } }), expanded && props.src && createPortal(_jsx(ImageViewer, { src: props.src, title: alt || '图片', onClose: () => setExpanded(false) }), document.body)] });
}
function ImageViewer({ src, title, onClose }) {
    const dialog = useRef(null), stage = useRef(null);
    const titleId = useId(), hintId = useId();
    const [natural, setNatural] = useState({ width: 1, height: 1 });
    const [area, setArea] = useState({ width: 1, height: 1 });
    const [view, setView] = useState(initialView), [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
    const drag = useRef(null);
    const [dragging, setDragging] = useState(false);
    useEffect(() => {
        const element = dialog.current, trigger = document.activeElement;
        if (typeof element.showModal === 'function')
            element.showModal();
        else
            element.setAttribute('open', '');
        return () => { element.close?.(); if (trigger instanceof HTMLElement && trigger.isConnected)
            trigger.focus(); };
    }, []);
    useEffect(() => {
        const measure = () => {
            const bounds = stage.current.getBoundingClientRect(), next = { width: bounds.width, height: bounds.height };
            setArea(next);
            setView(current => current.fit ? { ...initialView, scale: fitScale(natural, next) } : constrain(current, natural, next));
        };
        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
        observer?.observe(stage.current);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, [natural]);
    const zoom = useCallback((factor, x = 0, y = 0) => {
        if (!ready)
            return;
        setView(current => {
            const scale = clamp(current.scale * factor, Math.min(.1, fitScale(natural, area)), 16), ratio = scale / current.scale;
            return constrain({ scale, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, fit: false }, natural, area);
        });
    }, [ready, natural, area]);
    const fit = () => setView({ ...initialView, scale: fitScale(natural, area) });
    useEffect(() => {
        const element = stage.current;
        const wheel = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const bounds = element.getBoundingClientRect();
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
            zoom(Math.exp(-clamp(delta, -300, 300) * .0025), event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
        };
        // React delegates wheel listeners passively; bind locally to keep the page still.
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, [zoom]);
    return _jsxs("dialog", { ref: dialog, className: css.viewer, "aria-labelledby": titleId, "aria-describedby": hintId, "aria-modal": "true", onCancel: event => { event.preventDefault(); onClose(); }, onKeyDown: event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
            else if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                zoom(1.25);
            }
            else if (event.key === '-') {
                event.preventDefault();
                zoom(.8);
            }
            else if (event.key === '0') {
                event.preventDefault();
                fit();
            }
        }, children: [_jsxs("header", { className: css.toolbar, children: [_jsx("h2", { id: titleId, children: title }), _jsxs("div", { className: css.controls, children: [_jsx("button", { type: "button", disabled: !ready, "aria-label": "\u7F29\u5C0F\u56FE\u7247", onClick: () => zoom(.8), children: "\u2212" }), _jsxs("output", { "aria-label": "\u56FE\u7247\u7F29\u653E\u6BD4\u4F8B", children: [Math.round(view.scale * 100), "%"] }), _jsx("button", { type: "button", disabled: !ready, "aria-label": "\u653E\u5927\u56FE\u7247", onClick: () => zoom(1.25), children: "\uFF0B" }), _jsx("button", { type: "button", disabled: !ready, onClick: fit, children: "\u9002\u5E94\u7A97\u53E3" }), _jsx("button", { type: "button", disabled: !ready, onClick: () => setView({ ...initialView, fit: false }), children: "\u539F\u59CB\u5C3A\u5BF8" }), _jsx("button", { type: "button", "aria-label": "\u5173\u95ED\u56FE\u7247\u9884\u89C8", onClick: onClose, children: "\u00D7" })] })] }), _jsx("div", { ref: stage, className: css.stage, "data-dragging": dragging || undefined, role: "region", "aria-label": "\u56FE\u7247\u7F29\u653E\u753B\u5E03", onDoubleClick: () => view.fit ? setView({ ...initialView, fit: false }) : fit(), onPointerDown: event => {
                    if (event.button !== 0 || !ready)
                        return;
                    event.preventDefault();
                    stage.current?.focus();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                    setDragging(true);
                }, onPointerMove: event => {
                    const previous = drag.current;
                    if (!previous || previous.id !== event.pointerId)
                        return;
                    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
                    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                    setView(current => constrain({ ...current, x: current.x + dx, y: current.y + dy, fit: false }, natural, area));
                }, onPointerUp: event => { if (drag.current?.id === event.pointerId) {
                    drag.current = null;
                    setDragging(false);
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                } }, onPointerCancel: () => { drag.current = null; setDragging(false); }, onLostPointerCapture: () => { drag.current = null; setDragging(false); }, tabIndex: 0, children: failed ? _jsx("p", { role: "alert", children: "\u56FE\u7247\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u5173\u95ED\u540E\u91CD\u8BD5\u3002" }) : _jsxs(_Fragment, { children: [!ready && _jsx("p", { role: "status", children: "\u6B63\u5728\u52A0\u8F7D\u56FE\u7247\u2026" }), _jsx("img", { src: src, alt: title, draggable: false, className: css.fullImage, "data-ready": ready || undefined, style: { width: natural.width, height: natural.height, transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})` }, onLoad: event => { const image = event.currentTarget; setNatural({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 }); setReady(true); }, onError: () => { setFailed(true); setReady(false); } })] }) }), _jsx("footer", { id: hintId, children: "\u6EDA\u8F6E\u7F29\u653E \u00B7 \u62D6\u52A8\u67E5\u770B \u00B7 \u53CC\u51FB\u5207\u6362\u539F\u56FE / \u9002\u5E94\u7A97\u53E3 \u00B7 Esc \u5173\u95ED" })] });
}
//# sourceMappingURL=ZoomableImage.js.map