/** QuantSkills native-plugin bundle manifest and composition contract. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applyEntryPatches, entryListSchema, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import * as yaml from 'js-yaml'

const root = fileURLToPath(new URL('..', import.meta.url))

function patches(path: string): PatchOptions[] {
  const parsed = yaml.load(readFileSync(path, 'utf8'), { schema: entryListSchema })
  if (!Array.isArray(parsed)) throw new TypeError(`${path} must parse to a patch list`)
  return parsed as PatchOptions[]
}

describe('dsh-quantskills-plugin bundle', () => {
  it('publishes executable Agent Team and client Host entries', async () => {
    const agentTeam = await import('../packages/agent-team/lib/index.js')
    const clientRemotesHost = await import('../packages/client-remotes-quantskills/lib/index.js')
    const clientHost = await import('../packages/ui-quantskills/lib/index.js')

    expect(typeof agentTeam.default).toBe('function')
    expect(typeof agentTeam.TeamTaskId).toBe('function')
    expect(typeof clientRemotesHost.apply).toBe('function')
    expect(typeof clientHost.apply).toBe('function')
  })

  it('mounts generated Remote faces before the application waits for them', () => {
    const remotes = readFileSync(resolve(root, 'packages/client-remotes-quantskills/lib/client.js'), 'utf8')
    const client = readFileSync(resolve(root, 'packages/ui-quantskills/lib/client.js'), 'utf8')

    for (const service of ['remote.quantSkills', 'remote.quantSkillsSessions', 'remote.pandaMcp']) {
      expect(client).toContain(`"${service}"`)
    }
    for (const namespace of ['quantSkills', 'quantSkillsSessions', 'pandaMcp']) {
      expect(remotes).toContain(namespace)
    }
    expect(remotes).not.toContain('pandaConnector/bootstrap')
    expect(remotes).toContain('$mount')
  })

  it('keeps generated client module paths portable', () => {
    let regionCount = 0
    for (const relativePath of [
      'packages/client-remotes-quantskills/lib/client.js',
      'packages/client-ui-chat/lib/client.js',
      'packages/client-ui-conversation/lib/client.js',
      'packages/client-ui-input-trigger/lib/client.js',
      'packages/client-ui-layout/lib/client.js',
      'packages/ui-quantskills/lib/client.js',
    ]) {
      const client = readFileSync(resolve(root, relativePath), 'utf8')
      const regions = [...client.matchAll(/^\s*\/\/#region \\0dsh-(?:css|png|image):(.+)$/gm)]
      regionCount += regions.length
      for (const region of regions) expect(region[1], relativePath).toMatch(/^packages\//)
    }
    expect(regionCount).toBeGreaterThan(0)
  })

  it('keeps ordinary Sessions independent from PandaData runtime readiness', () => {
    const clientSource = readFileSync(resolve(root, 'packages/ui-quantskills/src/client/index.ts'), 'utf8')
    const hostSource = readFileSync(resolve(root, 'packages/quantskills-session/src/index.ts'), 'utf8')
    const remoteFace = readFileSync(resolve(root, 'packages/quantskills-session/lib/typert.remote-client.js'), 'utf8')
    const start = clientSource.indexOf('const startPlainSession = async')
    const end = clientSource.indexOf('const renameSession = async', start)
    const startPlainSession = clientSource.slice(start, end)
    const createStart = hostSource.indexOf("@Remote('plainSessionCreate')")
    const createEnd = hostSource.indexOf("@Remote('create')", createStart)
    const plainSessionCreate = hostSource.slice(createStart, createEnd)
    const setupStart = hostSource.indexOf('if (loggedPlain !== null || plainReservation !== undefined)')
    const setupEnd = hostSource.indexOf('if (loggedTeam !== null || teamReservation !== undefined)', setupStart)
    const plainSetup = hostSource.slice(setupStart, setupEnd)

    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    expect(startPlainSession).toContain('plainSessionCreate')
    expect(startPlainSession).not.toContain('runPandaGated')
    expect(startPlainSession).not.toContain('authenticatePandaMcp')
    expect(startPlainSession).not.toContain('pandaMcp')
    expect(createStart).toBeGreaterThanOrEqual(0)
    expect(createEnd).toBeGreaterThan(createStart)
    expect(plainSessionCreate).not.toContain('ensureDefaultPandaRuntime')
    expect(plainSessionCreate).not.toContain('PANDA_RUNTIME_EVENT')
    expect(setupStart).toBeGreaterThanOrEqual(0)
    expect(setupEnd).toBeGreaterThan(setupStart)
    expect(plainSetup).not.toContain('ensureDefaultPandaRuntime')
    expect(plainSetup).not.toContain('registerPandaPythonTool')
    expect(remoteFace).toContain('quantSkillsSessions/plainSessionList')
  })

  it('restores the QuantSkills frame for owned Sessions and keeps the empty capability entry visible', () => {
    const clientSource = readFileSync(resolve(root, 'packages/ui-quantskills/src/client/index.ts'), 'utf8')
    const appSource = readFileSync(resolve(root, 'packages/ui-quantskills/src/client/QuantSkillsApp.tsx'), 'utf8')
    const capabilitySource = readFileSync(
      resolve(root, 'packages/ui-quantskills/src/client/QuantSkillsCapabilityPicker.tsx'),
      'utf8',
    )

    expect(clientSource).toContain('restore the plugin frame for QuantSkills-owned Sessions')
    expect(clientSource).toContain('sessionSnapshot.plainArchives.some')
    expect(clientSource).toContain('sessionSnapshot.archives.some')
    expect(clientSource).toContain('agentSnapshot.archives.some')
    expect(clientSource).toContain('agentSnapshot.teamArchives.some')
    expect(clientSource).toContain('suppressedPluginSessionId')
    expect(clientSource).toMatch(/suppressedPluginSessionId = undefined\r?\n\s+view\.actions\.openPlugin\(\)/)
    expect(appSource).toContain('sidebarOnly')
    expect(appSource).toContain("['panda-data', <Database/>, 'PandaData']")
    expect(appSource).toContain('authenticatePandaMcp')
    expect(appSource).not.toContain('type="password"')
    const pandaMcpSource = readFileSync(resolve(root, 'packages/panda-mcp/src/index.ts'), 'utf8')
    expect(pandaMcpSource).toContain('Never ask for a password')
    expect(pandaMcpSource).toContain('Never switch to AkShare, Yahoo, Tushare')
    expect(appSource).not.toContain("PropsRenderSlots<'quantskills.page' | 'quantskills.results' | 'conversation'>")
    expect(capabilitySource).not.toContain('if (resident.length === 0 && agent == null) return null')
    expect(capabilitySource).toContain('当前会话还没有加载 技能 或 专家。')
  })

  it('restores the 3082 launcher, exclusive columns, and QuantSkills conversation identity', () => {
    const layoutFrame = readFileSync(resolve(root, 'packages/client-ui-layout/src/client/AppFrame.tsx'), 'utf8')
    const layoutService = readFileSync(resolve(root, 'packages/client-ui-layout/src/client/service.ts'), 'utf8')
    const inputController = readFileSync(
      resolve(root, 'packages/client-ui-input-trigger/src/client/controller.ts'),
      'utf8',
    )
    const conversation = readFileSync(resolve(root, 'packages/client-ui-conversation/src/client/apply.ts'), 'utf8')
    const client = readFileSync(resolve(root, 'packages/ui-quantskills/src/client/index.ts'), 'utf8')
    const capabilitySource = readFileSync(
      resolve(root, 'packages/ui-quantskills/src/client/QuantSkillsCapabilityPicker.tsx'),
      'utf8',
    )

    expect(layoutFrame).toContain('data-exclusive-hidden')
    expect(layoutFrame).toContain("{ inert: '' }")
    expect(layoutService).toContain('claimSidebar(options: SidebarColumnClaimOptions)')
    expect(layoutService).toContain('claimDetails(options: DetailsColumnClaimOptions)')
    expect(inputController).toContain('toggleLauncher(hit: TriggerHit)')
    expect(conversation).toContain('inputTriggers.toggleLauncher')
    expect(conversation).toContain("'conversation.hero.identity': { kind: 'single', scope: 'root' }")
    expect(client).toContain("const stockLayout = ctx.get('layout')")
    expect(client).toContain('claimSidebar: claimOptions => stockLayout.claimSidebar(claimOptions)')
    expect(client).toContain('claimDetails: claimOptions => stockLayout.claimDetails(claimOptions)')
    expect(client).toContain("ctx.slots.inject('conversation.hero.identity'")
    expect(client).toContain("ctx.slots.inject('conversation.chat.turnStatus'")
    expect(capabilitySource).toContain("name: 'QuantSkills'")
    expect(capabilitySource).toContain("name: '常用'")
  })

  it('publishes one additive patch and declares every inserted package', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
      devDependencies?: Record<string, string>
      files?: string[]
      scripts?: Record<string, string>
    }
    const workspace = yaml.load(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8')) as {
      allowBuilds?: Record<string, boolean>
    }

    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toContain('cordis.patch.yml')
    expect(manifest.scripts).toMatchObject({
      'install:plugin': 'node ./scripts/retire-context-plugin.mjs && dsh plugin --profile web add . ./packages/agent-team ./packages/tool-agent-team ./packages/quantskills-host ./packages/quantskills-session ./packages/panda-mcp ./packages/client-ui-layout ./packages/client-ui-input-trigger ./packages/client-ui-conversation ./packages/client-ui-chat ./packages/client-remotes-quantskills ./node_modules/dsh-file-upload ./packages/ui-quantskills ./node_modules/dshmarket',
      'uninstall:plugin': 'dsh plugin --profile web remove @quantskills/dsh-plugin @deepseek-ai/dsh-agent-team @deepseek-ai/dsh-tool-agent-team @deepseek-ai/dsh-quantskills-host @deepseek-ai/dsh-quantskills-session @deepseek-ai/dsh-panda-mcp @deepseek-ai/dsh-client-ui-layout @deepseek-ai/dsh-client-ui-input-trigger @deepseek-ai/dsh-client-ui-conversation @deepseek-ai/dsh-client-ui-chat @deepseek-ai/dsh-client-remotes-quantskills dsh-file-upload @deepseek-ai/dsh-client-ui-quantskills dshmarket',
      preweb: 'node ./scripts/install-application-bootstrap.mjs',
      web: 'node ./scripts/launch-quantskills.mjs',
    })
    expect(manifest.devDependencies?.['@deepseek-ai/dsh']).toBe('0.1.2-alpha.2')
    expect(workspace.allowBuilds).toMatchObject({
      '@deepseek-ai/dsh-subprocess-local': true,
      '@google/genai': false,
      esbuild: true,
      koffi: true,
      'node-pty': true,
      protobufjs: false,
      'tesseract.js': false,
    })
    expect(Object.values(workspace.allowBuilds ?? {}).every(value => typeof value === 'boolean')).toBe(true)
    expect(manifest.dependencies).toEqual({
      '@deepseek-ai/dsh-agent-team': 'workspace:^',
      '@deepseek-ai/dsh-client-remotes-quantskills': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-chat': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-conversation': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-input-trigger': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-layout': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-quantskills': 'workspace:^',
      '@deepseek-ai/dsh-panda-connector': 'workspace:^',
      '@deepseek-ai/dsh-panda-mcp': 'workspace:^',
      '@deepseek-ai/dsh-quantskills-host': 'workspace:^',
      '@deepseek-ai/dsh-quantskills-session': 'workspace:^',
      '@deepseek-ai/dsh-tool-agent-team': 'workspace:^',
      dshmarket: '1.45.1',
      'dsh-file-upload': 'github:GLFzr/dsh-file-upload#baa569938c03404b4eac6c6740c27afb49b60ba8',
    })
    expect(patches(resolve(root, manifest.dsh!.bundle!.patch!))).toHaveLength(5)
  })

  it('keeps the native DSH shell owners enabled and appends QuantSkills once', () => {
    const overlay = patches(resolve(root, 'cordis.patch.yml'))
    const warnings: string[] = []
    const entries = applyEntryPatches([
      { id: 'ui-layout', name: '@deepseek-ai/dsh-client-ui-layout' },
      { id: 'ui-sidebar', name: '@deepseek-ai/dsh-client-ui-sidebar' },
      { id: 'workspace', name: '@deepseek-ai/dsh-workspace' },
      { id: 'ui-workspace', name: '@deepseek-ai/dsh-client-ui-workspace' },
      { id: 'ui-settings', name: '@deepseek-ai/dsh-client-ui-settings' },
      { id: 'ui-settings-models', name: '@deepseek-ai/dsh-client-ui-settings-models' },
      { id: 'system-prompt', name: '@deepseek-ai/dsh-system-prompt' },
      { id: 'web-runtime', name: '@deepseek-ai/dsh-web-app' },
      { id: 'skill-badge', name: '@deepseek-ai/dsh-skill-badge' },
      { id: 'ui-conversation', name: '@deepseek-ai/dsh-client-ui-conversation' },
      { id: 'ui-tool', name: '@deepseek-ai/dsh-client-ui-tool' },
    ], overlay, (message, ...args) => {
      let index = 0
      warnings.push(message.replace(/%C/g, () => JSON.stringify(args[index++])))
    })

    expect(warnings).toEqual([])
    expect(entries.find(row => row.id === 'ui-layout')).toMatchObject({
      id: 'ui-layout',
      name: '@deepseek-ai/dsh-client-ui-layout',
    })
    expect(entries.find(row => row.id === 'ui-layout')).not.toMatchObject({ disabled: true })
    expect(entries.find(row => row.id === 'ui-sidebar')).toMatchObject({
      id: 'ui-sidebar',
      name: '@deepseek-ai/dsh-client-ui-sidebar',
    })
    expect(entries.find(row => row.id === 'ui-sidebar')).not.toMatchObject({ disabled: true })
    for (const [id, name] of [
      ['workspace', '@deepseek-ai/dsh-workspace'],
      ['ui-workspace', '@deepseek-ai/dsh-client-ui-workspace'],
      ['ui-settings', '@deepseek-ai/dsh-client-ui-settings'],
      ['ui-conversation', '@deepseek-ai/dsh-client-ui-conversation'],
      ['ui-tool', '@deepseek-ai/dsh-client-ui-tool'],
    ]) {
      expect(entries.find(row => row.id === id)).toMatchObject({ id, name })
      expect(entries.find(row => row.id === id)).not.toMatchObject({ disabled: true })
    }
    expect(overlay.filter(patch => 'insert' in patch)).toHaveLength(1)
    expect(entries.find(row => row.id === 'ui-settings-models')).toMatchObject({
      id: 'ui-settings-models',
      disabled: true,
    })
    expect(entries.find(row => row.id === 'system-prompt')).toMatchObject({ config: { includeHarnessIdentity: false, persona: expect.stringContaining('You are QuantSkills') } })
    expect(entries.find(row => row.id === 'web-runtime')).toMatchObject({ config: { surfaceContext: false } })
    expect(entries.find(row => row.id === 'skill-badge')).toMatchObject({ disabled: true })
    expect(entries.filter(row => row.id === 'ui-quantskills')).toEqual([{
      id: 'ui-quantskills',
      name: '@deepseek-ai/dsh-client-ui-quantskills',
    }])
    expect(entries.filter(row => row.id === 'quantskills-host')).toHaveLength(1)
    expect(entries.filter(row => row.id === 'quantskills-session')).toHaveLength(1)
    expect(entries.filter(row => row.id === 'panda-connector')).toHaveLength(0)
    expect(entries.filter(row => row.id === 'panda-mcp')).toEqual([{
      id: 'panda-mcp',
      name: '@deepseek-ai/dsh-panda-mcp',
    }])
    expect(entries.findIndex(row => row.id === 'client-remotes-quantskills')).toBeLessThan(
      entries.findIndex(row => row.id === 'ui-quantskills'),
    )
    expect(entries.filter(row => row.id === 'file-upload')).toEqual([])
  })
})
