import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { QuantSkillsFrequentSkill, QuantSkillsPlainSessionArchiveItem, QuantSkillsSessionArchiveItem, QuantSkillsSessionCreateRequest, QuantSkillsSessionCreateResult } from './plugin-types.ts';
import type { QuantSkillsSessionsSnapshot } from './types.ts';
/** Typed QuantSkills-bound Session Remote consumed by the browser controller. */
export interface QuantSkillsSessionsPort {
    /** Read ordinary QuantSkills conversations that have no asset composition. */
    plainList: (signal?: AbortSignal) => Promise<readonly QuantSkillsPlainSessionArchiveItem[]>;
    /** Read only Host-verified QuantSkills-bound Session archives. */
    list: (signal?: AbortSignal) => Promise<readonly QuantSkillsSessionArchiveItem[]>;
    /** Read Host-computed Skill usage frequency from the same bound Session set. */
    frequent: (signal?: AbortSignal) => Promise<readonly QuantSkillsFrequentSkill[]>;
    /** Create one new Session and bind its immutable installed Skill version atomically. */
    create: (request: QuantSkillsSessionCreateRequest, signal?: AbortSignal) => Promise<QuantSkillsSessionCreateResult>;
}
/** Observable browser controller over authoritative QuantSkills-bound Session state. */
export declare class QuantSkillsSessionsController {
    private readonly host;
    /** Current Host projection for framework selector hooks. */
    readonly source: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
    private readonly listeners;
    private snapshot;
    private revision;
    /**
     * Create a controller around the typed Host Remote.
     * @param host - Remote adapter returning only verified bound Session projections.
     */
    constructor(host: QuantSkillsSessionsPort);
    /**
     * Refresh archives and usage frequency as one browser projection.
     * @param signal - optional caller cancellation for both Host reads.
     */
    refresh(signal?: AbortSignal): Promise<void>;
    /**
     * Create and bind one Session, then refresh authoritative archive projections.
     * @param request - fresh Session id plus one committed installed Skill version.
     * @param signal - cancellation shared by creation and the following archive refresh.
     * @returns the Host-created bound Session identity and immutable binding.
     */
    create(request: QuantSkillsSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsSessionCreateResult>;
    private publish;
    private listen;
}
//# sourceMappingURL=sessions.d.ts.map