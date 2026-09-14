/** OS-backed PandaData credential persistence kept private to the connector. */
import type { NormalizedPandaAccount } from './account.ts';
declare const STORED_CREDENTIAL_SCHEMA_VERSION = 1;
/** Credential replay material retained only in an OS credential store or Host memory. */
export interface PandaStoredCredential {
    readonly schemaVersion: typeof STORED_CREDENTIAL_SCHEMA_VERSION;
    readonly account: NormalizedPandaAccount;
    readonly password: string;
}
/** Connector-private persistence adapter. */
export interface PandaCredentialVault {
    /** Return whether the native OS credential store can be reached. */
    status(): Promise<'available' | 'unavailable'>;
    /** Read the stored credential, if one exists. */
    read(): Promise<PandaStoredCredential | undefined>;
    /** Replace the stored credential atomically according to the OS provider. */
    write(value: PandaStoredCredential): Promise<void>;
    /** Delete the stored credential. */
    delete(): Promise<void>;
}
interface KeyringEntry {
    getPassword(signal?: AbortSignal): Promise<string | undefined>;
    setPassword(password: string, signal?: AbortSignal): Promise<void>;
    deletePassword(signal?: AbortSignal): Promise<unknown>;
}
interface KeyringModule {
    readonly AsyncEntry: new (service: string, username: string) => KeyringEntry;
}
type KeyringLoader = () => Promise<KeyringModule>;
/** Fixed failure that never includes native keyring diagnostics or credential material. */
export declare class PandaCredentialVaultUnavailableError extends Error {
    constructor();
}
/** Native OS keyring implementation loaded lazily so unsupported hosts can use memory-only login. */
export declare class PandaOsCredentialVault implements PandaCredentialVault {
    private readonly loadKeyring;
    private entryPromise;
    /**
     * @param loadKeyring - lazy native-module loader; replaceable in isolated tests.
     */
    constructor(loadKeyring?: KeyringLoader);
    /** @returns whether an OS keyring read succeeds. */
    status(): Promise<'available' | 'unavailable'>;
    /** @returns the validated stored credential or `undefined`. */
    read(): Promise<PandaStoredCredential | undefined>;
    /** @param value - normalized account and write-only password. */
    write(value: PandaStoredCredential): Promise<void>;
    /** Delete the underlying OS credential. */
    delete(): Promise<void>;
    private entry;
}
/**
 * Create the connector-owned lazy native credential vault.
 * @returns the connector's lazy native credential vault.
 */
export declare function createPandaCredentialVault(): PandaCredentialVault;
export {};
//# sourceMappingURL=credential-vault.d.ts.map