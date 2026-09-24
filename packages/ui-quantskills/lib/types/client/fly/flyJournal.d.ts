export type JournalEntry = {
    seq: number;
    at: number;
    actor: string;
    kind: string;
    decision_id: string;
    payload: Record<string, any>;
    merged_count?: number;
};
export declare function collapseNeuralWaits(events: JournalEntry[]): JournalEntry[];
//# sourceMappingURL=flyJournal.d.ts.map