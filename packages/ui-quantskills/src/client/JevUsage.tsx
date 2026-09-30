import { useEffect, useState } from 'react'
import { ArrowClockwiseIcon, ArrowDownIcon, ArrowUpIcon, CaretDownIcon, ClockCounterClockwiseIcon, DownloadSimpleIcon, InfoIcon, PulseIcon } from '@phosphor-icons/react'
import type { ContestJevUsage, ContestWatchStatus } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import './JevUsage.css'

const labels = { watch: '盯盘决策', 'connection-test': '连接测试', research: '研究评估', validation: '合成场景验证' }
export function JevUsage({ access, events }: { access: NonNullable<ContestAccess['watch']>; events?: ContestWatchStatus['events'] | undefined }) {
  const [usage, setUsage] = useState<ContestJevUsage>(), [error, setError] = useState('')
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      if (!disposed) setLoading(true)
      try {
        const value = await waitForCompetition(() => access.usage(), 'Jev 调用记录')
        if (!disposed) { setUsage(value); setError('') }
      } catch { if (!disposed) setError('调用记录暂时无法读取；请稍后重试。') }
      finally { if (!disposed) { setLoading(false); timer = setTimeout(() => { void refresh() }, 10000) } }
    }
    void refresh()
    return () => { disposed = true; clearTimeout(timer) }
  }, [access, revision])
  const download = () => {
    if (!usage) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(usage, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'jev-request-audit.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="qs-jev-diagnostics">
    <section aria-label="Jev 调用概览">
      <header className="qs-diagnostics-heading"><div><h3>调用概览</h3><p>本机累计用量 · 每 10 秒更新</p></div><button type="button" className="qs-diagnostics-icon-button" aria-label="刷新调用记录" disabled={loading} onClick={() => setRevision(value => value + 1)}><ArrowClockwiseIcon size={17} aria-hidden="true"/></button></header>
      {error && <p className="qs-diagnostics-error" role="alert">{error}</p>}
      <dl className="qs-diagnostics-metrics">
        <div><dt><PulseIcon size={15} aria-hidden="true"/>API 调用</dt><dd>{usage?.requests.toLocaleString() ?? '—'}<small>次</small></dd><p>{usage ? `HTTP 成功 ${usage.responsesOk} 次` : '正在读取'}</p></div>
        <div><dt><ArrowUpIcon size={15} aria-hidden="true"/>输入 token</dt><dd>{usage?.inputTokens.toLocaleString() ?? '—'}</dd><p>已知输入用量</p></div>
        <div><dt><ArrowDownIcon size={15} aria-hidden="true"/>输出 token</dt><dd>{usage?.outputTokens.toLocaleString() ?? '—'}</dd><p>已知输出用量</p></div>
      </dl>
      <details className="qs-diagnostics-method"><summary><InfoIcon size={16} aria-hidden="true"/><span>统计口径{usage ? ` · ${usage.unknownUsage} 次用量未知` : ''}</span><CaretDownIcon size={14} aria-hidden="true"/></summary><div>
        {usage && <p>统计自 {contestTime(usage.since)} 起的本机 API 调用。</p>}
        <p>来自 TypeSafe 响应的 usage 字段，非官网账单。旧版本未记录的请求不计入；用量未知不等于零。汇总累计保存，明细保留最近 200 次，每 10 秒更新。</p>
      </div></details>
    </section>
    <section aria-label="最近调用">
      <header className="qs-diagnostics-heading"><h3>最近调用 <small>{usage?.records.length ?? '—'}</small></h3><button type="button" className="qs-diagnostics-export" aria-label="导出脱敏调用记录" disabled={!usage?.records.length} onClick={download}><DownloadSimpleIcon size={15} aria-hidden="true"/>导出记录</button></header>
      {!usage ? <p className="qs-diagnostics-empty" role="status">{error ? '调用记录暂不可用' : '正在读取调用记录…'}</p> : !usage.records.length ? <p className="qs-diagnostics-empty">暂无调用记录，模型请求后会显示在这里。</p> : <div className="qs-diagnostics-calls">
      {[...usage.records].reverse().map(item => <details key={item.id} className="qs-diagnostics-call"><summary>
        <span className="qs-diagnostics-call-icon"><PulseIcon size={18} aria-hidden="true"/></span><span className="qs-diagnostics-call-copy"><strong>{labels[item.purpose]}</strong><time>{contestTime(item.startedAt)}</time></span><span className="qs-diagnostics-http" data-ok={Boolean(item.httpStatus && item.httpStatus >= 200 && item.httpStatus < 300)}>{item.httpStatus ? `HTTP ${item.httpStatus}` : '未收到响应'}</span><CaretDownIcon className="qs-diagnostics-caret" size={14} aria-hidden="true"/>
      </summary><div><dl>
        <dt>实际返回模型</dt><dd>{item.model ?? '未返回'}</dd><dt>耗时</dt><dd>{item.finishedAt - item.startedAt} ms</dd>
        <dt>输入 / 输出 token</dt><dd>{item.usage ? `${item.usage.input_tokens} / ${item.usage.output_tokens}` : '未知'}</dd>
        <dt>密钥指纹（非密钥）</dt><dd>{item.keyFingerprint}</dd><dt>本地记录 ID（非官网请求 ID）</dt><dd>{item.id}</dd>
      </dl></div></details>)}
      </div>}
    </section>
    <section aria-label="Jev 运行记录">
      <header className="qs-diagnostics-heading"><h3>运行记录 <small>{events?.length ?? '—'}</small></h3><ClockCounterClockwiseIcon size={17} aria-hidden="true"/></header>
      {!events ? <p className="qs-diagnostics-empty">正在读取运行状态…</p> : !events.length ? <p className="qs-diagnostics-empty">暂无运行记录，盯盘状态变化后会显示在这里。</p> : <ol className="qs-diagnostics-events">{[...events].reverse().map((entry, index) => <li key={`${entry.time}-${index}`}><time>{contestTime(entry.time)}</time><p>{entry.message}</p></li>)}</ol>}
    </section>
  </div>
}
