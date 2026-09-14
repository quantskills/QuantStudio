import { useCallback, useEffect, useRef, useState } from 'react'
import { DatabaseIcon, PlusIcon, ArrowClockwiseIcon, TrashIcon, MagnifyingGlassIcon, TableIcon, ChartLineIcon, NewspaperIcon, BuildingsIcon, UploadSimpleIcon, CloudArrowDownIcon, XIcon } from '@phosphor-icons/react'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { DataCategory, DataSummary, DataImport, DataFetch, DataQuery, DataResult } from '@deepseek-ai/dsh-panda-mcp'
import { ActionDialog } from './ActionDialog.tsx'
import css from './DatabasePage.module.css'

export interface DatabaseAccess {
  list(): Promise<DataSummary[]>
  import(input: DataImport): Promise<DataSummary>
  fetch(input: DataFetch): Promise<DataSummary>
  preview(id: string): Promise<DataResult>
  query(input: DataQuery): Promise<DataResult>
  refresh(id: string): Promise<DataSummary>
  remove(id: string): Promise<void>
  categorize(id: string, category: DataCategory): Promise<DataSummary>
}
const categories = [
  { id: 'market', label: '行情', description: '价格、成交量、盘口与历史 K 线', icon: ChartLineIcon },
  { id: 'news', label: '新闻', description: '新闻快讯、公司公告与市场事件', icon: NewspaperIcon },
  { id: 'fundamental', label: '基本面', description: '财务报表、业绩、估值与公司资料', icon: BuildingsIcon },
  { id: 'other', label: '其他', description: '暂未识别的研究数据，可在详情中调整分类', icon: TableIcon },
] as const
const categoryOf = (item: DataSummary) => categories.find(category => category.id === item.category) ?? categories[3]
const time = (date: string) => new Date(date).toLocaleString('zh-CN', { hour12: false })
const sourceName = (item: DataSummary) => ({ file: '本地文件', http: '外部接口', pandadata: 'PandaData' })[item.source.kind]
const display = (value: unknown): string => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const methodNames: Record<string, string> = { get_fina_reports: '财务报表', get_fina_performance: '业绩与财务指标', get_daily: '日行情', get_quotes: '实时行情' }
const titleOf = (item: DataSummary) => item.name === item.source.method ? methodNames[item.name] ?? item.name : item.name
const parameterSummary = (item: DataSummary, compact = false) => {
  const params = item.source.params ?? {}
  return ['symbol', 'symbols', 'code', 'codes', 'ts_code', 'ticker', 'index_code', 'frequency', 'period']
    .filter(key => params[key] !== undefined).map(key => {
      const value = params[key]
      if (!Array.isArray(value)) return display(value)
      if (compact && value.length > 2) return value.slice(0, 2).map(display).join('、') + ' 等 ' + value.length + ' 个标的'
      return value.map(display).join('、')
    }).join(' · ')
}
const coverage = (item: DataSummary) => item.from ? item.from.slice(0, 10) + ' — ' + (item.to?.slice(0, 10) ?? '') : '未设置日期范围'

