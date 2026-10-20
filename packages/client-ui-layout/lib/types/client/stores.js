/**
 * Root-owned frame measurement, panel preferences, and presentation reports.
 * The registration supplies a fresh store and binds its actions to ctx.layout.
 */
import { defineStore } from '@deepseek-ai/dsh-client-store';
import { clampWidth, RIGHTBAR_DEFAULT_RATIO, RIGHTBAR_MAX_RATIO, RIGHTBAR_MIN, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, } from "./columns.js";
/**
 * Create the layout panel store handle. For the sidebar the preference IS the
 * width, so closing it forgets its drag width — reopening restores the contract
 * default. The right panel initializes at 45% of the frame on first opening
 * and keeps that px preference across resizes and close. Drag writes clamp to
 * the current frame's range. Narrow sidebar toggles change only the expansion
 * override; opening the right panel clears that override.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore() {
    const handle = defineStore({
        init: () => ({
            panelInfo: { activePanelId: null },
            layoutInfo: {
                sidebarReservation: 0,
                sidebarExclusive: false,
                sidebarClaimDragging: false,
                detailsReservation: 0,
                detailsExclusive: false,
                detailsClaimDragging: false,
                conversationTextScale: 1,
                sidebar: SIDEBAR_DEFAULT,
                viewportWidth: window.innerWidth,
                narrowExpanded: false,
                rightbar: null,
                rightbarShown: false,
                rightbarTrack: false,
                rightbarFullscreen: false,
                rightbarInstant: false,
            },
        }),
        actions: {
            setSidebarReservation: (d, px) => { d.layoutInfo.sidebarReservation = Math.max(0, Math.round(px)); },
            setDetailsReservation: (d, px) => { d.layoutInfo.detailsReservation = Math.max(0, Math.round(px)); },
            setSidebarClaimState: (d, exclusive, dragging) => { d.layoutInfo.sidebarExclusive = exclusive; d.layoutInfo.sidebarClaimDragging = exclusive && dragging; },
            setDetailsClaimState: (d, exclusive, dragging) => { d.layoutInfo.detailsExclusive = exclusive; d.layoutInfo.detailsClaimDragging = exclusive && dragging; },
            setConversationTextScale: (d, scale) => { d.layoutInfo.conversationTextScale = scale; },
            selectPanel: (d, panelId) => {
                d.panelInfo.activePanelId = panelId;
            },
            retainMainPanels: (d, panelIds) => {
                if (d.panelInfo.activePanelId !== null && !panelIds.includes(d.panelInfo.activePanelId)) {
                    d.panelInfo.activePanelId = null;
                }
            },
            setSidebar: (d, px) => {
                d.layoutInfo.rightbarInstant = false;
                d.layoutInfo.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX);
            },
            // Narrow toggles flip only the override: the width preference survives
            // untouched, so re-widening restores the pre-squeeze layout.
            toggleSidebar: (d) => {
                d.layoutInfo.rightbarInstant = false;
                if (d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE)
                    d.layoutInfo.narrowExpanded = !d.layoutInfo.narrowExpanded;
                else
                    d.layoutInfo.sidebar = d.layoutInfo.sidebar === 0 ? SIDEBAR_DEFAULT : 0;
            },
            // Crossing the breakpoint in either direction drops the override: the
            // narrow default is auto-collapsed, the wide state is the preference.
            setViewportWidth: (d, width) => {
                if (d.layoutInfo.viewportWidth === width)
                    return;
                d.layoutInfo.rightbarInstant = false;
                if ((d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE) !== (width < SIDEBAR_AUTO_COLLAPSE)) {
                    d.layoutInfo.narrowExpanded = false;
                }
                d.layoutInfo.viewportWidth = width;
            },
            setRightbar: (d, px) => {
                d.layoutInfo.rightbarInstant = false;
                d.layoutInfo.rightbar = clampWidth(px, RIGHTBAR_MIN, Math.max(RIGHTBAR_MIN, d.layoutInfo.viewportWidth * RIGHTBAR_MAX_RATIO));
            },
            openRightbar: (d, track, fullscreen) => {
                if (!d.layoutInfo.rightbarShown || d.layoutInfo.rightbarTrack !== track || d.layoutInfo.rightbarFullscreen !== fullscreen) {
                    d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen && !fullscreen;
                }
                if (!d.layoutInfo.rightbarShown && d.layoutInfo.viewportWidth < SIDEBAR_AUTO_COLLAPSE)
                    d.layoutInfo.narrowExpanded = false;
                d.layoutInfo.rightbar ??= Math.max(RIGHTBAR_MIN, Math.round(d.layoutInfo.viewportWidth * RIGHTBAR_DEFAULT_RATIO));
                d.layoutInfo.rightbarShown = true;
                d.layoutInfo.rightbarTrack = track;
                d.layoutInfo.rightbarFullscreen = fullscreen;
            },
            closeRightbar: (d) => {
                if (d.layoutInfo.rightbarShown)
                    d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen;
                d.layoutInfo.rightbarShown = false;
                d.layoutInfo.rightbarTrack = false;
                d.layoutInfo.rightbarFullscreen = false;
            },
        },
    });
    return handle;
}
//# sourceMappingURL=stores.js.map