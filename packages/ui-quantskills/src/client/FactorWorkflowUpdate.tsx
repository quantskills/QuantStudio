import { useEffect, useState } from 'react'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { FactorContestAccess } from './factor-contest.ts'
import { asRecord, display } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './FactorContestPage.module.css'

/** Updates are platform-owned versions of one factor, not arbitrary replacement IDs. */
export function FactorWorkflowUpdate({ factorId, workflowId, access, busy, submit }: {
  factorId: string; workflowId: string; access: FactorContestAccess; busy: boolean; submit(id: string): void
}) {
  const [page, setPage] = useState(1), [value, setValue] = useState<JsonValue>(), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setValue(undefined)
    void waitForCompetition(signal => access.query({ kind: 'workflows', page }, signal), '工作流版本查询', 30_000, controller.signal)
      .then(result => { if (!controller.signal.aborted) setValue(result) })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '版本查询失败') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [access, factorId, workflowId, page])
  const result = asRecord(value), items = Array.isArray(result.items) ? result.items.map(asRecord) : []
  const related = items.filter(item => item.factor_instance_id === factorId || item.workflow_id === workflowId)
  const versions = related.filter(item => item.action === 'update' && item.action_enabled === true)
  const more = typeof result.total === 'number' ? page * 50 < result.total : items.length >= 50
  return <div className={css.form}>
    <p>更新当前因子的成功运行快照。更换为另一只因子，请先移除原因子，再从可入池工作流中添加。</p>
    <p>当前工作流：{workflowId}</p>
    {loading ? <p role="status">正在检查可更新版本…</p> : error ? <p role="alert">{error}</p> : versions.length ? versions.map(item =>
      <div className={css.row} key={String(item.workflow_id)}><div><strong>{display(item.name)}</strong><p>{display(item.workflow_id)}</p></div>
        <button type="button" disabled={busy} onClick={() => submit(String(item.workflow_id))}>使用此版本生成确认计划</button></div>)
      : <p>{related.length ? '当前已是最新版本，没有新的成功运行快照。' : more || page > 1 ? '本页没有当前因子的更新版本。' : '暂无可更新版本。请在平台完成当前工作流的新一次回测后再检查。'}</p>}
    {(page > 1 || more) && <div className={css.pagination}><button type="button" disabled={loading || busy || page === 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={loading || busy || !more} onClick={() => setPage(page + 1)}>下一页</button></div>}
  </div>
}
