import { useEffect, useState } from 'react'
import type { FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts'
import type { FlyAccess } from './fly/transport.ts'
import type { ContestAccess } from './contest.ts'
import { useContest } from './contest.ts'
import { ContestPlans } from './ContestPlans.tsx'
import { waitForCompetition } from './competition-async.ts'
import './TradingWorkspace.css'
import FlyV2Page from './fly/FlyV2Page.tsx'
import './RefinedTrading.css'

export function FlyPage(props: Parameters<typeof FlyWorkspace>[0]) {
  return <div className={`qs-trader-shell${props.embedded ? ' qs-trader-embedded' : ''}`}>
    {!props.embedded && <div className="qs-workspace-breadcrumb"><button type="button" className="qs-return-contest" onClick={props.openContest}>← 返回比赛首页</button><span>/ AI 交易员</span></div>}
    <FlyWorkspace {...props}/>
  </div>
}

function FlyWorkspace({ access, contest, openContest, openModelSettings }: { embedded?: boolean; access?: FlyAccess | undefined; contest?: ContestAccess | undefined; openContest(): void; openModelSettings?: (() => void) | undefined }) {
  const [state, setState] = useState<FlyRuntimeStatus>(), [error, setError] = useState('')
  const [view, setView] = useState<'dashboard' | 'analysis' | 'talk'>('dashboard')
  useEffect(() => {
    if (!access) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { const result = await waitForCompetition(() => access.status(), 'AI 交易员状态读取', 15_000); if (!disposed) { setState(result); setError('') } }
      catch (error) { if (!disposed) setError(String(error)) }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 2000) }
    }
    void poll(); return () => { disposed = true; clearTimeout(timer) }
  }, [access, view])
  const navigation = <nav className="fv-nav" aria-label="AI 交易员栏目">{([['dashboard', '交易'], ['analysis', '表现'], ['talk', '记录']] as const).map(([key, label]) => <button type="button" key={key} className={view === key ? 'selected' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>{label}</button>)}</nav>
  const heading = <header className="fv-header"><div className="fv-identity"><div className="fv-avatar" aria-hidden="true"><span className="qs-trader-orb"/></div><h1>AI 交易员<span>跟踪持仓、成交与每次交易决策</span></h1></div></header>
  if (!access) return <div className="fv-page fv-workspace">{heading}{navigation}<p>交易服务尚未连接，请重新连接后查看交易状态。</p></div>
  if (!state?.installed) return <div className="fv-page fv-install">{heading}{navigation}<div className="fv-kicker">QuantStudio · AI 交易员</div><h1>准备你的AI 交易员</h1><p>准备运行环境并连接比赛账户后，即可设置交易员。</p><section className="fv-install-card">
    <p>先准备轻量运行环境，即可选择 QS 已配置的大模型。需要神经交易员时，再从设置中安装神经依赖。</p>
    <p role="status">{state?.message ?? '正在检查运行环境…'}</p>{error && <p role="alert">{error}</p>}
    {state && !state.supported ? <p>当前交易运行环境支持 Windows。</p> : <button type="button" className="fv-primary" disabled={!state || state.installing}
      onClick={() => { void access.install({ neural: false }).then(setState).catch(error => setError(String(error))) }}>{state?.installing ? '正在准备…' : '准备交易环境'}</button>}</section></div>
  return <div className="quantstudio-fly">
    <FlyV2Page initialTab={view} active contest={contest} openContest={openContest} openModelSettings={openModelSettings} preparing={state.installing} prepareMessage={state.message} onPrepare={() => access.install({ neural: true })} tradePlans={contest && <FlyPlans access={contest} />}/></div>
}
function FlyPlans({ access }: { access: ContestAccess }) {
  const state = useContest(access)
  if (!state.status) return null
  const identity = state.status.identity
  const filtered = { ...state.status, plans: state.status.plans.filter(plan => plan.sessionId.startsWith('fly:')
    && plan.identity.accountId === identity?.accountId && plan.identity.contestId === identity?.contestId) }
  const pending = filtered.plans.filter(plan => ['prepared', 'executing', 'queued', 'submitted', 'unknown', 'partial'].includes(plan.status)).length
  return <details id="fly-contest-plans" className="fv-contest-plans" open={pending > 0}><summary>交易计划与回执 · {pending} 笔待处理</summary><p>逐笔确认的计划需要核对后提交；自动委托直接展示回执。成交以柜台记录为准。</p><ContestPlans status={filtered} access={access} refresh={state.refresh} /></details>
}
