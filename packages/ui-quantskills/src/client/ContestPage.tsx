import { useEffect, useRef, useState } from 'react'
import type { ContestData, ContestQuery, QuantSkillsPlainSessionArchiveItem } from './plugin-types.ts'
import { asRecord, contestPhases, contestTime, display, useContest, type ContestAccess } from './contest.ts'
import { ContestPlans } from './ContestPlans.tsx'
import css from './ContestPage.module.css'

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
  researchSessions?: readonly QuantSkillsPlainSessionArchiveItem[] | undefined
  openResearch?: ((sessionId: QuantSkillsPlainSessionArchiveItem['sessionId']) => void) | undefined
}

export function ContestPage({ access, researchSessions = [], openResearch }: ContestPageProps) {
  if (!access) return <section className={css.page}><h1>期货仿真比赛</h1><p>比赛功能暂未就绪，请重新启动应用。</p></section>
  return <ConnectedContestPage access={access} researchSessions={researchSessions} openResearch={openResearch}/>
}

function ConnectedContestPage({ access, researchSessions = [], openResearch }: ContestPageProps & { access: ContestAccess }) {
  const { status, busy, error, run, refresh } = useContest(access)
  const [tab, setTab] = useState<ContestQuery['kind']>('account')
  const [date, setDate] = useState('today'), [board, setBoard] = useState<'live' | 'settled'>('live')
  const [symbol, setSymbol] = useState(''), [data, setData] = useState<ContestData>()
  const [loading, setLoading] = useState(false), [dataError, setDataError] = useState<string>()
  const request = useRef(0), checked = useRef(false)
  const connected = status?.enabled && status.phase === 'connected'
  const recentResearch = status?.identity && researchSessions.filter(session => !session.archived && !session.parentSessionId
    && session.binding.purpose === 'contest' && session.binding.contest?.accountId === status.identity!.accountId
    && session.binding.contest?.contestId === status.identity!.contestId).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const query = async (lastId?: string) => {
    if (!connected || (tab === 'quote' && !symbol.trim())) return
    const id = ++request.current
    setLoading(true); setDataError(undefined); setData(undefined)
    try {
      const next = await access.query({ kind: tab, ...(tab === 'quote' ? { symbol: symbol.trim() } : {}),
        ...(['orders', 'trades'].includes(tab) && date ? { date } : {}), ...(['ranking', 'ranking-me'].includes(tab) ? { board } : {}), ...(lastId ? { lastId } : {}) })
      if (id === request.current) setData(next)
    } catch (error) { if (id === request.current) setDataError(error instanceof Error ? error.message : '查询失败。') }
    finally { if (id === request.current) setLoading(false) }
  }
  useEffect(() => {
    request.current++; setData(undefined); setDataError(undefined); setLoading(false)
    if (connected && tab !== 'quote') void query()
    return () => { request.current++ }
  }, [tab, date, board, connected, status?.identity?.accountId, status?.identity?.contestId])
  useEffect(() => {
    if (!status?.enabled || !status.cliVersion || ['installing', 'authenticating'].includes(status.phase)) { checked.current = false; return }
    if (checked.current) return
    checked.current = true
    void access.checkUpdate().then(refresh).catch(() => {})
  }, [status?.enabled, status?.cliVersion, status?.phase, access, refresh])
  const enabled = status?.enabled ?? false
  return <section className={css.page} aria-label="期货仿真比赛">
    <header className={css.header}>
      <div><span className={css.eyebrow}>PANDAAI · 期货仿真赛</span><h1>比赛工作台</h1><p>研究、预演、确认，跟踪每一笔交易。</p></div>
      <button type="button" role="switch" aria-label="比赛模式" aria-checked={enabled} disabled={!status || busy === 'mode'}
        className={css.switch} data-enabled={enabled} onClick={() => { void run('mode', () => access.mode(!enabled)) }}>
        <span aria-hidden="true"/>{enabled ? '比赛模式已开启' : '开启比赛模式'}</button>
    </header>
    {error && <p className={css.error} role="alert">{error}</p>}
    {!status ? <p role="status">读取本机比赛状态…</p> : !enabled ? <div className={css.welcome}>
      <h2>准备好时，再进入比赛。</h2><p>开启后可连接自己的参赛账户，查看持仓和战绩，并从这里开始研究。</p>
      <p>普通对话、数据、技能和专家继续按原有方式使用。</p>
      {status.message && <p role="status">{status.message}</p>}
      <a href="https://www.pandaaiquant.com/contest/" target="_blank" rel="noreferrer">查看赛事与报名 ↗</a>
    </div> : <>
      <section className={css.connection} aria-label="比赛连接">
        <div><strong>{contestPhases[status.phase]}</strong><p role="status">{status.message || '首次连接将准备官方 CLI，再打开官网授权。'}</p>
          {status.identity && <small>仿真账户 {status.identity.accountId} · 赛事 {status.identity.contestId}</small>}
          {status.cliVersion && <small>CLI {status.cliVersion}{status.updateAvailable ? ` · 可更新至 ${status.latestVersion}` : ''}</small>}
        </div><div className={css.actions}>
          <a href="https://www.pandaaiquant.com/contest/" target="_blank" rel="noreferrer">赛事报名 ↗</a>
          <button type="button" disabled={Boolean(busy)} onClick={() => { void run('connect', () => access.connect()) }}>{busy === 'connect' ? '连接中…' : connected ? '检查连接' : '连接比赛'}</button>
          {status.cliVersion && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('check-update', () => access.checkUpdate()) }}>检查更新</button>}
          {status.updateAvailable && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update', () => access.update()) }}>{busy === 'update' ? '更新中…' : '更新 CLI'}</button>}
          {connected && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('disconnect', () => access.disconnect()) }}>退出账户</button>}
        </div>
      </section>
      <section className={css.assistant} aria-label="AI 交易助手">
        <div className={css.assistantHeading}>
          <div><h2>让 AI 协助你的比赛交易</h2><p>默认继续本账户主对话，先巡检资金、持仓与委托，再研究、预演，由你确认提交。</p></div>
          <div className={css.actions}>
            <button type="button" data-primary disabled={!connected || Boolean(busy)} onClick={() => { void run('research', () => access.startResearch()) }}>
              {busy === 'research' ? '正在打开对话…' : '进入 AI 交易助手'}</button>
            <button type="button" disabled={!connected || Boolean(busy)} onClick={() => { void run('topic', () => access.startResearch(true)) }}>新建专题对话</button>
            {recentResearch && openResearch && <button type="button" disabled={!connected || Boolean(busy)}
              onClick={() => openResearch(recentResearch.sessionId)}>继续最近对话</button>}
          </div>
        </div>
        <ol className={css.steps} aria-label="AI 交易步骤"><li><b>1</b>在对话中提出需求</li><li><b>2</b>选择方案并预演</li><li><b>3</b>核对计划，确认执行</li></ol>
        <p>{connected ? '可以这样问：查看我的持仓，分析下一步操作，先给出建议。' : '连接比赛账户后，即可进入 AI 交易助手。'}</p>
        {recentResearch && <p className={css.recent}>最近对话：{recentResearch.title || '比赛 · AI 交易助手'} · {contestTime(recentResearch.updatedAt)}</p>}
      </section>
      {connected && <>
        <section className={css.dataPanel} aria-label="比赛账户数据">
          <div className={css.tabs} role="tablist" aria-label="比赛数据分类">{tabs.map(([kind, label]) => <button type="button" role="tab" key={kind}
            aria-selected={tab === kind} onClick={() => setTab(kind)}>{label}</button>)}</div>
          <div className={css.toolbar}>
            {['orders', 'trades'].includes(tab) && <label>记录范围 <select value={date} onChange={event => setDate(event.target.value)}><option value="today">今天</option><option value="">最近记录</option></select></label>}
            {['ranking', 'ranking-me'].includes(tab) && <label>榜单 <select value={board} onChange={event => setBoard(event.target.value as 'live' | 'settled')}><option value="live">实时榜</option><option value="settled">结算榜</option></select></label>}
            {tab === 'quote' && <label>品种或实际合约 <input value={symbol} maxLength={32} placeholder="例如：黄金、rb2610" onChange={event => { request.current++; setSymbol(event.target.value); setData(undefined); setLoading(false) }} onKeyDown={event => { if (event.key === 'Enter') void query() }}/></label>}
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
        <ContestPlans status={status} access={access} refresh={refresh}/>
      </>}
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
