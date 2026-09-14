/** Cross-plugin panel-action face (ctx.layout). */
export class LayoutController {
    #panels;
    #sidebarReservations = new Map();
    #sidebarClaim;
    #detailsReservations = new Map();
    #detailsClaim;
    #conversationTextScaleClaim;
    /**
     * Adopt the root entry's bound store actions. Called from the root
     * registration's inject hook (a sanctioned assembly side effect), so the
     * face is live from the entry's first render; on entry re-register the
     * fresh actions overwrite the stale set.
     * @param actions - bound actions of the entry's layout store instance.
     */
    attachPanels(actions) {
        this.#panels = actions;
        this.#syncSidebarReservation();
        this.#syncDetailsReservation();
        this.#syncConversationTextScale();
    }
    /** Toggle the sidebar panel (closed ⟷ contract default width). */
    toggleSidebar() {
        const claim = this.#sidebarClaim;
        if (claim !== undefined) {
            this.#sidebarClaim = undefined;
            this.#syncSidebarReservation();
            claim.onDisplaced();
        }
        this.#require().toggleSidebar();
    }
    /** Reserve a transient minimum sidebar width until the returned disposer runs. */
    reserveSidebar(minimum) {
        const id = Symbol('layout-sidebar-reservation');
        this.#sidebarReservations.set(id, Math.max(0, Math.round(minimum)));
        this.#syncSidebarReservation();
        let active = true;
        return () => {
            if (!active)
                return;
            active = false;
            this.#sidebarReservations.delete(id);
            this.#syncSidebarReservation();
        };
    }
    /** Claim the shell left column for one exclusive application surface. */
    claimSidebar(options) {
        if (this.#sidebarClaim !== undefined) {
            throw new Error('layout: the sidebar column already has an exclusive claim');
        }
        const id = Symbol('layout-sidebar-claim');
        this.#sidebarClaim = {
            id,
            width: Math.max(0, Math.round(options.width)),
            dragging: false,
            onDisplaced: options.onDisplaced,
        };
        this.#syncSidebarReservation();
        let active = true;
        const release = () => {
            if (!active)
                return;
            active = false;
            if (this.#sidebarClaim?.id !== id)
                return;
            this.#sidebarClaim = undefined;
            this.#syncSidebarReservation();
        };
        return {
            update: (width) => {
                if (!active || this.#sidebarClaim?.id !== id)
                    return;
                this.#sidebarClaim.width = Math.max(0, Math.round(width));
                this.#syncSidebarReservation();
            },
            setDragging: (dragging) => {
                if (!active || this.#sidebarClaim?.id !== id)
                    return;
                this.#sidebarClaim.dragging = dragging;
                this.#syncSidebarReservation();
            },
            release,
        };
    }
    /** Reserve a transient minimum details width until the returned disposer runs. */
    reserveDetails(minimum) {
        const id = Symbol('layout-details-reservation');
        this.#detailsReservations.set(id, Math.max(0, Math.round(minimum)));
        this.#syncDetailsReservation();
        let active = true;
        return () => {
            if (!active)
                return;
            active = false;
            this.#detailsReservations.delete(id);
            this.#syncDetailsReservation();
        };
    }
    /** Claim the shell right column for one exclusive workbench. */
    claimDetails(options) {
        if (this.#detailsClaim !== undefined) {
            throw new Error('layout: the details column already has an exclusive claim');
        }
        const id = Symbol('layout-details-claim');
        this.#detailsClaim = {
            id,
            width: Math.max(0, Math.round(options.width)),
            dragging: false,
            onDisplaced: options.onDisplaced,
        };
        this.#syncDetailsReservation();
        let active = true;
        const release = () => {
            if (!active)
                return;
            active = false;
            if (this.#detailsClaim?.id !== id)
                return;
            this.#detailsClaim = undefined;
            this.#syncDetailsReservation();
        };
        return {
            update: (width) => {
                if (!active || this.#detailsClaim?.id !== id)
                    return;
                this.#detailsClaim.width = Math.max(0, Math.round(width));
                this.#syncDetailsReservation();
            },
            setDragging: (dragging) => {
                if (!active || this.#detailsClaim?.id !== id)
                    return;
                this.#detailsClaim.dragging = dragging;
                this.#syncDetailsReservation();
            },
            release,
        };
    }
    /** Claim the stock conversation transcript text scale for one application surface. */
    claimConversationTextScale(scale) {
        if (this.#conversationTextScaleClaim !== undefined) {
            throw new Error('layout: the conversation text scale already has an exclusive claim');
        }
        const id = Symbol('layout-conversation-text-scale-claim');
        this.#conversationTextScaleClaim = { id, scale };
        this.#syncConversationTextScale();
        let active = true;
        return {
            update: (nextScale) => {
                if (!active || this.#conversationTextScaleClaim?.id !== id)
                    return;
                this.#conversationTextScaleClaim.scale = nextScale;
                this.#syncConversationTextScale();
            },
            release: () => {
                if (!active)
                    return;
                active = false;
                if (this.#conversationTextScaleClaim?.id !== id)
                    return;
                this.#conversationTextScaleClaim = undefined;
                this.#syncConversationTextScale();
            },
        };
    }
    /** Open the details panel (no-op when already open). */
    openDetails() {
        const claim = this.#detailsClaim;
        if (claim !== undefined) {
            this.#detailsClaim = undefined;
            this.#syncDetailsReservation();
            claim.onDisplaced();
        }
        this.#require().openDetails();
    }
    /** Close the details panel. */
    closeDetails() {
        this.#require().closeDetails();
    }
    #syncSidebarReservation() {
        if (this.#panels === undefined)
            return;
        const claim = this.#sidebarClaim;
        this.#panels.setSidebarReservation(claim?.width ?? Math.max(0, ...this.#sidebarReservations.values()));
        this.#panels.setSidebarClaimState(claim !== undefined, claim?.dragging ?? false);
    }
    #syncDetailsReservation() {
        if (this.#panels === undefined)
            return;
        const claim = this.#detailsClaim;
        this.#panels.setDetailsReservation(claim?.width ?? Math.max(0, ...this.#detailsReservations.values()));
        this.#panels.setDetailsClaimState(claim !== undefined, claim?.dragging ?? false);
    }
    #syncConversationTextScale() {
        if (this.#panels === undefined)
            return;
        this.#panels.setConversationTextScale(this.#conversationTextScaleClaim?.scale ?? 1);
    }
    #require() {
        // Callers are UI gestures, which cannot fire before the root entry
        // rendered (the inject hook runs in its first render) — reaching this
        // unwired is a boot-order bug, not a race to tolerate.
        if (this.#panels === undefined)
            throw new Error('layout: panel actions not wired (root entry not mounted)');
        return this.#panels;
    }
}
//# sourceMappingURL=service.js.map