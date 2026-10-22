/** Content-sized model collapse for the composer's two control groups. */
/**
 * Collapse the model text only when the expanded controls cannot share a line.
 * The model seat consumes the row's inherited display variables; wrapping remains
 * available when even the icon cannot fit. Each notification is measured synchronously.
 * @param row - Composer control row with its leading and trailing groups.
 * @returns Disconnect the layout observers and font listener.
 */
export declare function observeControlRow(row: HTMLElement): () => void;
//# sourceMappingURL=control-row-layout.d.ts.map