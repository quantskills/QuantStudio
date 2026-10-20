import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Three-column shell frame, registered into the built-in 'root' slot (the web
 * shell renders only 'root'). Owns the grid tracks (sidebar | center |
 * rightbar), the drag handles (pointer capture + rAF throttle), the column
 * solve (columns.ts), and the child-slot render decisions: the sidebar slot
 * receives live parameters from that solve. The root-scoped main slot selects
 * the Conversation or a global panel. Each column occupant owns its Session
 * binding and reports the geometry it needs.
 *
 * The right column is a track, not a box: its occupant draws its panel anchored
 * to the frame's right edge at the resolved normal width, and the
 * track only decides whether the centre makes room for it. The occupant reports
 * shown/track/fullscreen through `ctx.layout`; fullscreen keeps the reported
 * track but hides the outer resize handle. Everything arrives through the framework
 * shares — zero cordis or framework imports, zero self-made hooks.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyColumnClaims, computeColumns, CENTER_MIN, RIGHTBAR_DEFAULT_RATIO, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT } from "./columns.js";
import { DocumentTitle } from "./DocumentTitle.js";
import css from './AppFrame.module.css';
/** Center column grid item (session-body building block). */
function CenterColumn(props) {
    return _jsx("div", { className: css.centerCol, style: {
            '--dsh-conversation-text-scale': props.conversationTextScale,
            '--dsh-conversation-text-base-size': `${String(16 * (props.conversationTextScale ?? 1))}px`,
        }, children: props.children });
}
/** Subscribe to the main key without subscribing the column frame to each panel id. */
function MainPanel({ usePanelInfo, renderSlot }) {
    const panelId = usePanelInfo(info => info.activePanelId);
    return renderSlot('main', {}, { entryKey: panelId ?? 'conversation' });
}
/**
 * Right column grid item. Zero-width unless the occupant asked for a track; the
 * occupant's panel is positioned against the column's right edge, which never
 * moves, so it can hang over the centre when there is no track.
 */
