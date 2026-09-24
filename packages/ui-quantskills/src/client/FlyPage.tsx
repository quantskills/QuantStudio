import { useEffect, useState } from 'react'
import type { FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts'
import type { FlyAccess } from './fly/transport.ts'
import type { ContestAccess } from './contest.ts'
import { useContest } from './contest.ts'
import { ContestPlans } from './ContestPlans.tsx'
import { waitForCompetition } from './competition-async.ts'
import FlyV2Page from './fly/FlyV2Page.tsx'

export function FlyPage({ access, contest, openContest, openModelSettings }: { access?: FlyAccess | undefined; contest?: ContestAccess | undefined; openContest(): void; openModelSettings?: (() => void) | undefined }) {
  const [state, setState] = useState<FlyRuntimeStatus>(), [error, setError] = useState('')
  const [blenderPath, setBlenderPath] = useState('')
  useEffect(() => {
    if (!access) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { const result = await waitForCompetition(() => access.status(), '果蝇状态读取', 15_000); if (!disposed) { setState(result); setError('') } }
      catch (error) { if (!disposed) setError(String(error)) }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 2000) }
    }
    void poll(); return () => { disposed = true; clearTimeout(timer) }
  }, [access])
  if (!access) return <div className="fv-page"><h1>果蝇交易员</h1><p>果蝇服务尚未连接，请重启 QuantStudio。</p></div>
  if (!state?.installed) return <div className="fv-page fv-install"><div className="fv-kicker">QuantStudio · 果蝇交易员</div><h1>准备你的果蝇交易员</h1><p>先准备运行环境，再连接比赛账户与合约。</p><section className="fv-install-card">
    <p>点击一次即可依次准备控制器、神经 Python 与 MaleCNS；会显示进度，完成后进入首次设置。</p>
    <label>已有 Blender 安装路径（可选）<input value={blenderPath} onChange={event => setBlenderPath(event.target.value)} placeholder="安装目录或 blender.exe 的完整路径" /></label>
    <p role="status">{state?.message ?? '正在检查运行环境…'}</p>{error && <p role="alert">{error}</p>}
    {state && !state.supported ? <p>当前果蝇版本支持 Windows。</p> : <button type="button" className="fv-primary" disabled={!state || state.installing}
      onClick={() => { void access.install({ blenderPath: blenderPath.trim() }).then(setState).catch(error => setError(String(error))) }}>{state?.installing ? '正在准备…' : '一键准备果蝇'}</button>}</section></div>
  return <div className="quantstudio-fly">
    <FlyV2Page active contest={contest} openContest={openContest} openModelSettings={openModelSettings} preparing={state.installing} prepareMessage={state.message} onPrepare={path => access.install({ blenderPath: path })} tradePlans={contest && <FlyPlans access={contest} />}/></div>
}
function FlyPlans({ access }: { access: ContestAccess }) {
  const state = useContest(access)
  if (!state.status) return null
  const filtered = { ...state.status, plans: state.status.plans.filter(plan => plan.sessionId.startsWith('fly:')) }
  const pending = filtered.plans.filter(plan => plan.status === 'prepared').length
  return <details id="fly-contest-plans" className="fv-contest-plans" open={pending > 0}><summary>待确认交易计划 · {pending} 笔</summary><p>核对账户、合约与手数后逐笔确认。停止建议不会撤销已提交的委托。</p><ContestPlans status={filtered} access={access} refresh={state.refresh} /></details>
}
