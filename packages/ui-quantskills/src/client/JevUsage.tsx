import { useEffect, useState } from 'react'
import type { ContestJevUsage } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'

const labels = { watch: '盯盘决策', 'connection-test': '连接测试', research: '研究评估', validation: '合成场景验证' }
export function JevUsage({ access }: { access: NonNullable<ContestAccess['watch']> }) {
  const [usage, setUsage] = useState<ContestJevUsage>(), [error, setError] = useState('')
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      try {
        const value = await waitForCompetition(() => access.usage(), 'Jev 调用记录')
        if (!disposed) { setUsage(value); setError('') }
      } catch { if (!disposed) setError('调用记录暂时无法读取；请稍后重试。') }
      finally { if (!disposed) timer = setTimeout(() => { void refresh() }, 10000) }
    }
    void refresh()
    return () => { disposed = true; clearTimeout(timer) }
  }, [access])
  const download = () => {
    if (!usage) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(usage, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'jev-request-audit.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <details className={css.jevHistory}><summary>Jev 请求与 token 用量 <span>{usage ? `${usage.requests} 次 · 已知输入 ${usage.inputTokens.toLocaleString()} token` : '正在读取'}</span></summary>
    {error && <p className={css.error}>{error}</p>}
    {usage && <div className={css.jevAuditBody}>
      <p>统计自 {contestTime(usage.since)} 起的本机 API 调用：HTTP 成功 {usage.responsesOk} 次，已知输入 {usage.inputTokens.toLocaleString()} / 输出 {usage.outputTokens.toLocaleString()} token，用量未知 {usage.unknownUsage} 次。</p>
      <p className={css.jevFine}>来自 TypeSafe 响应的 usage 字段，非官网账单。旧版本未记录的请求不计入；用量未知不等于零。汇总累计保存，明细保留最近 200 次，每 10 秒更新。</p>
      <button type="button" disabled={!usage.records.length} onClick={download}>导出脱敏调用记录</button>
      {[...usage.records].reverse().map(item => <details key={item.id} className={css.jevHistoryItem}><summary>
        <time>{contestTime(item.startedAt)}</time><strong>{labels[item.purpose]}</strong><span>{item.httpStatus ? `HTTP ${item.httpStatus}` : '未收到 HTTP 响应'}</span>
      </summary><div><dl>
        <dt>实际返回模型</dt><dd>{item.model ?? '未返回'}</dd><dt>耗时</dt><dd>{item.finishedAt - item.startedAt} ms</dd>
        <dt>输入 / 输出 token</dt><dd>{item.usage ? `${item.usage.input_tokens} / ${item.usage.output_tokens}` : '未知'}</dd>
        <dt>密钥指纹（非密钥）</dt><dd>{item.keyFingerprint}</dd><dt>本地记录 ID（非官网请求 ID）</dt><dd>{item.id}</dd>
      </dl></div></details>)}
    </div>}
  </details>
}
