import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, ChatCircleDotsIcon, DotsThreeIcon, PlusIcon, ClockCounterClockwiseIcon, WaveformIcon } from '@phosphor-icons/react'
import type { ContestData, ContestQuery, QuantSkillsPlainSessionArchiveItem } from './plugin-types.ts'
import { asRecord, contestPhases, contestTime, display, useContest, type ContestAccess } from './contest.ts'
import { ContestPlans } from './ContestPlans.tsx'
import { FlyPage } from './FlyPage.tsx'
import { ContestWatch } from './ContestWatch.tsx'
import type { FlyAccess } from './fly/transport.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'
import './RefinedTrading.css'

const tabs: readonly [ContestQuery['kind'], string][] = [['account', '资金'], ['positions', '持仓'], ['open-orders', '当前挂单'], ['orders', '委托记录'], ['trades', '成交记录'], ['ranking-me', '我的排名'], ['ranking', '排行榜'], ['settlements', '每日结算'], ['quote', '最新行情']]
const labels: Record<string, string> = { accountId: '账户', equity: '动态权益', totalProfit: '动态权益', availableFunds: '可用资金', margin: '保证金', riskRate: '风险度', dailyPnl: '当日盈亏', holdingPnl: '持仓盈亏', addProfit: '累计盈亏', cost: '手续费', contractCode: '实际合约', exchange: '交易所', symbol: '品种/合约', direction: '持仓方向', volume: '手数', position: '持仓', closable: '可平', sellable: '可平', openPrice: '开仓价', avgPrice: '均价', lastPrice: '最新价', latestPrice: '最新价', openMarketValue: '开仓市值', holdingPnlRate: '持仓收益率', orderId: '委托号', tradeId: '成交号', tradeDirectionText: '交易方向', tradeDirection: '方向代码', side: '买卖', offset: '开平', price: '价格', filledVolume: '已成手数', orderTime: '委托时间', tradeTime: '成交时间', status: '状态', statusText: '状态', rank: '名次', nickname: '昵称', score: '综合得分', totalScore: '综合得分', returnRate: '收益率', maxDrawdown: '最大回撤', netValue: '净值', settleDate: '结算日', quoteTime: '行情时间', changeRate: '涨跌幅', high: '日内高', low: '日内低', bidPrice1: '买一', askPrice1: '卖一', name: '名称', message: '说明' }
const valueLabels: Record<string, string> = { long: '多头', short: '空头', buy: '买', sell: '卖', open: '开仓', close: '平仓' }
Object.assign(labels, { playerName: '选手', netProfit: '累计净利', tradeCount: '交易笔数', dailyReturn: '当日收益率', cumNav: '累计净值', commission: '手续费', cumulativePnl: '累计盈亏', quantity: '手数', todayVolume: '今仓', total: '总人数', boardType: '榜单', period: '周期', bidVolume1: '买一量', askVolume1: '卖一量', openInterest: '持仓量' })
Object.assign(labels, { startCapital: '初始资金', staticProfit: '静态盈亏', frozenCapital: '冻结资金', positionPnl: '仓位盈亏', marketValue: '持仓市值', tradeDate: '交易日', tradingModes: '交易模式', tradingModeLabels: '交易模式' })
function cell(value: unknown, key: string): string {
  if (/Rate$|Drawdown$|^dailyReturn$/.test(key) && typeof value === 'number') return `${(value * 100).toFixed(2)}%`
  if (key === 'tradeDate' && /^\d{8}$/.test(String(value))) return String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  if (Array.isArray(value)) return value.length ? value.map(item => display(item)).join('、') : '暂无'
  return valueLabels[String(value)] ?? display(value)
}

interface ContestPageProps {
  access?: ContestAccess | undefined
  flyAccess?: FlyAccess | undefined
  openFly?: (() => void) | undefined
  openModelSettings?: (() => void) | undefined
  onWorkspaceChange?: ((open: boolean) => void) | undefined
  researchSessions?: readonly QuantSkillsPlainSessionArchiveItem[] | undefined
  openResearch?: ((sessionId: QuantSkillsPlainSessionArchiveItem['sessionId']) => void) | undefined
}

