/** Pinned, checksum-verified uv binary provisioning for managed PandaData Python. */
/** Pinned uv download, verification, or extraction failure. */
export declare class ManagedUvError extends Error {
    readonly name = "ManagedUvError";
}
/**
 * Install or reuse the pinned uv binary for this operating system and architecture.
 * @param managerRoot - connector-owned PandaData runtime root.
 * @param signal - download and extraction lifetime.
 * @returns absolute executable path without modifying PATH or shell profiles.
 */
export declare function resolveManagedUv(managerRoot: string, signal: AbortSignal): Promise<string>;
//# sourceMappingURL=managed-uv.d.ts.map