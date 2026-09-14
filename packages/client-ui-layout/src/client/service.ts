/**
 * LayoutController: the cross-plugin panel-action face behind ctx.layout.
 * Panel geometry itself lives in the root entry's layout store (stores.ts);
 * the current-session selection lives with the runtime sessions service, and
 * the per-session active view dissolved into ui-conversation's session store
 * (its only consumer). What remains here is the contract other plugins'
 * apply worlds reach for panel transitions (sidebar toggle from ui-sidebar,
 * temporary sidebar reservation from an application overlay, and details
 * open/close from ui-conversation) — writes stay inside the store's declared
 * action set, delivered as the registration's bound actions.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'

/** The layout store's bound action set (framework-baked, draft params peeled). */
export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

/** Mutable handle for one exclusive owner of the shell's left column. */
export interface SidebarColumnClaim {
  /** Replace the desired left-column width. */
  update(width: number): void
  /** Disable or restore track animation during an owner-managed drag. */
  setDragging(dragging: boolean): void
  /** Release the left column and restore native Sidebar state. */
  release(): void
}

/** Options required to claim the left column. */
export interface SidebarColumnClaimOptions {
  readonly width: number
  readonly exclusive: true
  readonly onDisplaced: () => void
}

/** Mutable handle for one exclusive owner of the shell's right column. */
export interface DetailsColumnClaim {
  /** Replace the desired right-column width. */
  update(width: number): void
  /** Disable or restore track animation during an owner-managed drag. */
  setDragging(dragging: boolean): void
  /** Release the right column and restore native Details state. */
  release(): void
}

/** Options required to claim the right column. */
export interface DetailsColumnClaimOptions {
  readonly width: number
  readonly exclusive: true
  readonly onDisplaced: () => void
}

/** Mutable handle for one transient owner of the stock conversation text scale. */
export interface ConversationTextScaleClaim {
  /** Replace the scale applied to stock conversation transcript text. */
  update(scale: number): void
  /** Release the scale and restore the native value. */
  release(): void
}

/**
 * The outward layout face (`ctx.layout`): the panel transitions other
 * plugins may trigger — and exactly what a test fake must supply. Sidebar
 * reservations compose by maximum width and release through their disposer,
 * and right-side workbench reservations follow the same rule without
 * changing either user drag preference. The
 * attachPanels wiring hook stays on the concrete class (root-entry assembly
 * only).
 */
export interface ILayout {
  /** Toggle the sidebar panel (closed ⟷ contract default width). */
  toggleSidebar(): void
  /**
   * Reserve a minimum left-column width without changing the user's sidebar preference.
   * @param minimum - required rendered width in pixels.
   * @returns an idempotent disposer that releases this reservation.
   */
  reserveSidebar(minimum: number): () => void
  /**
   * Claim the left column for one exclusive application surface.
   * @param options - desired width and displacement callback.
   * @returns a mutable, idempotently releasable claim.
   */
  claimSidebar(options: SidebarColumnClaimOptions): SidebarColumnClaim
  /**
   * Reserve a minimum right-column width without changing the user's details preference.
   * @param minimum - required rendered width in pixels.
   * @returns an idempotent disposer that releases this reservation.
   */
  reserveDetails(minimum: number): () => void
  /**
   * Claim the right column for one exclusive workbench.
   * @param options - desired width and displacement callback.
   * @returns a mutable, idempotently releasable claim.
   */
  claimDetails(options: DetailsColumnClaimOptions): DetailsColumnClaim
  /**
   * Claim the stock conversation transcript text scale until the returned handle releases it.
   * @param scale - multiplier applied only to transcript text.
   * @returns a mutable, idempotently releasable claim.
   */
  claimConversationTextScale(scale: number): ConversationTextScaleClaim
  /** Open the details panel (no-op when already open). */
  openDetails(): void
  /** Close the details panel. */
  closeDetails(): void
}

