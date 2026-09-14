/** Trusted QuantSkills catalog gateway and immutable fixed-commit Host installer. */
import type { QuantSkillsManualSkillSaveRequest } from './types.ts';
import { Context, Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import type { SkillDefinition } from '@deepseek-ai/dsh-skill';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { QuantSkillsAuthoredDraft, QuantSkillsAuthoredDraftPrepareRequest, QuantSkillsAuthoredDraftPublishRequest, QuantSkillsAssetReadme, QuantSkillsAssetReadmeRequest, QuantSkillsCatalogSnapshot, QuantSkillsCatalogSyncStatus, QuantSkillsInstallRequest, QuantSkillsInstalledSnapshot, QuantSkillsInstalledAgentTemplate, QuantSkillsInstalledVersion, QuantSkillsInstalledVersionId, QuantSkillsApplicationUpdateCheckRequest, QuantSkillsApplicationUpdateStartResult, QuantSkillsApplicationUpdateStatus } from './types.ts';
export { QuantSkillsHostError } from './error.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Trusted QuantSkills catalog, immutable installation, and exact-version resolver. */
        quantSkillsHost: QuantSkillsHostGateway;
    }
}
/** Exact installed Skill resolved from Host-owned durable state. */
export interface QuantSkillsResolvedInstalledSkill {
    /** Host-validated immutable installation record. */
    readonly version: QuantSkillsInstalledVersion;
    /** Complete definition loaded from that exact version directory. */
    readonly definition: SkillDefinition;
    /** Optional form metadata parsed independently from the literal Skill instructions. */
    readonly promptForm?: import('./types.ts').QuantSkillsPromptFormResult;
}
/** Loader configuration for trusted catalog I/O and immutable-tree admission. */
export interface Config {
    /** Allow direct loopback browsers without a launch token; remote authentication remains enabled. */
    readonly localBrowserAccess?: boolean;
    /** Harness home override. */
    readonly dshHome?: string;
    /** Official QuantSkills raw catalog URL, on `main` or an exact 40-hex commit. */
    readonly catalogUrl?: string;
    /** Catalog request timeout. */
    readonly catalogTimeoutMs?: number;
    /** Delay advertised to Clients between automatic catalog checks. */
    readonly catalogRefreshMs?: number;
    /** Optional HTTPS SSE relay that announces official catalog publication changes. */
    readonly catalogEventsUrl?: string;
    /** Delay before reconnecting a closed catalog event stream. */
    readonly catalogEventsReconnectMs?: number;
    /** Maximum complete catalog response bytes. */
    readonly maxCatalogBytes?: number;
    /** README request timeout. */
    readonly readmeTimeoutMs?: number;
    /** Maximum complete repository README bytes. */
    readonly maxReadmeBytes?: number;
    /** Maximum catalog asset rows before approval filtering. */
    readonly maxCatalogAssets?: number;
    /** Git executable path or bare executable name. */
    readonly gitCommand?: string;
    /** pnpm executable path or bare executable name used after a successful repository update. */
    readonly pnpmCommand?: string;
    /** Source checkout to compare with and fast-forward from the official plugin repository. */
    readonly repositoryRoot?: string;
    /** Maximum time for the primary GitHub asset fetch before trying the matching Gitee mirror. */
    readonly githubFetchTimeoutMs?: number;
    /** Tree-scoped Git termination grace. */
    readonly gitGraceMs?: number;
    /** Maximum complete stdout or stderr retained from one Git command. */
    readonly maxGitOutputBytes?: number;
    /** Maximum regular files in one installed tree. */
    readonly maxFiles?: number;
    /** Maximum aggregate regular-file bytes in one installed tree. */
    readonly maxTotalBytes?: number;
    /** Maximum bytes in one installed file. */
    readonly maxFileBytes?: number;
    /** Maximum path segment depth in one installed tree. */
    readonly maxDepth?: number;
    /** Maximum UTF-8 bytes in one installed relative path. */
    readonly maxPathBytes?: number;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Host-owned QuantSkills catalog and immutable installer. */
        quantSkillsHost: QuantSkillsHostGateway;
    }
}
/** Remote Host service that owns catalog freshness checks and installed-version truth. */
export declare class QuantSkillsHostGateway extends TypertRemoteService {
    static inject: string[];
    static Config: s<Config>;
    private readonly resolved;
    private readonly configuredHome;
    private roots?;
    private gitPath?;
    private pnpmPath?;
    private applicationUpdater;
    private accepting;
    private readonly lifetime;
    private readonly operations;
    private skillProviderControl;
    private catalogCache;
    private catalogRequestRevision;
    private syncStatus;
    /**
     * @param ctx - Host context carrying the managed subprocess runtime.
     * @param config - catalog, Git, and complete-tree bounds.
     */
    constructor(ctx: Context, config: Config);
    /** Prepare managed roots and resolve Git before the service becomes injectable. */
    protected [Service.init](): AsyncGenerator<() => Promise<void>, void, void>;
    /**
     * Read the approved official catalog without making a validated process cache wait on GitHub.
     * @param signal - optional caller cancellation for the initial or background fetch.
     * @returns a bounded, validated point-in-time snapshot.
     */
    catalog(signal?: AbortSignal): Promise<QuantSkillsCatalogSnapshot>;
    /**
     * Read the current event-driven catalog delivery state.
     * @returns Host-owned connection state for the configured relay.
     */
    catalogSyncStatus(): QuantSkillsCatalogSyncStatus;
    /**
     * List versions with a complete Host publication record.
     * @param signal - optional caller cancellation.
     * @returns immutable installed versions sorted by asset and commit.
     */
    list(signal?: AbortSignal): Promise<QuantSkillsInstalledSnapshot>;
    /** Remove a catalog asset from discovery while retaining immutable versions for existing sessions. */
    uninstallAsset(request: {
        readonly assetId: string;
    }, signal?: AbortSignal): Promise<void>;
    /** @returns the current background application-update state without network I/O. */
    applicationUpdateStatus(): QuantSkillsApplicationUpdateStatus;
    /**
     * Start a user-requested official version check without downloading an update.
     * @param request - explicit Git service selected by the user.
     * @returns immediate started-or-reused acknowledgement.
     */
    applicationUpdateCheck(request: QuantSkillsApplicationUpdateCheckRequest): QuantSkillsApplicationUpdateStartResult;
    /**
     * Prepare the version selected by the user's latest completed check.
     * @returns immediate started-or-reused acknowledgement.
     */
    applicationUpdateStart(): QuantSkillsApplicationUpdateStartResult;
    /**
     * Read the repository's real README at the exact commit shown by the Client.
     * @param request - catalog-bound asset identity and exact observed commit.
     * @param signal - optional caller cancellation propagated to both catalog and README fetches.
     * @returns bounded UTF-8 Markdown from the approved repository version.
     */
    assetReadme(request: QuantSkillsAssetReadmeRequest, signal?: AbortSignal): Promise<QuantSkillsAssetReadme>;
    /**
     * Re-fetch the catalog, enforce the Client's observed snapshot and commit,
     * and atomically publish one validated immutable version.
     * @param request - catalog-bound asset identity and exact observed commit.
     * @param signal - optional caller cancellation propagated to fetch and Git.
     * @returns the Host-committed installation record.
     */
    install(request: QuantSkillsInstallRequest, signal?: AbortSignal): Promise<QuantSkillsInstalledVersion>;
    /**
     * Resolve one exact installed Skill for a session-scoped provider.
     * @param versionId - Host-issued immutable installed-version identity.
     * @param signal - optional caller cancellation.
     * @returns the validated manifest and complete exact-version definition.
     * @throws when the version is absent, stored-only, or corrupt.
     */
    resolveInstalledSkill(versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal): Promise<QuantSkillsResolvedInstalledSkill>;
    /**
     * Resolve the immutable source directory for one exact installed version.
     * This same-process Host method lets trusted consumers authorize legacy files without
     * projecting the Host filesystem path through the remote Agent-template response.
     * @param versionId - Host-issued immutable installed-version identity.
     * @param signal - optional caller cancellation.
     * @returns the validated public manifest and its immutable source directory.
     */
    resolveInstalledResource(versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal): Promise<Readonly<{
        version: QuantSkillsInstalledVersion;
        resourceBase: string;
    }>>;
    /**
     * Match one model-visible resource directory to an exact installed registry Skill.
     * This same-process lookup lets trusted Session consumers validate durable `skill`
     * tool results without exposing the installed-version root through RPC.
     * @param resourceBase - directory rendered by the successful Skill tool result.
     * @param signal - optional caller cancellation.
     * @returns the exact Skill manifest and source directory, or undefined when no installation matches.
     */
    matchInstalledSkillResource(resourceBase: string, signal?: AbortSignal): Promise<Readonly<{
        version: QuantSkillsInstalledVersion;
        resourceBase: string;
    }> | undefined>;
    /**
     * Resolve one exact installed Agent as an editable user-Agent template.
     * @param versionId - Host-issued immutable installed-version identity.
     * @param signal - optional caller cancellation.
     * @returns validated Agent metadata, instructions, and exact dependency identities.
     */
    agentTemplate(versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal): Promise<QuantSkillsInstalledAgentTemplate>;
    /**
     * Validate one Workspace-local authoring draft through the same Git-tree admission used by catalog installs.
     * @param request - draft directory and declaration family.
     * @param signal - optional caller cancellation.
     * @returns content identity and validated declaration metadata without publishing files.
     */
    prepareAuthoredDraft(request: QuantSkillsAuthoredDraftPrepareRequest, signal?: AbortSignal): Promise<QuantSkillsAuthoredDraft>;
    /**
     * Publish one unchanged Workspace-local authoring draft as an immutable local Git version.
     * @param request - prepared draft and expected tree digest.
     * @param signal - optional caller cancellation.
     * @returns committed local installation visible to exact-version resolvers.
     */
    private authoredWrite;
    publishAuthoredDraft(request: QuantSkillsAuthoredDraftPublishRequest, signal?: AbortSignal): Promise<QuantSkillsInstalledVersion>;
    /** Save a manual declaration through the same admission and immutable publication as AI creation. */
    manualSkillRead(versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal): Promise<string>;
    manualSkillSave(request: QuantSkillsManualSkillSaveRequest, signal?: AbortSignal): Promise<QuantSkillsInstalledVersion>;
    private materializeAuthoredDraft;
    private runOperation;
    private fetchCatalog;
    private withSyncStatus;
    private publishSyncStatus;
    private runCatalogEventLoop;
    private consumeCatalogEvents;
    private requireRoots;
    private versionRoot;
    private versionSource;
    private requireGitPath;
    private requirePnpmPath;
    private requireApplicationUpdater;
    private listCommitted;
    private readCommittedManifests;
    private listInstalledSkillLocations;
    private installResolved;
    private readAssetReadme;
    private installCatalogAssetWithDependencies;
    private installCatalogAsset;
    private runGit;
    private runPnpm;
    private assertCompleteGitOutput;
    private verifyCheckout;
    private validateSkillDeclaration;
    private validateAgentDeclaration;
    private installDeclaredAgentDependencies;
    private resolveApprovedSkillDependency;
    private confirmExposure;
    private readActiveManifests;
}
export default QuantSkillsHostGateway;
//# sourceMappingURL=index.d.ts.map