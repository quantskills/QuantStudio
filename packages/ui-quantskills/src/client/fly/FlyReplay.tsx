import { useEffect, useState } from 'react'
import { flyApi } from './transport.ts'

type Event = { seq: number; at: number; kind: string; actor: string; decision_id: string; payload: unknown }
export function FlyReplayLab({ active }: { active: boolean }) {
  const [events, setEvents] = useState<Event[]>([]), [selected, setSelected] = useState(0), [error, setError] = useState('')
  const load = async (after = 0) => {
    try {
      const result = await flyApi<{ events: Event[] }>(`events?after=${after}`)
      setEvents(result.events); setSelected(0); setError('')
    } catch (error) { setError(String(error)) }
  }
  useEffect(() => { if (active) void load() }, [active])
  const event = events[selected]
  return <section className="fv-widget"><header><h2>事件回放</h2><button type="button" onClick={() => void load()}>从头读取</button>
    <button type="button" disabled={!events.length} onClick={() => void load(events.at(-1)!.seq)}>下一页</button></header>
    <div className="fv-widget-content"><p>逐条查看保存的神经决策、生活反馈和柜台回报；回放不会执行交易或再次学习。</p>
      {error && <p role="alert">{error}</p>}{events.length ? <><input aria-label="回放位置" type="range" min={0} max={events.length - 1} value={selected} onChange={e => setSelected(Number(e.target.value))} />
        <p>#{event!.seq} · {new Date(event!.at * 1000).toLocaleString('zh-CN')} · {event!.actor} · {event!.kind}</p>
        <pre className="fv-replay-json">{JSON.stringify(event!.payload, null, 2)}</pre></> : <p>暂无保存的事件。</p>}</div>
  </section>
}