export function DatabasePage({ access }: { access?: DatabaseAccess | undefined }) {
  const [items, setItems] = useState<DataSummary[]>([]), [selected, setSelected] = useState<DataResult>()
  const [selectedId, setSelectedId] = useState<string>(), [opening, setOpening] = useState(false)
  const [search, setSearch] = useState(''), [filter, setFilter] = useState<'all' | DataCategory>('all')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<{ mode: 'single' | 'selected' | 'all'; items: DataSummary[] }>()
  const [managing, setManaging] = useState(false), [checked, setChecked] = useState<string[]>([])
  const [removedCount, setRemovedCount] = useState(0)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [minRows, setMinRows] = useState(1)
  const request = useRef(0), detailBody = useRef<HTMLDivElement>(null)
  const load = useCallback(async () => { if (access) setItems(await access.list()) }, [access])
  useEffect(() => {
    let active = true
    if (access) access.list().then(data => { if (active) setItems(data) }).catch(e => { if (active) setError(String(e.message ?? e)) }).finally(() => { if (active) setLoading(false) })
    else setLoading(false)
    return () => { active = false; request.current++ }
  }, [access])
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  const closeDetail = () => { request.current++; setSelectedId(undefined); setSelected(undefined); setOpening(false) }
  const open = async (id: string) => {
    if (!access) return
    const version = ++request.current
    setSelectedId(id); setSelected(undefined); setOpening(true); setError('')
    setFrom(''); setTo(''); setMinRows(1)
    if (detailBody.current) detailBody.current.scrollTop = 0
    try { const result = await access.preview(id); if (version === request.current) setSelected(result) }
    catch (e) { if (version === request.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { if (version === request.current) setOpening(false) }
  }
  const visible = items.filter(item => (filter === 'all' || categoryOf(item).id === filter) && [item.name, titleOf(item), categoryOf(item).label, sourceName(item), parameterSummary(item), ...item.columns].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  const pendingItem = items.find(item => item.id === selectedId)
  const currentCategory = categories.find(category => category.id === filter)
  const chosen = items.filter(item => checked.includes(item.id))
  const allVisibleChecked = visible.length > 0 && visible.every(item => checked.includes(item.id))
  const askRemove = (mode: 'single' | 'selected' | 'all', targets: DataSummary[]) => { setError(''); setRemovedCount(0); setRemoving({ mode, items: targets }) }
  const removeConfirmed = async () => {
    if (!access || !removing) return
    const failed: DataSummary[] = [], messages: string[] = []
    // Freeze the confirmed IDs: new arrivals must not be swept up by a clear operation.
    for (const item of removing.items) {
      try {
        await access.remove(item.id)
        setItems(current => current.filter(value => value.id !== item.id))
        setChecked(current => current.filter(id => id !== item.id))
        if (selectedId === item.id) closeDetail()
        setRemovedCount(count => count + 1)
      } catch (e) { failed.push(item); messages.push(e instanceof Error ? e.message : String(e)) }
    }
    setRemoving(failed.length ? { mode: removing.mode, items: failed } : undefined)
    await load()
    if (failed.length) throw new Error(`${failed.length} 份缓存未删除，可重试。${messages[0] ?? ''}`)
  }
  return <div className={css.page}>
    <header className={css.header}>
      <div><h1>数据库</h1><p>把行情、新闻和基本面留在本地，研究随时开始。</p></div>
      <div className={css.headerActions}>
        <button disabled={!access || busy || loading || !items.length} onClick={() => askRemove('all', [...items])}><TrashIcon size={17}/>清空全部缓存</button>
        <button className={css.primary} disabled={!access || busy} onClick={() => setAdding(true)}><PlusIcon size={18}/>添加数据</button>
      </div>
    </header>
    <div className={css.notice}><DatabaseIcon size={21}/><span>AI 优先读取本地缓存；过期、日期范围或条数不足时，再按需更新。</span>
      <details className={css.categoryHelp}><summary>如何分类</summary><div>{categories.slice(0, 3).map(category => <p key={category.id}><b>{category.label}</b>{category.description}</p>)}<small>按数据内容分类，是否带有日期不影响分类。系统会自动识别，也可手动调整。</small></div></details>
    </div>
    <div className={css.toolbar}>
      <div className={css.tabs} role="tablist" aria-label="数据分类">
        <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>全部<span>{items.length}</span></button>
        {categories.map(category => <button key={category.id} role="tab" aria-selected={filter === category.id} title={category.description} onClick={() => setFilter(category.id)}>{category.label}<span>{items.filter(item => categoryOf(item).id === category.id).length}</span></button>)}
      </div>
      <label className={css.search}><MagnifyingGlassIcon size={17}/><input aria-label="搜索数据集" placeholder="名称、股票代码、来源或字段" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <button aria-label="刷新数据目录" disabled={busy || !access} onClick={() => void run(load)}><ArrowClockwiseIcon size={18}/></button>
    </div>
    {error && <p role="alert" className={css.error}>{error}</p>}
    <div className={css.layout} data-selected={!!selectedId}>
      <div className={css.listPane}>
        <div className={css.listHeading}><b>{currentCategory?.label ?? '本地数据'}</b><span>{visible.length} 份缓存</span><button disabled={busy || !items.length} aria-pressed={managing} onClick={() => { setManaging(!managing); setChecked([]) }}>{managing ? '完成' : '批量管理'}</button></div>
        {managing && <div className={css.bulkBar}>
          <label><input type="checkbox" disabled={busy || !visible.length} checked={allVisibleChecked} onChange={() => setChecked(current => allVisibleChecked ? current.filter(id => !visible.some(item => item.id === id)) : [...new Set([...current, ...visible.map(item => item.id)])])}/>全选当前列表</label>
          <button disabled={busy || !chosen.length} onClick={() => askRemove('selected', chosen)}><TrashIcon size={15}/>删除所选（{chosen.length}）</button>
        </div>}
        <section className={css.list} aria-label="本地数据集" tabIndex={0}>
          {loading ? <p className={css.empty}>正在读取本地数据…</p> : visible.length === 0 ? <div className={css.empty}><DatabaseIcon size={32}/><h2>{items.length ? '没有匹配的数据' : '建立你的研究数据库'}</h2><p>{currentCategory?.description ?? '连接 PandaData 或外部接口，也可以导入 CSV、JSON 文件。'}</p>{!items.length && <button disabled={!access} className={css.primary} onClick={() => setAdding(true)}>添加第一份数据</button>}</div> : visible.map(item => {
            const category = categoryOf(item), Icon = category.icon, params = parameterSummary(item, true)
            const stale = Date.now() >= Date.parse(item.expiresAt)
            return <article className={css.item} key={item.id} data-selected={selectedId === item.id}>
              {managing && <input className={css.selectItem} type="checkbox" aria-label={`选择 ${titleOf(item)} ${params}`} checked={checked.includes(item.id)} disabled={busy} onChange={event => setChecked(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))}/>}
              <button className={css.openItem} aria-pressed={selectedId === item.id} onClick={() => void open(item.id)} disabled={busy}>
              <span className={css.icon} data-category={category.id}><Icon size={22}/></span>
              <span className={css.itemContent}><b title={titleOf(item)}>{titleOf(item)}</b>{params && <small className={css.params} title={parameterSummary(item)}>{params}</small>}<small>{category.label} · {sourceName(item)} · {item.rowCount.toLocaleString()} 行</small><small>{coverage(item)}</small></span>
              </button>
              <div className={css.itemActions}><span className={css.fresh} data-stale={stale}>{stale ? '待更新' : '可用'}</span><button className={css.deleteItem} aria-label={`删除 ${titleOf(item)} ${params}`} title="删除这份缓存" disabled={busy} onClick={() => askRemove('single', [item])}><TrashIcon size={17}/></button></div>
            </article>
          })}
        </section>
      </div>
      <section className={css.detail} aria-label="数据详情" aria-busy={opening}>
        <header className={css.detailHeader}><div><h2>{selected ? titleOf(selected.dataset) : pendingItem ? titleOf(pendingItem) : '数据详情'}</h2><p>{selected ? sourceName(selected.dataset) + ' · ' + selected.dataset.rowCount.toLocaleString() + ' 行 · ' + selected.dataset.columns.length + ' 列' : '在左侧选择一份数据，查看来源与内容。'}</p></div>{selectedId && <button aria-label="关闭数据详情，返回列表" disabled={busy} onClick={closeDetail}><span className={css.mobileBack}>返回列表</span><XIcon size={19}/></button>}</header>
        <div className={css.detailBody} ref={detailBody}>
          {opening ? <div className={css.empty} role="status"><ArrowClockwiseIcon size={28}/><p>正在读取数据预览…</p></div> : !selected ? <div className={css.empty}><TableIcon size={40}/><h2>{selectedId ? '暂时无法读取数据' : '选择数据，展开研究'}</h2><p>左侧列表独立滚动，详情会保留在这里。</p>{selectedId && <button onClick={() => void open(selectedId)}>重试</button>}</div> : <>
            <div className={css.categoryRow}><label>数据分类<select aria-label="调整数据分类" value={selected.dataset.category} disabled={busy} onChange={event => { const category = event.target.value as DataCategory; void run(async () => { const dataset = await access!.categorize(selected.dataset.id, category); setSelected({ ...selected, dataset }); await load() }) }}>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><span>{categoryOf(selected.dataset).description}</span></div>
            <dl className={css.meta}>
              <div><dt>数据范围</dt><dd>{parameterSummary(selected.dataset) || '—'}</dd></div>
              <div><dt>覆盖日期</dt><dd>{coverage(selected.dataset)}{selected.dataset.dateColumn && <small>日期字段：{selected.dataset.dateColumn}</small>}</dd></div>
              <div><dt>最近更新</dt><dd>{time(selected.dataset.fetchedAt)}</dd></div>
              <div><dt>缓存有效至</dt><dd>{time(selected.dataset.expiresAt)}</dd></div>
              <div><dt>数据来源</dt><dd>{selected.dataset.source.method ?? selected.dataset.source.url ?? '本地导入'}<small>{(selected.dataset.bytes / 1024).toFixed(1)} KB · {selected.dataset.name}</small></dd></div>
            </dl>
            <div className={css.actions}>
              <button disabled={busy || selected.dataset.source.kind === 'file'} title={selected.dataset.source.kind === 'file' ? '本地文件需要重新导入' : '从原数据源重新拉取'} onClick={() => void run(async () => { await access!.refresh(selected.dataset.id); await load(); setSelected(await access!.preview(selected.dataset.id)) })}><ArrowClockwiseIcon size={16}/>更新缓存</button>
              <button disabled={busy} onClick={() => askRemove('single', [selected.dataset])}><TrashIcon size={16}/>删除缓存</button>
            </div>
            <form className={css.query} onSubmit={event => { event.preventDefault(); void run(async () => { setSelected(await access!.query({ id: selected.dataset.id, ...(from ? { from } : {}), ...(to ? { to } : {}), minRows, limit: 100 })); await load() }) }}>
              <b>检查研究所需数据</b>
              {selected.dataset.kind === 'timeseries' && <div className={css.dates}><label>开始日期<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>结束日期<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label></div>}
              <div className={css.actions}><label>至少<input type="number" aria-label="所需最少条数" min={1} max={100000} value={minRows} onChange={e => setMinRows(Number(e.target.value))}/>行</label><button disabled={busy} type="submit">{busy ? '检查中…' : '检查并按需更新'}</button></div>
            </form>
            <p className={css.result} role="status">{selected.status === 'insufficient' ? '暂不能满足：' + selected.reasons.join('、') + (selected.rows.length ? '。以下为已有缓存预览，AI 使用前需先更新。' : selected.dataset.source.kind === 'file' ? '。请重新导入文件。' : '。请检查源数据的日期和条数参数。') : selected.status === 'refreshed' ? '已更新缓存，符合本次数据需求。' : '本地缓存可用。'}</p>
            <div className={css.table} tabIndex={0} role="region" aria-label="数据表格预览"><table><thead><tr>{selected.dataset.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{selected.rows.map((row, i) => <tr key={i}>{selected.dataset.columns.map(column => <td key={column} title={display(row[column])}>{display(row[column])}</td>)}</tr>)}</tbody></table></div>
            <small className={css.foot}>预览前 {selected.rows.length} 行 · 共 {selected.total.toLocaleString()} 行 · AI 可按需分页读取</small>
          </>}
        </div>
      </section>
    </div>
    {adding && access && <AddData access={access} close={() => setAdding(false)} done={async item => { setAdding(false); setFilter('all'); setSearch(''); await load(); await open(item.id) }}/>}
    {removing && <ActionDialog title={removing.mode === 'all' ? '清空全部缓存' : removing.mode === 'selected' ? '删除所选缓存' : '删除本地缓存'} busy={busy} error={error} onClose={() => setRemoving(undefined)}>
      <p>{removing.mode === 'all' ? '将清空所有分类中的' : '将删除'} {removing.items.length} 份本地缓存。仅移除缓存副本，不删除原始文件、会话或研究产物；需要时可重新拉取或导入。</p>
      <ul>{removing.items.map(item => <li key={item.id}>{titleOf(item)}{parameterSummary(item, true) ? ` · ${parameterSummary(item, true)}` : ''}</li>)}</ul>
      {busy && <p role="status">已删除 {removedCount} / {removing.items.length} 份缓存…</p>}
      <footer><button disabled={busy} onClick={() => setRemoving(undefined)}>取消</button><button data-danger disabled={busy} onClick={() => { setRemovedCount(0); void run(removeConfirmed) }}>{busy ? '正在删除…' : removing.mode === 'all' ? '确认清空' : '删除缓存'}</button></footer>
    </ActionDialog>}
  </div>
}

function AddData({ access, close, done }: { access: DatabaseAccess; close(): void; done(item: DataSummary): Promise<void> }) {
  const [source, setSource] = useState<'file'|'http'|'pandadata'>('file'), [name, setName] = useState(''), [content, setContent] = useState(''), [format, setFormat] = useState<'csv'|'json'>('csv')
  const [category, setCategory] = useState<'auto'|DataCategory>('auto'), [dateColumn, setDateColumn] = useState(''), [ttl, setTtl] = useState(60)
  const [url, setUrl] = useState(''), [method, setMethod] = useState(''), [params, setParams] = useState('{}'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <ActionDialog title="添加研究数据" busy={busy} error={error} onClose={close}><form className={css.form} onSubmit={async event => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const base = { name, kind: 'auto' as const, ...(category !== 'auto' ? { category } : {}), ttlSeconds: ttl * 60, ...(dateColumn ? { dateColumn } : {}) }
      if (source === 'file' && !content) throw new Error('请先选择 CSV 或 JSON 文件')
      const parsed = source === 'pandadata' ? JSON.parse(params) as unknown : {}
      if (source === 'pandadata' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error('接口参数应为 JSON 对象')
      const item = source === 'file' ? await access.import({ ...base, content, format }) : await access.fetch({ ...base, source: source === 'http' ? { kind: source, url } : { kind: source, method, params: parsed as Record<string, JsonValue> } })
      await done(item)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }}>
    <div className={css.tabs} aria-label="数据来源">{(['file','pandadata','http'] as const).map(value => <button type="button" key={value} disabled={busy} aria-pressed={source === value} onClick={() => setSource(value)}>{value === 'file' ? <UploadSimpleIcon/> : <CloudArrowDownIcon/>}{value === 'file' ? '本地文件' : value === 'pandadata' ? 'PandaData' : '外部接口'}</button>)}</div>
    <label>数据集名称<input required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="例如：沪深 300 日行情"/></label>
    <label>数据分类<select value={category} onChange={e => setCategory(e.target.value as 'auto'|DataCategory)}><option value="auto">自动识别（推荐）</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label} · {item.description}</option>)}</select></label>
    <p>行情看价格与成交，新闻看资讯与事件，基本面看财务与公司资料。日期字段会单独识别，无需定义数据结构。</p>
    {source === 'file' ? <label>选择文件（CSV / JSON，最大 10 MB）<input type="file" accept=".csv,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setError(''); setContent(''); if (file.size > 10 * 1024 * 1024) { setError('文件不能超过 10 MB'); return } setContent(await file.text()); setFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'); if (!name) setName(file.name.replace(/\.[^.]+$/, '')) }}/></label> : source === 'http' ? <label>数据地址<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… / CSV 或 JSON 接口"/></label> : <><p>填写已查阅 PandaData 文档的只读方法与参数。需要先在设置中连接 PandaData。</p><label>方法名<input required pattern="get_.+" placeholder="get_…" value={method} onChange={e => setMethod(e.target.value)}/></label><label>接口参数（JSON）<textarea rows={4} value={params} onChange={e => setParams(e.target.value)}/></label></>}
    <label>缓存有效期（分钟）<input type="number" required min={1} max={525600} value={ttl} onChange={e => setTtl(Number(e.target.value))}/></label>
    <details className={css.advanced}><summary>日期设置（可选）</summary><label>日期列<input placeholder="自动识别；如需指定，请填写真实字段名" value={dateColumn} onChange={e => setDateColumn(e.target.value)}/></label><p>有有效日期时可按范围查询，没有日期时仍可作为研究数据保存。</p></details>
    <footer><button type="button" disabled={busy} onClick={close}>取消</button><button type="submit" className={css.primary} disabled={busy}>{busy ? '正在缓存…' : '导入并缓存'}</button></footer>
  </form></ActionDialog>
}