export function ContestPage({ access, flyAccess, openFly, researchSessions = [], openResearch, openModelSettings, onWorkspaceChange }: ContestPageProps) {
  if (!access) return <section className={css.page}><h1>「巅峰交易者」全国期货模拟赛</h1><p>比赛功能暂未就绪，请重新启动应用。</p></section>
  return <ConnectedContestPage access={access} flyAccess={flyAccess} openFly={openFly} researchSessions={researchSessions} openResearch={openResearch} openModelSettings={openModelSettings} onWorkspaceChange={onWorkspaceChange}/>
}

function ConnectedContestPage({ access, flyAccess, openFly, researchSessions = [], openResearch, openModelSettings, onWorkspaceChange }: ContestPageProps & { access: ContestAccess }) {
  const { status, busy, error, run, refresh } = useContest(access)
  const [workspace, setWorkspace] = useState<'entry' | 'jev' | 'trader'>('entry')
  const [visited, setVisited] = useState({ jev: false, trader: false })
  const [researchMore, setResearchMore] = useState(false)
  const [researchMenuAbove, setResearchMenuAbove] = useState(false)
  const researchMoreRef = useRef<HTMLDivElement>(null)
  const researchMenuId = useId()
  const pageRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!researchMore) return
    const anchor = researchMoreRef.current?.getBoundingClientRect()
    const menu = researchMoreRef.current?.querySelector('.qs-research-menu')?.getBoundingClientRect()
    const page = pageRef.current?.getBoundingClientRect()
    if (!anchor || !menu || !page) return
    const below = Math.min(window.innerHeight, page.bottom) - anchor.bottom
    const above = anchor.top - Math.max(0, page.top)
    setResearchMenuAbove(below < menu.height + 16 && above > below)
  }, [researchMore])
  useEffect(() => {
    if (!researchMore) return
    const dismissOutside = (event: PointerEvent) => {
      if (!researchMoreRef.current?.contains(event.target as Node)) setResearchMore(false)
    }
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setResearchMore(false)
      researchMoreRef.current?.querySelector('button')?.focus()
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [researchMore])
  function navigateWorkspace(next: typeof workspace) {
    setResearchMore(false)
    setWorkspace(next)
    if (next !== 'entry') setVisited(current => ({ ...current, [next]: true }))
    pageRef.current?.scrollTo?.({ top: 0 })
  }
  useEffect(() => { onWorkspaceChange?.(workspace !== 'entry') }, [workspace, onWorkspaceChange])
  useEffect(() => { if (status && !status.enabled) setWorkspace('entry') }, [status?.enabled])
  const accountPanel = useRef<HTMLDetailsElement>(null)
  function revealAccount() {
    navigateWorkspace('entry')
    requestAnimationFrame(() => {
      if (!accountPanel.current) return
      accountPanel.current.open = true
      accountPanel.current.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      accountPanel.current.querySelector('summary')?.focus({ preventScroll: true })
    })
  }
  const [tab, setTab] = useState<ContestQuery['kind']>('account')
  const [date, setDate] = useState('today'), [board, setBoard] = useState<'live' | 'settled'>('live')
  const [symbol, setSymbol] = useState(''), [data, setData] = useState<ContestData>()
  const [loading, setLoading] = useState(false), [dataError, setDataError] = useState<string>()
  const request = useRef(0), checked = useRef(false)
  const queryController = useRef<AbortController | undefined>(undefined)
  const connected = status?.enabled && status.phase === 'connected'
  const canRead = connected && !['connect', 'disconnect', 'update', 'mode'].includes(busy)
  const recentResearch = status?.identity && researchSessions.filter(session => !session.archived && !session.parentSessionId
    && session.binding.purpose === 'contest' && session.binding.contest?.accountId === status.identity!.accountId
    && session.binding.contest?.contestId === status.identity!.contestId).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const query = async (lastId?: string) => {
    if (!connected || (tab === 'quote' && !symbol.trim())) return
    const id = ++request.current
    queryController.current?.abort(); queryController.current = new AbortController()
    setLoading(true); setDataError(undefined); setData(undefined)
    try {
      const next = await waitForCompetition(signal => access.query({ kind: tab, ...(tab === 'quote' ? { symbol: symbol.trim() } : {}),
        ...(['orders', 'trades'].includes(tab) && date ? { date } : {}), ...(['ranking', 'ranking-me'].includes(tab) ? { board } : {}), ...(lastId ? { lastId } : {}) }, signal), '比赛数据查询', 30_000, queryController.current.signal)
      if (id === request.current) setData(next)
    } catch (error) { if (id === request.current) setDataError(error instanceof Error ? error.message : '查询失败。') }
    finally { if (id === request.current) setLoading(false) }
  }
  useEffect(() => {
    request.current++; setData(undefined); setDataError(undefined); setLoading(false)
    if (canRead && tab !== 'quote') void query()
    return () => { request.current++; queryController.current?.abort() }
  }, [tab, date, board, canRead, status?.identity?.accountId, status?.identity?.contestId])
  useEffect(() => {
    if (!status?.enabled || !status.cliVersion) { checked.current = false; return }
    if (!connected || busy) return
    if (checked.current) return
    checked.current = true
    void waitForCompetition(() => access.checkUpdate(), 'CLI 更新检查').then(refresh).catch(() => {})
  }, [status?.enabled, status?.cliVersion, connected, busy, access, refresh])
  const enabled = status?.enabled ?? false
  return <section ref={pageRef} className={`${css.page} qs-contest-workspace`} data-workspace={workspace} aria-label="期货仿真比赛">
    <header className={css.header} hidden={workspace !== 'entry'}>
      <div><span className={css.eyebrow}>比赛 / 期货模拟赛</span><h1>你的交易空间</h1><p>选择工作台，开始研究与交易。</p></div>
      <button type="button" role="switch" aria-label="比赛模式" aria-checked={enabled} disabled={!status || busy === 'mode'}
        className={css.switch} data-enabled={enabled} onClick={() => { void run('mode', () => access.mode(!enabled)) }}>
        <span aria-hidden="true"/>{enabled ? '比赛模式已开启' : '开启比赛模式'}</button>
    </header>
    {workspace !== 'entry' && <div className="qs-workspace-breadcrumb">
      <button type="button" onClick={() => navigateWorkspace('entry')}><ArrowLeftIcon size={15}/>返回比赛首页</button><span>/</span><span>{workspace === 'jev' ? 'JEV 盯盘' : 'AI 交易员'}</span>
      <div className="qs-workspace-account"><button type="button" onClick={revealAccount}>{connected ? `仿真账户 ${status?.identity?.accountId ?? ''}` : '连接比赛账户'}</button>{status && <ContestPlans status={status} access={access} refresh={refresh} compact/>}</div>
    </div>}
    {error && <p className={css.error} role="alert">{error} <button type="button" onClick={() => { void refresh() }}>重新读取状态</button></p>}
    {!status ? <p role="status">读取本机比赛状态…</p> : !enabled ? <div className={css.welcome}>
      <h2>准备好时，再进入比赛。</h2><p>开启后可连接自己的参赛账户，查看持仓和战绩，并从这里开始研究。</p>
      <p>普通对话、数据、技能和专家继续按原有方式使用。</p>
      {status.message && <p role="status">{status.message}</p>}
      <a href="https://www.pandaaiquant.com/contest/" target="_blank" rel="noreferrer">查看赛事与报名 ↗</a>
    </div> : <>
      <div hidden={workspace !== 'entry'}><section className={css.connection} data-compact={connected || undefined} aria-label="比赛连接">
        <div><strong className={css.connectionState} data-connected={Boolean(connected)}>{contestPhases[status.phase]}</strong>{(!connected || status.message) && <p role="status">{status.message || '首次连接将准备官方 CLI，再打开官网授权。'}</p>}
          {status.identity && <small>仿真账户 {status.identity.accountId}</small>}
        </div><div className={css.connectionTools}><ContestPlans status={status} access={access} refresh={refresh} compact/><details className={css.accountActions} open={!connected}><summary>账户管理</summary><div className={css.actions}>
          {status.identity && <small>赛事 {status.identity.contestId}</small>}
          {status.cliVersion && <small>CLI {status.cliVersion}{status.updateAvailable ? ` · 可更新至 ${status.latestVersion}` : ''}</small>}
          <a href="https://www.pandaaiquant.com/contest/" target="_blank" rel="noreferrer">赛事报名 ↗</a>
          <button type="button" disabled={Boolean(busy)} onClick={() => { void run('connect', () => access.connect()) }}>{busy === 'connect' ? '连接中…' : connected ? '检查连接' : '连接比赛'}</button>
          {status.cliVersion && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('check-update', () => access.checkUpdate()) }}>检查更新</button>}
          {status.updateAvailable && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update', () => access.update()) }}>{busy === 'update' ? '更新中…' : '更新 CLI'}</button>}
          {connected && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('disconnect', () => access.disconnect()) }}>退出账户</button>}
        </div></details></div>
      </section>
      <div className="qs-workspace-entries" aria-label="交易工作台入口">
        {access.watch && <button type="button" className="qs-workspace-entry" onClick={() => navigateWorkspace('jev')}><span className="qs-workspace-avatar"><WaveformIcon size={27}/></span><span><strong>JEV 盯盘</strong><small>按你的策略盯盘，自选确认或自动下单。</small></span><ArrowRightIcon size={21}/></button>}
        {(flyAccess || openFly) && <button type="button" className="qs-workspace-entry" onClick={() => flyAccess ? navigateWorkspace('trader') : openFly?.()}><span className="qs-workspace-avatar"><span className="qs-trader-orb"/></span><span><strong>AI 交易员</strong><small>同时跟踪多个合约，自选确认或自动下单。</small></span><ArrowRightIcon size={21}/></button>}
        <article className="qs-workspace-research" aria-label="Ai辅助">
          <button type="button" className="qs-workspace-entry" aria-label={busy === 'research' ? '正在打开对话…' : '进入 AI 交易助手'} disabled={!connected || Boolean(busy)} onClick={() => { setResearchMore(false); void run('research', signal => access.startResearch(undefined, signal)) }}>
            <span className="qs-workspace-avatar"><ChatCircleDotsIcon size={27}/></span>
            <span><strong>Ai辅助</strong><small>{busy === 'research' ? '正在打开对话…' : connected ? '查持仓、研究行情，把想法整理成交易计划。' : '连接比赛账户后，即可进入 AI 交易助手。'}</small></span>
            <ArrowRightIcon size={21}/>
          </button>
          <div className="qs-research-more" ref={researchMoreRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setResearchMore(false) }}>
            <button type="button" className="qs-research-more-trigger" aria-label="更多对话选项" title="更多对话选项" aria-expanded={researchMore} aria-controls={researchMenuId} onClick={() => setResearchMore(open => !open)}><DotsThreeIcon size={24}/></button>
            {researchMore && <div id={researchMenuId} className="qs-research-menu" data-above={researchMenuAbove}>
              <button type="button" disabled={!connected || Boolean(busy)} onClick={() => { setResearchMore(false); void run('topic', signal => access.startResearch(true, signal)) }}><PlusIcon size={18}/>新建专题对话</button>
              {recentResearch && openResearch && <button type="button" disabled={!connected || Boolean(busy)} onClick={() => { setResearchMore(false); openResearch(recentResearch.sessionId) }}><ClockCounterClockwiseIcon size={18}/>继续最近对话</button>}
              {recentResearch && <div className="qs-research-recent"><small>最近对话</small><span>{recentResearch.title || '比赛 · AI 交易助手'}</span><small>{contestTime(recentResearch.updatedAt)}</small></div>}
            </div>}
          </div>
        </article>
      </div>
      <details className={css.methodGuide}><summary>JEV 和 AI 交易员有什么区别？</summary><div>
        <p><strong>JEV 盯盘</strong>按你设置的策略和行情作判断，支持逐笔确认或自动下单。</p>
        <p><strong>AI 交易员</strong>可选择 QS 大模型或本地神经模型，支持多合约和两种执行方式。</p>
        <p>两者共用比赛账户，配置与运行状态独立。为避免重复操作同一账户，JEV 盯盘运行时，AI 交易员会等待。AI 交易员里的「生活」可单独体验。</p>
      </div></details>
      <details ref={accountPanel} className={css.contestDetails} aria-label="比赛详情">
        <summary><h2>账户与赛况</h2><span>资金 · 持仓 · 委托 · 成交 · 排名</span></summary>
        <p className={css.muted}>当前比赛账户的整体数据，包含各策略与手工交易。</p>
        {connected ? <>
        <section className={css.dataPanel} aria-label="比赛账户数据">
          <div className={css.tabs} role="tablist" aria-label="比赛数据分类">{tabs.map(([kind, label]) => <button type="button" role="tab" key={kind}
            aria-selected={tab === kind} onClick={() => setTab(kind)}>{label}</button>)}</div>
          <div className={css.toolbar}>
            {['orders', 'trades'].includes(tab) && <label>记录范围 <select value={date} onChange={event => setDate(event.target.value)}><option value="today">今天</option><option value="">最近记录</option></select></label>}
            {['ranking', 'ranking-me'].includes(tab) && <label>榜单 <select value={board} onChange={event => setBoard(event.target.value as 'live' | 'settled')}><option value="live">实时榜</option><option value="settled">结算榜</option></select></label>}
            {tab === 'quote' && <label>品种或实际合约 <input value={symbol} maxLength={32} placeholder="例如：黄金、rb2610" onChange={event => { request.current++; queryController.current?.abort(); setSymbol(event.target.value); setData(undefined); setLoading(false) }} onKeyDown={event => { if (event.key === 'Enter') void query() }}/></label>}
            <button type="button" disabled={loading || (tab === 'quote' && !symbol.trim())} onClick={() => { void query() }}>{loading ? '读取中…' : '刷新数据'}</button>
            {data && <small>读取于 {contestTime(data.fetchedAt)}（上海）</small>}
          </div>
          {dataError && <p className={css.error} role="alert">{dataError}</p>}
          {loading && <p role="status">正在读取比赛数据…</p>}
          {data && <ContestTable value={data.data}/>}
          {data?.meta?.hasMore === true && typeof data.meta.nextLastId !== 'undefined' && <button type="button" disabled={loading}
            onClick={() => { void query(String(data.meta?.nextLastId)) }}>下一页记录</button>}
          {tab === 'quote' && !data && !loading && <p className={css.muted}>输入一个品种或实际合约，查询最新行情快照。</p>}
        </section>
        </> : <p className={css.muted}>连接比赛账户后，可查看资金、持仓、成交、排名及交易计划。</p>}
      </details>
      </div>
      {visited.jev && access.watch && <div hidden={workspace !== 'jev'} className="qs-independent-workspace" aria-label="JEV 独立工作台"><ContestWatch accountId={status?.identity?.accountId} access={access.watch} connected={Boolean(connected)} openModelSettings={openModelSettings}/></div>}
      {visited.trader && flyAccess && <div hidden={workspace !== 'trader'} className="qs-independent-workspace" aria-label="AI 交易员独立工作台"><FlyPage embedded access={flyAccess} contest={access} openContest={revealAccount} openModelSettings={openModelSettings}/></div>}
    </>}
  </section>
}

