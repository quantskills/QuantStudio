/** Bridge preserved Team mailboxes into the one official Agent runtime, on explicit continuation only. */
import type { Context } from '@deepseek-ai/cordis';
import type { LegacyTeamRecoveryRequest, LegacyTeamRecoveryResult } from './types.ts';
export type { LegacyTeamRecoveryRequest, LegacyTeamRecoveryResult } from './types.ts';
export declare function recoverLegacyTeam(ctx: Context, directory: string, request: LegacyTeamRecoveryRequest, signal: AbortSignal): Promise<LegacyTeamRecoveryResult>;
//# sourceMappingURL=legacy-team-recovery.d.ts.map