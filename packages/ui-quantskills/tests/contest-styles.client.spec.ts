// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { MINIMAL_THEMES, minimalThemeStyle } from '../src/client/minimal-themes.ts'

const stylesheet = readFileSync(resolve('packages/ui-quantskills/src/client/ContestPage.module.css'), 'utf8')
const factorStylesheet = readFileSync(resolve('packages/ui-quantskills/src/client/FactorContestPage.module.css'), 'utf8')
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; delete document.body.dataset.qsPluginTheme })

// jsdom does not resolve custom properties. Substitute the shipped theme tokens before
// applying the real stylesheet, including CSS fallbacks (the source of the white cards).
function resolveTokens(source: string, tokens: Record<string, string>): string {
  for (let i = 0; i < 12 && source.includes('var('); i++) {
    source = source.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_, name: string, fallback?: string) => tokens[name] ?? fallback ?? 'initial')
  }
  return source
}
function contrast(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    })
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722
  }
  const a = luminance(first), b = luminance(second)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}

it.each(MINIMAL_THEMES)('$label renders readable contest cards, tabs and action labels', theme => {
  document.body.dataset.qsPluginTheme = theme.scheme
  const tokens = { ...minimalThemeStyle(theme), '--qs-muted': theme.tokens.secondary, '--qs-border': theme.tokens.line }
  const style = document.createElement('style')
  style.textContent = resolveTokens(`${stylesheet}\n${factorStylesheet}`, tokens)
  document.head.append(style)
  document.body.innerHTML = `<section class="page"><section class="connection">已连接</section>
    <div class="welcome">进入比赛</div><dl class="metrics"><div><dt>可用资金</dt><dd>5,000,000</dd></div></dl>
    <div class="tabs"><button aria-selected="true">资金</button></div>
    <div class="toolbar"><input value="黄金"></div><button data-primary>进入 AI 交易助手</button></section>
    <section class="plans"><button class="planRow">交易计划</button><button data-primary>确认执行这笔交易</button></section>
    <nav class="selector"><button aria-pressed="true">第四届因子大赛</button></nav><form class="form"><label>因子账户<input value="账户"></label><button>连接因子账户</button></form><pre class="json">因子定义</pre>`
  for (const selector of ['.connection', '.welcome', '.metrics > div', '.tabs button', '.toolbar input', '.page button[data-primary]', '.plans button[data-primary]', '.planRow', '.selector button', '.form input', '.form button', '.json']) {
    const computed = getComputedStyle(document.querySelector(selector)!)
    expect(computed.backgroundColor, `${selector}: missing theme surface`).not.toBe('rgba(0, 0, 0, 0)')
    expect(contrast(computed.color, computed.backgroundColor), `${selector}: text contrast`).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast(getComputedStyle(document.querySelector('.metrics dt')!).color,
    getComputedStyle(document.querySelector('.metrics > div')!).backgroundColor)).toBeGreaterThanOrEqual(4.5)
})
