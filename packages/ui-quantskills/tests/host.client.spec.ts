import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY } from '../src/appearance-settings.ts'
import { apply } from '../src/index.ts'
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

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-quantskills host', () => {
  it.each(['motion-glass-blue', 'motion-glass-ink'])('restores %s and the separate rainy profile after a Host restart', async lightBackground => {
    let durable: Record<string, unknown> = {}
    class DurableSettings extends SettingsProvider {
      readonly writable = true
      protected load() { return Promise.resolve(structuredClone(durable)) }
      protected persist(ns: SettingsNamespace, section: Record<string, unknown>) {
        durable = { ...durable, [ns]: structuredClone(section) }
        return Promise.resolve()
      }
    }
    const ns = QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE
    const original = new Context()
    await original.plugin(DurableSettings).await()
    const registration = original.plugin({ apply })
    await registration.await()
    await original.settings.update(ns, { colorScheme: 'dark', darkBackground: 'motion-glass-rain', conversationOverlayOpacity: .64 })
    await original.settings.update(ns, { colorScheme: 'light', lightBackground })
    await expect(original.settings.update(ns, { darkBackground: lightBackground })).rejects.toThrow()
    await expect(original.settings.update(ns, { lightBackground: 'motion-glass-rain' })).rejects.toThrow()
    await registration.dispose()

    const restored = new Context()
    await restored.plugin(DurableSettings).await()
    const restoredRegistration = restored.plugin({ apply })
    await restoredRegistration.await()
    expect(restored.settings.get(ns)).toMatchObject({ colorScheme: 'light', lightBackground, darkBackground: 'motion-glass-rain', conversationOverlayOpacity: .64 })
    await restoredRegistration.dispose()
  })

  it('registers, validates, updates, and disposes every durable application preference', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({
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
    expect(ctx.settings.get(ns)).toEqual({
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
    expect(ctx.settings.get(ns)).toMatchObject({ interfaceScale: 0.6, conversationScale: 1.5 })
    await expect(ctx.settings.update(ns, { interfaceScale: 0.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { interfaceScale: 1.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { favoriteAssetIds: [''] })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { defaultAgentPermission: 'root' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { colorScheme: 'system' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { conversationBrightness: 0.55 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { conversationOverlayOpacity: 1.1 })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})
