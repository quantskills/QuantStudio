import { CATALOG_ZH, hasChinese } from "./catalog-zh.js";
/** Observable controller for the published catalog and Host-owned installation state. */
export class QuantSkillsCatalogController {
    host;
    /** Current catalog projection for React selector hooks. */
    source;
    listeners = new Set();
    snapshot = {
        phase: 'loading',
        installedPhase: 'loading',
        categories: [],
        assets: [],
        versionsByAsset: {},
        installing: new Set(),
        sync: { mode: 'manual', state: 'idle' },
    };
    catalogRevision = 0;
    installedRevision = 0;
    catalogOperation;
    installedOperation;
    installOperations = new Map();
    disposed = false;
    /**
     * Create a controller around the trusted Host Remote.
     * @param host - Remote adapter returning validated catalog and committed versions.
     */
    constructor(host) {
        this.host = host;
        this.source = {
            getSnapshot: () => this.snapshot,
            subscribe: listener => this.listen(listener),
        };
    }
    /** Refresh catalog and committed installation projections independently. */
    async refresh() {
        await Promise.all([this.refreshCatalog(), this.refreshInstalled()]);
    }
    /** Remove a capability from future discovery, then reconcile the authoritative library. */
    async uninstall(assetId) {
        if (!this.host.uninstall)
            throw new Error('当前宿主不支持卸载，请更新后重试。');
        await this.host.uninstall(assetId);
        await this.refreshInstalled();
        if (this.snapshot.installedPhase !== 'ready')
            throw new Error('卸载已提交，但列表刷新失败，请刷新目录。');
    }
    /** Cancel active Host operations and suppress every later publication. */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.catalogRevision += 1;
        this.installedRevision += 1;
        this.catalogOperation?.abort();
        this.installedOperation?.abort();
        for (const operation of this.installOperations.values())
            operation.abort();
        this.installOperations.clear();
        this.listeners.clear();
    }
    /**
     * Install the exact version shown by the current Host catalog, then re-read committed versions.
     * @param asset - current catalog asset selected by the user.
     * @returns Host-committed version, or undefined after a classified failure.
     */
    async install(asset) {
        if (this.disposed)
            return undefined;
        const snapshotId = this.snapshot.snapshotId;
        if (this.snapshot.phase !== 'ready' || snapshotId === undefined) {
            this.publishOperationError('目录不是最新宿主投影，请刷新后再安装。', 'CATALOG_STALE');
            return undefined;
        }
        this.installOperations.get(asset.name)?.abort();
        const operation = new AbortController();
        this.installOperations.set(asset.name, operation);
        this.setInstalling(asset.name, true);
        try {
            const installed = await this.host.install({
                assetId: asset.name,
                observedSnapshotId: snapshotId,
                observedCommit: asset.commitSha,
            }, operation.signal);
            await this.refreshInstalled();
            return projectInstalledVersion(installed);
        }
        catch (error) {
            if (operation.signal.aborted)
                return undefined;
            const code = remoteErrorCode(error);
            if (code === 'CATALOG_STALE')
                this.publish({ ...this.snapshot, phase: 'stale' });
            this.publishOperationError(installFailureLabel(code), code);
            return undefined;
        }
        finally {
            if (this.installOperations.get(asset.name) === operation) {
                this.installOperations.delete(asset.name);
                this.setInstalling(asset.name, false);
            }
        }
    }
    /** Supersede any older catalog request and publish only this request's result. */
    async refreshCatalog() {
        if (this.disposed)
            return;
        this.catalogOperation?.abort();
        const operation = new AbortController();
        this.catalogOperation = operation;
        const revision = ++this.catalogRevision;
        const hadCatalog = this.snapshot.snapshotId !== undefined;
        const { catalogError: _catalogError, operationError: _operationError, operationCode: _operationCode, ...current } = this.snapshot;
        this.publish({ ...current, phase: hadCatalog ? this.snapshot.phase : 'loading' });
        try {
            const catalog = await this.host.catalog(operation.signal);
            if (revision !== this.catalogRevision)
                return;
            const projected = projectCatalog(catalog);
            const { catalogError: _error, ...latest } = this.snapshot;
            this.publish({
                ...latest,
                ...projected,
                assets: applyInstalledDeclarationNames(projected.assets, latest.versionsByAsset),
                phase: 'ready',
                refreshedAt: Date.now(),
            });
        }
        catch (error) {
            if (operation.signal.aborted || revision !== this.catalogRevision)
                return;
            this.publish({
                ...this.snapshot,
                phase: hadCatalog ? 'stale' : 'error',
                catalogError: catalogFailureLabel(remoteErrorCode(error)),
            });
        }
        finally {
            if (this.catalogOperation === operation)
                this.catalogOperation = undefined;
        }
    }
    /**
     * Publish one Host-pushed trusted snapshot and supersede any older catalog read.
     * @param catalog - trusted catalog snapshot fetched and projected by the Host.
     */
    acceptCatalogSnapshot(catalog) {
        if (this.disposed)
            return;
        this.catalogRevision += 1;
        this.catalogOperation?.abort();
        this.catalogOperation = undefined;
        const projected = projectCatalog(catalog);
        const { catalogError: _catalogError, operationError: _operationError, operationCode: _operationCode, ...latest } = this.snapshot;
        this.publish({
            ...latest,
            ...projected,
            assets: applyInstalledDeclarationNames(projected.assets, latest.versionsByAsset),
            phase: 'ready',
            refreshedAt: Date.now(),
        });
    }
    /**
     * Mirror Host event-stream state without changing the trusted catalog projection.
     * @param sync - current Host catalog event-stream status.
     */
    acceptSyncStatus(sync) {
        if (this.disposed)
            return;
        this.publish({ ...this.snapshot, sync });
    }
    /** Supersede any older installed-version request and publish only this request's result. */
    async refreshInstalled() {
        if (this.disposed)
            return;
        this.installedOperation?.abort();
        const operation = new AbortController();
        this.installedOperation = operation;
        const revision = ++this.installedRevision;
        const hadInstalledProjection = this.snapshot.installedRefreshedAt !== undefined;
        const { installedError: _installedError, ...current } = this.snapshot;
        this.publish({ ...current, installedPhase: hadInstalledProjection ? this.snapshot.installedPhase : 'loading' });
        try {
            const installed = await this.host.list(operation.signal);
            if (revision !== this.installedRevision)
                return;
            const { installedError: _error, ...latest } = this.snapshot;
            const versionsByAsset = projectInstalled(installed);
            this.publish({
                ...latest,
                installedPhase: 'ready',
                assets: applyInstalledDeclarationNames(latest.assets, versionsByAsset),
                versionsByAsset,
                installedRefreshedAt: Date.now(),
            });
        }
        catch (error) {
            if (operation.signal.aborted || revision !== this.installedRevision)
                return;
            this.publish({
                ...this.snapshot,
                installedPhase: hadInstalledProjection ? 'stale' : 'error',
                installedError: installedFailureLabel(remoteErrorCode(error)),
            });
        }
        finally {
            if (this.installedOperation === operation)
                this.installedOperation = undefined;
        }
    }
    publishOperationError(message, code) {
        const { operationCode: _operationCode, ...current } = this.snapshot;
        this.publish({ ...current, operationError: message, ...(code === undefined ? {} : { operationCode: code }) });
    }
    setInstalling(assetName, active) {
        const installing = new Set(this.snapshot.installing);
        if (active)
            installing.add(assetName);
        else
            installing.delete(assetName);
        if (!active) {
            this.publish({ ...this.snapshot, installing });
            return;
        }
        const { operationError: _operationError, operationCode: _operationCode, ...current } = this.snapshot;
        this.publish({ ...current, installing });
    }
    publish(snapshot) {
        if (this.disposed)
            return;
        this.snapshot = snapshot;
        for (const listener of this.listeners)
            listener();
    }
    listen(listener) {
        if (this.disposed)
            return () => { };
        this.listeners.add(listener);
        return () => { void this.listeners.delete(listener); };
    }
}
/** Lifecycle-owned timer and focus listener for Host-configured catalog checks. */
export class QuantSkillsCatalogAutoChecker {
    catalog;
    environment;
    timer;
    revision = 0;
    started = false;
    enabled = true;
    eventStreamConnected = false;
    disposed = false;
    focusListener = () => {
        if (this.enabled)
            void this.checkNow();
    };
    /**
     * Create an automatic checker without starting network activity.
     * @param catalog - cancellable catalog controller.
     * @param environment - browser focus and timer operations.
     */
    constructor(catalog, environment) {
        this.catalog = catalog;
        this.environment = environment;
    }
    /** Start focus observation and schedule the next Host-advertised interval. */
    start() {
        if (this.started || this.disposed)
            return;
        this.started = true;
        this.environment.addEventListener('focus', this.focusListener);
        if (this.catalog.source.getSnapshot().snapshotId === undefined) {
            void this.checkNow();
            return;
        }
        this.scheduleNext();
    }
    /**
     * Apply the durable automatic-check preference at runtime.
     * @param enabled - whether focus and interval checks may issue catalog reads.
     */
    setEnabled(enabled) {
        if (this.disposed || this.enabled === enabled)
            return;
        this.enabled = enabled;
        this.revision += 1;
        this.clearTimer();
        if (enabled && this.started)
            void this.checkNow();
    }
    /**
     * Suppress fallback polling while the Host's outbound event stream is healthy.
     * @param connected - whether the Host reports a connected catalog event stream.
     */
    setEventStreamConnected(connected) {
        if (this.disposed || this.eventStreamConnected === connected)
            return;
        this.eventStreamConnected = connected;
        this.revision += 1;
        this.clearTimer();
        if (!connected && this.started && this.enabled)
            this.scheduleNext();
    }
    /** Run a fresh check, superseding the pending check and resetting its next interval. */
    async checkNow() {
        const hasCatalog = this.catalog.source.getSnapshot().snapshotId !== undefined;
        if (!this.started || this.disposed || !this.enabled || (this.eventStreamConnected && hasCatalog))
            return;
        this.clearTimer();
        const revision = ++this.revision;
        await this.catalog.refreshCatalog();
        if (revision !== this.revision)
            return;
        this.scheduleNext();
    }
    /** Remove the focus listener and cancel the pending interval. */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.revision += 1;
        this.clearTimer();
        if (this.started)
            this.environment.removeEventListener('focus', this.focusListener);
    }
    clearTimer() {
        if (this.timer === undefined)
            return;
        this.environment.clearTimeout(this.timer);
        this.timer = undefined;
    }
    scheduleNext() {
        if (!this.started || this.disposed || !this.enabled || this.eventStreamConnected)
            return;
        const delay = this.catalog.source.getSnapshot().refreshAfterMs;
        if (delay === undefined)
            return;
        this.timer = this.environment.setTimeout(() => {
            this.timer = undefined;
            void this.checkNow();
        }, delay);
    }
}
const PANDA_FAILURE_LABEL = {
    'invalid-request': '请检查账号格式和密码后重试。',
    'cancelled': 'PandaData 操作已取消。',
    'python-unavailable': '未找到可用的 Python 或 uv 托管安装器，请检查插件运行环境。',
    'python-unsupported': 'PandaData 需要 Python 3.10 或更高版本。',
    'sdk-not-ready': '请先安装 PandaData 私有运行环境。',
    'sdk-version-mismatch': 'PandaData SDK 版本与宿主要求不一致。',
    'bootstrap-failed': 'PandaData 私有运行环境安装失败。',
    'release-unavailable': '无法读取 PandaData 官方版本信息，请稍后重试。',
    'update-not-available': '当前 PandaData SDK 已是最新版本。',
    'update-failed': '候选 SDK 未通过验证，当前环境未改变。',
    'repair-failed': '新环境未通过验证，当前环境未改变。',
    'rollback-unavailable': '没有可回滚的已验证 PandaData 环境。',
    'incompatible-api': '候选 PandaData SDK 缺少当前能力所需接口。',
    'login-failed': 'PandaData 登录失败，请检查账号和密码。',
    'data-validation-failed': 'PandaData 登录成功，但只读数据验证失败；不会保存本次登录。',
    'execution-unavailable': 'PandaData 登录和数据接口可用，但当前平台执行链未通过验证。请在运行环境中修复后重试。',
    'credential-cleanup-failed': 'PandaData SDK 凭据文件清理失败；本次登录不会被保存。',
    'network-unavailable': '暂时无法连接 PandaData；已保存的登录信息会在网络恢复后重试。',
    'logout-unsupported': '当前 PandaData SDK 不支持可靠登出，连接仍然保留。',
    'logout-failed': 'PandaData 登出失败，连接仍然保留。',
    'worker-failed': 'PandaData 宿主进程返回了无效响应。',
};
/** Browser projection of the Host-owned Panda connector lifecycle. */
export class PandaConnectionController {
    connector;
    /** Current Host connector projection for React selector hooks. */
    source;
    listeners = new Set();
    snapshot = { status: 'checking', updateAvailable: false, logoutSupported: false };
    preparation;
    /**
     * Create the controller around the typed Host Remote.
     * @param connector - safe Remote adapter whose results never contain credentials.
     */
    constructor(connector) {
        this.connector = connector;
        this.source = {
            getSnapshot: () => this.snapshot,
            subscribe: (listener) => {
                this.listeners.add(listener);
                return () => { this.listeners.delete(listener); };
            },
        };
    }
    /** Inspect SDK readiness before offering installation or login actions. */
    async describe() {
        if (this.preparation !== undefined) {
            await this.preparation;
            return;
        }
        await this.describeNow();
    }
    async describeNow() {
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : 'error';
        this.publish(this.withoutFailure('checking', true));
        await this.invoke(() => this.connector.describe(), fallbackStatus);
    }
    /** Read the official release index without changing the active environment. */
    async checkForUpdates() {
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : this.snapshot.installedSdkVersion === null ? 'not-ready' : 'ready';
        this.publish(this.withoutFailure('checking', true));
        await this.invoke(() => this.connector.checkForUpdates(), fallbackStatus);
    }
    /** Inspect and automatically prepare the private runtime when no SDK is active. */
    async prepare() {
        if (this.preparation !== undefined)
            return this.preparation;
        const operation = this.prepareOnce();
        this.preparation = operation;
        try {
            await operation;
        }
        finally {
            if (this.preparation === operation)
                this.preparation = undefined;
        }
    }
    async prepareOnce() {
        await this.describeNow();
        const status = this.source.getSnapshot().status;
        if (status === 'not-ready')
            await this.bootstrap();
        else if (status === 'ready' || status === 'connected')
            await this.checkForUpdates();
    }
    /** Install the latest compatible SDK for automatic first-run preparation or explicit retry. */
    async bootstrap() {
        this.publish(this.withoutFailure('bootstrapping'));
        await this.invoke(() => this.connector.bootstrap(), 'not-ready');
    }
    /** Install and activate a compatible newer candidate. */
    async update() {
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : 'ready';
        this.publish(this.withoutFailure('updating'));
        await this.invoke(() => this.connector.update(), fallbackStatus);
    }
    /** Rebuild the current release without modifying its active environment. */
    async repair() {
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : 'ready';
        this.publish(this.withoutFailure('repairing'));
        await this.invoke(() => this.connector.repair(), fallbackStatus);
    }
    /** Switch back to the previously verified immutable environment. */
    async rollback() {
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : 'ready';
        this.publish(this.withoutFailure('rolling-back'));
        await this.invoke(() => this.connector.rollback(), fallbackStatus);
    }
    /**
     * Authenticate an explicitly selected account form without inferring identity type.
     * @param kind - user-selected phone, email, or username form.
     * @param countryCode - phone calling code; ignored for email and username forms.
     * @param identifier - national phone number, email, or username according to kind.
     * @param password - write-only password forwarded once and never retained.
     */
    async connect(kind, countryCode, identifier, password) {
        if (this.snapshot.status === 'not-ready') {
            await this.bootstrap();
            const bootstrappedStatus = this.source.getSnapshot().status;
            if (bootstrappedStatus !== 'ready' && bootstrappedStatus !== 'connected')
                return;
        }
        const value = identifier.trim();
        if (value === '' || password === '') {
            this.publish({ ...this.snapshot, error: '请输入完整的账号与密码。', failureCode: 'invalid-request' });
            return;
        }
        const account = kind === 'phone'
            ? { kind, countryCallingCode: countryCode.trim() || '+86', nationalNumber: value }
            : kind === 'email'
                ? { kind, email: value }
                : { kind, username: value };
        const fallbackStatus = this.snapshot.status === 'connected' ? 'connected' : 'ready';
        this.publish(this.withoutFailure('connecting'));
        await this.invoke(() => this.connector.login({ account, password }), fallbackStatus);
    }
    /** Request verified logout while preserving connected state when the SDK cannot log out. */
    async disconnect() {
        this.publish(this.withoutFailure('connecting'));
        await this.invoke(() => this.connector.logout(), 'connected');
    }
    async invoke(operation, fallbackStatus) {
        try {
            this.publishResult(await operation());
        }
        catch {
            this.publish({
                ...this.snapshot,
                status: fallbackStatus,
                error: '无法连接 Panda 宿主服务，请检查应用连接后重试。',
                failureCode: 'remote-failed',
            });
        }
    }
    publishResult(result) {
        const state = result.state;
        this.publish({
            ...snapshotFromPandaState(state),
            ...(result.ok ? {} : {
                error: PANDA_FAILURE_LABEL[result.code],
                failureCode: result.code,
            }),
        });
    }
    publish(snapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners)
            listener();
    }
    withoutFailure(status, preserveFailure = false) {
        if (preserveFailure)
            return { ...this.snapshot, status };
        const { error: _error, failureCode: _failureCode, lastFailure: _lastFailure, ...current } = this.snapshot;
        return { ...current, status };
    }
}
function snapshotFromPandaState(state) {
    const retainedFailure = state.lastFailure;
    return {
        status: state.phase,
        credentialPersistence: state.credentialPersistence,
        reconnectState: state.reconnectState,
        dataReadiness: state.dataReadiness,
        lastDataValidatedAt: state.lastDataValidatedAt,
        executionReadiness: state.executionReadiness,
        executionIsolation: state.executionIsolation,
        executionBackend: state.executionBackend,
        lastExecutionCheckedAt: state.lastExecutionCheckedAt,
        lastFailure: retainedFailure,
        requiredSdkVersion: state.requiredSdkVersion,
        installedSdkVersion: state.installedSdkVersion,
        latestSdkVersion: state.latestSdkVersion,
        updateAvailable: state.updateAvailable,
        rollbackSdkVersion: state.rollbackSdkVersion,
        pythonVersion: state.pythonVersion,
        pythonSource: state.pythonSource,
        apiFingerprint: state.apiFingerprint,
        capabilities: state.capabilities,
        lastUpdateCheckedAt: state.lastUpdateCheckedAt,
        logoutSupported: state.logoutSupported,
        ...(retainedFailure === null ? {} : {
            failureCode: retainedFailure.code,
            error: PANDA_FAILURE_LABEL[retainedFailure.code],
        }),
    };
}
function projectCatalog(snapshot) {
    return {
        snapshotId: snapshot.snapshotId,
        refreshAfterMs: snapshot.refreshAfterMs,
        sync: snapshot.sync,
        categories: snapshot.categories.map(category => ({
            id: category.id,
            label: category.labelZh.trim() || category.labelEn,
            subcategories: category.subcategories.map(subcategory => ({
                id: subcategory.id,
                label: subcategory.labelZh.trim() || subcategory.labelEn,
            })),
        })),
        assets: snapshot.assets.map(projectAsset),
    };
}
function projectAsset(asset) {
    const original = asset.summaryZh?.trim() || asset.summaryEn?.trim() || asset.description?.trim() || '';
    const translation = CATALOG_ZH[asset.assetId];
    const summary = hasChinese(original) ? original : translation?.summary ?? '该技能尚未提供中文简介，打开详情可查看原始说明。';
    const sourceTitle = asset.displayNames.zhCN.trim();
    const catalogTitle = hasChinese(sourceTitle) ? sourceTitle : translation?.title ?? (sourceTitle || asset.assetId);
    return {
        name: asset.assetId,
        title: catalogTitle,
        catalogTitle,
        englishTitle: asset.displayNames.en?.trim() || asset.title?.trim() || '',
        aliases: asset.aliases,
        nameSource: asset.nameSource,
        summary,
        description: asset.description?.trim() || original,
        projectType: asset.kind,
        category: asset.category ?? '',
        subcategory: asset.subcategory ?? '',
        commitSha: asset.commit,
        declarationFile: asset.declaration,
        url: asset.repository,
        health: asset.health ?? 'unknown',
        validationLevel: asset.validationLevel ?? 'unknown',
        requires: asset.requires ?? [],
    };
}
function projectInstalled(snapshot) {
    const versions = {};
    for (const version of snapshot.versions) {
        const projected = projectInstalledVersion(version);
        versions[projected.assetName] ??= [];
        versions[projected.assetName]?.push(projected);
    }
    return versions;
}
function projectInstalledVersion(version) {
    return {
        versionId: version.versionId,
        assetName: version.assetId,
        projectType: version.kind,
        commitSha: version.commit,
        declarationFile: version.declaration,
        installedAt: version.installedAt,
        origin: version.origin,
        exposure: version.exposure,
        ...(version.declarationTitleZh === undefined ? {} : { declarationTitleZh: version.declarationTitleZh }),
    };
}
function applyInstalledDeclarationNames(assets, versionsByAsset) {
    return assets.map((asset) => {
        const declarationTitleZh = versionsByAsset[asset.name]
            ?.find(version => version.commitSha === asset.commitSha)
            ?.declarationTitleZh
            ?.trim();
        if (declarationTitleZh === undefined || declarationTitleZh === '')
            return asset;
        return {
            ...asset,
            title: declarationTitleZh,
            catalogTitle: declarationTitleZh,
            nameSource: 'declaration',
        };
    });
}
/**
 * Apply durable user-local display names without changing catalog identities or bindings.
 * @param snapshot - Host-backed catalog projection.
 * @param overrides - validated user preference rows.
 * @returns a catalog whose effective titles use the user override first.
 */
