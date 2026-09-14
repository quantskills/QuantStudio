/** QuantSkills browser application assembled over the existing DSH layout, sessions, and conversation services. */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { QuantSkillsAsset, QuantSkillsAuthoringKind } from './types.ts';
export { createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore, } from './store.ts';
export type { PandaConnectionSnapshot, QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsInstalledVersion, QuantSkillsAgentsSnapshot, QuantSkillsCategory, QuantSkillsPage, QuantSkillsSessionsSnapshot, } from './types.ts';
/** Services required by the QuantSkills application. */
export declare const inject: string[];
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** QuantSkills-owned non-conversation page surface. */
        'quantskills.page': {
            kind: 'single';
            scope: 'root';
        };
        /** Additive result workbench for the currently bound QuantSkills Session. */
        'quantskills.results': {
            kind: 'single';
            scope: 'session';
            owner: {
                mode?: 'rail' | 'expanded';
                maximized?: boolean;
                toggleMaximized?: () => void;
                expand?: () => void;
            };
        };
    }
}
/** Composition selected by the package entry that mounts the shared QuantSkills application. */
export type QuantSkillsApplicationMode = 'standalone' | 'native-plugin';
/** Options for mounting the shared QuantSkills browser application. */
export interface QuantSkillsApplicationOptions {
    /** Standalone owns the root shell; native-plugin contributes to the stock DSH shell. */
    mode: QuantSkillsApplicationMode;
}
/**
 * Mount the shared QuantSkills browser application in one explicit composition.
 * @param ctx - client root context.
 * @param options - standalone shell or additive native DSH plugin composition.
 */
export declare function mountQuantSkillsApplication(ctx: ClientContext, options: QuantSkillsApplicationOptions): void;
/**
 * Mount QuantSkills in the composition selected by the surrounding DSH shell.
 *
 * The stock shell declares `shell.overlay` before feature plugins load. The
 * standalone bundle deliberately disables that owner, so the same client
 * package can preserve the standalone root while the native plugin remains an
 * additive application inside an installed DSH profile.
 *
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
/**
 * Return the neutral visible name of the internal authoring Agent.
 *
 * @param kind - QuantSkills asset kind being authored.
 * @returns The visible name stored on the authoring Agent definition.
 */
export declare function quantSkillsAuthoringAgentName(kind: QuantSkillsAuthoringKind): string;
/**
 * Return the durable role instruction for one QuantSkills authoring Agent.
 * @param kind - QuantSkills asset kind being authored.
 * @returns The role text stored on the internal authoring Agent.
 */
export declare function quantSkillsAuthoringRole(kind: QuantSkillsAuthoringKind): string;
/**
 * Return the first user task for one QuantSkills authoring conversation.
 * @param kind - QuantSkills asset kind being authored.
 * @param initialRequest - Optional home-page requirement used as confirmed starting context.
 * @returns The opening task submitted after Session creation.
 */
export declare function quantSkillsAuthoringOpening(kind: QuantSkillsAuthoringKind, initialRequest?: string): string;
/**
 * Determine whether one catalog asset transitively depends on the standard
 * PandaData capability Skill.
 * @param asset - asset selected for a Skill or Agent launch.
 * @param assets - current trusted catalog snapshot.
 * @returns whether the launch requires Panda authentication preflight.
 */
export declare function quantSkillsAssetRequiresPanda(asset: QuantSkillsAsset, assets: readonly QuantSkillsAsset[]): boolean;
//# sourceMappingURL=index.d.ts.map