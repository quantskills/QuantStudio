import type { AssistantBlock } from '../contract/snapshot.ts';
/** Explicit final-response protocol; paths are claims until the Host reads them. */
export interface FinalDeliverable {
    readonly path: string;
    readonly title: string;
    readonly presentation: 'card' | 'interactive';
}
/** Only a closing answer may recover an unmarked JSON manifest with the exact delivery schema. */
export declare function projectFinalDeliverables(blocks: readonly AssistantBlock[], streaming?: boolean, options?: {
    allowUnmarked?: boolean;
}): {
    blocks: readonly AssistantBlock[];
    items: readonly FinalDeliverable[];
};
//# sourceMappingURL=final-deliverables.d.ts.map