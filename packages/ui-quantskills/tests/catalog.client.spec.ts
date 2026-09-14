// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PandaConnectionState, PandaConnectorResult, QuantSkillsAssetId, QuantSkillsCatalogSnapshot as HostCatalogSnapshot,
  QuantSkillsCommitSha, QuantSkillsInstalledSnapshot as HostInstalledSnapshot,
  QuantSkillsInstalledVersion as HostInstalledVersion, QuantSkillsInstalledVersionId, QuantSkillsSnapshotId,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import {
  applyAssetDisplayNameOverrides,
  PandaConnectionController, type PandaConnectorPort, QuantSkillsCatalogAutoChecker,
  QuantSkillsCatalogController, type QuantSkillsHostPort,
} from '../src/client/catalog.ts'

const ASSET_ID = 'skill-five-day-momentum' as QuantSkillsAssetId
const SNAPSHOT_ID = 'snapshot-2026-08-20' as QuantSkillsSnapshotId
const COMMIT = 'a'.repeat(40) as QuantSkillsCommitSha

const hostCatalog: HostCatalogSnapshot = {
  snapshotId: SNAPSHOT_ID,
  refreshAfterMs: 300_000,
  sync: { mode: 'manual', state: 'idle' },
  categories: Array.from({ length: 11 }, (_, index) => ({
    id: String(index + 1).padStart(2, '0'),
    labelZh: `动态分类 ${index + 1}`,
    labelEn: `Dynamic category ${index + 1}`,
    subcategories: [],
  })),
  assets: [{
    assetId: ASSET_ID,
    kind: 'skill',
    repository: 'https://github.com/quantskills/skill-five-day-momentum',
    commit: COMMIT,
    declaration: 'SKILL.md',
    displayNames: { zhCN: '五日动量因子', en: 'Five Day Momentum' },
    aliases: ['动量因子'],
    nameSource: 'catalog',
    title: '五日动量因子',
    summaryZh: '五日动量研究',
    description: '计算并验证五日动量。',
    category: '02',
    subcategory: '02.factor-generation',
    health: 'healthy',
    validationLevel: 'verified',
    requires: [],
  }],
}

const installedVersion: HostInstalledVersion = {
  versionId: 'skill-five-day-momentum@aaaaaaaaaaaa' as QuantSkillsInstalledVersionId,
  assetId: ASSET_ID,
  kind: 'skill',
  repository: 'https://github.com/quantskills/skill-five-day-momentum',
  commit: COMMIT,
  declaration: 'SKILL.md',
  treeDigest: 'b'.repeat(64) as QuantSkillsTreeDigest,
  fileCount: 3,
  totalBytes: 2048,
  installedAt: 1_787_171_200_000,
  exposure: 'skill-registry',
  origin: 'catalog',
}

function host(overrides: Partial<QuantSkillsHostPort> = {}): QuantSkillsHostPort {
  return {
    catalog: vi.fn(async () => hostCatalog),
    list: vi.fn(async () => ({ versions: [] } satisfies HostInstalledSnapshot)),
    install: vi.fn(async () => installedVersion),
    ...overrides,
  }
}

function codedFailure(code: string): Error & { code: string } {
  return Object.assign(new Error('untrusted Host detail'), { code })
}

