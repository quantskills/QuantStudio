import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import * as Persona from '@deepseek-ai/dsh-persona'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { describe, expect, it } from 'vitest'
import { installQuantSkillsIdentity } from '../src/product-identity.ts'

describe('QuantSkills identity in built-in agent presets', () => {
  for (const preset of ['standard', 'ptc', 'cordis']) {
    it(`replaces the ${preset} preset identity during real prompt assembly`, async () => {
      const source = await readFile(new URL(`../../../node_modules/@deepseek-ai/dsh-web-app/presets/${preset}.patch.yml`, import.meta.url), 'utf8')
      const identity = source.split('\n').find(line => line.includes('You are a coding agent powered by'))!.trim().replace(/^prefix: /, '')
      const ctx = new Context()
      await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
      installQuantSkillsIdentity(ctx)
      const key = {}
      const scope = createScope(ctx, key)
      ctx.systemPrompt.variable('model', () => 'DeepSeek-V4-Flash')
      ctx.systemPrompt.variable('cwd', () => '/data/workspace')
      await scope.ctx.plugin(Persona, { prefix: identity })
      ctx.systemPrompt.section({ name: 'workspace', order: 2, text: 'Workspace: {{cwd}}' })
      ctx.systemPrompt.section({ name: 'agent:instructions', order: 1, text: 'Keep the user workflow.' })
      try {
        const prompt = renderPrompt(await ctx.systemPrompt.assemble({ scope: key }))
        expect(prompt).toContain('You are QuantSkills, an AI assistant for research and everyday work.')
        expect(prompt).toContain('/data/workspace')
        expect(prompt).toContain('Keep the user workflow.')
        expect(prompt).not.toMatch(/deepseek/i)
      } finally { await scope.dispose() }
    })
  }

  it('preserves user-authored personas and technical identifiers in other sections', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt, { personaPrefix: 'You are my financial research expert.' })
    installQuantSkillsIdentity(ctx)
    ctx.systemPrompt.section({ name: 'skill:setup', order: 1, text: 'The configured model is DeepSeek-V4-Flash.' })
    const prompt = renderPrompt(await ctx.systemPrompt.assemble())
    expect(prompt).toContain('You are my financial research expert.')
    expect(prompt).toContain('The configured model is DeepSeek-V4-Flash.')
  })
})
