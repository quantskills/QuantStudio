/** Trusted QuantSkills catalog gateway and immutable fixed-commit Host installer. */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { parseDocument } from 'yaml';
import { constants } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { cp, chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, unlink, } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Service } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { parseCatalogDocument, readCatalogResponse, validateCatalogUrl, } from "./catalog.js";
import { QuantSkillsHostError } from "./error.js";
import { extractChineseDeclarationTitle } from "./display-names.js";
import { validateGitTree } from "./tree.js";
import { parseQuantSkillsSkill, loadQuantSkillsInstalledSkill, matchesQuantSkillsSkillName, QUANTSKILLS_SKILL_PROVIDER, QuantSkillsInstalledSkillProvider, } from "./skill-provider.js";
import { parseQuantSkillsAgent } from "./agent-template.js";
import { parseQuantSkillsPromptForm } from "./prompt-form.js";
import { quantSkillsReadmeUrl, readQuantSkillsReadmeResponse } from "./readme.js";
import { QuantSkillsApplicationUpdater } from "./application-update.js";
import { installLocalBrowserAccess } from "./local-browser-access.js";
export { QuantSkillsHostError } from "./error.js";
const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json';
const QUANTSKILLS_GITEE_ORGANIZATION = 'https://gitee.com/quantskills';
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ASSET_PATTERN = /^(?:skill|agent)-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
function signalAborted(signal) {
    return signal.aborted;
}
const ETAG_PATTERN = /^(?:W\/)?\x22[\x21\x23-\x7e]{0,200}\x22$/;
const MANIFEST_NAME = 'manifest.json';
const MANIFEST_SCHEMA_VERSION = 1;
const MAX_CATALOG_EVENT_BUFFER_BYTES = 64 * 1024;
const manifestSchema = z.object({
    schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
    versionId: z.string(),
    assetId: z.string(),
    kind: z.enum(['skill', 'agent']),
    repository: z.string(),
    commit: z.string(),
    declaration: z.enum(['SKILL.md', 'AGENTS.md']),
    treeDigest: z.string(),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    installedAt: z.number().int().nonnegative(),
    exposure: z.enum(['skill-registry', 'agent-template']),
    origin: z.enum(['catalog', 'local-authoring']).default('catalog'),
});
function validateCatalogEventsUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch (error) {
        throw new TypeError('QuantSkills catalog event URL must be an absolute HTTPS URL.', { cause: error });
    }
    const localDevelopment = parsed.protocol === 'http:'
        && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1');
    if ((parsed.protocol !== 'https:' && !localDevelopment)
        || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
        throw new TypeError('QuantSkills catalog event URL must be HTTPS without credentials or a fragment.');
    }
    return parsed.href;
}
function catalogEtag(response) {
    const etag = response.headers.get('etag');
    return etag !== null && ETAG_PATTERN.test(etag) ? etag : undefined;
}
function installedVersionId(assetId, commit) {
    return `${assetId}@${commit}`;
}
function isExists(error) {
    return error instanceof Error && 'code' in error && (error.code === 'EEXIST' || error.code === 'ENOTEMPTY');
}
function isMissing(error) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
async function ensurePrivateChild(parent, name) {
    const parentReal = await realpath(parent);
    const target = join(parentReal, name);
    try {
        await mkdir(target, { mode: 0o700 });
    }
    catch (error) {
        if (!isExists(error))
            throw error;
    }
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new QuantSkillsHostError('QuantSkills managed directory is not a real directory.', 'INSTALL_WRITE_FAILED');
    }
    await chmod(target, 0o700);
    const canonical = await realpath(target);
    if (dirname(canonical) !== parentReal) {
        throw new QuantSkillsHostError('QuantSkills managed directory escaped its parent.', 'INSTALL_WRITE_FAILED');
    }
    return canonical;
}
async function prepareRoots(configuredHome) {
    const selected = resolveDshHome(configuredHome);
    await mkdir(selected, { recursive: true, mode: 0o700 });
    const home = await realpath(selected);
    const root = await ensurePrivateChild(home, 'quantskills');
    const versions = await ensurePrivateChild(root, 'versions');
    const authored = await ensurePrivateChild(root, 'authored');
    const staging = await ensurePrivateChild(root, 'staging');
    return { home, root, versions, authored, staging };
}
async function removeOwnedPath(path, parent) {
    const target = resolve(path);
    const owner = resolve(parent);
    const rel = relative(owner, target);
    if (rel === '' || rel.startsWith('..') || resolve(owner, rel) !== target) {
        throw new QuantSkillsHostError('Refused to remove a path outside the owned staging directory.', 'INSTALL_WRITE_FAILED');
    }
    let info;
    try {
        info = await lstat(target);
    }
    catch (error) {
        if (isMissing(error))
            return;
        throw error;
    }
    if (info.isSymbolicLink())
        await unlink(target);
    else if (info.isDirectory())
        await rm(target, { recursive: true });
    else
        await unlink(target);
}
async function writeManifest(path, manifest) {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
        await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
function parseManifest(value) {
    const parsed = manifestSchema.safeParse(value);
    if (!parsed.success || !ASSET_PATTERN.test(parsed.data.assetId) || !SHA_PATTERN.test(parsed.data.commit)
        || parsed.data.versionId !== `${parsed.data.assetId}@${parsed.data.commit}`
        || parsed.data.repository !== (parsed.data.origin === 'catalog'
            ? `https://github.com/quantskills/${parsed.data.assetId}`
            : `local-authoring:${parsed.data.assetId}`)
        || parsed.data.declaration !== (parsed.data.kind === 'skill' ? 'SKILL.md' : 'AGENTS.md')
        || parsed.data.exposure !== (parsed.data.kind === 'skill' ? 'skill-registry' : 'agent-template')
        || !/^sha256:[a-f0-9]{64}$/.test(parsed.data.treeDigest)) {
        throw new QuantSkillsHostError('QuantSkills installation manifest is corrupt.', 'INSTALL_RECORD_CORRUPT');
    }
    return Object.freeze({
        ...parsed.data,
        versionId: parsed.data.versionId,
        assetId: parsed.data.assetId,
        commit: parsed.data.commit,
        treeDigest: parsed.data.treeDigest,
    });
}
async function readManifest(versionRoot) {
    const path = join(versionRoot, MANIFEST_NAME);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 64 * 1024) {
        throw new QuantSkillsHostError('QuantSkills installation manifest is corrupt.', 'INSTALL_RECORD_CORRUPT');
    }
    let value;
    try {
        value = JSON.parse(await readFile(path, 'utf8'));
    }
    catch (error) {
        throw new QuantSkillsHostError('QuantSkills installation manifest is corrupt.', 'INSTALL_RECORD_CORRUPT', { cause: error });
    }
    return parseManifest(value);
}
function publicManifest(manifest) {
    const { schemaVersion: _schemaVersion, ...version } = manifest;
    return Object.freeze(version);
}
/** Remote Host service that owns catalog freshness checks and installed-version truth. */
let QuantSkillsHostGateway = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _catalog_decorators;
    let _catalogSyncStatus_decorators;
    let _list_decorators;
    let _uninstallAsset_decorators;
    let _applicationUpdateStatus_decorators;
    let _applicationUpdateCheck_decorators;
    let _applicationUpdateStart_decorators;
    let _assetReadme_decorators;
    let _install_decorators;
    let _agentTemplate_decorators;
    let _manualSkillRead_decorators;
    let _manualSkillSave_decorators;
    return class QuantSkillsHostGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _catalog_decorators = [Remote('catalog')];
            _catalogSyncStatus_decorators = [Remote('catalogSyncStatus')];
            _list_decorators = [Remote('list')];
            _uninstallAsset_decorators = [Remote('uninstallAsset')];
            _applicationUpdateStatus_decorators = [Remote('applicationUpdateStatus')];
            _applicationUpdateCheck_decorators = [Remote('applicationUpdateCheck')];
            _applicationUpdateStart_decorators = [Remote('applicationUpdateStart')];
            _assetReadme_decorators = [Remote('assetReadme')];
            _install_decorators = [Remote('installAsset')];
            _agentTemplate_decorators = [Remote('agentTemplate')];
            _manualSkillRead_decorators = [Remote('manualSkillRead')];
            _manualSkillSave_decorators = [Remote('manualSkillSave')];
            __esDecorate(this, null, _catalog_decorators, { kind: "method", name: "catalog", static: false, private: false, access: { has: obj => "catalog" in obj, get: obj => obj.catalog }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _catalogSyncStatus_decorators, { kind: "method", name: "catalogSyncStatus", static: false, private: false, access: { has: obj => "catalogSyncStatus" in obj, get: obj => obj.catalogSyncStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _uninstallAsset_decorators, { kind: "method", name: "uninstallAsset", static: false, private: false, access: { has: obj => "uninstallAsset" in obj, get: obj => obj.uninstallAsset }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _applicationUpdateStatus_decorators, { kind: "method", name: "applicationUpdateStatus", static: false, private: false, access: { has: obj => "applicationUpdateStatus" in obj, get: obj => obj.applicationUpdateStatus }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _applicationUpdateCheck_decorators, { kind: "method", name: "applicationUpdateCheck", static: false, private: false, access: { has: obj => "applicationUpdateCheck" in obj, get: obj => obj.applicationUpdateCheck }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _applicationUpdateStart_decorators, { kind: "method", name: "applicationUpdateStart", static: false, private: false, access: { has: obj => "applicationUpdateStart" in obj, get: obj => obj.applicationUpdateStart }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _assetReadme_decorators, { kind: "method", name: "assetReadme", static: false, private: false, access: { has: obj => "assetReadme" in obj, get: obj => obj.assetReadme }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _install_decorators, { kind: "method", name: "install", static: false, private: false, access: { has: obj => "install" in obj, get: obj => obj.install }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _agentTemplate_decorators, { kind: "method", name: "agentTemplate", static: false, private: false, access: { has: obj => "agentTemplate" in obj, get: obj => obj.agentTemplate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _manualSkillRead_decorators, { kind: "method", name: "manualSkillRead", static: false, private: false, access: { has: obj => "manualSkillRead" in obj, get: obj => obj.manualSkillRead }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _manualSkillSave_decorators, { kind: "method", name: "manualSkillSave", static: false, private: false, access: { has: obj => "manualSkillSave" in obj, get: obj => obj.manualSkillSave }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['subprocess', 'skills'];
        static Config = s.object({
            localBrowserAccess: s.boolean().default(true),
            dshHome: s.string(),
            catalogUrl: s.string().default(DEFAULT_CATALOG_URL),
            catalogTimeoutMs: s.number().step(1).min(1).default(15_000),
            catalogRefreshMs: s.number().step(1).min(1).default(300_000),
            catalogEventsUrl: s.string(),
            catalogEventsReconnectMs: s.number().step(1).min(1).default(5_000),
            maxCatalogBytes: s.number().step(1).min(1).default(8 * 1024 * 1024),
            maxCatalogAssets: s.number().step(1).min(1).default(10_000),
            readmeTimeoutMs: s.number().step(1).min(1).default(15_000),
            maxReadmeBytes: s.number().step(1).min(1).default(1024 * 1024),
            gitCommand: s.string().default('git'),
            pnpmCommand: s.string().default('pnpm'),
            repositoryRoot: s.string().default(process.cwd()),
            githubFetchTimeoutMs: s.number().step(1).min(1).default(10_000),
            gitGraceMs: s.number().step(1).min(1).default(5_000),
            maxGitOutputBytes: s.number().step(1).min(1).default(16 * 1024 * 1024),
            maxFiles: s.number().step(1).min(1).default(10_000),
            maxTotalBytes: s.number().step(1).min(1).default(512 * 1024 * 1024),
            maxFileBytes: s.number().step(1).min(1).default(128 * 1024 * 1024),
            maxDepth: s.number().step(1).min(1).default(32),
            maxPathBytes: s.number().step(1).min(1).default(1024),
        });
        resolved = __runInitializers(this, _instanceExtraInitializers);
        configuredHome;
        roots;
        gitPath;
        pnpmPath;
        applicationUpdater;
        accepting = true;
        lifetime = new AbortController();
        operations = new Set();
        skillProviderControl;
        catalogCache;
        catalogRequestRevision = 0;
        syncStatus;
        /**
         * @param ctx - Host context carrying the managed subprocess runtime.
         * @param config - catalog, Git, and complete-tree bounds.
         */
        constructor(ctx, config) {
            super(ctx, 'quantSkillsHost', { namespace: 'quantSkills' });
            if (config.localBrowserAccess !== false) {
                ctx.inject(['connection'], (connectionCtx) => {
                    connectionCtx.effect(() => installLocalBrowserAccess(connectionCtx.get('connection')), 'quantskills: direct local browser access');
                });
            }
            const catalogUrl = config.catalogUrl ?? DEFAULT_CATALOG_URL;
            validateCatalogUrl(catalogUrl);
            const catalogEventsUrl = config.catalogEventsUrl === undefined
                ? undefined
                : validateCatalogEventsUrl(config.catalogEventsUrl);
            this.configuredHome = config.dshHome;
            this.resolved = Object.freeze({
                catalogUrl,
                catalogTimeoutMs: config.catalogTimeoutMs ?? 15_000,
                catalogRefreshMs: config.catalogRefreshMs ?? 300_000,
                ...(catalogEventsUrl === undefined ? {} : { catalogEventsUrl }),
                catalogEventsReconnectMs: config.catalogEventsReconnectMs ?? 5_000,
                maxCatalogBytes: config.maxCatalogBytes ?? 8 * 1024 * 1024,
                maxCatalogAssets: config.maxCatalogAssets ?? 10_000,
                readmeTimeoutMs: config.readmeTimeoutMs ?? 15_000,
                maxReadmeBytes: config.maxReadmeBytes ?? 1024 * 1024,
                gitCommand: config.gitCommand ?? 'git',
                pnpmCommand: config.pnpmCommand ?? 'pnpm',
                repositoryRoot: resolve(config.repositoryRoot ?? process.cwd()),
                githubFetchTimeoutMs: config.githubFetchTimeoutMs ?? 10_000,
                gitGraceMs: config.gitGraceMs ?? 5_000,
                maxGitOutputBytes: config.maxGitOutputBytes ?? 16 * 1024 * 1024,
                tree: Object.freeze({
                    maxFiles: config.maxFiles ?? 10_000,
                    maxTotalBytes: config.maxTotalBytes ?? 512 * 1024 * 1024,
                    maxFileBytes: config.maxFileBytes ?? 128 * 1024 * 1024,
                    maxDepth: config.maxDepth ?? 32,
                    maxPathBytes: config.maxPathBytes ?? 1024,
                }),
            });
            this.syncStatus = Object.freeze(catalogEventsUrl === undefined
                ? { mode: 'manual', state: 'idle' }
                : { mode: 'event-stream', state: 'connecting' });
        }
        /** Prepare managed roots and resolve Git before the service becomes injectable. */
        async *[Service.init]() {
            this.roots = await prepareRoots(this.configuredHome);
            this.gitPath = await this.ctx.subprocess.resolveExecutable(this.resolved.gitCommand);
            this.pnpmPath = await this.ctx.subprocess.resolveExecutable(this.resolved.pnpmCommand);
            this.applicationUpdater = new QuantSkillsApplicationUpdater({
                applicationRoot: join(this.roots.root, 'application'),
                repositoryRoot: this.resolved.repositoryRoot,
                commands: {
                    runGit: (args, cwd, signal) => this.runGit(args, cwd, signal),
                    runPnpm: (args, cwd, signal, environment) => this.runPnpm(args, cwd, signal, environment),
                },
            });
            await this.applicationUpdater.initialize();
            const disposeSkillProvider = this.ctx.skills.registerProvider((control) => {
                this.skillProviderControl = control;
                return new QuantSkillsInstalledSkillProvider(signal => this.listInstalledSkillLocations(signal));
            });
            if (this.resolved.catalogEventsUrl !== undefined) {
                const stream = this.runCatalogEventLoop(this.lifetime.signal);
                this.operations.add(stream);
                void stream.finally(() => { this.operations.delete(stream); });
            }
            yield async () => {
                this.accepting = false;
                this.lifetime.abort(new Error('quantskills-host: service is disposing'));
                disposeSkillProvider();
                this.skillProviderControl = undefined;
                this.catalogCache = undefined;
                await this.applicationUpdater?.dispose();
                this.applicationUpdater = undefined;
                await Promise.allSettled(this.operations);
            };
        }
        /**
         * Read the approved official catalog without making a validated process cache wait on GitHub.
         * @param signal - optional caller cancellation for the initial or background fetch.
         * @returns a bounded, validated point-in-time snapshot.
         */
        catalog(signal) {
            const cached = this.catalogCache;
            if (cached === undefined)
                return this.runOperation(active => this.fetchCatalog(active), signal);
            void this.runOperation(active => this.fetchCatalog(active), signal).catch(() => {
                if (!signal?.aborted && !this.lifetime.signal.aborted) {
                    this.ctx.logger.warn('QuantSkills catalog revalidation failed; serving the last validated process snapshot.');
                }
            });
            return Promise.resolve(this.withSyncStatus(cached.snapshot));
        }
        /**
         * Read the current event-driven catalog delivery state.
         * @returns Host-owned connection state for the configured relay.
         */
        catalogSyncStatus() {
            return this.syncStatus;
        }
        /**
         * List versions with a complete Host publication record.
         * @param signal - optional caller cancellation.
         * @returns immutable installed versions sorted by asset and commit.
         */
        list(signal) {
            return this.runOperation(active => this.listCommitted(active), signal);
        }
        /** Remove a catalog asset from discovery while retaining immutable versions for existing sessions. */
        uninstallAsset(request, signal) {
            return this.runOperation(async (active) => {
                if (!ASSET_PATTERN.test(request.assetId))
                    throw new Error('无效的能力标识。');
                const manifests = await this.readCommittedManifests(active);
                if (!manifests.some(item => item.assetId === request.assetId && item.origin === 'catalog')) {
                    throw new Error('未找到已安装的公共能力，请刷新列表后重试。');
                }
                const root = await ensurePrivateChild(this.requireRoots().versions, request.assetId);
                active.throwIfAborted();
                try {
                    const file = await open(join(root, '.uninstalled'), 'wx', 0o600);
                    try {
                        await file.writeFile('Uninstalled; retained for existing session bindings.\n');
                        await file.sync();
                    }
                    finally {
                        await file.close();
                    }
                }
                catch (error) {
                    if (!isExists(error))
                        throw error;
                }
                this.skillProviderControl?.invalidate();
            }, signal);
        }
        /** @returns the current background application-update state without network I/O. */
        applicationUpdateStatus() {
            return this.requireApplicationUpdater().getStatus();
        }
        /**
         * Start a user-requested official version check without downloading an update.
         * @param request - explicit Git service selected by the user.
         * @returns immediate started-or-reused acknowledgement.
         */
        applicationUpdateCheck(request) {
            return this.requireApplicationUpdater().check(request.source);
        }
        /**
         * Prepare the version selected by the user's latest completed check.
         * @returns immediate started-or-reused acknowledgement.
         */
        applicationUpdateStart() {
            return this.requireApplicationUpdater().start();
        }
        /**
         * Read the repository's real README at the exact commit shown by the Client.
         * @param request - catalog-bound asset identity and exact observed commit.
         * @param signal - optional caller cancellation propagated to both catalog and README fetches.
         * @returns bounded UTF-8 Markdown from the approved repository version.
         */
        assetReadme(request, signal) {
            return this.runOperation(active => this.readAssetReadme(request, active), signal);
        }
        /**
         * Re-fetch the catalog, enforce the Client's observed snapshot and commit,
         * and atomically publish one validated immutable version.
         * @param request - catalog-bound asset identity and exact observed commit.
         * @param signal - optional caller cancellation propagated to fetch and Git.
         * @returns the Host-committed installation record.
         */
        install(request, signal) {
            return this.runOperation(active => this.installResolved(request, active), signal);
        }
        /**
         * Resolve one exact installed Skill for a session-scoped provider.
         * @param versionId - Host-issued immutable installed-version identity.
         * @param signal - optional caller cancellation.
         * @returns the validated manifest and complete exact-version definition.
         * @throws when the version is absent, stored-only, or corrupt.
         */
        resolveInstalledSkill(versionId, signal) {
            return this.runOperation(async (active) => {
                const manifest = (await this.readCommittedManifests(active))
                    .find(candidate => candidate.versionId === versionId);
                if (manifest === undefined) {
                    throw new QuantSkillsHostError('Installed QuantSkills version was not found.', 'INSTALLED_VERSION_NOT_FOUND');
                }
                if (manifest.exposure !== 'skill-registry' || manifest.kind !== 'skill') {
                    throw new QuantSkillsHostError('Installed QuantSkills version is not a registry-visible Skill.', 'INSTALLED_VERSION_NOT_SKILL');
                }
                const resourceBase = this.versionSource(manifest);
                const location = Object.freeze({
                    assetId: manifest.assetId,
                    versionId: manifest.versionId,
                    declarationPath: join(resourceBase, manifest.declaration),
                    resourceBase,
                });
                const definition = await loadQuantSkillsInstalledSkill(location, active);
                const promptForm = parseQuantSkillsPromptForm(definition.content);
                return Object.freeze({
                    version: publicManifest(manifest),
                    definition,
                    ...(promptForm === undefined ? {} : { promptForm }),
                });
            }, signal);
        }
        /**
         * Resolve the immutable source directory for one exact installed version.
         * This same-process Host method lets trusted consumers authorize legacy files without
         * projecting the Host filesystem path through the remote Agent-template response.
         * @param versionId - Host-issued immutable installed-version identity.
         * @param signal - optional caller cancellation.
         * @returns the validated public manifest and its immutable source directory.
         */
        resolveInstalledResource(versionId, signal) {
            return this.runOperation(async (active) => {
                const manifest = (await this.readCommittedManifests(active))
                    .find(candidate => candidate.versionId === versionId);
                if (manifest === undefined) {
                    throw new QuantSkillsHostError('Installed QuantSkills version was not found.', 'INSTALLED_VERSION_NOT_FOUND');
                }
                return Object.freeze({
                    version: publicManifest(manifest),
                    resourceBase: this.versionSource(manifest),
                });
            }, signal);
        }
        /**
         * Match one model-visible resource directory to an exact installed registry Skill.
         * This same-process lookup lets trusted Session consumers validate durable `skill`
         * tool results without exposing the installed-version root through RPC.
         * @param resourceBase - directory rendered by the successful Skill tool result.
         * @param signal - optional caller cancellation.
         * @returns the exact Skill manifest and source directory, or undefined when no installation matches.
         */
        matchInstalledSkillResource(resourceBase, signal) {
            return this.runOperation(async (active) => {
                const manifest = (await this.readCommittedManifests(active)).find(candidate => (candidate.kind === 'skill'
                    && candidate.exposure === 'skill-registry'
                    && this.versionSource(candidate) === resourceBase));
                if (manifest === undefined)
                    return undefined;
                return Object.freeze({ version: publicManifest(manifest), resourceBase });
            }, signal);
        }
        /**
         * Resolve one exact installed Agent as an editable user-Agent template.
         * @param versionId - Host-issued immutable installed-version identity.
         * @param signal - optional caller cancellation.
         * @returns validated Agent metadata, instructions, and exact dependency identities.
         */
        agentTemplate(versionId, signal) {
            return this.runOperation(async (active) => {
                const manifest = (await this.readCommittedManifests(active))
                    .find(candidate => candidate.versionId === versionId);
                if (manifest === undefined) {
                    throw new QuantSkillsHostError('Installed QuantSkills version was not found.', 'INSTALLED_VERSION_NOT_FOUND');
                }
                if (manifest.exposure !== 'agent-template' || manifest.kind !== 'agent') {
                    throw new QuantSkillsHostError('Installed QuantSkills version is not an Agent template.', 'INSTALLED_VERSION_NOT_AGENT');
                }
                const source = this.versionSource(manifest);
                const parsed = parseQuantSkillsAgent(await readFile(join(source, manifest.declaration), { encoding: 'utf8', signal: active }));
                if (parsed.name !== manifest.assetId) {
                    throw new QuantSkillsHostError('Installed QuantSkills Agent declaration is corrupt.', 'INSTALL_RECORD_CORRUPT');
                }
                return Object.freeze({ version: publicManifest(manifest), ...parsed });
            }, signal);
        }
        /**
         * Validate one Workspace-local authoring draft through the same Git-tree admission used by catalog installs.
         * @param request - draft directory and declaration family.
         * @param signal - optional caller cancellation.
         * @returns content identity and validated declaration metadata without publishing files.
         */
        async prepareAuthoredDraft(request, signal) {
            return this.runOperation(async (active) => {
                const materialized = await this.materializeAuthoredDraft(request, active);
                try {
                    return materialized.draft;
                }
                finally {
                    await removeOwnedPath(materialized.staging, this.requireRoots().staging).catch(() => { });
                }
            }, signal);
        }
        /**
         * Publish one unchanged Workspace-local authoring draft as an immutable local Git version.
         * @param request - prepared draft and expected tree digest.
         * @param signal - optional caller cancellation.
         * @returns committed local installation visible to exact-version resolvers.
         */
        authoredWrite = Promise.resolve();
        async publishAuthoredDraft(request, signal) {
            return this.runOperation(active => {
                const write = this.authoredWrite.catch(() => { }).then(async () => {
                    active.throwIfAborted();
                    const materialized = await this.materializeAuthoredDraft(request, active);
                    let published = false;
                    try {
                        if (materialized.draft.treeDigest !== request.expectedTreeDigest) {
                            throw new QuantSkillsHostError('QuantSkills authoring draft changed after it was prepared.', 'INSTALL_INVALID_TREE');
                        }
                        if (request.expectedBaseVersionId !== undefined) {
                            const versions = (await this.readCommittedManifests(active)).filter(item => item.assetId === materialized.manifest.assetId);
                            const duplicate = versions.find(item => item.origin === 'local-authoring' && item.treeDigest === request.expectedTreeDigest);
                            if (duplicate) {
                                await this.confirmExposure(duplicate, active);
                                return publicManifest(duplicate);
                            }
                            const latest = versions.sort((a, b) => b.installedAt - a.installedAt || b.versionId.localeCompare(a.versionId))[0];
                            if ((request.expectedBaseVersionId === null && latest) || (request.expectedBaseVersionId !== null && (latest?.origin !== 'local-authoring' || latest.versionId !== request.expectedBaseVersionId))) {
                                throw new QuantSkillsHostError('技能已被修改，或名称已被使用。请保留草稿，重新打开最新版本后核对。', 'INSTALL_INVALID_TREE');
                            }
                        }
                        const assetRoot = await ensurePrivateChild(this.requireRoots().authored, materialized.manifest.assetId);
                        const target = join(assetRoot, materialized.manifest.commit);
                        try {
                            await rename(materialized.payload, target);
                            published = true;
                            await this.confirmExposure(materialized.manifest, active);
                            return publicManifest(materialized.manifest);
                        }
                        catch (error) {
                            if (!isExists(error))
                                throw error;
                            const existing = await readManifest(target);
                            await assertStoredSource(target, existing);
                            if (existing.treeDigest !== request.expectedTreeDigest || existing.origin !== 'local-authoring') {
                                throw new QuantSkillsHostError('Local QuantSkills version identity conflicts with stored content.', 'INSTALL_RECORD_CORRUPT');
                            }
                            await this.confirmExposure(existing, active);
                            return publicManifest(existing);
                        }
                    }
                    finally {
                        if (!published)
                            await removeOwnedPath(materialized.payload, materialized.staging).catch(() => { });
                        await removeOwnedPath(materialized.staging, this.requireRoots().staging).catch(() => { });
                    }
                });
                this.authoredWrite = write;
                return write;
            }, signal);
        }
        /** Save a manual declaration through the same admission and immutable publication as AI creation. */
        async manualSkillRead(versionId, signal) {
            return this.runOperation(async (active) => {
                const source = (await this.readCommittedManifests(active)).find(item => item.versionId === versionId);
                if (!source || source.kind !== 'skill')
                    throw new QuantSkillsHostError('技能版本不可用。', 'INSTALLED_VERSION_NOT_FOUND');
                const location = this.versionSource(source);
                await assertStoredSource(dirname(location), source);
                return readFile(join(location, 'SKILL.md'), { encoding: 'utf8', signal: active });
            }, signal);
        }
        manualSkillSave(request, signal) {
            return this.runOperation(async (active) => {
                const input = z.object({ markdown: z.string().min(1).max(512_000), mode: z.enum(['create', 'edit', 'copy']), sourceVersionId: z.string().optional(), copyAssetId: z.string().regex(/^skill-[a-z0-9]+(?:-[a-z0-9]+)*$/).optional() }).strict().parse(request);
                if (input.mode === 'copy') {
                    if (!input.copyAssetId)
                        throw new QuantSkillsHostError('个人副本缺少新标识，请重新打开编辑器。', 'INSTALL_INVALID_TREE');
                    const header = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(input.markdown);
                    if (!header)
                        throw new QuantSkillsHostError('SKILL.md 缺少声明元信息。', 'INSTALL_INVALID_TREE');
                    const document = parseDocument(header[1]);
                    if (document.errors.length)
                        throw new QuantSkillsHostError('SKILL.md 声明格式有误，请检查 YAML。', 'INSTALL_INVALID_TREE');
                    document.set('name', input.copyAssetId);
                    input.markdown = `---\n${document.toString()}---\n${input.markdown.slice(header[0].length)}`;
                }
                const parsed = parseQuantSkillsSkill(input.markdown);
                if (!parsed.content.trim())
                    throw new QuantSkillsHostError('请填写技能的执行说明。', 'INSTALL_INVALID_TREE');
                const assetId = parsed.name.startsWith('skill-') ? parsed.name : `skill-${parsed.name}`;
                const manifests = await this.readCommittedManifests(active);
                const source = manifests.find(item => item.versionId === input.sourceVersionId);
                if (input.mode === 'create' ? input.sourceVersionId !== undefined : !source || source.kind !== 'skill') {
                    throw new QuantSkillsHostError('原技能版本不可用，请重新选择。', 'INSTALLED_VERSION_NOT_FOUND');
                }
                if (input.mode === 'edit' && (source?.origin !== 'local-authoring' || source.assetId !== assetId)) {
                    throw new QuantSkillsHostError('公共技能不能直接修改；请另存为我的技能。编辑时不能改变技能标识。', 'INSTALL_INVALID_TREE');
                }
                if (input.mode === 'copy' && source?.assetId === assetId) {
                    throw new QuantSkillsHostError('个人副本需要新的技能标识。', 'INSTALL_INVALID_TREE');
                }
                const staging = await mkdtemp(join(this.requireRoots().staging, 'manual-skill-'));
                const draft = join(staging, 'source');
                try {
                    if (source)
                        await cp(this.versionSource(source), draft, { recursive: true, dereference: false, errorOnExist: true, force: false });
                    else
                        await mkdir(draft, { mode: 0o700 });
                    // Never write through a link, even if an installed tree has been altered outside the Host.
                    const declaration = join(draft, 'SKILL.md');
                    const existing = await lstat(declaration).catch(error => { if (error.code === 'ENOENT')
                        return undefined; throw error; });
                    if (existing && (!existing.isFile() || existing.isSymbolicLink()))
                        throw new QuantSkillsHostError('技能声明文件不安全，未保存。', 'INSTALL_INVALID_TREE');
                    await unlink(declaration).catch(error => { if (error.code !== 'ENOENT')
                        throw error; });
                    const file = await open(declaration, 'wx', 0o600);
                    try {
                        await file.writeFile(input.markdown, 'utf8');
                    }
                    finally {
                        await file.close();
                    }
                    const prepared = await this.prepareAuthoredDraft({ draftRoot: draft, kind: 'skill' }, active);
                    return await this.publishAuthoredDraft({ draftRoot: draft, kind: 'skill', expectedTreeDigest: prepared.treeDigest,
                        expectedBaseVersionId: input.mode === 'edit' ? source.versionId : null }, active);
                }
                finally {
                    await removeOwnedPath(staging, this.requireRoots().staging);
                }
            }, signal);
        }
        async materializeAuthoredDraft(request, signal) {
            const draftRoot = await realpath(request.draftRoot);
            const draftInfo = await lstat(draftRoot);
            if (!draftInfo.isDirectory() || draftInfo.isSymbolicLink()) {
                throw new QuantSkillsHostError('QuantSkills authoring draft is not a real directory.', 'INSTALL_INVALID_TREE');
            }
            const roots = this.requireRoots();
            const staging = await mkdtemp(join(roots.staging, 'authoring-'));
            await chmod(staging, 0o700);
            const templateRoot = await ensurePrivateChild(staging, 'git-template');
            const repository = await ensurePrivateChild(staging, 'repository.git');
            const payload = await ensurePrivateChild(staging, 'payload');
            const source = await ensurePrivateChild(payload, 'source');
            try {
                await this.runGit(['init', '--quiet', '--bare', repository], staging, signal, templateRoot);
                const gitScope = [`--git-dir=${repository}`, `--work-tree=${draftRoot}`];
                await this.runGit([...gitScope, 'add', '--force', '--all', '--', '.'], staging, signal, templateRoot);
                const treeObject = (await this.runGit([...gitScope, 'write-tree'], staging, signal, templateRoot)).trim();
                if (!SHA_PATTERN.test(treeObject)) {
                    throw new QuantSkillsHostError('Git did not produce an exact local draft tree.', 'INSTALL_GIT_FAILED');
                }
                const declaration = request.kind === 'skill' ? 'SKILL.md' : 'AGENTS.md';
                const treeOutput = await this.runGit([`--git-dir=${repository}`, 'ls-tree', '-rlz', '--full-tree', treeObject], staging, signal, templateRoot);
                const tree = validateGitTree(treeOutput, declaration, this.resolved.tree);
                const commit = (await this.runGit([
                    `--git-dir=${repository}`,
                    '-c', 'user.name=QuantSkills Local Authoring',
                    '-c', 'user.email=local-authoring@quantskills.invalid',
                    'commit-tree', treeObject, '-m', 'QuantSkills local authoring snapshot',
                ], staging, signal, templateRoot, {
                    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
                    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
                })).trim();
                if (!SHA_PATTERN.test(commit)) {
                    throw new QuantSkillsHostError('Git did not produce an exact local authoring commit.', 'INSTALL_GIT_FAILED');
                }
                await this.runGit([`--git-dir=${repository}`, `--work-tree=${source}`, 'checkout', '--quiet', '--force', commit, '--', '.'], staging, signal, templateRoot);
                await this.verifyCheckout(source, tree.entries, signal);
                let assetId;
                let requires;
                if (request.kind === 'skill') {
                    const parsed = parseQuantSkillsSkill(await readFile(join(source, declaration), { encoding: 'utf8', signal }));
                    const normalized = parsed.name.startsWith('skill-') ? parsed.name : `skill-${parsed.name}`;
                    if (!ASSET_PATTERN.test(normalized)) {
                        throw new QuantSkillsHostError('Local SKILL.md name is not a valid QuantSkills asset identity.', 'INSTALL_INVALID_TREE');
                    }
                    assetId = normalized;
                    requires = Object.freeze([]);
                }
                else {
                    const parsed = parseQuantSkillsAgent(await readFile(join(source, declaration), { encoding: 'utf8', signal }));
                    assetId = parsed.name;
                    requires = parsed.requires;
                }
                const catalog = await this.fetchCatalog(signal);
                if (catalog.assets.some(asset => asset.assetId === assetId)) {
                    throw new QuantSkillsHostError('Local QuantSkills asset id conflicts with the official catalog.', 'INSTALL_INVALID_TREE');
                }
                const installed = await this.readCommittedManifests(signal);
                for (const required of requires) {
                    if (!installed.some(candidate => candidate.assetId === required && candidate.kind === 'skill')) {
                        throw new QuantSkillsHostError(`Local QuantSkills Agent requires an uninstalled Skill: ${required}.`, 'INSTALL_INVALID_TREE');
                    }
                }
                const typedCommit = commit;
                const manifest = Object.freeze({
                    schemaVersion: MANIFEST_SCHEMA_VERSION,
                    versionId: installedVersionId(assetId, typedCommit),
                    assetId,
                    kind: request.kind,
                    repository: `local-authoring:${assetId}`,
                    commit: typedCommit,
                    declaration,
                    treeDigest: tree.treeDigest,
                    fileCount: tree.fileCount,
                    totalBytes: tree.totalBytes,
                    installedAt: Date.now(),
                    exposure: request.kind === 'skill' ? 'skill-registry' : 'agent-template',
                    origin: 'local-authoring',
                });
                await writeManifest(join(payload, MANIFEST_NAME), manifest);
                return Object.freeze({
                    draft: Object.freeze({
                        assetId,
                        kind: request.kind,
                        declaration,
                        treeDigest: tree.treeDigest,
                        fileCount: tree.fileCount,
                        totalBytes: tree.totalBytes,
                        requires,
                    }),
                    manifest,
                    payload,
                    staging,
                });
            }
            catch (error) {
                await removeOwnedPath(staging, roots.staging).catch(() => { });
                if (error instanceof QuantSkillsHostError)
                    throw error;
                throw new QuantSkillsHostError('Unable to validate the local QuantSkills draft.', 'INSTALL_WRITE_FAILED', { cause: error });
            }
        }
        runOperation(operation, caller) {
            if (!this.accepting)
                return Promise.reject(new Error('quantskills-host: service is disposing'));
            const signal = caller === undefined
                ? this.lifetime.signal
                : AbortSignal.any([this.lifetime.signal, caller]);
            const result = Promise.resolve().then(() => {
                signal.throwIfAborted();
                return operation(signal);
            });
            this.operations.add(result);
            return result.finally(() => { this.operations.delete(result); });
        }
        async fetchCatalog(signal) {
            const requestRevision = ++this.catalogRequestRevision;
            const cached = this.catalogCache;
            const timeout = AbortSignal.timeout(this.resolved.catalogTimeoutMs);
            const combined = AbortSignal.any([signal, timeout]);
            let response;
            try {
                response = await fetch(this.resolved.catalogUrl, {
                    method: 'GET', redirect: 'error', cache: 'no-store', signal: combined,
                    headers: {
                        accept: 'application/json, text/plain;q=0.9',
                        ...(cached?.etag === undefined ? {} : { 'if-none-match': cached.etag }),
                    },
                });
            }
            catch (error) {
                signal.throwIfAborted();
                throw new QuantSkillsHostError(timeout.aborted ? 'QuantSkills catalog request timed out.' : 'Unable to fetch the QuantSkills catalog.', 'CATALOG_FETCH_FAILED', { cause: error });
            }
            signal.throwIfAborted();
            if (response.url !== this.resolved.catalogUrl) {
                throw new QuantSkillsHostError('QuantSkills catalog response was not the trusted publication.', 'CATALOG_FETCH_FAILED');
            }
            if (response.status === 304) {
                if (cached === undefined || cached.etag === undefined) {
                    throw new QuantSkillsHostError('QuantSkills catalog returned an unusable not-modified response.', 'CATALOG_FETCH_FAILED');
                }
                return this.withSyncStatus(cached.snapshot);
            }
            if (!response.ok) {
                throw new QuantSkillsHostError('QuantSkills catalog response was not the trusted publication.', 'CATALOG_FETCH_FAILED');
            }
            const limits = {
                maxBytes: this.resolved.maxCatalogBytes,
                maxAssets: this.resolved.maxCatalogAssets,
            };
            const parsed = parseCatalogDocument(await readCatalogResponse(response, limits.maxBytes), limits);
            const snapshot = Object.freeze({ ...parsed, refreshAfterMs: this.resolved.catalogRefreshMs });
            const etag = catalogEtag(response);
            if (requestRevision === this.catalogRequestRevision) {
                this.catalogCache = Object.freeze({
                    snapshot,
                    ...(etag === undefined ? {} : { etag }),
                });
            }
            const published = this.withSyncStatus(snapshot);
            if (cached?.snapshot.snapshotId !== snapshot.snapshotId) {
                this.ctx.emit('quantskills/catalog-updated', published);
            }
            return published;
        }
        withSyncStatus(snapshot) {
            return Object.freeze({ ...snapshot, sync: this.syncStatus });
        }
        publishSyncStatus(status) {
            this.syncStatus = Object.freeze(status);
            this.ctx.emit('quantskills/catalog-sync-status', this.syncStatus);
        }
        async runCatalogEventLoop(signal) {
            let connectedOnce = false;
            while (!signal.aborted) {
                this.publishSyncStatus(Object.freeze({
                    mode: 'event-stream',
                    state: connectedOnce ? 'reconnecting' : 'connecting',
                }));
                try {
                    await this.consumeCatalogEvents(signal);
                }
                catch (_eventStreamUnavailable) {
                    if (signalAborted(signal))
                        return;
                    this.publishSyncStatus(Object.freeze({
                        mode: 'event-stream',
                        state: 'error',
                        error: '目录事件连接暂不可用，正在重连。',
                    }));
                }
                if (signalAborted(signal))
                    return;
                connectedOnce = true;
                try {
                    await delay(this.resolved.catalogEventsReconnectMs, undefined, { signal });
                }
                catch (_serviceDisposing) {
                    return;
                }
            }
        }
        async consumeCatalogEvents(signal) {
            const url = this.resolved.catalogEventsUrl;
            if (url === undefined)
                return;
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'error',
                cache: 'no-store',
                signal,
                headers: { accept: 'text/event-stream' },
            });
            if (!response.ok || response.url !== url
                || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')
                || response.body === null) {
                throw new Error('QuantSkills catalog event relay returned an invalid response.');
            }
            const connectedAt = Date.now();
            this.publishSyncStatus(Object.freeze({ mode: 'event-stream', state: 'connected', connectedAt }));
            const reader = response.body.getReader();
            const cancelReader = () => {
                void reader.cancel(signal.reason).catch(() => undefined);
            };
            signal.addEventListener('abort', cancelReader, { once: true });
            const decoder = new TextDecoder();
            let buffer = '';
            let eventName = '';
            let hasData = false;
            const dispatch = async () => {
                if (!hasData || (eventName !== '' && eventName !== 'catalog' && eventName !== 'catalog.updated')) {
                    eventName = '';
                    hasData = false;
                    return;
                }
                const eventReceivedAt = Date.now();
                this.publishSyncStatus(Object.freeze({
                    mode: 'event-stream',
                    state: 'connected',
                    connectedAt,
                    eventReceivedAt,
                }));
                await this.fetchCatalog(signal);
                eventName = '';
                hasData = false;
            };
            try {
                while (!signal.aborted) {
                    const chunk = await reader.read();
                    if (chunk.done)
                        throw new Error('QuantSkills catalog event relay closed the stream.');
                    buffer += decoder.decode(chunk.value, { stream: true });
                    if (Buffer.byteLength(buffer, 'utf8') > MAX_CATALOG_EVENT_BUFFER_BYTES) {
                        throw new Error('QuantSkills catalog event exceeded the allowed buffer.');
                    }
                    let newline = buffer.indexOf('\n');
                    while (newline >= 0) {
                        const rawLine = buffer.slice(0, newline);
                        buffer = buffer.slice(newline + 1);
                        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
                        if (line === '')
                            await dispatch();
                        else if (!line.startsWith(':')) {
                            const separator = line.indexOf(':');
                            const field = separator < 0 ? line : line.slice(0, separator);
                            if (field === 'event')
                                eventName = line.slice(separator + 1).trimStart();
                            else if (field === 'data')
                                hasData = true;
                        }
                        newline = buffer.indexOf('\n');
                    }
                }
            }
            finally {
                signal.removeEventListener('abort', cancelReader);
            }
        }
        requireRoots() {
            if (this.roots === undefined)
                throw new Error('quantskills-host: managed roots are not initialized');
            return this.roots;
        }
        versionRoot(manifest) {
            const root = manifest.origin === 'catalog' ? this.requireRoots().versions : this.requireRoots().authored;
            return join(root, manifest.assetId, manifest.commit);
        }
        versionSource(manifest) {
            return join(this.versionRoot(manifest), 'source');
        }
        requireGitPath() {
            if (this.gitPath === undefined)
                throw new Error('quantskills-host: Git executable is not initialized');
            return this.gitPath;
        }
        requirePnpmPath() {
            if (this.pnpmPath === undefined)
                throw new Error('quantskills-host: pnpm executable is not initialized');
            return this.pnpmPath;
        }
        requireApplicationUpdater() {
            if (this.applicationUpdater === undefined) {
                throw new Error('quantskills-host: application updater is not initialized');
            }
            return this.applicationUpdater;
        }
        async listCommitted(signal) {
            const versions = await Promise.all((await this.readActiveManifests(signal)).map(async (manifest) => {
                const declarationPath = join(this.versionSource(manifest), manifest.declaration);
                let declaration;
                try {
                    declaration = await readFile(declarationPath, { encoding: 'utf8', signal });
                }
                catch (error) {
                    throw new QuantSkillsHostError('Installed QuantSkills declaration cannot be read.', 'INSTALL_RECORD_CORRUPT', { cause: error });
                }
                const declarationTitleZh = extractChineseDeclarationTitle(declaration);
                return Object.freeze({
                    ...publicManifest(manifest),
                    ...(declarationTitleZh === undefined ? {} : { declarationTitleZh }),
                });
            }));
            versions.sort((left, right) => left.versionId.localeCompare(right.versionId));
            return Object.freeze({ versions: Object.freeze(versions) });
        }
        async readCommittedManifests(signal) {
            const versions = [];
            for (const store of [
                { path: this.requireRoots().versions, origin: 'catalog' },
                { path: this.requireRoots().authored, origin: 'local-authoring' },
            ]) {
                for (const assetEntry of await readdir(store.path, { withFileTypes: true })) {
                    signal?.throwIfAborted();
                    if (!assetEntry.isDirectory() || assetEntry.isSymbolicLink() || !ASSET_PATTERN.test(assetEntry.name)) {
                        throw new QuantSkillsHostError('QuantSkills versions directory contains an invalid entry.', 'INSTALL_RECORD_CORRUPT');
                    }
                    const assetRoot = join(store.path, assetEntry.name);
                    for (const versionEntry of await readdir(assetRoot, { withFileTypes: true })) {
                        signal?.throwIfAborted();
                        if (store.origin === 'catalog' && versionEntry.name === '.uninstalled' && versionEntry.isFile() && !versionEntry.isSymbolicLink())
                            continue;
                        if (!versionEntry.isDirectory() || versionEntry.isSymbolicLink() || !SHA_PATTERN.test(versionEntry.name)) {
                            throw new QuantSkillsHostError('QuantSkills asset directory contains an invalid version entry.', 'INSTALL_RECORD_CORRUPT');
                        }
                        const versionRoot = join(assetRoot, versionEntry.name);
                        const manifest = await readManifest(versionRoot);
                        if (manifest.assetId !== assetEntry.name || manifest.commit !== versionEntry.name
                            || manifest.origin !== store.origin) {
                            throw new QuantSkillsHostError('QuantSkills installation path disagrees with its manifest.', 'INSTALL_RECORD_CORRUPT');
                        }
                        await assertStoredSource(versionRoot, manifest);
                        versions.push(manifest);
                    }
                }
            }
            return versions;
        }
        async listInstalledSkillLocations(signal) {
            const active = new Map();
            for (const manifest of await this.readActiveManifests(signal)) {
                if (manifest.exposure !== 'skill-registry')
                    continue;
                const prior = active.get(manifest.assetId);
                if (prior === undefined || prior.installedAt < manifest.installedAt
                    || (prior.installedAt === manifest.installedAt && prior.versionId.localeCompare(manifest.versionId) < 0)) {
                    active.set(manifest.assetId, manifest);
                }
            }
            return Object.freeze([...active.values()].map((manifest) => {
                const resourceBase = this.versionSource(manifest);
                return Object.freeze({
                    assetId: manifest.assetId,
                    versionId: manifest.versionId,
                    declarationPath: join(resourceBase, manifest.declaration),
                    resourceBase,
                });
            }));
        }
        async installResolved(request, signal) {
            const catalog = await this.fetchCatalog(signal);
            if (catalog.snapshotId !== request.observedSnapshotId) {
                throw new QuantSkillsHostError('QuantSkills catalog changed; refresh before installing.', 'CATALOG_STALE');
            }
            const asset = catalog.assets.find(candidate => candidate.assetId === request.assetId);
            if (asset === undefined)
                throw new QuantSkillsHostError('Approved QuantSkills asset was not found.', 'ASSET_NOT_FOUND');
            if (asset.commit !== request.observedCommit) {
                throw new QuantSkillsHostError('QuantSkills asset commit changed; refresh before installing.', 'CATALOG_STALE');
            }
            const visiting = new Set();
            return this.installCatalogAssetWithDependencies(catalog, asset, visiting, signal);
        }
        async readAssetReadme(request, signal) {
            const catalog = await this.fetchCatalog(signal);
            if (catalog.snapshotId !== request.observedSnapshotId) {
                throw new QuantSkillsHostError('QuantSkills catalog changed; refresh before reading details.', 'CATALOG_STALE');
            }
            const asset = catalog.assets.find(candidate => candidate.assetId === request.assetId);
            if (asset === undefined) {
                throw new QuantSkillsHostError('Approved QuantSkills asset was not found.', 'ASSET_NOT_FOUND');
            }
            if (asset.commit !== request.observedCommit) {
                throw new QuantSkillsHostError('QuantSkills asset commit changed; refresh before reading details.', 'CATALOG_STALE');
            }
            const url = quantSkillsReadmeUrl(asset.assetId, asset.commit);
            const timeout = AbortSignal.timeout(this.resolved.readmeTimeoutMs);
            const combined = AbortSignal.any([signal, timeout]);
            let response;
            try {
                response = await fetch(url, {
                    method: 'GET',
                    redirect: 'error',
                    cache: 'no-store',
                    signal: combined,
                    headers: { accept: 'text/markdown, text/plain;q=0.9' },
                });
            }
            catch (error) {
                signal.throwIfAborted();
                throw new QuantSkillsHostError(timeout.aborted ? 'QuantSkills README request timed out.' : 'Unable to fetch the QuantSkills README.', 'ASSET_README_FETCH_FAILED', { cause: error });
            }
            signal.throwIfAborted();
            if (response.url !== url) {
                throw new QuantSkillsHostError('QuantSkills README response was not the approved fixed-commit document.', 'ASSET_README_FETCH_FAILED');
            }
            if (response.status === 404) {
                throw new QuantSkillsHostError('QuantSkills repository has no README.md at this commit.', 'ASSET_README_NOT_FOUND');
            }
            if (!response.ok) {
                throw new QuantSkillsHostError('Unable to fetch the QuantSkills README.', 'ASSET_README_FETCH_FAILED');
            }
            const markdown = await readQuantSkillsReadmeResponse(response, this.resolved.maxReadmeBytes);
            return Object.freeze({ assetId: asset.assetId, commit: asset.commit, path: 'README.md', markdown });
        }
        async installCatalogAssetWithDependencies(catalog, asset, visiting, signal) {
            if (visiting.has(asset.assetId)) {
                throw new QuantSkillsHostError('QuantSkills catalog contains a dependency cycle.', 'CATALOG_INVALID');
            }
            visiting.add(asset.assetId);
            try {
                for (const requiredId of asset.requires ?? []) {
                    const required = this.resolveApprovedSkillDependency(catalog, requiredId);
                    await this.installCatalogAssetWithDependencies(catalog, required, visiting, signal);
                }
                return await this.installCatalogAsset(asset, catalog, visiting, signal);
            }
            finally {
                visiting.delete(asset.assetId);
            }
        }
        async installCatalogAsset(asset, catalog, visiting, signal) {
            const roots = this.requireRoots();
            const assetRoot = await ensurePrivateChild(roots.versions, asset.assetId);
            const target = join(assetRoot, asset.commit);
            try {
                const existing = await readManifest(target);
                await assertStoredSource(target, existing);
                if (asset.kind === 'agent') {
                    const declared = await this.validateAgentDeclaration(join(target, 'source'), asset.assetId, signal);
                    await this.installDeclaredAgentDependencies(catalog, declared, visiting, signal);
                }
                await this.confirmExposure(existing, signal);
                return publicManifest(existing);
            }
            catch (error) {
                if (!isMissing(error))
                    throw error;
            }
            const staging = await mkdtemp(join(roots.staging, 'install-'));
            await chmod(staging, 0o700);
            const templateRoot = await ensurePrivateChild(staging, 'git-template');
            const payload = await ensurePrivateChild(staging, 'payload');
            const source = join(payload, 'source');
            let published = false;
            try {
                await this.runGit(['init', '--quiet', `--template=${templateRoot}`, source], staging, signal);
                await this.runGit(['remote', 'add', 'origin', asset.repository], source, signal, templateRoot);
                const githubTimeout = AbortSignal.timeout(this.resolved.githubFetchTimeoutMs);
                try {
                    await this.runGit(['fetch', '--quiet', '--depth=1', '--no-tags', 'origin', asset.commit], source, AbortSignal.any([signal, githubTimeout]), templateRoot);
                }
                catch (error) {
                    signal.throwIfAborted();
                    const gitFailed = error instanceof QuantSkillsHostError && error.code === 'INSTALL_GIT_FAILED';
                    if (!githubTimeout.aborted && !gitFailed)
                        throw error;
                    await this.runGit(['remote', 'set-url', 'origin', `${QUANTSKILLS_GITEE_ORGANIZATION}/${asset.assetId}.git`], source, signal, templateRoot);
                    await this.runGit(['fetch', '--quiet', '--depth=1', '--no-tags', 'origin', asset.commit], source, signal, templateRoot);
                }
                const resolved = (await this.runGit(['rev-parse', 'FETCH_HEAD^{commit}'], source, signal, templateRoot)).trim();
                if (resolved !== asset.commit)
                    throw new QuantSkillsHostError('Git did not resolve the catalog commit exactly.', 'INSTALL_GIT_FAILED');
                const treeOutput = await this.runGit(['ls-tree', '-rlz', '--full-tree', asset.commit], source, signal, templateRoot);
                const tree = validateGitTree(treeOutput, asset.declaration, this.resolved.tree);
                await this.runGit(['checkout', '--quiet', '--detach', '--force', asset.commit], source, signal, templateRoot);
                await this.verifyCheckout(source, tree.entries, signal);
                await removeOwnedPath(join(source, '.git'), source);
                if (asset.kind === 'skill')
                    await this.validateSkillDeclaration(source, asset.assetId, signal);
                else {
                    const declared = await this.validateAgentDeclaration(source, asset.assetId, signal);
                    await this.installDeclaredAgentDependencies(catalog, declared, visiting, signal);
                }
                const manifest = Object.freeze({
                    schemaVersion: MANIFEST_SCHEMA_VERSION,
                    versionId: installedVersionId(asset.assetId, asset.commit),
                    assetId: asset.assetId,
                    kind: asset.kind,
                    repository: asset.repository,
                    commit: asset.commit,
                    declaration: asset.declaration,
                    treeDigest: tree.treeDigest,
                    fileCount: tree.fileCount,
                    totalBytes: tree.totalBytes,
                    installedAt: Date.now(),
                    exposure: asset.kind === 'skill' ? 'skill-registry' : 'agent-template',
                    origin: 'catalog',
                });
                await writeManifest(join(payload, MANIFEST_NAME), manifest);
                signal.throwIfAborted();
                try {
                    await rename(payload, target);
                    published = true;
                    await this.confirmExposure(manifest, signal);
                    return publicManifest(manifest);
                }
                catch (error) {
                    if (!isExists(error))
                        throw error;
                    const existing = await readManifest(target);
                    await assertStoredSource(target, existing);
                    await this.confirmExposure(existing, signal);
                    return publicManifest(existing);
                }
            }
            catch (error) {
                signal.throwIfAborted();
                if (error instanceof QuantSkillsHostError)
                    throw error;
                throw new QuantSkillsHostError('Unable to publish the QuantSkills asset version.', 'INSTALL_WRITE_FAILED', { cause: error });
            }
            finally {
                if (!published)
                    await removeOwnedPath(payload, staging).catch(() => { });
                await removeOwnedPath(staging, roots.staging).catch(() => { });
            }
        }
        async runGit(args, cwd, signal, hooksPath, environment) {
            const prefix = hooksPath === undefined
                ? []
                : ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', '-c', `core.hooksPath=${hooksPath}`];
            const handle = this.ctx.subprocess.spawn({
                argv: [this.requireGitPath(), ...prefix, ...args],
                cwd,
                stdio: {
                    stdin: 'ignore',
                    stdout: { maxBytes: this.resolved.maxGitOutputBytes },
                    stderr: { maxBytes: this.resolved.maxGitOutputBytes },
                },
                graceMs: this.resolved.gitGraceMs,
                signal,
                env: {
                    GIT_TERMINAL_PROMPT: '0',
                    GIT_CONFIG_NOSYSTEM: '1',
                    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
                    GIT_ALLOW_PROTOCOL: 'https',
                    ...environment,
                },
            });
            const outcome = await handle.done;
            signal.throwIfAborted();
            const stdout = handle.collected.stdout?.readFrom(0);
            const stderr = handle.collected.stderr?.readFrom(0);
            this.assertCompleteGitOutput(stdout, 'stdout');
            this.assertCompleteGitOutput(stderr, 'stderr');
            if (outcome.exitCode !== 0 || outcome.signal !== null) {
                const detail = stderr?.text.trim();
                throw new QuantSkillsHostError(detail === undefined || detail === '' ? 'Git command failed.' : `Git command failed: ${detail}`, 'INSTALL_GIT_FAILED');
            }
            return stdout?.text ?? '';
        }
        async runPnpm(args, cwd, signal, environment) {
            const handle = this.ctx.subprocess.spawn({
                argv: [this.requirePnpmPath(), ...args],
                cwd,
                stdio: {
                    stdin: 'ignore',
                    stdout: { maxBytes: this.resolved.maxGitOutputBytes },
                    stderr: { maxBytes: this.resolved.maxGitOutputBytes },
                },
                graceMs: this.resolved.gitGraceMs,
                signal,
                env: environment,
            });
            const outcome = await handle.done;
            signal.throwIfAborted();
            const stdout = handle.collected.stdout?.readFrom(0);
            const stderr = handle.collected.stderr?.readFrom(0);
            if (stdout === undefined || stdout.lossy || stderr === undefined || stderr.lossy) {
                throw new Error('pnpm output exceeded its configured complete-output limit');
            }
            if (outcome.exitCode !== 0 || outcome.signal !== null) {
                const detail = stderr.text.trim();
                throw new Error(detail === '' ? 'pnpm command failed' : detail);
            }
        }
        assertCompleteGitOutput(output, name) {
            if (output === undefined || output.lossy) {
                throw new QuantSkillsHostError(`Git ${name} exceeded its configured complete-output limit.`, 'INSTALL_LIMIT_EXCEEDED');
            }
        }
        async verifyCheckout(source, entries, signal) {
            for (const entry of entries) {
                signal.throwIfAborted();
                const path = join(source, ...entry.path.split('/'));
                const info = await lstat(path);
                if (!info.isFile() || info.isSymbolicLink() || info.size !== entry.bytes) {
                    throw new QuantSkillsHostError('Checked-out QuantSkills files disagree with the validated Git tree.', 'INSTALL_INVALID_TREE');
                }
                const object = await gitBlobObject(path, entry.bytes, signal);
                if (object !== entry.object) {
                    throw new QuantSkillsHostError('Checked-out QuantSkills content disagrees with the validated Git tree.', 'INSTALL_INVALID_TREE');
                }
            }
        }
        async validateSkillDeclaration(source, assetId, signal) {
            try {
                const parsed = parseQuantSkillsSkill(await readFile(join(source, 'SKILL.md'), { encoding: 'utf8', signal }));
                if (!matchesQuantSkillsSkillName(assetId, parsed.name)) {
                    throw new Error('SKILL.md name does not match its catalog asset identity');
                }
            }
            catch (error) {
                signal.throwIfAborted();
                throw new QuantSkillsHostError('QuantSkills SKILL.md is not discoverable by the Skill registry.', 'INSTALL_INVALID_TREE', {
                    cause: error,
                });
            }
        }
        async validateAgentDeclaration(source, assetId, signal) {
            try {
                const parsed = parseQuantSkillsAgent(await readFile(join(source, 'AGENTS.md'), { encoding: 'utf8', signal }));
                if (parsed.name !== assetId)
                    throw new Error('AGENTS.md name does not match its catalog asset id');
                return parsed.requires;
            }
            catch (error) {
                signal.throwIfAborted();
                throw new QuantSkillsHostError('QuantSkills AGENTS.md is not a valid Agent template.', 'INSTALL_INVALID_TREE', {
                    cause: error,
                });
            }
        }
        async installDeclaredAgentDependencies(catalog, declared, visiting, signal) {
            for (const requiredId of declared) {
                const required = this.resolveApprovedSkillDependency(catalog, requiredId);
                await this.installCatalogAssetWithDependencies(catalog, required, visiting, signal);
            }
        }
        resolveApprovedSkillDependency(catalog, assetId) {
            const asset = catalog.assets.find(candidate => candidate.assetId === assetId);
            if (asset === undefined) {
                throw new QuantSkillsHostError('Approved QuantSkills dependency was not found.', 'ASSET_NOT_FOUND');
            }
            if (asset.kind !== 'skill') {
                throw new QuantSkillsHostError('QuantSkills Agent dependencies must be approved Skills.', 'CATALOG_INVALID');
            }
            return asset;
        }
        async confirmExposure(manifest, signal) {
            if (manifest.origin === 'catalog') {
                const root = await ensurePrivateChild(this.requireRoots().versions, manifest.assetId);
                await unlink(join(root, '.uninstalled')).catch(error => { if (!isMissing(error))
                    throw error; });
            }
            if (manifest.exposure === 'agent-template')
                return;
            this.skillProviderControl?.invalidate();
            const resourceBase = this.versionSource(manifest);
            const parsed = parseQuantSkillsSkill(await readFile(join(resourceBase, manifest.declaration), { encoding: 'utf8', signal }));
            const skill = await this.ctx.skills.get(parsed.name, { signal });
            if (skill?.provider !== QUANTSKILLS_SKILL_PROVIDER || skill.path !== join(resourceBase, manifest.declaration)
                || skill.resourceBase?.kind !== 'directory' || skill.resourceBase.path !== resourceBase) {
                throw new QuantSkillsHostError('Installed QuantSkills Skill is not visible through the Skill registry.', 'INSTALL_EXPOSURE_FAILED');
            }
        }
        async readActiveManifests(signal) {
            const manifests = await this.readCommittedManifests(signal);
            const active = await Promise.all(manifests.map(async (manifest) => {
                if (manifest.origin !== 'catalog')
                    return true;
                try {
                    await lstat(join(this.requireRoots().versions, manifest.assetId, '.uninstalled'));
                    return false;
                }
                catch (error) {
                    if (isMissing(error))
                        return true;
                    throw error;
                }
            }));
            return manifests.filter((_, index) => active[index]);
        }
    };
})();
export { QuantSkillsHostGateway };
async function gitBlobObject(path, expectedBytes, signal) {
    const hash = createHash('sha1');
    hash.update(`blob ${expectedBytes}\0`);
    let bytes = 0;
    const stream = createReadStream(path, { signal });
    for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        hash.update(buffer);
    }
    signal.throwIfAborted();
    if (bytes !== expectedBytes) {
        throw new QuantSkillsHostError('Checked-out QuantSkills file changed during verification.', 'INSTALL_INVALID_TREE');
    }
    return hash.digest('hex');
}
async function assertStoredSource(versionRoot, manifest) {
    try {
        const source = await lstat(join(versionRoot, 'source'));
        const declaration = await lstat(join(versionRoot, 'source', manifest.declaration));
        if (!source.isDirectory() || source.isSymbolicLink() || !declaration.isFile() || declaration.isSymbolicLink()) {
            throw new Error('installed source is not a real directory with a regular declaration');
        }
    }
    catch (error) {
        if (error instanceof QuantSkillsHostError)
            throw error;
        throw new QuantSkillsHostError('QuantSkills installed source is corrupt.', 'INSTALL_RECORD_CORRUPT', { cause: error });
    }
}
export default QuantSkillsHostGateway;
//# sourceMappingURL=index.js.map