/** QuantSkills presentation changes to Apache-2.0 dsh-context 0.41.3.
 * Copyright and license remain in the bundled dependency and LICENSES/.
 * Idempotent: rerun after dependency installation, before launching the Web host.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const base = new URL('../node_modules/dsh-context/', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', base), 'utf8'))
if (pkg.version !== '0.41.3') throw new Error('Review dsh-context presentation and host compatibility before upgrading.')
const file = fileURLToPath(new URL('lib/client.js', base))
let content = await readFile(file, 'utf8')
const marker = '// Modified by QuantSkills: Chinese presentation copy, 2026-09-12. Upstream: bowenliang123/dsh-context (Apache-2.0).\n'
if (!content.startsWith(marker)) content = marker + content
for (const [before, after] of [
  ['"tab": "上下文"', '"tab": "会话洞察"'],
  ['"overview.title": "当前上下文"', '"overview.title": "AI 当前读到了什么"'],
  ['"stats.title": "上下文统计"', '"stats.title": "会话概览"'],
  ['"stats.cost": "预估费用"', '"stats.cost": "官方定价参考"'],
  ['"plugin.hint": "The best DSH context plugin ⭐"', '"plugin.hint": "理解会话内容、用量与变化"'],
  ['"settings.title": "上下文"', '"settings.title": "会话洞察"'],
  ['"settings.desc": "dsh-context 插件中上下文面板的偏好设置"', '"settings.desc": "调整会话洞察中的图表、内容与展开方式"'],
  ['"trend.title": "上下文趋势"', '"trend.title": "会话内容的变化"'],
  ['"jump.title": "在上下文标签页中查看此轮"', '"jump.title": "在会话洞察中查看此轮"'],
  ['"agents.title": "Agent 网络"', '"agents.title": "智能体协作"'],
  ['"footer": "估算口径：与 dsh 内置 tokenMeter 相同的固定密度启发式（约 4 字符 ≈ 1 token）；「实际」为供应商上报用量。"', '"footer": "上下文大小按约 4 字符 ≈ 1 token 估算；标注为「实际」的数值来自模型供应商上报。"'],
]) content = content.replaceAll(before, after)
await writeFile(file, content)
