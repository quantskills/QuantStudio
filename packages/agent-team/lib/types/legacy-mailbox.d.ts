/** Offline audit of historical Team outboxes. This module never sends or drops an event. */
export interface LegacyTeamRecord {
    type: string;
    data: unknown;
}
export interface ReceiverEvidence {
    /** True only after the entire receiver log was read and validated. */
    complete: boolean;
    accepted: readonly {
        teamId: string;
        messageId: string;
        senderId: string;
    }[];
}
export interface LegacyDelivery {
    teamId: string;
    messageId: string;
    senderId: string;
    targetId: string;
    status: 'delivered' | 'pending-recovery' | 'needs-confirmation';
    original: unknown;
}
export declare function classifyLegacyMessages(events: readonly LegacyTeamRecord[], receivers: ReadonlyMap<string, ReceiverEvidence>): {
    messages: LegacyDelivery[];
    unknown: LegacyTeamRecord[];
};
//# sourceMappingURL=legacy-mailbox.d.ts.map