export function ContestTable({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className={css.empty}>当前没有记录。</p>
    const rows = value.map(asRecord)
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => labels[key] || ['netProfit', 'profitRate', 'quantity', 'todayVolume'].includes(key))
    const columns = keys.length ? keys : Object.keys(rows[0] ?? {})
    return <div className={css.tableWrap}><table><thead><tr>{columns.map(key => <th key={key} scope="col">{labels[key] ?? key}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{columns.map(key => <td key={key}>{cell(row[key], key)}</td>)}</tr>)}</tbody></table></div>
  }
  const object = asRecord(value)
  if (object.ready === false) return <p className={css.empty}>{display(object.message ?? '暂无行情快照')}</p>
  if (Array.isArray(object.items)) return <ContestTable value={object.items}/>
  if (object.item && typeof object.item === 'object') {
    const { item, ...summary } = object
    return <ContestTable value={{ ...summary, ...asRecord(item) }}/>
  }
  return <dl className={css.metrics}>{Object.entries(object).filter(([key, val]) => key !== 'ready'
    && !(['tradingModes', 'tradingModeLabels'].includes(key) && Array.isArray(val) && val.length === 0)
    && !(key === 'tradingModes' && Array.isArray(object.tradingModeLabels) && object.tradingModeLabels.length > 0))
    .map(([key, val]) => <div key={key}><dt>{labels[key] ?? key}</dt><dd>{cell(val, key)}</dd></div>)}</dl>
}
