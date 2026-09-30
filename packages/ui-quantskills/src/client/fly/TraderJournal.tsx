import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon, TrashIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { ActionDialog } from '../ActionDialog.tsx'
import { flyApi } from './transport.ts'
import type { JournalEntry } from './flyJournal.ts'
import './trader-journal.css'

type JournalPage = { events: JournalEntry[]; total: number; page: number; pages: number; page_size: number; snapshot: number; has_new: boolean }
type Removal = { actor: string; snapshot: number; count: number; label: string; seqs?: number[]; all_matching?: true }

export function TraderJournal({ actors, formatEvent }: { actors: Record<string, string>; formatEvent(event: JournalEntry): string }) {
  const [actor, setActor] = useState('all'), [page, setPage] = useState(1), [revision, setRevision] = useState(0)
  const [data, setData] = useState<JournalPage>(), [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [removal, setRemoval] = useState<Removal>(), [busy, setBusy] = useState(false)
  const snapshot = useRef<number | undefined>(undefined), request = useRef(0), deleting = useRef(false)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout>
    const load = async () => {
      if (disposed) return
      if (deleting.current) { timer = setTimeout(load, 10_000); return }
      const current = ++request.current
      const query = new URLSearchParams({ actor, page: String(page) })
      if (snapshot.current !== undefined) query.set('snapshot', String(snapshot.current))
      try {
        const result = await flyApi<JournalPage>(`journal?${query}`)
        if (disposed || current !== request.current) return
        snapshot.current = result.snapshot
        setData(result); setError('')
        setSelected(previous => previous.filter(seq => result.events.some(event => event.seq === seq)))
      } catch (cause) {
        if (!disposed && current === request.current) setError(cause instanceof Error ? cause.message : '记录读取失败，请重试。')
      } finally {
        if (!disposed) { if (current === request.current) setLoading(false); timer = setTimeout(load, 10_000) }
      }
    }
    void load()
    return () => { disposed = true; clearTimeout(timer) }
  }, [actor, page, revision])

  function navigate(next: number, fresh = false, source = actor) {
    request.current++
    if (fresh) snapshot.current = undefined
    setActor(source); setPage(next); setSelected([]); setLoading(true); setData(undefined); setError(''); setMessage('')
    setRevision(value => value + 1)
    list.current?.scrollTo?.({ top: 0 })
  }
  function review(seqs?: number[]) {
    if (!data) return
    setRemoval({ actor, snapshot: data.snapshot, count: seqs?.length ?? data.total,
      label: seqs ? `选中的 ${seqs.length} 条记录` : `${actor === 'all' ? '所有来源' : actors[actor] || actor}中本次已加载范围的全部 ${data.total.toLocaleString()} 条记录`,
      ...(seqs ? { seqs } : { all_matching: true }) })
    setError('')
  }
  async function reviewAll() {
    if (deleting.current) return
    deleting.current = true; request.current++; setBusy(true); setError('')
    try {
      // Count every source at confirmation time, independently of the current page/filter.
      const result = await flyApi<JournalPage>('journal?actor=all&page=1')
      if (!result.total) { setMessage('暂无可删除的运行记录'); return }
      setRemoval({ actor: 'all', snapshot: result.snapshot, count: result.total, all_matching: true,
        label: `所有来源、全部分页中的 ${result.total.toLocaleString()} 条运行记录` })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取全部记录数量，请重试。') }
    finally { deleting.current = false; setBusy(false) }
  }
  async function remove() {
    if (!removal || deleting.current) return
    deleting.current = true; request.current++; setBusy(true); setError('')
    try {
      const result = await flyApi<{ deleted: number }>('journal/delete', {
        actor: removal.actor, snapshot: removal.snapshot, confirm: true,
        ...(removal.seqs ? { seqs: removal.seqs } : { all_matching: true }),
      })
      setRemoval(undefined); setSelected([]); setData(undefined); setLoading(true)
      setMessage(`已删除 ${result.deleted.toLocaleString()} 条列表记录`); setRevision(value => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败，请重试。') }
    finally { deleting.current = false; setBusy(false) }
  }
  const currentPage = data?.page ?? page
  return <section className="fv-journal qs-trader-journal" aria-label="运行与交易记录">
    <header><div><h2>运行与交易记录</h2><p>{data ? `共 ${data.total.toLocaleString()} 条` : '读取记录'} · 每页 20 条</p></div>
      <div className="qs-journal-tools"><select aria-label="记录来源" value={actor} disabled={busy} onChange={event => navigate(1, true, event.target.value)}><option value="all">所有来源</option>{Object.entries(actors).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <button type="button" aria-label="刷新记录" title="刷新记录" disabled={busy || loading} onClick={() => navigate(1, true)}><ArrowClockwiseIcon size={17}/></button></div>
    </header>
    <div className="qs-journal-selection"><label><input type="checkbox" aria-label="选择本页全部记录" disabled={loading || busy || !data?.events.length} checked={!!data?.events.length && selected.length === data.events.length} onChange={event => setSelected(event.target.checked ? data!.events.map(item => item.seq) : [])}/><span>{selected.length ? `已选 ${selected.length} 条` : '选择本页'}</span></label>
      {selected.length > 0 && <button type="button" disabled={busy || loading} onClick={() => review(selected)}>删除所选</button>}
      <div className="qs-journal-clear-actions">
        {actor !== 'all' && <button type="button" disabled={busy || loading || !data?.total} onClick={() => review()}>清理此来源记录</button>}
        <button type="button" className="qs-journal-clear" disabled={busy || loading || !data} onClick={() => void reviewAll()}><TrashIcon size={15} aria-hidden="true"/>删除全部</button>
      </div>
    </div>
    {data?.has_new && <button type="button" className="qs-journal-new" disabled={busy || loading} onClick={() => navigate(1, true)}>有新记录，点击刷新</button>}
    {error && !removal && <p className="qs-journal-error" role="alert">{error}<button type="button" onClick={() => navigate(currentPage)}>重试</button></p>}
    {message && <p role="status" className="qs-journal-message">{message}</p>}
    <div className="qs-journal-list" ref={list} aria-busy={loading}>
      {loading ? <div className="fv-empty" role="status">正在读取记录…</div> : data?.events.length ? data.events.map(event => <article key={event.seq}>
        <input type="checkbox" aria-label={`选择记录 #${event.seq}`} disabled={busy} checked={selected.includes(event.seq)} onChange={e => setSelected(previous => e.target.checked ? [...previous, event.seq] : previous.filter(seq => seq !== event.seq))}/>
        <div className="qs-journal-entry"><div className="fv-event-meta"><b>{actors[event.actor] || event.actor}</b><time dateTime={new Date(event.at * 1000).toISOString()}>{new Date(event.at * 1000).toLocaleString('zh-CN', { hour12: false })}</time><small>#{event.seq}</small></div><p>{formatEvent(event)}</p>{event.decision_id && <small className="fv-note">决策 {event.decision_id.slice(0, 12)}</small>}</div>
        <button type="button" className="qs-journal-delete" aria-label={`删除记录 #${event.seq}`} title="删除此记录" disabled={busy} onClick={() => review([event.seq])}><TrashIcon size={16}/></button>
      </article>) : <div className="fv-empty">{error ? '暂时无法读取记录' : '暂无记录'}</div>}
    </div>
    <footer className="qs-journal-pagination"><span>{data?.total ? `${(currentPage - 1) * 20 + 1}–${Math.min(currentPage * 20, data.total)} / ${data.total.toLocaleString()} 条` : '0 条记录'}</span>
      <nav aria-label="记录分页"><button type="button" aria-label="上一页" disabled={loading || busy || currentPage <= 1} onClick={() => navigate(currentPage - 1)}><CaretLeftIcon size={16}/></button><span>第 {currentPage} / {data?.pages ?? 1} 页</span><button type="button" aria-label="下一页" disabled={loading || busy || !data || currentPage >= data.pages} onClick={() => navigate(currentPage + 1)}><CaretRightIcon size={16}/></button></nav>
    </footer>
    {removal && <ActionDialog title={removal.all_matching && removal.actor === 'all' ? '删除全部运行记录？' : '删除运行记录？'} busy={busy} error={error || undefined} onClose={() => { setRemoval(undefined); setError('') }}>
      <p>将删除{removal.label}。删除后不会重新出现在此列表，无法在列表中恢复。</p>
      <p>此操作只清理运行记录列表。成交回执、持仓、盈亏统计及策略审计底账会保留；确认期间产生的新记录不会被删除。</p>
      <div className="qs-journal-confirm"><button type="button" disabled={busy} onClick={() => { setRemoval(undefined); setError('') }}>取消</button><button type="button" className="qs-journal-confirm-delete" disabled={busy} onClick={() => void remove()}>{busy ? '正在删除…' : `确认删除 ${removal.count.toLocaleString()} 条`}</button></div>
    </ActionDialog>}
  </section>
}
