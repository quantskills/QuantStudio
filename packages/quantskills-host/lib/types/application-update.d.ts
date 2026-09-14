/** Managed QuantSkills application candidate preparation and durable update state. */
import type { QuantSkillsApplicationUpdateSource, QuantSkillsApplicationUpdateStartResult, QuantSkillsApplicationUpdateStatus } from './types.ts';
/** Canonical package identity retained in every application manifest. */
export declare const OFFICIAL_APPLICATION_REPOSITORY = "https://github.com/quantskills/QuantStudio.git";
/** User-selectable official mirrors for release discovery and candidate download. */
export declare const OFFICIAL_APPLICATION_REPOSITORIES: Readonly<Record<QuantSkillsApplicationUpdateSource, string>>;
/** Branch admitted by the application updater. */
export declare const OFFICIAL_APPLICATION_BRANCH = "main";
/** Internal switch used by isolated candidate smoke tests. */
export declare const DISABLE_APPLICATION_UPDATE_ENV = "QUANTSKILLS_DISABLE_APPLICATION_UPDATE";
/** Durable fields shared with the stable bootstrap launcher. */
export interface QuantSkillsApplicationState {
    readonly schemaVersion: 1;
    readonly active?: string;
    readonly pending?: string;
    readonly previous?: string;
    readonly failedCandidates: readonly {
        readonly commit: string;
        readonly failedAt: number;
        readonly errorCode: string;
    }[];
}
/** Controlled command execution supplied by the Host subprocess capability. */
export interface QuantSkillsApplicationUpdateCommands {
    /**
     * Run Git with prompts and non-HTTPS transports disabled.
     * @param args - fixed updater-selected Git arguments.
     * @param cwd - validated working directory.
     * @param signal - updater lifetime cancellation.
     * @returns complete stdout.
     */
    runGit(args: readonly string[], cwd: string, signal: AbortSignal): Promise<string>;
    /**
     * Run the pinned package manager without an interactive terminal.
     * @param args - fixed updater-selected pnpm arguments.
     * @param cwd - validated candidate directory.
     * @param signal - updater lifetime cancellation.
     * @param environment - explicit validation-only environment values.
     */
    runPnpm(args: readonly string[], cwd: string, signal: AbortSignal, environment?: Readonly<Record<string, string>>): Promise<void>;
}
/** Construction values owned by the Host composition. */
export interface QuantSkillsApplicationUpdaterOptions {
    readonly applicationRoot: string;
    readonly repositoryRoot: string;
    readonly commands: QuantSkillsApplicationUpdateCommands;
    readonly now?: () => number;
}
/**
 * Prepare immutable official candidates without mutating the running checkout.
 * The stable launcher is the only component that activates or rolls back a candidate.
 */
export declare class QuantSkillsApplicationUpdater {
    private readonly root;
    private readonly versions;
    private readonly staging;
    private readonly statePath;
    private readonly repositoryRoot;
    private readonly commands;
    private readonly now;
    private readonly lifetime;
    private state;
    private status;
    private task;
    /**
     * @param options - managed paths, current source path, and Host command adapter.
     */
    constructor(options: QuantSkillsApplicationUpdaterOptions);
    /** Prepare private managed directories and recover readable durable state. */
    initialize(): Promise<void>;
    /** @returns current in-memory state without filesystem or network I/O. */
    getStatus(): QuantSkillsApplicationUpdateStatus;
    private releaseNotes;
    /**
     * Start a user-requested official version check without downloading a candidate.
     * @param source - official Git service selected by the user.
     * @returns immediate started-or-reused acknowledgement.
     */
    check(source: QuantSkillsApplicationUpdateSource): QuantSkillsApplicationUpdateStartResult;
    /** Prepare the version found by the latest completed user check. */
    start(): QuantSkillsApplicationUpdateStartResult;
    /** Abort preparation and wait for its command tree to settle. */
    dispose(): Promise<void>;
    private checkForUpdate;
    private inspectSource;
    private readLatestOfficialRelease;
    private readReleaseNotes;
    private readOfficialReleases;
    private readCurrentVersion;
    private prepareCandidate;
    private validateCandidate;
    private recordFailure;
}
//# sourceMappingURL=application-update.d.ts.map