describe('QuantSkillsCatalogController', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.useRealTimers() })

  it('localizes missing catalog copy while preserving installation identity and the original description', async () => {
    const original = 'Analyze A-share cross-sectional market participation.'
    const assetId = 'skill-a-share-market-participation' as QuantSkillsAssetId
    const controller = new QuantSkillsCatalogController(host({
      catalog: async () => ({
        ...hostCatalog,
        assets: [{ ...hostCatalog.assets[0]!, assetId, displayNames: { zhCN: assetId, en: 'Market participation' }, summaryZh: original, description: original }],
      }),
    }))
    await controller.refresh()
    expect(controller.source.getSnapshot().assets[0]).toMatchObject({
      name: assetId,
      title: 'A股市场参与度分析',
      commitSha: COMMIT,
      description: original,
    })
    expect(controller.source.getSnapshot().assets[0]?.summary).toMatch(/市场|参与|宽度/u)
    controller.dispose()
  })

  it('projects only the trusted Host catalog and committed installation list', async () => {
    const browserRead = vi.spyOn(Storage.prototype, 'getItem')
    const browserWrite = vi.spyOn(Storage.prototype, 'setItem')
    const port = host()
    const controller = new QuantSkillsCatalogController(port)

    await controller.refresh()

    expect(port.catalog).toHaveBeenCalledOnce()
    expect(port.list).toHaveBeenCalledOnce()
    const snapshot = controller.source.getSnapshot()
    expect(snapshot.phase).toBe('ready')
    expect(snapshot.installedPhase).toBe('ready')
    expect(snapshot.categories).toHaveLength(11)
    expect(snapshot.categories.at(-1)).toEqual({ id: '11', label: '动态分类 11', subcategories: [] })
    expect(snapshot.assets.map(asset => asset.name)).toEqual(['skill-five-day-momentum'])
    expect(snapshot.versionsByAsset).toEqual({})
    expect(browserRead).not.toHaveBeenCalled()
    expect(browserWrite).not.toHaveBeenCalled()
  })

  it('promotes an installed declaration H1 for the exact catalog commit', async () => {
    const controller = new QuantSkillsCatalogController(host({
      list: vi.fn(async () => ({
        versions: [{ ...installedVersion, declarationTitleZh: '声明中的五日动量因子' }],
      })),
    }))

    await controller.refresh()

    expect(controller.source.getSnapshot().assets[0]).toMatchObject({
      title: '声明中的五日动量因子',
      catalogTitle: '声明中的五日动量因子',
      nameSource: 'declaration',
    })
  })

  it('applies user-local names first without changing technical identity', () => {
    const snapshot = applyAssetDisplayNameOverrides({
      phase: 'ready',
      installedPhase: 'ready',
      sync: { mode: 'manual', state: 'idle' },
      categories: [],
      assets: [{
        name: ASSET_ID,
        title: '五日动量因子',
        catalogTitle: '五日动量因子',
        englishTitle: 'Five Day Momentum',
        aliases: [],
        nameSource: 'generated',
        summary: '',
        description: '',
        projectType: 'skill',
        category: '',
        subcategory: '',
        commitSha: COMMIT,
        declarationFile: 'SKILL.md',
        url: '',
        health: 'healthy',
        validationLevel: 'verified',
        requires: [],
      }],
      versionsByAsset: {},
      installing: new Set(),
    }, [{ assetId: ASSET_ID, displayName: '我的动量因子' }])

    expect(snapshot.assets[0]).toMatchObject({
      name: ASSET_ID,
      title: '我的动量因子',
      catalogTitle: '五日动量因子',
      nameSource: 'user',
    })
  })

  it('uses the Host-resolved asset-id fallback when no localized name exists', async () => {
    const { title: _title, ...untitledAsset } = hostCatalog.assets[0]!
    const untitledCatalog: HostCatalogSnapshot = {
      ...hostCatalog,
      assets: [{
        ...untitledAsset,
        displayNames: { zhCN: ASSET_ID },
        aliases: [],
        nameSource: 'asset-id',
      }],
    }
    const controller = new QuantSkillsCatalogController(host({
      catalog: vi.fn(async () => untitledCatalog),
    }))

    await controller.refresh()

    expect(controller.source.getSnapshot().assets[0]?.title).toBe(ASSET_ID)
  })

  it('shows an empty unavailable catalog instead of browser fallback data', async () => {
    const controller = new QuantSkillsCatalogController(host({
      catalog: vi.fn(async () => { throw codedFailure('CATALOG_FETCH_FAILED') }),
    }))

    await controller.refresh()

    const snapshot = controller.source.getSnapshot()
    expect(snapshot.phase).toBe('error')
    expect(snapshot.assets).toEqual([])
    expect(snapshot.categories).toEqual([])
    expect(snapshot.catalogError).toBe('宿主暂时无法读取 QuantSkills 官方目录。')
    expect(JSON.stringify(snapshot)).not.toContain('untrusted Host detail')
  })

  it('retains the last Host catalog as stale without reading browser cache', async () => {
    const catalog = vi.fn<QuantSkillsHostPort['catalog']>()
      .mockResolvedValueOnce(hostCatalog)
      .mockRejectedValueOnce(codedFailure('CATALOG_FETCH_FAILED'))
    const controller = new QuantSkillsCatalogController(host({ catalog }))

    await controller.refresh()
    await controller.refresh()

    const snapshot = controller.source.getSnapshot()
    expect(snapshot.phase).toBe('stale')
    expect(snapshot.snapshotId).toBe(SNAPSHOT_ID)
    expect(snapshot.assets.map(asset => asset.name)).toEqual([ASSET_ID])
  })

  it('installs the exact observed snapshot and commit, then re-reads Host truth', async () => {
    const list = vi.fn<QuantSkillsHostPort['list']>()
      .mockResolvedValueOnce({ versions: [] })
      .mockResolvedValueOnce({ versions: [installedVersion] })
    const install = vi.fn(async () => installedVersion)
    const controller = new QuantSkillsCatalogController(host({ list, install }))
    await controller.refresh()

    const result = await controller.install(controller.source.getSnapshot().assets[0]!)

    expect(install).toHaveBeenCalledWith({
      assetId: ASSET_ID,
      observedSnapshotId: SNAPSHOT_ID,
      observedCommit: COMMIT,
    }, expect.any(AbortSignal))
    expect(list).toHaveBeenCalledTimes(2)
    expect(result?.versionId).toBe(installedVersion.versionId)
    expect(controller.source.getSnapshot().versionsByAsset[ASSET_ID]).toEqual([
      expect.objectContaining({ commitSha: COMMIT, exposure: 'skill-registry' }),
    ])
    expect(controller.source.getSnapshot().installing.size).toBe(0)
  })

  it('never marks an asset installed when Host rejects a stale observation', async () => {
    const controller = new QuantSkillsCatalogController(host({
      install: vi.fn(async () => { throw codedFailure('CATALOG_STALE') }),
    }))
    await controller.refresh()

    const result = await controller.install(controller.source.getSnapshot().assets[0]!)

    expect(result).toBeUndefined()
    expect(controller.source.getSnapshot()).toMatchObject({
      phase: 'stale',
      operationCode: 'CATALOG_STALE',
      operationError: '目录或资产版本已更新，请刷新后重试。',
      versionsByAsset: {},
    })
  })

  it('reports an unavailable installed projection without fabricating versions', async () => {
    const controller = new QuantSkillsCatalogController(host({
      list: vi.fn(async () => { throw codedFailure('INSTALL_RECORD_CORRUPT') }),
    }))

    await controller.refresh()

    expect(controller.source.getSnapshot()).toMatchObject({
      installedPhase: 'error',
      versionsByAsset: {},
      installedError: '宿主检测到损坏的 QuantSkills 安装记录。',
    })
  })

  it('retains only the last Host-installed projection when a later list becomes stale', async () => {
    const list = vi.fn<QuantSkillsHostPort['list']>()
      .mockResolvedValueOnce({ versions: [installedVersion] })
      .mockRejectedValueOnce(codedFailure('REMOTE_UNAVAILABLE'))
    const controller = new QuantSkillsCatalogController(host({ list }))

    await controller.refresh()
    await controller.refresh()

    expect(controller.source.getSnapshot()).toMatchObject({
      installedPhase: 'stale',
      installedError: '无法从宿主读取已提交的 QuantSkills 版本。',
    })
    expect(controller.source.getSnapshot().versionsByAsset[ASSET_ID]).toHaveLength(1)
  })

  it('aborts a superseded catalog request and publishes only the newer response', async () => {
    let firstSignal: AbortSignal | undefined
    const catalog = vi.fn<QuantSkillsHostPort['catalog']>()
      .mockImplementationOnce(signal => new Promise((_resolve, reject) => {
        firstSignal = signal
        signal?.addEventListener('abort', () => {
          reject(signal.reason instanceof Error ? signal.reason : new Error('catalog request aborted'))
        }, { once: true })
      }))
      .mockResolvedValueOnce(hostCatalog)
    const controller = new QuantSkillsCatalogController(host({ catalog }))

    const first = controller.refreshCatalog()
    await vi.waitFor(() => { expect(catalog).toHaveBeenCalledOnce() })
    const second = controller.refreshCatalog()
    await Promise.all([first, second])

    expect(firstSignal?.aborted).toBe(true)
    expect(controller.source.getSnapshot()).toMatchObject({ phase: 'ready', snapshotId: SNAPSHOT_ID })
  })

  it('aborts active Host work and suppresses late errors when disposed', async () => {
    let signal: AbortSignal | undefined
    const catalog = vi.fn<QuantSkillsHostPort['catalog']>(active => new Promise((_resolve, reject) => {
      signal = active
      active?.addEventListener('abort', () => {
        reject(active.reason instanceof Error ? active.reason : new Error('catalog request aborted'))
      }, { once: true })
    }))
    const controller = new QuantSkillsCatalogController(host({ catalog }))
    const refreshing = controller.refreshCatalog()
    await vi.waitFor(() => { expect(catalog).toHaveBeenCalledOnce() })

    controller.dispose()
    await refreshing

    expect(signal?.aborted).toBe(true)
    expect(controller.source.getSnapshot()).not.toHaveProperty('catalogError')
  })

  it('keeps the required initial load separate and applies the live interval preference', async () => {
    vi.useFakeTimers()
    const port = host()
    const controller = new QuantSkillsCatalogController(port)
    const checker = new QuantSkillsCatalogAutoChecker(controller, window)

    await controller.refreshCatalog()
    checker.start()
    expect(port.catalog).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(299_999)
    expect(port.catalog).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(port.catalog).toHaveBeenCalledTimes(2)

    checker.setEnabled(false)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(port.catalog).toHaveBeenCalledTimes(2)

    checker.setEnabled(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(port.catalog).toHaveBeenCalledTimes(3)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(port.catalog).toHaveBeenCalledTimes(4)

    checker.dispose()
    await vi.advanceTimersByTimeAsync(300_000)
    expect(port.catalog).toHaveBeenCalledTimes(4)
  })

  it('suppresses fallback checks while the Host event stream is connected', async () => {
    vi.useFakeTimers()
    const port = host()
    const controller = new QuantSkillsCatalogController(port)
    const checker = new QuantSkillsCatalogAutoChecker(controller, window)

    await controller.refreshCatalog()
    checker.start()
    checker.setEventStreamConnected(true)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(600_000)
    expect(port.catalog).toHaveBeenCalledOnce()

    checker.setEventStreamConnected(false)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(port.catalog).toHaveBeenCalledTimes(2)
    checker.dispose()
  })

  it('retries an unavailable initial catalog even when the Host event stream is connected', async () => {
    const catalog = vi.fn<QuantSkillsHostPort['catalog']>()
      .mockRejectedValueOnce(codedFailure('CATALOG_FETCH_FAILED'))
      .mockResolvedValueOnce(hostCatalog)
    const controller = new QuantSkillsCatalogController(host({ catalog }))
    const checker = new QuantSkillsCatalogAutoChecker(controller, window)

    await controller.refreshCatalog()
    checker.setEventStreamConnected(true)
    checker.start()

    await vi.waitFor(() => { expect(catalog).toHaveBeenCalledTimes(2) })
    expect(controller.source.getSnapshot()).toMatchObject({ phase: 'ready', snapshotId: SNAPSHOT_ID })
    checker.dispose()
  })
})