/** Cross-plugin panel-action face (ctx.layout). */
export class LayoutController implements ILayout {
  #panels: PanelActions | undefined
  readonly #sidebarReservations = new Map<symbol, number>()
  #sidebarClaim: {
    readonly id: symbol
    width: number
    dragging: boolean
    readonly onDisplaced: () => void
  } | undefined
  readonly #detailsReservations = new Map<symbol, number>()
  #detailsClaim: {
    readonly id: symbol
    width: number
    dragging: boolean
    readonly onDisplaced: () => void
  } | undefined
  #conversationTextScaleClaim: { readonly id: symbol; scale: number } | undefined

  /**
   * Adopt the root entry's bound store actions. Called from the root
   * registration's inject hook (a sanctioned assembly side effect), so the
   * face is live from the entry's first render; on entry re-register the
   * fresh actions overwrite the stale set.
   * @param actions - bound actions of the entry's layout store instance.
   */
  attachPanels(actions: PanelActions): void {
    this.#panels = actions
    this.#syncSidebarReservation()
    this.#syncDetailsReservation()
    this.#syncConversationTextScale()
  }

  /** Toggle the sidebar panel (closed ⟷ contract default width). */
  toggleSidebar(): void {
    const claim = this.#sidebarClaim
    if (claim !== undefined) {
      this.#sidebarClaim = undefined
      this.#syncSidebarReservation()
      claim.onDisplaced()
    }
    this.#require().toggleSidebar()
  }

  /** Reserve a transient minimum sidebar width until the returned disposer runs. */
  reserveSidebar(minimum: number): () => void {
    const id = Symbol('layout-sidebar-reservation')
    this.#sidebarReservations.set(id, Math.max(0, Math.round(minimum)))
    this.#syncSidebarReservation()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.#sidebarReservations.delete(id)
      this.#syncSidebarReservation()
    }
  }

  /** Claim the shell left column for one exclusive application surface. */
  claimSidebar(options: SidebarColumnClaimOptions): SidebarColumnClaim {
    if (this.#sidebarClaim !== undefined) {
      throw new Error('layout: the sidebar column already has an exclusive claim')
    }
    const id = Symbol('layout-sidebar-claim')
    this.#sidebarClaim = {
      id,
      width: Math.max(0, Math.round(options.width)),
      dragging: false,
      onDisplaced: options.onDisplaced,
    }
    this.#syncSidebarReservation()
    let active = true
    const release = (): void => {
      if (!active) return
      active = false
      if (this.#sidebarClaim?.id !== id) return
      this.#sidebarClaim = undefined
      this.#syncSidebarReservation()
    }
    return {
      update: (width) => {
        if (!active || this.#sidebarClaim?.id !== id) return
        this.#sidebarClaim.width = Math.max(0, Math.round(width))
        this.#syncSidebarReservation()
      },
      setDragging: (dragging) => {
        if (!active || this.#sidebarClaim?.id !== id) return
        this.#sidebarClaim.dragging = dragging
        this.#syncSidebarReservation()
      },
      release,
    }
  }

  /** Reserve a transient minimum details width until the returned disposer runs. */
  reserveDetails(minimum: number): () => void {
    const id = Symbol('layout-details-reservation')
    this.#detailsReservations.set(id, Math.max(0, Math.round(minimum)))
    this.#syncDetailsReservation()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.#detailsReservations.delete(id)
      this.#syncDetailsReservation()
    }
  }

  /** Claim the shell right column for one exclusive workbench. */
  claimDetails(options: DetailsColumnClaimOptions): DetailsColumnClaim {
    if (this.#detailsClaim !== undefined) {
      throw new Error('layout: the details column already has an exclusive claim')
    }
    const id = Symbol('layout-details-claim')
    this.#detailsClaim = {
      id,
      width: Math.max(0, Math.round(options.width)),
      dragging: false,
      onDisplaced: options.onDisplaced,
    }
    this.#syncDetailsReservation()
    let active = true
    const release = (): void => {
      if (!active) return
      active = false
      if (this.#detailsClaim?.id !== id) return
      this.#detailsClaim = undefined
      this.#syncDetailsReservation()
    }
    return {
      update: (width) => {
        if (!active || this.#detailsClaim?.id !== id) return
        this.#detailsClaim.width = Math.max(0, Math.round(width))
        this.#syncDetailsReservation()
      },
      setDragging: (dragging) => {
        if (!active || this.#detailsClaim?.id !== id) return
        this.#detailsClaim.dragging = dragging
        this.#syncDetailsReservation()
      },
      release,
    }
  }

  /** Claim the stock conversation transcript text scale for one application surface. */
  claimConversationTextScale(scale: number): ConversationTextScaleClaim {
    if (this.#conversationTextScaleClaim !== undefined) {
      throw new Error('layout: the conversation text scale already has an exclusive claim')
    }
    const id = Symbol('layout-conversation-text-scale-claim')
    this.#conversationTextScaleClaim = { id, scale }
    this.#syncConversationTextScale()
    let active = true
    return {
      update: (nextScale) => {
        if (!active || this.#conversationTextScaleClaim?.id !== id) return
        this.#conversationTextScaleClaim.scale = nextScale
        this.#syncConversationTextScale()
      },
      release: () => {
        if (!active) return
        active = false
        if (this.#conversationTextScaleClaim?.id !== id) return
        this.#conversationTextScaleClaim = undefined
        this.#syncConversationTextScale()
      },
    }
  }

  /** Open the details panel (no-op when already open). */
  openDetails(): void {
    const claim = this.#detailsClaim
    if (claim !== undefined) {
      this.#detailsClaim = undefined
      this.#syncDetailsReservation()
      claim.onDisplaced()
    }
    this.#require().openDetails()
  }

  /** Close the details panel. */
  closeDetails(): void {
    this.#require().closeDetails()
  }

  #syncSidebarReservation(): void {
    if (this.#panels === undefined) return
    const claim = this.#sidebarClaim
    this.#panels.setSidebarReservation(claim?.width ?? Math.max(0, ...this.#sidebarReservations.values()))
    this.#panels.setSidebarClaimState(claim !== undefined, claim?.dragging ?? false)
  }

  #syncDetailsReservation(): void {
    if (this.#panels === undefined) return
    const claim = this.#detailsClaim
    this.#panels.setDetailsReservation(claim?.width ?? Math.max(0, ...this.#detailsReservations.values()))
    this.#panels.setDetailsClaimState(claim !== undefined, claim?.dragging ?? false)
  }

  #syncConversationTextScale(): void {
    if (this.#panels === undefined) return
    this.#panels.setConversationTextScale(this.#conversationTextScaleClaim?.scale ?? 1)
  }

  #require(): PanelActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#panels === undefined) throw new Error('layout: panel actions not wired (root entry not mounted)')
    return this.#panels
  }
}
