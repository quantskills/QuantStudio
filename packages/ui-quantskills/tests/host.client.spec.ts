import type { Context } from '@deepseek-ai/cordis'
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { boot, initProfile, readProfilePatches } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import { describe, expect, it, onTestFinished } from 'vitest'
import Settings from '@deepseek-ai/dsh-settings'
import { DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY } from '../src/appearance-settings.ts'
import * as Appearance from '../src/index.ts'
import {
  DEFAULT_QUANTSKILLS_SCALE,
  DEFAULT_QUANTSKILLS_AGENT_PERMISSION,
  DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
  DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA,
  DEFAULT_QUANTSKILLS_COLOR_SCHEME,
  DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
  DEFAULT_QUANTSKILLS_DARK_BACKGROUND,
  DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND,
  DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
  QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE,
} from '@deepseek-ai/dsh-client-ui-quantskills'

/** Real Loader + settings writer, with a private Profile for every test. */
async function fixture() {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'qs-preferences-'))), dir = join(home, 'profiles/web')
  onTestFinished(() => rmSync(home, { recursive: true, force: true }))
  initProfile(dir, ['test-bundle'])
  const bundle = join(dir, 'node_modules/test-bundle')
  mkdirSync(bundle, { recursive: true })
  writeFileSync(join(home, 'package.json'), '{"name":"qs-test-installation"}')
  writeFileSync(join(bundle, 'package.json'), JSON.stringify({ name: 'test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }))
  writeFileSync(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'config-editor', name: 'cordis:editor' }, { id: 'settings', name: 'cordis:settings' },
    { id: 'ui-quantskills', name: 'cordis:appearance' },
  ] }]))
  writeFileSync(join(dir, 'cordis.yml'), '[]')
  const profile = { name: 'web', startedBundles: ['test-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'),
    installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined }
  async function start(): Promise<Context> {
    const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), ctx => {
      ctx.provide('profileContext', profile)
      ctx.provide('appReady', { onReady: (listener: () => void) => { listener(); return () => {} } })
      Object.assign(ctx.loader.builtins, { editor: ConfigEditor, settings: Settings, appearance: Appearance })
    })
    onTestFinished(async () => { await ctx.fiber.dispose() })
    return ctx
  }
  return { start }
}
const value = (ctx: Context, ns: string) => ctx.settings.describe().find(row => row.ns === ns)?.value

describe('ui-quantskills host', () => {
  it.each(['motion-glass-blue', 'motion-glass-ink'])('restores %s and the separate rainy profile after a Host restart', async lightBackground => {
    const { start } = await fixture()
    const ns = QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE
    const original = await start()
    await original.settings.update(ns, { colorScheme: 'dark', darkBackground: 'motion-glass-rain', conversationOverlayOpacity: .64 })
    await original.settings.update(ns, { colorScheme: 'light', lightBackground })
    await expect(original.settings.update(ns, { darkBackground: lightBackground })).rejects.toThrow()
    await expect(original.settings.update(ns, { lightBackground: 'motion-glass-rain' })).rejects.toThrow()
    await original.fiber.dispose()
    const restored = await start()
    expect(value(restored, ns)).toMatchObject({ colorScheme: 'light', lightBackground, darkBackground: 'motion-glass-rain', conversationOverlayOpacity: .64 })
    await restored.fiber.dispose()
  })

  it('registers, validates, updates, and disposes every durable application preference', async () => {
    const { start } = await fixture()
    const ctx = await start()
    const ns = QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE
    expect(value(ctx, ns)).toEqual({
      interfaceScale: DEFAULT_QUANTSKILLS_SCALE,
      conversationScale: DEFAULT_QUANTSKILLS_SCALE,
      conversationBrightness: DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
      conversationOverlayOpacity: DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
      colorScheme: DEFAULT_QUANTSKILLS_COLOR_SCHEME,
      lightBackground: DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND,
      darkBackground: DEFAULT_QUANTSKILLS_DARK_BACKGROUND,
      autoCheckCatalog: DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
      autoCheckPanda: DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA,
      resumeAfterPandaLogin: DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
      favoriteAssetIds: [],
      assetDisplayNameOverrides: [],
      defaultAgentProvider: '',
      defaultAgentModel: '',
      defaultAgentReasoningEffort: '',
      defaultAgentPermission: DEFAULT_QUANTSKILLS_AGENT_PERMISSION,
    })
    await ctx.settings.update(ns, {
      conversationOverlayOpacity: 0.63,
      interfaceScale: 1.15,
      conversationScale: 0.95,
      conversationBrightness: 0.8,
      colorScheme: 'dark',
      lightBackground: 'network-sphere',
      darkBackground: 'orbital-rings',
      autoCheckCatalog: false,
      autoCheckPanda: false,
      resumeAfterPandaLogin: false,
      favoriteAssetIds: ['skill-five-day-momentum'],
      assetDisplayNameOverrides: [{ assetId: 'skill-five-day-momentum', displayName: '我的动量因子' }],
      defaultAgentProvider: 'deepseek-official',
      defaultAgentModel: 'deepseek-v4-pro',
      defaultAgentReasoningEffort: 'high',
      defaultAgentPermission: 'read-only',
    })
    expect(value(ctx, ns)).toEqual({
      conversationOverlayOpacity: 0.63,
      interfaceScale: 1.15,
      conversationScale: 0.95,
      conversationBrightness: 0.8,
      colorScheme: 'dark',
      lightBackground: 'network-sphere',
      darkBackground: 'orbital-rings',
      autoCheckCatalog: false,
      autoCheckPanda: false,
      resumeAfterPandaLogin: false,
      favoriteAssetIds: ['skill-five-day-momentum'],
      assetDisplayNameOverrides: [{ assetId: 'skill-five-day-momentum', displayName: '我的动量因子' }],
      defaultAgentProvider: 'deepseek-official',
      defaultAgentModel: 'deepseek-v4-pro',
      defaultAgentReasoningEffort: 'high',
      defaultAgentPermission: 'read-only',
    })
    await ctx.settings.update(ns, { interfaceScale: 0.6, conversationScale: 1.5 })
    expect(value(ctx, ns)).toMatchObject({ interfaceScale: 0.6, conversationScale: 1.5 })
    await expect(ctx.settings.update(ns, { interfaceScale: 0.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { interfaceScale: 1.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { favoriteAssetIds: [''] })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { defaultAgentPermission: 'root' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { colorScheme: 'system' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { conversationBrightness: 0.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { conversationOverlayOpacity: 1.1 })).rejects.toThrow()
    await ctx.fiber.dispose()
    expect(ctx.get('settings')).toBeUndefined()
  })
})
