/** Complete dependency validation for current Team task snapshots. */
import type { TeamTaskId, TeamTaskSnapshot } from './types.ts';
/** Task dependency relation rejected by the shared graph validator. */
export type TeamTaskGraphViolation = 'missing' | 'duplicate' | 'cycle';
/** Package-private task dependency failure retained for command error mapping. */
export declare class TeamTaskGraphError extends Error {
    readonly violation: TeamTaskGraphViolation;
    /**
     * @param message - concrete invalid dependency relation.
     * @param violation - stable relation category used by Team commands.
     */
    constructor(message: string, violation: TeamTaskGraphViolation);
}
/**
 * Validate the complete active task graph after replacing one candidate snapshot.
 * @param current - current task snapshots before the candidate event.
 * @param candidate - new or next-revision task snapshot.
 * @throws {TeamTaskGraphError} when an active dependency is missing, duplicated, self-referential, or cyclic.
 */
export declare function assertTaskGraphCandidate(current: ReadonlyMap<TeamTaskId, TeamTaskSnapshot>, candidate: TeamTaskSnapshot): void;
//# sourceMappingURL=task-graph.d.ts.map