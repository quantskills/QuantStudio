/** QuantSkills-managed default Workspace path discovery and registration. */
import { type NativeCommandRunner } from '@deepseek-ai/dsh-native-command';
import type { WorkspaceId, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import type { QuantSkillsWorkspaceResolveResult, QuantSkillsWorkspaceStatusResult } from './types.ts';
/** Replaceable host inputs used by managed-path tests. */
export interface QuantSkillsDocumentsResolverOptions {
    readonly platform?: NodeJS.Platform;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly home?: string;
    readonly readTextFile?: (path: string) => Promise<string>;
    readonly runCommand?: NativeCommandRunner;
    readonly signal?: AbortSignal;
}
/**
 * Resolve the user-visible directory that owns the managed QuantSkills Workspace.
 * @param options - testable operating-system and native-command inputs.
 * @returns the absolute managed Workspace path without creating it.
 */
export declare function resolveQuantSkillsManagedPath(options?: QuantSkillsDocumentsResolverOptions): Promise<string>;
/** Host-owned resolver for the optional preferred and managed default Workspace. */
export declare class QuantSkillsWorkspaceResolver {
    private readonly registry;
    private readonly managedPath;
    private readonly platform;
    private readonly ensureDirectory;
    private managedFlight;
    private managedPathFlight;
    /**
     * @param registry - authoritative DSH Workspace registry.
     * @param managedPath - read-only managed path resolver.
     * @param platform - path comparison platform.
     * @param ensureDirectory - managed-directory creator.
     */
    constructor(registry: WorkspaceRegistry, managedPath: () => Promise<string>, platform?: NodeJS.Platform, ensureDirectory?: (path: string) => Promise<void>);
    /**
     * Inspect preferred and managed Workspace state without creating either.
     * @param preferredWorkspaceId - optional user-selected Workspace.
     * @returns current targets and whether the preference needs recovery.
     */
    status(preferredWorkspaceId?: WorkspaceId): Promise<QuantSkillsWorkspaceStatusResult>;
    /**
     * Resolve one explicit Workspace target, creating the managed fallback when required.
     * Concurrent callers share the same directory and registry operation.
     * @param preferredWorkspaceId - optional user-selected Workspace.
     * @returns the selected target and recovery signal for a stale preference.
     */
    resolve(preferredWorkspaceId?: WorkspaceId): Promise<QuantSkillsWorkspaceResolveResult>;
    private resolveManaged;
    private createOrAdoptManaged;
    private readManagedPath;
    private findManaged;
    private availableTitle;
}
//# sourceMappingURL=managed-workspace.d.ts.map