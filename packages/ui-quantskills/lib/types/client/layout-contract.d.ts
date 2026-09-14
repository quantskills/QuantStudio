/** QuantSkills-owned sidebar claim used by the native plugin overlay. */
export interface SidebarColumnClaim {
    /** Update the requested sidebar width. */
    update(width: number): void;
    /** Notify the layout that a pointer or keyboard resize is active. */
    setDragging(dragging: boolean): void;
    /** Release the exclusive sidebar claim. */
    release(): void;
}
/** Options for an exclusive QuantSkills sidebar claim. */
export interface SidebarColumnClaimOptions {
    readonly width: number;
    readonly exclusive: true;
    readonly onDisplaced: () => void;
}
/** QuantSkills-owned details claim used by the result workbench. */
export interface DetailsColumnClaim {
    /** Update the requested details width. */
    update(width: number): void;
    /** Disable width animation while a resize is active. */
    setDragging(dragging: boolean): void;
    /** Release the exclusive details claim. */
    release(): void;
}
/** Options for an exclusive QuantSkills details claim. */
export interface DetailsColumnClaimOptions {
    readonly width: number;
    readonly exclusive: true;
    readonly onDisplaced: () => void;
}
/** Exclusive text-scale claim for the QuantSkills conversation surface. */
export interface ConversationTextScaleClaim {
    /** Update the conversation scale. */
    update(scale: number): void;
    /** Restore the default scale. */
    release(): void;
}
//# sourceMappingURL=layout-contract.d.ts.map