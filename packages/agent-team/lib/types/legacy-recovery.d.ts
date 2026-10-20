import { type LegacyTeamRecord, type LegacyDelivery, type ReceiverEvidence } from './legacy-mailbox.ts';
type Entry = LegacyDelivery & {
    correlation: string;
    attempt?: 'started' | 'verified';
};
export interface LegacyRecoveryJournal {
    version: 1;
    teamId: string;
    inputHash: string;
    messages: Entry[];
    unknown: LegacyTeamRecord[];
}
export interface LegacyRecoveryPort {
    /** Read the full, validated durable receiver log, including its pending inbox. */
    evidence(targetId: string): Promise<ReceiverEvidence>;
    /** Persist a message with the original team/message/sender identities; await receiver flush. */
    deliver(message: LegacyDelivery, correlation: string): Promise<void>;
}
export declare class LegacyTeamRecovery {
    private readonly directory;
    constructor(directory: string);
    /** Read-only inspection also honors a previously interrupted acceptance attempt. */
    audit(teamId: string, events: readonly LegacyTeamRecord[], receivers: ReadonlyMap<string, ReceiverEvidence>): Promise<{
        messages: LegacyDelivery[];
        unknown: LegacyTeamRecord[];
    }>;
    /** Called only by an explicit user continuation, never by Agent construction or replay. */
    continue(teamId: string, events: readonly LegacyTeamRecord[], port: LegacyRecoveryPort, authorization: {
        userContinued: true;
    }): Promise<LegacyRecoveryJournal>;
}
export {};
//# sourceMappingURL=legacy-recovery.d.ts.map