function RightbarColumn(props) {
    return _jsx("div", { className: css.rightbarCol, "data-rightbar-col": true, children: props.children });
}
/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props) {
    const [dragging, setDragging] = useState(false);
    const origin = useRef(0);
    const latest = useRef(0);
    const frame = useRef(null);
    const capture = useRef(null);
    const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd });
    callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd };
    const endDrag = useCallback(() => {
        const active = capture.current;
        if (active === null)
            return;
        capture.current = null;
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
            frame.current = null;
        }
        if (active.element.hasPointerCapture(active.id))
            active.element.releasePointerCapture(active.id);
        setDragging(false);
        callbacks.current.onEnd();
    }, []);
    useEffect(() => endDrag, [endDrag]);
    const onPointerDown = useCallback((e) => {
        if (e.button !== 0 || capture.current !== null)
            return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        capture.current = { element: e.currentTarget, id: e.pointerId };
        origin.current = e.clientX;
        latest.current = e.clientX;
        callbacks.current.onStart();
        setDragging(true);
    }, []);
    const onPointerMove = useCallback((e) => {
        if (capture.current?.id !== e.pointerId)
            return;
        latest.current = e.clientX;
        frame.current ??= requestAnimationFrame(() => {
            frame.current = null;
            callbacks.current.onDrag(latest.current - origin.current);
        });
    }, []);
    const onPointerUp = useCallback((e) => {
        if (capture.current?.id !== e.pointerId)
            return;
        callbacks.current.onDrag(e.clientX - origin.current);
        endDrag();
    }, [endDrag]);
    const onPointerCancel = useCallback((e) => {
        if (capture.current?.id === e.pointerId)
            endDrag();
    }, [endDrag]);
    return (_jsx("div", { className: css.handle, style: { left: props.left }, "data-side": props.side, "data-dragging": dragging || undefined, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerCancel, onLostPointerCapture: onPointerCancel }));
}
/** The three-column frame (see module doc). */
export function AppFrame({ useStore, useSessions, usePanelInfo, actions, renderSlot, t, }) {
    const layoutInfo = useStore(state => state.layoutInfo);
    const frameRef = useRef(null);
    const viewport = layoutInfo.viewportWidth;
    // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
    useLayoutEffect(() => {
        const el = frameRef.current;
        /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
        if (el === null)
            return;
        let raf = null;
        let disposed = false;
        const measure = () => {
            const width = el.getBoundingClientRect().width;
            if (width > 0)
                actions.setViewportWidth(width);
        };
        measure();
        const observer = new ResizeObserver(() => {
            if (disposed)
                return;
            raf ??= requestAnimationFrame(() => {
                raf = null;
                measure();
            });
        });
        observer.observe(el);
        return () => {
            disposed = true;
            observer.disconnect();
            if (raf !== null)
                cancelAnimationFrame(raf);
        };
    }, [actions]);
    const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
    const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0;
    const sidebarPreference = sidebarCollapsed
        ? 0
        : layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : layoutInfo.sidebar;
    const rightbarPreference = layoutInfo.rightbar ?? viewport * RIGHTBAR_DEFAULT_RATIO;
    // Desktop reopen controls occupy the frame's shell.leading seat (macOS) or
    // the Windows caption row; neither platform keeps an icon rail.
    const darwin = document.documentElement.dataset.platform === 'darwin';
    const collapsedWidth = darwin
        || document.documentElement.hasAttribute('data-windows-titlebar') ? 0 : SIDEBAR_COLLAPSED;
    // Opening on a narrow frame collapses the left sidebar. Eligibility must
    // include that space before the occupant's first shown report arrives.
    const normal = computeColumns(viewport, !layoutInfo.rightbarShown && narrow ? 0 : sidebarPreference, rightbarPreference, collapsedWidth);
    const nativeCols = computeColumns(viewport, sidebarPreference, layoutInfo.rightbarTrack ? rightbarPreference : 0, collapsedWidth);
    const cols = applyColumnClaims(viewport, nativeCols, layoutInfo);
    const colsRef = useRef(cols);
    colsRef.current = cols;
    const rightbarWidth = useRef(normal.rightbar);
    rightbarWidth.current = normal.rightbar;
    // The drag base is the rendered width captured at drag start (grabbing a
    // concession-clamped panel must not jump back to the stored preference);
    // it stays frozen for the whole gesture so dx deltas do not compound.
    const sidebarBase = useRef(0);
    const rightbarBase = useRef(0);
    // Track-level transitions pause for the whole gesture: eased tracks would
    // detach the column edge from the pointer (AppFrame.module.css).
    const [dragging, setDragging] = useState(false);
    // Track easing is scoped to a discrete open/close toggle: data-animating
    // goes up when the collapse state or the rightbar track flips and comes down
    // at transition end (timeout as the reduced-motion/covered-frame fallback).
    // Steady-state viewport updates stay instant (AppFrame.module.css), and so
    // does a toggle arriving together with a viewport change — that is the
    // responsive auto-collapse firing mid window-resize, where easing would
    // chase the live window edge. The counter restarts the settle window when a
    // re-toggle interrupts a running transition.
    const [animating, setAnimating] = useState(0);
    const trackToggle = `${sidebarCollapsed}:${layoutInfo.rightbarTrack}`;
    const previousToggle = useRef(trackToggle);
    const previousViewport = useRef(viewport);
    useLayoutEffect(() => {
        const viewportChanged = previousViewport.current !== viewport;
        previousViewport.current = viewport;
        if (previousToggle.current === trackToggle)
            return;
        previousToggle.current = trackToggle;
        if (viewportChanged)
            return;
        setAnimating(token => token + 1);
    }, [trackToggle, viewport]);
    useEffect(() => {
        if (animating === 0)
            return;
        const frame = frameRef.current;
        /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
        if (frame === null)
            return;
        const settle = () => { setAnimating(0); };
        const onTransitionEnd = (event) => {
            if (event.target === frame && event.propertyName === 'grid-template-columns')
                settle();
        };
        frame.addEventListener('transitionend', onTransitionEnd);
        const timer = setTimeout(settle, 600);
        return () => {
            frame.removeEventListener('transitionend', onTransitionEnd);
            clearTimeout(timer);
        };
    }, [animating]);
    const onDragEnd = useCallback(() => { setDragging(false); }, []);
    const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true); }, []);
    const onSidebarDrag = useCallback((dx) => {
        actions.setSidebar(sidebarBase.current + dx);
    }, [actions]);
    const onRightbarStart = useCallback(() => { rightbarBase.current = rightbarWidth.current; setDragging(true); }, []);
    const onRightbarDrag = useCallback((dx) => {
        actions.setRightbar(rightbarBase.current - dx);
    }, [actions]);
    const productTitle = process.env.DSH_CLIENT_TITLE ?? t('brand.localBuild');
    // The rendered template lets the grid solve the squeeze natively: the centre
    // declares its protected minimum and the right column bids up to the clamped
    // preference, so a window resize lands in the same layout pass as the frame
    // edge. The JS solve lags the viewport by a ResizeObserver + rAF frame; when
    // it priced the squeeze itself, the centre column absorbed each width change
    // whole and was corrected two frames later — visible jitter. cols keeps only
    // the discrete decisions (track present, collapse state) and the drag base.
    const rightbarMax = cols.rightbar;
    const sidebar = useMemo(() => renderSlot('sidebar', {
        collapsed: sidebarCollapsed,
        width: cols.sidebar,
    }), [renderSlot, sidebarCollapsed, cols.sidebar]);
    const main = useMemo(() => (_jsx(MainPanel, { usePanelInfo: usePanelInfo, renderSlot: renderSlot })), [usePanelInfo, renderSlot]);
    const overlays = useMemo(() => renderSlot('shell.overlay', {}), [renderSlot]);
    // Window-chrome seat over the main panels' top-left corner: only a fully
    // hidden sidebar column on macOS desktop leaves window chrome without a
    // home — the Windows zero-width collapse keeps its controls in the caption
    // row (ui-sidebar). AppFrame.module.css publishes the matching
    // --dsh-frame-leading-clearance under the same collapsed condition.
    const leading = useMemo(() => renderSlot('shell.leading', {}), [renderSlot]);
    const leadingMounted = darwin && sidebarCollapsed;
    return (_jsxs("div", { ref: frameRef, "data-shell-frame": true, className: css.frame, style: {
            ...(document.documentElement.hasAttribute('data-windows-titlebar')
                ? { '--dsh-windows-sidebar-width': `${cols.sidebar}px` } : {}),
            gridTemplateColumns: `${cols.sidebar}px minmax(${cols.rightbar === 0 ? 0 : CENTER_MIN}px, 1fr) minmax(0px, ${rightbarMax}px)`,
        }, "data-sidebar-collapsed": sidebarCollapsed || undefined, "data-rightbar-collapsed": cols.rightbar === 0 || undefined, "data-rightbar-fullscreen": layoutInfo.rightbarFullscreen || undefined, "data-rightbar-instant": layoutInfo.rightbarInstant || undefined, "data-dragging": dragging || layoutInfo.sidebarClaimDragging || layoutInfo.detailsClaimDragging || undefined, "data-animating": animating > 0 || undefined, children: [_jsx(DocumentTitle, { productTitle: productTitle, useSessions: useSessions, usePanelInfo: usePanelInfo }), _jsx("div", { className: css.sidebarCol, "data-exclusive-hidden": layoutInfo.sidebarExclusive || undefined, ...(layoutInfo.sidebarExclusive ? { inert: '' } : {}), children: sidebar }), _jsxs(_Fragment, { children: [_jsx(CenterColumn, { conversationTextScale: layoutInfo.conversationTextScale, children: main }), _jsx(RightbarColumn, { children: !layoutInfo.detailsExclusive && renderSlot('rightbar', { width: normal.rightbar, viewportWidth: viewport, canShow: normal.rightbar > 0 }) })] }), _jsx("div", { className: css.bottomRow, "data-shell-bottom": true, children: renderSlot('shell.bottom', {}) }), _jsx("div", { className: css.overlayLayer, "data-shell-overlay": true, children: overlays }), leadingMounted && (_jsx("div", { className: css.leadingSeat, "data-shell-leading": true, children: leading })), !sidebarCollapsed && !layoutInfo.sidebarExclusive && _jsx(DragHandle, { side: "sidebar", left: cols.sidebar, onStart: onSidebarStart, onDrag: onSidebarDrag, onEnd: onDragEnd }), !layoutInfo.detailsExclusive && layoutInfo.rightbarShown && !layoutInfo.rightbarFullscreen && normal.rightbar > 0 && (_jsx(DragHandle, { side: "rightbar", left: viewport - normal.rightbar, onStart: onRightbarStart, onDrag: onRightbarDrag, onEnd: onDragEnd }))] }));
}
//# sourceMappingURL=AppFrame.js.map