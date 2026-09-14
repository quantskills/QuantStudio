/** Strict replay fold for Agent Teams log-only events. */
import { SessionId } from '@deepseek-ai/dsh-session';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { TeamId, TeamMemberSnapshot, TeamMessageId, TeamMessageSnapshot, TeamTaskId, TeamTaskSnapshot } from './types.ts';
/** Mutable internal replay state. */
export interface TeamFoldState {
    readonly id: TeamId;
    readonly members: Map<SessionId, TeamMemberSnapshot>;
    readonly memberIdsByName: Map<string, SessionId>;
    readonly tasks: Map<TeamTaskId, TeamTaskSnapshot>;
    readonly messages: Map<TeamMessageId, TeamMessageSnapshot>;
    readonly delivered: Set<TeamMessageId>;
    nextTaskNumber: number;
}
/**
 * Construct an empty Team fold for one root Session.
 * @param rootId - Session whose TeamId selects applicable records.
 * @returns mutable empty replay state.
 */
export declare function emptyTeamFoldState(rootId: SessionId): TeamFoldState;
/** Whether one event belongs to the Team domain. */
export type TeamEventType = 'team/member' | 'team/task' | 'team/message/queued' | 'team/message/delivered';
/** One event owned by the Team domain. */
export type TeamSessionEvent = SessionEvent<TeamEventType>;
/**
 * Test whether a Session event belongs to the Team domain.
 * @param event - candidate Session event.
 * @returns whether the event has a Team-owned type.
 */
export declare function isTeamEvent(event: SessionEvent): event is TeamSessionEvent;
/**
 * Apply one event, ignoring Team records inherited by a different root fork.
 * @param state - mutable Team replay state.
 * @param event - next contiguous Session event.
 */
export declare function applyTeamEvent(state: TeamFoldState, event: SessionEvent): void;
/**
 * Replay one root Session into its current Team state.
 * @param rootId - root Session identity selecting Team-owned records.
 * @param events - complete contiguous Session log.
 * @returns mutable replay state at the end of the log.
 */
export declare function foldTeam(rootId: SessionId, events: readonly SessionEvent[]): TeamFoldState;
//# sourceMappingURL=fold.d.ts.map