/** OS-backed PandaData credential persistence kept private to the connector. */

import type { NormalizedPandaAccount } from './account.ts'

const KEYRING_SERVICE = 'DeepSeek Harness QuantSkills PandaData'
const KEYRING_ACCOUNT = 'default'
const STORED_CREDENTIAL_SCHEMA_VERSION = 1

/** Credential replay material retained only in an OS credential store or Host memory. */
export interface PandaStoredCredential {
  readonly schemaVersion: typeof STORED_CREDENTIAL_SCHEMA_VERSION
  readonly account: NormalizedPandaAccount
  readonly password: string
}

/** Connector-private persistence adapter. */
export interface PandaCredentialVault {
  /** Return whether the native OS credential store can be reached. */
  status(): Promise<'available' | 'unavailable'>
  /** Read the stored credential, if one exists. */
  read(): Promise<PandaStoredCredential | undefined>
  /** Replace the stored credential atomically according to the OS provider. */
  write(value: PandaStoredCredential): Promise<void>
  /** Delete the stored credential. */
  delete(): Promise<void>
}

interface KeyringEntry {
  getPassword(signal?: AbortSignal): Promise<string | undefined>
  setPassword(password: string, signal?: AbortSignal): Promise<void>
  deletePassword(signal?: AbortSignal): Promise<unknown>
}

interface KeyringModule {
  readonly AsyncEntry: new (service: string, username: string) => KeyringEntry
}

type KeyringLoader = () => Promise<KeyringModule>

/** Fixed failure that never includes native keyring diagnostics or credential material. */
export class PandaCredentialVaultUnavailableError extends Error {
  constructor() {
    super('The operating-system credential store is unavailable.')
    this.name = 'PandaCredentialVaultUnavailableError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeStoredCredential(raw: string): PandaStoredCredential | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!isRecord(value) || value.schemaVersion !== STORED_CREDENTIAL_SCHEMA_VERSION
    || !isRecord(value.account) || typeof value.account.login !== 'string'
    || value.account.login.length === 0 || value.account.login.length > 320
    || (value.account.kind !== 'phone' && value.account.kind !== 'email' && value.account.kind !== 'username')
    || typeof value.password !== 'string' || value.password.length === 0 || value.password.length > 4096) {
    return undefined
  }
  return {
    schemaVersion: STORED_CREDENTIAL_SCHEMA_VERSION,
    account: { kind: value.account.kind, login: value.account.login },
    password: value.password,
  }
}

/** Native OS keyring implementation loaded lazily so unsupported hosts can use memory-only login. */
export class PandaOsCredentialVault implements PandaCredentialVault {
  private entryPromise: Promise<KeyringEntry> | undefined

  /**
   * @param loadKeyring - lazy native-module loader; replaceable in isolated tests.
   */
  constructor(
    private readonly loadKeyring: KeyringLoader = async () => import('@napi-rs/keyring'),
  ) {}

  /** @returns whether an OS keyring read succeeds. */
  async status(): Promise<'available' | 'unavailable'> {
    try {
      await (await this.entry()).getPassword()
      return 'available'
    } catch {
      return 'unavailable'
    }
  }

  /** @returns the validated stored credential or `undefined`. */
  async read(): Promise<PandaStoredCredential | undefined> {
    let entry: KeyringEntry
    let raw: string | undefined
    try {
      entry = await this.entry()
      raw = await entry.getPassword()
    } catch {
      throw new PandaCredentialVaultUnavailableError()
    }
    if (raw === undefined) return undefined
    const value = decodeStoredCredential(raw)
    if (value !== undefined) return value
    try {
      await entry.deletePassword()
    } catch {
      throw new PandaCredentialVaultUnavailableError()
    }
    return undefined
  }

  /** @param value - normalized account and write-only password. */
  async write(value: PandaStoredCredential): Promise<void> {
    try {
      await (await this.entry()).setPassword(JSON.stringify(value))
    } catch {
      throw new PandaCredentialVaultUnavailableError()
    }
  }

  /** Delete the underlying OS credential. */
  async delete(): Promise<void> {
    try {
      await (await this.entry()).deletePassword()
    } catch {
      throw new PandaCredentialVaultUnavailableError()
    }
  }

  private entry(): Promise<KeyringEntry> {
    this.entryPromise ??= this.loadKeyring().then(module => new module.AsyncEntry(KEYRING_SERVICE, KEYRING_ACCOUNT))
    return this.entryPromise.catch((error: unknown) => {
      this.entryPromise = undefined
      throw error
    })
  }
}

/**
 * Create the connector-owned lazy native credential vault.
 * @returns the connector's lazy native credential vault.
 */
export function createPandaCredentialVault(): PandaCredentialVault {
  return new PandaOsCredentialVault()
}