export function applyAssetDisplayNameOverrides(snapshot, overrides) {
    if (overrides.length === 0)
        return snapshot;
    const names = new Map(overrides.map(entry => [entry.assetId, entry.displayName.trim()]));
    return {
        ...snapshot,
        assets: snapshot.assets.map((asset) => {
            const title = names.get(asset.name);
            return title === undefined || title === ''
                ? asset
                : { ...asset, title, nameSource: 'user' };
        }),
    };
}
function remoteErrorCode(error) {
    if (!(error instanceof Error) || !('code' in error))
        return undefined;
    const code = error.code;
    return typeof code === 'string' ? code : undefined;
}
function catalogFailureLabel(code) {
    if (code === 'CATALOG_INVALID')
        return '宿主拒绝了无效的 QuantSkills 发布目录。';
    if (code === 'CATALOG_FETCH_FAILED')
        return '宿主暂时无法读取 QuantSkills 官方目录。';
    return '无法连接 QuantSkills 宿主服务。';
}
function installedFailureLabel(code) {
    if (code === 'INSTALL_RECORD_CORRUPT')
        return '宿主检测到损坏的 QuantSkills 安装记录。';
    return '无法从宿主读取已提交的 QuantSkills 版本。';
}
function installFailureLabel(code) {
    if (code === 'CATALOG_STALE')
        return '目录或资产版本已更新，请刷新后重试。';
    if (code === 'ASSET_NOT_FOUND')
        return '宿主已找不到该公开资产，请刷新目录。';
    if (code === 'INSTALL_LIMIT_EXCEEDED')
        return '该资产超出宿主安装限制。';
    if (code === 'INSTALL_INVALID_TREE')
        return '该资产未通过宿主完整性验证。';
    if (code === 'INSTALL_EXPOSURE_FAILED')
        return '已写入资产，但 技能 注册表未能验证该版本。';
    if (code === 'INSTALL_GIT_MISSING')
        return '客户端内置 Git 不可用。请重装 QuantSkills，或在网页版本机安装 Git 后重试。';
    if (code === 'INSTALL_GIT_FAILED')
        return '无法从 GitHub 或 Gitee 拉取该资产。请检查网络后重试。';
    if (code === 'INSTALL_WRITE_FAILED')
        return '宿主无法写入本地安装目录。';
    return '宿主未能完成 QuantSkills 安装。';
}
//# sourceMappingURL=catalog.js.map