import type { PandaConnectionState, QuantSkillsAgentDefinition, QuantSkillsAgentSessionArchiveItem, QuantSkillsLibrarySourceRecord, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsFrequentSkill, QuantSkillsPlainSessionArchiveItem, QuantSkillsSessionArchiveItem } from './plugin-types.ts';
/** QuantSkills application routes owned by the client shell. */
export type QuantSkillsPage = 'database' | 'home' | 'skills' | 'conversations' | 'favorites' | 'agents' | 'teams' | 'settings' | 'parallel' | 'qube' | 'evo' | 'contest';
/** Asset kind supported by the shared QuantSkills AI authoring launcher. */
export type QuantSkillsAuthoringKind = 'skill' | 'agent' | 'agent-team';
/** One category projected from the published QuantSkills catalog taxonomy. */
export interface QuantSkillsCategory {
    readonly id: string;
    readonly label: string;
    readonly subcategories: readonly {
        readonly id: string;
        readonly label: string;
    }[];
}
/** Catalog fields consumed by the browser application. */
export interface QuantSkillsAsset {
    readonly name: string;
    /** Effective title after an optional user override. */
    readonly title: string;
    /** Host-resolved localized title before a user override. */
    readonly catalogTitle: string;
    readonly englishTitle: string;
    readonly aliases: readonly string[];
    readonly nameSource: 'catalog' | 'declaration' | 'generated' | 'asset-id' | 'user';
    readonly summary: string;
    readonly description: string;
    readonly projectType: 'skill' | 'agent';
    readonly category: string;
    readonly subcategory: string;
    readonly commitSha: string;
    readonly declarationFile: 'SKILL.md' | 'AGENTS.md';
    readonly url: string;
    readonly health: string;
    readonly validationLevel: string;
    readonly requires: readonly string[];
}
/** Host-committed immutable asset version safe to expose in the browser. */
export interface QuantSkillsInstalledVersion {
    /** Host provenance; absence is unknown, never inferred as a public installation. */
    readonly origin?: 'catalog' | 'local-authoring';
    readonly versionId: string;
    readonly assetName: string;
    readonly projectType: 'skill' | 'agent';
    readonly commitSha: string;
    readonly declarationFile: 'SKILL.md' | 'AGENTS.md';
    readonly installedAt: number;
    readonly exposure: 'skill-registry' | 'agent-template';
    readonly declarationTitleZh?: string;
}
/** One selectable model route for the Agent builder. */
export interface QuantSkillsAgentModelOption {
    readonly provider: string;
    readonly providerLabel: string;
    readonly model: string;
    readonly modelLabel: string;
    readonly reasoningEfforts: readonly {
        readonly id: string;
        readonly label: string;
    }[];
}
/** Immutable browser catalog state exposed through a framework-bound hook. */
export interface QuantSkillsCatalogSnapshot {
    readonly phase: 'loading' | 'ready' | 'stale' | 'error';
    readonly installedPhase: 'loading' | 'ready' | 'stale' | 'error';
    readonly snapshotId?: string;
    readonly categories: readonly QuantSkillsCategory[];
    readonly assets: readonly QuantSkillsAsset[];
    readonly versionsByAsset: Readonly<Record<string, readonly QuantSkillsInstalledVersion[]>>;
    readonly installing: ReadonlySet<string>;
    readonly sync: {
        readonly mode: 'manual' | 'event-stream';
        readonly state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
        readonly connectedAt?: number;
        readonly eventReceivedAt?: number;
        readonly error?: string;
    };
    readonly refreshAfterMs?: number;
    readonly refreshedAt?: number;
    readonly installedRefreshedAt?: number;
    readonly catalogError?: string;
    readonly installedError?: string;
    readonly operationError?: string;
    readonly operationCode?: string;
}
/** Panda connector state presented by the settings page. */
export interface PandaConnectionSnapshot {
    readonly status: 'checking' | 'not-ready' | 'ready' | 'bootstrapping' | 'updating' | 'repairing' | 'rolling-back' | 'connecting' | 'connected' | 'error';
    readonly credentialPersistence?: 'os-keyring' | 'session-only' | 'unavailable';
    readonly reconnectState?: 'idle' | 'reconnecting' | 'reauth-required';
    /** Read-only data readiness is independent from restored login state. */
    readonly dataReadiness?: PandaConnectionState['dataReadiness'];
    /** Host-lifetime completion time of the latest successful read-only validation. */
    readonly lastDataValidatedAt?: number | null;
    /** Host-lifetime script execution readiness for the active immutable environment. */
    readonly executionReadiness?: PandaConnectionState['executionReadiness'];
    /** Honest confinement level returned by the active platform executor. */
    readonly executionIsolation?: PandaConnectionState['executionIsolation'];
    /** Platform executor that completed the latest successful script probe. */
    readonly executionBackend?: PandaConnectionState['executionBackend'];
    /** Host-lifetime completion time of the latest successful script probe. */
    readonly lastExecutionCheckedAt?: number | null;
    /** Latest failed Host action, retained across read-only status refreshes. */
    readonly lastFailure?: PandaConnectionState['lastFailure'];
    readonly requiredSdkVersion?: string;
    readonly installedSdkVersion?: string | null;
    readonly latestSdkVersion?: string | null;
    readonly updateAvailable: boolean;
    readonly rollbackSdkVersion?: string | null;
    readonly pythonVersion?: string | null;
    readonly pythonSource?: 'configured' | 'uv-managed' | null;
    readonly apiFingerprint?: string | null;
    readonly capabilities?: {
        readonly authentication: boolean;
        readonly marketData: boolean;
        readonly indexData: boolean;
        readonly marginData: boolean;
    } | null;
    readonly lastUpdateCheckedAt?: number | null;
    readonly logoutSupported: boolean;
    readonly failureCode?: string;
    readonly error?: string;
}
/** Explicit account form selected before Panda authentication. */
export type PandaAccountKind = 'phone' | 'email' | 'username';
/** Host-authoritative projection of QuantSkills-bound Session archives and usage frequency. */
export interface QuantSkillsSessionsSnapshot {
    readonly phase: 'loading' | 'ready' | 'stale' | 'error';
    readonly plainArchives: readonly QuantSkillsPlainSessionArchiveItem[];
    readonly archives: readonly QuantSkillsSessionArchiveItem[];
    readonly frequent: readonly QuantSkillsFrequentSkill[];
    readonly refreshedAt?: number;
    readonly error?: string;
}
/** Host-authoritative user Agent definitions and their logged Session archives. */
export interface QuantSkillsAgentsSnapshot {
    readonly librarySources?: readonly QuantSkillsLibrarySourceRecord[];
    readonly definitionsPhase?: 'loading' | 'ready' | 'stale' | 'error';
    readonly teamsPhase?: 'loading' | 'ready' | 'stale' | 'error';
    readonly phase: 'loading' | 'ready' | 'stale' | 'error';
    readonly definitions: readonly QuantSkillsAgentDefinition[];
    readonly archives: readonly QuantSkillsAgentSessionArchiveItem[];
    readonly teams: readonly QuantSkillsAgentTeamDefinition[];
    readonly teamArchives: readonly QuantSkillsAgentTeamSessionArchiveItem[];
    readonly refreshedAt?: number;
    readonly error?: string;
}
//# sourceMappingURL=types.d.ts.map