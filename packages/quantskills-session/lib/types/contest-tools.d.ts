/** Only dedicated contest sessions receive these read/preview tools. Execution is a Client action. */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ContestIdentity } from './contest-types.ts';
import type { ContestService } from './contest-service.ts';
export declare function installContestTools(ctx: Context, agent: Agent, contest: ContestService, identity: ContestIdentity): void;
//# sourceMappingURL=contest-tools.d.ts.map