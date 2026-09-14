import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { PandaConnectorResult, PandaLoginRequest, QuantSkillsCatalogSnapshot as HostCatalogSnapshot, QuantSkillsInstallRequest as HostInstallRequest, QuantSkillsInstalledSnapshot as HostInstalledSnapshot, QuantSkillsInstalledVersion as HostInstalledVersion } from './plugin-types.ts';
import type { PandaAccountKind, PandaConnectionSnapshot, QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsInstalledVersion } from './types.ts';
/** Typed QuantSkills Host Remote face consumed by the browser controller. */
export interface QuantSkillsHostPort {
    /** Fetch the current trusted catalog projection. */
    catalog: (signal?: AbortSignal) => Promise<HostCatalogSnapshot>;
    /** Read only Host-committed immutable installation records. */
    list: (signal?: AbortSignal) => Promise<HostInstalledSnapshot>;
    /** Install one exact catalog-observed asset version. */
    install: (request: HostInstallRequest, signal?: AbortSignal) => Promise<HostInstalledVersion>;
    uninstall?: (assetId: string) => Promise<void>;
}
/** Observable controller for the published catalog and Host-owned installation state. */
export declare class QuantSkillsCatalogController {
    private readonly host;
    /** Current catalog projection for React selector hooks. */
    readonly source: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
    private readonly listeners;
    private snapshot;
    private catalogRevision;
    private installedRevision;
    private catalogOperation;
    private installedOperation;
    private readonly installOperations;
    private disposed;
    /**
     * Create a controller around the trusted Host Remote.
     * @param host - Remote adapter returning validated catalog and committed versions.
     */
    constructor(host: QuantSkillsHostPort);
    /** Refresh catalog and committed installation projections independently. */
    refresh(): Promise<void>;
    /** Remove a capability from future discovery, then reconcile the authoritative library. */
    uninstall(assetId: string): Promise<void>;
    /** Cancel active Host operations and suppress every later publication. */
    dispose(): void;
    /**
     * Install the exact version shown by the current Host catalog, then re-read committed versions.
     * @param asset - current catalog asset selected by the user.
     * @returns Host-committed version, or undefined after a classified failure.
     */
    install(asset: QuantSkillsAsset): Promise<QuantSkillsInstalledVersion | undefined>;
    /** Supersede any older catalog request and publish only this request's result. */
    refreshCatalog(): Promise<void>;
    /**
     * Publish one Host-pushed trusted snapshot and supersede any older catalog read.
     * @param catalog - trusted catalog snapshot fetched and projected by the Host.
     */
    acceptCatalogSnapshot(catalog: HostCatalogSnapshot): void;
    /**
     * Mirror Host event-stream state without changing the trusted catalog projection.
     * @param sync - current Host catalog event-stream status.
     */
    acceptSyncStatus(sync: HostCatalogSnapshot['sync']): void;
    /** Supersede any older installed-version request and publish only this request's result. */
    refreshInstalled(): Promise<void>;
    private publishOperationError;
    private setInstalling;
    private publish;
    private listen;
}
interface CatalogAutoCheckEnvironment {
    addEventListener(type: 'focus', listener: EventListener): void;
    removeEventListener(type: 'focus', listener: EventListener): void;
    setTimeout(handler: () => void, timeout: number): number;
    clearTimeout(handle: number): void;
}
/** Lifecycle-owned timer and focus listener for Host-configured catalog checks. */
export declare class QuantSkillsCatalogAutoChecker {
    private readonly catalog;
    private readonly environment;
    private timer;
    private revision;
    private started;
    private enabled;
    private eventStreamConnected;
    private disposed;
    private readonly focusListener;
    /**
     * Create an automatic checker without starting network activity.
     * @param catalog - cancellable catalog controller.
     * @param environment - browser focus and timer operations.
     */
    constructor(catalog: QuantSkillsCatalogController, environment: CatalogAutoCheckEnvironment);
    /** Start focus observation and schedule the next Host-advertised interval. */
    start(): void;
    /**
     * Apply the durable automatic-check preference at runtime.
     * @param enabled - whether focus and interval checks may issue catalog reads.
     */
    setEnabled(enabled: boolean): void;
    /**
     * Suppress fallback polling while the Host's outbound event stream is healthy.
     * @param connected - whether the Host reports a connected catalog event stream.
     */
    setEventStreamConnected(connected: boolean): void;
    /** Run a fresh check, superseding the pending check and resetting its next interval. */
    checkNow(): Promise<void>;
    /** Remove the focus listener and cancel the pending interval. */
    dispose(): void;
    private clearTimer;
    private scheduleNext;
}
/** Minimal Host Remote face consumed by the Panda controller. */
export interface PandaConnectorPort {
    /** Inspect the Host-owned private SDK and connection state. */
    describe: () => Promise<PandaConnectorResult>;
    /** Discover the latest official SDK release without changing environments. */
    checkForUpdates: () => Promise<PandaConnectorResult>;
    /** Install the latest private SDK after an explicit user action. */
    bootstrap: () => Promise<PandaConnectorResult>;
    /** Activate a verified newer candidate environment. */
    update: () => Promise<PandaConnectorResult>;
    /** Rebuild the active SDK in a fresh environment. */
    repair: () => Promise<PandaConnectorResult>;
    /** Restore the previously verified environment. */
    rollback: () => Promise<PandaConnectorResult>;
    /** Forward one write-only credential request to the Host connector. */
    login: (request: PandaLoginRequest) => Promise<PandaConnectorResult>;
    /** Ask the Host connector to log out when the SDK supports it. */
    logout: () => Promise<PandaConnectorResult>;
}
/** Browser projection of the Host-owned Panda connector lifecycle. */
export declare class PandaConnectionController {
    private readonly connector;
    /** Current Host connector projection for React selector hooks. */
    readonly source: ObservableSnapshot<PandaConnectionSnapshot>;
    private readonly listeners;
    private snapshot;
    private preparation;
    /**
     * Create the controller around the typed Host Remote.
     * @param connector - safe Remote adapter whose results never contain credentials.
     */
    constructor(connector: PandaConnectorPort);
    /** Inspect SDK readiness before offering installation or login actions. */
    describe(): Promise<void>;
    private describeNow;
    /** Read the official release index without changing the active environment. */
    checkForUpdates(): Promise<void>;
    /** Inspect and automatically prepare the private runtime when no SDK is active. */
    prepare(): Promise<void>;
    private prepareOnce;
    /** Install the latest compatible SDK for automatic first-run preparation or explicit retry. */
    bootstrap(): Promise<void>;
    /** Install and activate a compatible newer candidate. */
    update(): Promise<void>;
    /** Rebuild the current release without modifying its active environment. */
    repair(): Promise<void>;
    /** Switch back to the previously verified immutable environment. */
    rollback(): Promise<void>;
    /**
     * Authenticate an explicitly selected account form without inferring identity type.
     * @param kind - user-selected phone, email, or username form.
     * @param countryCode - phone calling code; ignored for email and username forms.
     * @param identifier - national phone number, email, or username according to kind.
     * @param password - write-only password forwarded once and never retained.
     */
    connect(kind: PandaAccountKind, countryCode: string, identifier: string, password: string): Promise<void>;
    /** Request verified logout while preserving connected state when the SDK cannot log out. */
    disconnect(): Promise<void>;
    private invoke;
    private publishResult;
    private publish;
    private withoutFailure;
}
/**
 * Apply durable user-local display names without changing catalog identities or bindings.
 * @param snapshot - Host-backed catalog projection.
 * @param overrides - validated user preference rows.
 * @returns a catalog whose effective titles use the user override first.
 */
export declare function applyAssetDisplayNameOverrides(snapshot: QuantSkillsCatalogSnapshot, overrides: readonly {
    readonly assetId: string;
    readonly displayName: string;
}[]): QuantSkillsCatalogSnapshot;
export {};
//# sourceMappingURL=catalog.d.ts.map