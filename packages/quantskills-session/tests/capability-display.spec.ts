import { expect, it } from 'vitest'
import { capabilityDisplayName } from '../src/capability-display.ts'

it('uses declared Chinese headings without renaming an explicit Chinese name', () => {
  expect(capabilityDisplayName('agent-news-analyst', '# A股新闻分析师（News Sentiment Analyst）\n## 角色')).toBe('A股新闻分析师')
  expect(capabilityDisplayName('agent-team-lead', '# Agent Team Lead — 每日热点新闻与聪明钱画像')).toBe('每日热点新闻与聪明钱画像')
  expect(capabilityDisplayName('我的研究员', '# 默认中文标题')).toBe('我的研究员')
  expect(capabilityDisplayName('Custom Agent', 'No declared Chinese title')).toBe('Custom Agent')
})
