/** QS compatibility import path. The official runtime is the sole agentTeams owner. */
export { default, TeamService, TeamId, TeamTaskId, TeamMessageId, TeamError } from '@deepseek-ai/dsh-experimental-agent-team'
export type * from '@deepseek-ai/dsh-experimental-agent-team'
export { classifyLegacyMessages } from './legacy-mailbox.ts'
export { LegacyTeamRecovery } from './legacy-recovery.ts'
export type { LegacyDelivery, LegacyTeamRecord, ReceiverEvidence } from './legacy-mailbox.ts'
