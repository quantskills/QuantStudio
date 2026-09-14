/** QuantSkills-managed default Workspace path discovery and registration. */
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import { runNativeCommand } from '@deepseek-ai/dsh-native-command';
const MANAGED_DIRECTORY_NAME = 'QuantSkills';
const WINDOWS_DOCUMENTS_COMMAND = [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '[Console]::OutputEncoding=[Text.UTF8Encoding]::new();[Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)',
];
function parseXdgDocuments(source, home) {
    const line = source.split(/\r?\n/u).find(candidate => /^\s*XDG_DOCUMENTS_DIR\s*=/u.test(candidate));
    if (line === undefined)
        return undefined;
    const raw = line.slice(line.indexOf('=') + 1).trim();
    const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    const expanded = unquoted.replace(/^\$HOME(?=$|[\\/])/u, home);
    return posix.isAbsolute(expanded) ? posix.normalize(expanded) : undefined;
}
const pathRules = (platform) => platform === 'win32' ? win32 : posix;
/**
 * Resolve the user-visible directory that owns the managed QuantSkills Workspace.
 * @param options - testable operating-system and native-command inputs.
 * @returns the absolute managed Workspace path without creating it.
 */
export async function resolveQuantSkillsManagedPath(options = {}) {
    const platform = options.platform ?? process.platform;
    const paths = pathRules(platform);
    const env = options.env ?? process.env;
    const home = paths.resolve(options.home ?? homedir());
    if (platform === 'win32') {
        const signal = options.signal ?? new AbortController().signal;
        const result = await (options.runCommand ?? runNativeCommand)('powershell.exe', WINDOWS_DOCUMENTS_COMMAND, signal);
        const documents = result.stdout.trim();
        if (documents === '')
            throw new Error('Windows did not resolve the Documents known folder');
        return paths.join(paths.resolve(documents), MANAGED_DIRECTORY_NAME);
    }
    if (platform === 'darwin')
        return paths.join(home, 'Documents', MANAGED_DIRECTORY_NAME);
    const environmentDocuments = env.XDG_DOCUMENTS_DIR?.trim();
    if (environmentDocuments !== undefined && environmentDocuments !== '') {
        const expanded = environmentDocuments.replace(/^\$HOME(?=$|[\\/])/u, home);
        if (!paths.isAbsolute(expanded))
            throw new Error('XDG_DOCUMENTS_DIR must resolve to an absolute path');
        return paths.join(paths.normalize(expanded), MANAGED_DIRECTORY_NAME);
    }
    const configRoot = env.XDG_CONFIG_HOME?.trim() || paths.join(home, '.config');
    const readTextFile = options.readTextFile ?? (path => readFile(path, 'utf8'));
    try {
        const documents = parseXdgDocuments(await readTextFile(paths.join(configRoot, 'user-dirs.dirs')), home);
        if (documents !== undefined)
            return paths.join(documents, MANAGED_DIRECTORY_NAME);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    return paths.join(home, MANAGED_DIRECTORY_NAME);
}
function pathKey(path, platform) {
    const paths = pathRules(platform);
    const value = paths.normalize(paths.resolve(path));
    return platform === 'win32' ? value.toLocaleLowerCase('en-US') : value;
}
function target(workspace) {
    return Object.freeze({ workspaceId: workspace.id, path: workspace.path, title: workspace.title });
}
/** Host-owned resolver for the optional preferred and managed default Workspace. */
export class QuantSkillsWorkspaceResolver {
    registry;
    managedPath;
    platform;
    ensureDirectory;
    managedFlight;
    managedPathFlight;
    /**
     * @param registry - authoritative DSH Workspace registry.
     * @param managedPath - read-only managed path resolver.
     * @param platform - path comparison platform.
     * @param ensureDirectory - managed-directory creator.
     */
    constructor(registry, managedPath, platform = process.platform, ensureDirectory = async (path) => {
        await mkdir(path, { recursive: true });
    }) {
        this.registry = registry;
        this.managedPath = managedPath;
        this.platform = platform;
        this.ensureDirectory = ensureDirectory;
    }
    /**
     * Inspect preferred and managed Workspace state without creating either.
     * @param preferredWorkspaceId - optional user-selected Workspace.
     * @returns current targets and whether the preference needs recovery.
     */
    async status(preferredWorkspaceId) {
        const managedPath = await this.readManagedPath();
        const preferred = preferredWorkspaceId === undefined ? undefined : this.registry.get(preferredWorkspaceId);
        const preferredAvailable = preferred !== undefined && await preferred.status() === 'ok';
        const managedWorkspace = await this.findManaged(managedPath);
        const managedAvailable = managedWorkspace !== undefined && await managedWorkspace.status() === 'ok';
        return Object.freeze({
            managedPath,
            ...(managedAvailable ? { managedWorkspace: target(managedWorkspace) } : {}),
            ...(preferredAvailable ? { preferredWorkspace: target(preferred) } : {}),
            preferredMissing: preferredWorkspaceId !== undefined && !preferredAvailable,
        });
    }
    /**
     * Resolve one explicit Workspace target, creating the managed fallback when required.
     * Concurrent callers share the same directory and registry operation.
     * @param preferredWorkspaceId - optional user-selected Workspace.
     * @returns the selected target and recovery signal for a stale preference.
     */
    async resolve(preferredWorkspaceId) {
        const preferred = preferredWorkspaceId === undefined ? undefined : this.registry.get(preferredWorkspaceId);
        if (preferred !== undefined && await preferred.status() === 'ok') {
            return Object.freeze({ workspace: target(preferred), source: 'preferred' });
        }
        const workspace = await this.resolveManaged();
        return Object.freeze({
            workspace,
            source: 'managed',
            ...(preferredWorkspaceId === undefined ? {} : { recoveredPreferredWorkspaceId: preferredWorkspaceId }),
        });
    }
    resolveManaged() {
        const running = this.managedFlight;
        if (running !== undefined)
            return running;
        const operation = this.createOrAdoptManaged().finally(() => {
            if (this.managedFlight === operation)
                this.managedFlight = undefined;
        });
        this.managedFlight = operation;
        return operation;
    }
    async createOrAdoptManaged() {
        const managedPath = await this.readManagedPath();
        await this.ensureDirectory(managedPath);
        const existing = await this.findManaged(managedPath);
        const workspace = existing ?? await this.registry.create(managedPath, this.availableTitle());
        return target(workspace);
    }
    readManagedPath() {
        const running = this.managedPathFlight;
        if (running !== undefined)
            return running;
        const operation = this.managedPath().catch((error) => {
            if (this.managedPathFlight === operation)
                this.managedPathFlight = undefined;
            throw error;
        });
        this.managedPathFlight = operation;
        return operation;
    }
    async findManaged(managedPath) {
        let comparable = managedPath;
        try {
            comparable = await realpath(managedPath);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        const key = pathKey(comparable, this.platform);
        return this.registry.list().find(workspace => pathKey(workspace.path, this.platform) === key);
    }
    availableTitle() {
        const titles = new Set(this.registry.list().map(workspace => workspace.title));
        if (!titles.has(MANAGED_DIRECTORY_NAME))
            return MANAGED_DIRECTORY_NAME;
        let index = 2;
        while (titles.has(`${MANAGED_DIRECTORY_NAME} (${String(index)})`))
            index += 1;
        return `${MANAGED_DIRECTORY_NAME} (${String(index)})`;
    }
}
//# sourceMappingURL=managed-workspace.js.map