/** Client-safe PandaData connector payloads. @module @deepseek-ai/dsh-panda-connector/types */
/** Phone identity whose country calling code is distinct from the national number. */
export interface PandaPhoneAccount {
    readonly kind: 'phone';
    /** E.164 country calling code; omitted means `+86`. */
    readonly countryCallingCode?: string;
    /** National number without a country calling code. */
    readonly nationalNumber: string;
}
/** Email identity passed to PandaData unchanged apart from surrounding whitespace. */
export interface PandaEmailAccount {
    readonly kind: 'email';
    readonly email: string;
}
/** Non-phone username passed to PandaData unchanged apart from surrounding whitespace. */
export interface PandaUsernameAccount {
    readonly kind: 'username';
    readonly username: string;
}
/** Explicit PandaData account forms accepted by the connector. */
export type PandaAccount = PandaPhoneAccount | PandaEmailAccount | PandaUsernameAccount;
/** Login request; the password is write-only and never appears in a response or connector state. */
export interface PandaLoginRequest {
    readonly account: PandaAccount;
    readonly password: string;
}
/** Connector lifecycle phase published to clients. */
export type PandaConnectionPhase = 'not-ready' | 'ready' | 'connected';
/** Read-only PandaData API readiness, tracked separately from credential restoration. */
export type PandaDataReadiness = 'unchecked' | 'verified' | 'unavailable';
/** End-to-end PandaData script readiness for the active Host-lifetime environment. */
export type PandaExecutionReadiness = 'unchecked' | 'ready' | 'unavailable';
/** File-effect isolation completeness reported by the selected Host sandbox backend. */
export type PandaExecutionIsolation = 'full' | 'partial';
/** Sandbox backend admitted by the PandaData execution adapter. */
export type PandaExecutionBackend = 'windows-acl' | 'seatbelt' | 'bwrap' | 'landlock';
/** User-visible operation that produced the latest retained connector failure. */
export type PandaConnectorOperation = 'describe' | 'check-for-updates' | 'bootstrap' | 'update' | 'repair' | 'rollback' | 'login' | 'logout' | 'execution-check';
/** Origin of the interpreter that owns the active PandaData environment. */
export type PandaPythonSource = 'configured' | 'uv-managed';
/** Public SDK capabilities verified before an environment can become active. */
export interface PandaSdkCapabilities {
    readonly authentication: boolean;
    readonly marketData: boolean;
    readonly indexData: boolean;
    readonly marginData: boolean;
}
/** Immutable PandaData runtime identity frozen into one Session log. */
export interface PandaRuntimeBinding {
    readonly environmentId: string;
    readonly sdkVersion: string;
    readonly pythonVersion: string;
    readonly apiFingerprint: string;
}
/** Safe connector state with no account, password, token, or SDK exception text. */
export interface PandaConnectionState {
    readonly phase: PandaConnectionPhase;
    /** Storage used for the credential replay material, or the unavailable native-store state. */
    readonly credentialPersistence: 'os-keyring' | 'session-only' | 'unavailable';
    /** Automatic credential replay state. */
    readonly reconnectState: 'idle' | 'reconnecting' | 'reauth-required';
    /** Whether a matrix-owned read-only data request has succeeded for the active environment. */
    readonly dataReadiness: PandaDataReadiness;
    /** Completion time of the latest successful read-only data validation in this Host lifetime. */
    readonly lastDataValidatedAt: number | null;
    /** Whether the active environment completed the credential-injected sandbox execution probe. */
    readonly executionReadiness: PandaExecutionReadiness;
    /** Isolation completeness reported by the backend used for the latest execution probe. */
    readonly executionIsolation: PandaExecutionIsolation | null;
    /** Backend used for the latest execution probe, or `null` before authoritative detection. */
    readonly executionBackend: PandaExecutionBackend | null;
    /** Completion time of the latest execution probe attempt in this Host lifetime. */
    readonly lastExecutionCheckedAt: number | null;
    /** Latest failed connector action, retained across read-only refreshes. */
    readonly lastFailure: PandaConnectorFailureRecord | null;
    readonly requiredSdkVersion: string;
    readonly installedSdkVersion: string | null;
    readonly latestSdkVersion: string | null;
    readonly updateAvailable: boolean;
    readonly rollbackSdkVersion: string | null;
    readonly pythonVersion: string | null;
    readonly pythonSource: PandaPythonSource | null;
    readonly apiFingerprint: string | null;
    readonly capabilities: PandaSdkCapabilities | null;
    readonly lastUpdateCheckedAt: number | null;
    readonly logoutSupported: boolean;
}
/** Closed, user-actionable connector failures. */
export type PandaConnectorFailureCode = 'invalid-request' | 'cancelled' | 'python-unavailable' | 'python-unsupported' | 'sdk-not-ready' | 'sdk-version-mismatch' | 'bootstrap-failed' | 'release-unavailable' | 'update-not-available' | 'update-failed' | 'repair-failed' | 'rollback-unavailable' | 'incompatible-api' | 'login-failed' | 'data-validation-failed' | 'credential-cleanup-failed' | 'network-unavailable' | 'logout-unsupported' | 'logout-failed' | 'execution-unavailable' | 'worker-failed';
/** Safe retained failure metadata; it never includes SDK exception text or credentials. */
export interface PandaConnectorFailureRecord {
    readonly operation: PandaConnectorOperation;
    readonly code: PandaConnectorFailureCode;
    readonly occurredAt: number;
}
/** Successful mutation response. */
export interface PandaConnectorSuccess {
    readonly ok: true;
    readonly state: PandaConnectionState;
}
/** Fixed failure response. It deliberately excludes upstream exception text. */
export interface PandaConnectorFailure {
    readonly ok: false;
    readonly code: PandaConnectorFailureCode;
    readonly message: string;
    readonly state: PandaConnectionState;
}
/** Result of bootstrap, login, or logout. */
export type PandaConnectorResult = PandaConnectorSuccess | PandaConnectorFailure;
//# sourceMappingURL=types.d.ts.map