describe('PandaConnectionController', () => {
  const notReady: PandaConnectionState = {
    phase: 'not-ready',
    credentialPersistence: 'unavailable',
    reconnectState: 'idle',
    dataReadiness: 'unchecked',
    lastDataValidatedAt: null,
    executionReadiness: 'unchecked',
    executionIsolation: null,
    executionBackend: null,
    lastExecutionCheckedAt: null,
    lastFailure: null,
    requiredSdkVersion: '0.0.12',
    installedSdkVersion: null,
    latestSdkVersion: null,
    updateAvailable: false,
    rollbackSdkVersion: null,
    pythonVersion: null,
    pythonSource: null,
    apiFingerprint: null,
    capabilities: null,
    lastUpdateCheckedAt: null,
    logoutSupported: false,
  }
  const ready: PandaConnectionState = {
    phase: 'ready',
    credentialPersistence: 'os-keyring',
    reconnectState: 'idle',
    dataReadiness: 'unchecked',
    lastDataValidatedAt: null,
    executionReadiness: 'unchecked',
    executionIsolation: null,
    executionBackend: null,
    lastExecutionCheckedAt: null,
    lastFailure: null,
    requiredSdkVersion: '0.0.12',
    installedSdkVersion: '0.0.12',
    latestSdkVersion: '0.0.12',
    updateAvailable: false,
    rollbackSdkVersion: null,
    pythonVersion: '3.11.9',
    pythonSource: 'configured',
    apiFingerprint: 'test-fingerprint',
    capabilities: { authentication: true, marketData: true, indexData: true, marginData: true },
    lastUpdateCheckedAt: 1,
    logoutSupported: false,
  }
  const connected: PandaConnectionState = {
    ...ready,
    phase: 'connected',
    dataReadiness: 'verified',
    lastDataValidatedAt: 2,
    executionReadiness: 'ready',
    executionIsolation: 'partial',
    executionBackend: 'windows-acl',
    lastExecutionCheckedAt: 3,
  }

  function success(state: PandaConnectionState): PandaConnectorResult {
    return { ok: true, state }
  }

  function connector(overrides: Partial<PandaConnectorPort> = {}): PandaConnectorPort {
    return {
      describe: vi.fn(async () => success(notReady)),
      checkForUpdates: vi.fn(async () => success(notReady)),
      bootstrap: vi.fn(async () => success(ready)),
      update: vi.fn(async () => success(ready)),
      repair: vi.fn(async () => success(ready)),
      rollback: vi.fn(async () => success(ready)),
      login: vi.fn(async () => success(connected)),
      logout: vi.fn(async () => success(ready)),
      ...overrides,
    }
  }

  it('describes readiness without installing until the user requests bootstrap', async () => {
    const port = connector()
    const controller = new PandaConnectionController(port)

    await controller.describe()

    expect(port.describe).toHaveBeenCalledOnce()
    expect(port.bootstrap).not.toHaveBeenCalled()
    expect(port.login).not.toHaveBeenCalled()
    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'not-ready',
      requiredSdkVersion: '0.0.12',
      installedSdkVersion: null,
      logoutSupported: false,
    })

    await controller.bootstrap()

    expect(port.bootstrap).toHaveBeenCalledOnce()
    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'ready',
      requiredSdkVersion: '0.0.12',
      installedSdkVersion: '0.0.12',
      logoutSupported: false,
    })
  })

  it('automatically prepares a missing private runtime on first use', async () => {
    const port = connector()
    const controller = new PandaConnectionController(port)

    await controller.prepare()

    expect(port.describe).toHaveBeenCalledOnce()
    expect(port.bootstrap).toHaveBeenCalledOnce()
    expect(port.checkForUpdates).not.toHaveBeenCalled()
    expect(port.login).not.toHaveBeenCalled()
    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'ready',
      installedSdkVersion: '0.0.12',
    })
  })

  it('shares one first-run preparation with an immediate launch check', async () => {
    let resolveDescribe!: (result: PandaConnectorResult) => void
    const describe = vi.fn(() => new Promise<PandaConnectorResult>((resolve) => {
      resolveDescribe = resolve
    }))
    const port = connector({ describe })
    const controller = new PandaConnectionController(port)

    const preparation = controller.prepare()
    const launchCheck = controller.describe()
    expect(describe).toHaveBeenCalledOnce()

    resolveDescribe(success(notReady))
    await Promise.all([preparation, launchCheck])

    expect(describe).toHaveBeenCalledOnce()
    expect(port.bootstrap).toHaveBeenCalledOnce()
    expect(controller.source.getSnapshot().status).toBe('ready')
  })

  it('checks updates without rebuilding an already active runtime', async () => {
    const port = connector({ describe: vi.fn(async () => success(ready)) })
    const controller = new PandaConnectionController(port)

    await controller.prepare()

    expect(port.describe).toHaveBeenCalledOnce()
    expect(port.bootstrap).not.toHaveBeenCalled()
    expect(port.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('forwards only the explicitly selected account form and retains no credential state', async () => {
    const port = connector({ describe: vi.fn(async () => success(ready)) })
    const controller = new PandaConnectionController(port)

    await controller.describe()
    await controller.connect('phone', '+44', ' 13800138000 ', 'phone-secret')
    await controller.connect('email', '+852', ' analyst@example.com ', 'email-secret')
    await controller.connect('username', '+1', '13800138000', 'username-secret')

    expect(port.login).toHaveBeenNthCalledWith(1, {
      account: { kind: 'phone', countryCallingCode: '+44', nationalNumber: '13800138000' },
      password: 'phone-secret',
    })
    expect(port.login).toHaveBeenNthCalledWith(2, {
      account: { kind: 'email', email: 'analyst@example.com' },
      password: 'email-secret',
    })
    expect(port.login).toHaveBeenNthCalledWith(3, {
      account: { kind: 'username', username: '13800138000' },
      password: 'username-secret',
    })
    expect(JSON.stringify(controller.source.getSnapshot())).not.toMatch(/secret|13800138000|analyst/)
  })

  it('keeps the verified connection when the private SDK cannot log out', async () => {
    const port = connector({
      describe: vi.fn(async () => success(connected)),
      logout: vi.fn(async (): Promise<PandaConnectorResult> => ({
        ok: false,
        code: 'logout-unsupported',
        message: 'not exposed',
        state: connected,
      })),
    })
    const controller = new PandaConnectionController(port)

    await controller.describe()
    await controller.disconnect()

    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'connected',
      requiredSdkVersion: '0.0.12',
      installedSdkVersion: '0.0.12',
      logoutSupported: false,
      failureCode: 'logout-unsupported',
      error: '当前 PandaData SDK 不支持可靠登出，连接仍然保留。',
    })
  })

  it('shows a fixed transport failure without exposing submitted values', async () => {
    const port = connector({
      describe: vi.fn(async () => success(ready)),
      login: vi.fn(async () => { throw new Error('worker leaked secret-value') }),
    })
    const controller = new PandaConnectionController(port)

    await controller.describe()
    await controller.connect('username', '+86', 'private-account', 'secret-value')

    const serialized = JSON.stringify(controller.source.getSnapshot())
    expect(serialized).toContain('无法连接 Panda 宿主服务')
    expect(serialized).not.toMatch(/secret-value|private-account|worker leaked/)
  })

  it('retains the exact Host failure through describe and update checks', async () => {
    const failedAt = Date.now()
    const failedState: PandaConnectionState = {
      ...ready,
      latestSdkVersion: '0.0.14',
      updateAvailable: true,
      lastFailure: { operation: 'update', code: 'network-unavailable', occurredAt: failedAt },
    }
    let resolveDescribe: ((result: PandaConnectorResult) => void) | undefined
    const port = connector({
      update: vi.fn(async (): Promise<PandaConnectorResult> => ({
        ok: false,
        code: 'network-unavailable',
        message: 'fixed',
        state: failedState,
      })),
      describe: vi.fn(() => new Promise<PandaConnectorResult>((resolve) => { resolveDescribe = resolve })),
      checkForUpdates: vi.fn(async () => success(failedState)),
    })
    const controller = new PandaConnectionController(port)

    await controller.update()
    expect(controller.source.getSnapshot()).toMatchObject({
      failureCode: 'network-unavailable',
      error: '暂时无法连接 PandaData；已保存的登录信息会在网络恢复后重试。',
      lastFailure: { operation: 'update', occurredAt: failedAt },
    })

    const describing = controller.describe()
    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'checking',
      failureCode: 'network-unavailable',
    })
    resolveDescribe?.(success(failedState))
    await describing
    await controller.checkForUpdates()

    expect(controller.source.getSnapshot()).toMatchObject({
      status: 'ready',
      failureCode: 'network-unavailable',
      lastFailure: { operation: 'update', occurredAt: failedAt },
    })
  })
})
