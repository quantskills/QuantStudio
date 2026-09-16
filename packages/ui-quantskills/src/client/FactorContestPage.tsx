import { useEffect, useRef, useState } from 'react'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { FactorPoolAction, FactorQuery } from './plugin-types.ts'
import { ActionDialog } from './ActionDialog.tsx'
import { asRecord, contestTime, display } from './contest.ts'
import { factorPhases, factorStates, useFactorContest, type FactorContestAccess } from './factor-contest.ts'
import { FactorPlans } from './FactorPlans.tsx'
import { FactorDataView } from './FactorDataView.tsx'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'
import styles from './FactorContestPage.module.css'

export function FactorContestPage({ access }: { access?: FactorContestAccess | undefined }) {
  if (!access) return <section className={css.page}><h1>第四届因子大赛</h1><p>因子比赛服务未就绪，请重启应用。</p></section>
  return <ConnectedFactorPage access={access}/>
}
function ConnectedFactorPage({ access }: { access: FactorContestAccess }) {
  const { status, error, busy, run, refresh } = useFactorContest(access)
  const [phone, setPhone] = useState(''), [password, setPassword] = useState(''), [login, setLogin] = useState(false)
  const [tab, setTab] = useState<FactorQuery['kind']>('pool'), [data, setData] = useState<JsonValue>(), [page, setPage] = useState(1)
  const [editing, setEditing] = useState<'create' | 'update'>(), [name, setName] = useState(''), [style, setStyle] = useState(''), [cycle, setCycle] = useState(5)
  const [replacement, setReplacement] = useState<string>(), [workflow, setWorkflow] = useState('')
  const [selectedResult, setSelectedResult] = useState<JsonValue>()
  const epoch = useRef(0), checked = useRef(false)
  const queryController = useRef<AbortController | undefined>(undefined)
  const [loading, setLoading] = useState(false), [dataError, setDataError] = useState('')
  const ready = status?.enabled && status.phase === 'connected'
  const canRead = ready && !['connect', 'login', 'disconnect', 'update', 'mode'].includes(busy)
  const pool = asRecord(status?.inspection?.pool), factors = Array.isArray(pool.factors) ? pool.factors.map(asRecord) : []
  const read = async (kind = tab, nextPage = page) => {
    const current = ++epoch.current
    queryController.current?.abort(); queryController.current = new AbortController()
    setLoading(true); setDataError('')
    try {
      const next = await waitForCompetition(async signal => kind === 'pool' ? (await access.inspect(undefined, signal)).pool
        : access.query({ kind, ...(kind === 'workflows' || kind === 'factors' ? { page: nextPage } : {}) }, signal), '因子数据查询', 30_000, queryController.current.signal)
      if (current === epoch.current) { setData(next); if (kind === 'pool') void refresh() }
    } catch (error) { if (current === epoch.current) setDataError(error instanceof Error ? error.message : '因子数据查询未完成。') }
    finally { if (current === epoch.current) setLoading(false) }
  }
  useEffect(() => {
    setLogin(false); setPassword(''); setEditing(undefined); setReplacement(undefined); setSelectedResult(undefined)
  }, [ready, status?.identity?.accountId, status?.identity?.contestId])
  useEffect(() => {
    setData(undefined)
    setLoading(false); setDataError('')
    if (canRead) void read()
    return () => { epoch.current++; queryController.current?.abort() }
  }, [canRead, status?.identity?.accountId, status?.identity?.contestId, tab, page])
  useEffect(() => {
    if (!status?.enabled) { checked.current = false; return }
    if (!ready || !status.cliVersion || busy || checked.current) return
    checked.current = true; void waitForCompetition(() => access.checkUpdate(), 'CLI 更新检查').then(refresh).catch(() => {})
  }, [status?.enabled, status?.cliVersion, ready, busy, access, refresh])
  const prepare = async (action: FactorPoolAction) => {
    await access.prepare(action)
  }
  const records = asRecord(data), workflows = Array.isArray(records.items) ? records.items.map(asRecord) : []
  return <section className={css.page}>
    <header className={css.header}><div><span className={css.eyebrow}>PANDAAI · FACTOR COMPETITION</span><h1>第四届因子大赛</h1><p>研究因子、筛选候选并确认参赛</p></div>
      <button type="button" role="switch" aria-checked={status?.enabled ?? false} aria-label="因子比赛模式" className={css.switch} data-enabled={status?.enabled ?? false}
        disabled={!status || busy === 'mode'} onClick={() => { void run('mode', () => access.mode(!status?.enabled)) }}><span aria-hidden="true"/>因子比赛模式</button>
    </header>
    {!status ? <p role="status">读取状态…</p> : !status.enabled ? <div className={css.welcome}><h2>从因子想法到正式参赛</h2><p>开启后连接自己的 PandaAI 账户，进入专用 AI 对话。应用会准备独立 CLI，研究前确认预算，入池和参赛操作单独确认。</p>
      <a href="https://www.pandaaiquant.com/factorhub/fourthFactorCompetition/" target="_blank" rel="noreferrer">查看赛事与报名</a></div> : <>
      <div className={css.connection}><div><strong>{factorPhases[status.phase]}{status.identity ? ` · 账户 ${status.identity.accountId}` : ''}</strong><p>{status.message}</p>
        <small>因子 CLI {status.cliVersion ?? '首次连接时安装'}{status.latestVersion ? ` · 最新 ${status.latestVersion}` : ''}</small></div>
        <div className={css.actions}><button type="button" disabled={Boolean(busy)} onClick={() => { void run('connect', () => access.connect()) }}>{busy === 'connect' ? '连接中…' : '检查连接'}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => setLogin(true)}>{ready ? '切换因子账户' : '登录并连接'}</button>
          {ready && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('disconnect', () => access.disconnect()) }}>退出账户</button>}
          <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update-check', () => access.checkUpdate()) }}>检查 CLI 更新</button>
          {status.updateAvailable && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update', () => access.update()) }}>更新因子 CLI</button>}
        </div>
      </div>
      <div className={css.assistant}><div className={css.assistantHeading}><div><h2>AI 因子研究助手</h2><p>提出研究目标 → 确认批次预算 → 回测筛选 → 核对因子池并提交</p></div>
        <div className={css.actions}><button type="button" data-primary disabled={!ready || Boolean(busy)} onClick={() => { void run('research', signal => access.startResearch(undefined, signal)) }}>{busy === 'research' ? '正在打开对话…' : '进入 AI 因子助手'}</button>
          <button type="button" disabled={!ready || Boolean(busy)} onClick={() => { void run('research', signal => access.startResearch(true, signal)) }}>新建因子专题</button></div></div>
        <p className={css.recent}>默认继续当前账户主对话。预算与工具权限只用于因子比赛会话。</p>
      </div>
      {ready && <>
        <dl className={css.metrics}><div><dt>算力余额</dt><dd>{display(status.inspection?.balance)}</dd></div><div><dt>有效 / 就绪因子</dt><dd>{display(pool.active_factor_count)} / {display(pool.ready_factor_count)}</dd></div>
          <div><dt>统一调仓周期</dt><dd>{display(pool.rebalance_cycle_days)} 日{pool.cycle_locked === true ? ' · 已锁定' : ''}</dd></div>
          <div><dt>修改窗口</dt><dd>{asRecord(pool.modification_window).open === true ? '开放' : '未开放'}</dd></div></dl>
        <p className={styles.notice}>快照：{status.inspection ? contestTime(status.inspection.fetchedAt) : '尚未读取'}。
          <a href="https://www.pandaaiquant.com/factorhub/fourthFactorCompetition/" target="_blank" rel="noreferrer">报名与身份资料</a> 在官网完成。关闭模式不会停止平台正在运行的回测或参赛因子池。</p>
        <div className={css.actions}><button type="button" disabled={Boolean(busy)} onClick={() => { const current = epoch.current; void run('inspect', async signal => { await waitForCompetition(s => access.inspect(undefined, s), '因子账户巡检', 30_000, signal); if (current === epoch.current && tab !== 'pool') void read() }) }}>{busy === 'inspect' ? '巡检中…' : '刷新账户与因子池'}</button></div>
        <div className={css.dataPanel}><div className={css.tabs} role="tablist" aria-label="因子比赛数据">{([['pool', '比赛因子池'], ['workflows', '可入池工作流'], ['scores', '积分与成绩'], ['factors', '全部研究因子']] as const).map(([key, label]) =>
          <button type="button" role="tab" key={key} aria-selected={tab === key} onClick={() => { setTab(key); setPage(1) }}>{label}</button>)}</div>
          <div className={css.toolbar}><button type="button" disabled={loading} onClick={() => { void read() }}>{loading ? '读取中…' : '刷新当前数据'}</button></div>
          {dataError && <p role="alert" className={css.error}>{dataError}</p>}
          {loading && <p role="status">正在读取因子数据…</p>}
          {tab === 'pool' ? <>
            <div className={css.toolbar}><strong>{display(pool.name)}</strong><span>{({ draft: '建池中', active: '已参赛', submitting: '提交处理中', suspended: '已暂停', archived: '已归档' } as Record<string, string>)[String(pool.status)] ?? '尚未创建因子池'}</span>
              <button type="button" disabled={Boolean(busy)} onClick={() => { setName(String(pool.name ?? '')); setStyle(String(pool.style_tag ?? '')); setCycle(Number(pool.rebalance_cycle_days ?? 5)); setEditing(pool.pool_id ? 'update' : 'create') }}>{pool.pool_id ? '修改因子池设置' : '创建因子池'}</button>
              {Boolean(pool.pool_id) && <button type="button" data-primary disabled={Boolean(busy) || pool.status !== 'draft' || Number(pool.ready_factor_count ?? 0) < 5} onClick={() => { void run('prepare', () => prepare({ kind: 'submit-pool' })) }}>准备正式参赛</button>}
            </div>
            {factors.length === 0 ? <p className={css.empty}>因子池为空。在 AI 对话研究因子，回测完成后到「可入池工作流」选择候选。</p> : factors.map(f => <div className={styles.row} key={String(f.factor_instance_id)}><div><strong>{display(f.factor_name)}</strong><p>工作流 {display(f.workflow_id)} · {display(f.status)}</p></div>
              <div className={css.actions}><button type="button" disabled={Boolean(busy) || f.can_edit === false} onClick={() => { setWorkflow(String(f.workflow_id)); setReplacement(String(f.factor_instance_id)) }}>更新工作流</button>
                <button type="button" disabled={Boolean(busy) || f.can_delete === false} onClick={() => { void run('prepare', () => prepare({ kind: 'remove-factor', factorId: String(f.factor_instance_id) })) }}>准备删除</button></div></div>)}
          </> : tab === 'workflows' ? <>
            {workflows.length === 0 ? !loading && !dataError && <p className={css.empty}>本页暂无工作流，请先完成因子回测。</p> : workflows.map(w => {
              const selectable = w.action === 'add' ? w.action_enabled === true : w.action === undefined && w.selectable === true
              return <div className={styles.row} key={String(w.workflow_id)}><div><strong>{display(w.name)}</strong><p>{display(w.workflow_id)} · {w.in_pool ? '已在池内' : selectable ? '可入池' : display(w.action_detail ?? w.disabled_detail ?? '尚不可入池')}</p></div>
                <button type="button" disabled={Boolean(busy) || !pool.pool_id || !selectable} onClick={() => { void run('prepare', () => prepare({ kind: 'add-factor', workflowId: String(w.workflow_id) })) }}>准备加入因子池</button></div>
            })}
          </> : data === undefined ? <p>等待查询…</p> : <FactorDataView value={data}/>}
          {(tab === 'workflows' || tab === 'factors') && <div className={css.toolbar}><button type="button" disabled={page <= 1 || Boolean(busy)} onClick={() => setPage(p => p - 1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={Boolean(busy)} onClick={() => setPage(p => p + 1)}>下一页</button></div>}
        </div>
      </>}
      <FactorPlans status={status} access={access} refresh={refresh}/>
      <h2>研究批次</h2>{status.budgets.length === 0 ? <p className={css.muted}>暂无研究预算，在专用对话中与 AI 确定一批实验。</p> : [...status.budgets].reverse().slice(0, 20).map(b => <div key={b.id} className={styles.row}><div><strong>{b.hypothesis}</strong><p>{factorStates[b.status]} · 运行 {b.runsUsed}/{b.maxRuns} 次 · 观测消耗 {b.creditsUsed} / 停止阈值 {b.creditThreshold}</p></div>
        {b.status === 'active' && <button type="button" onClick={() => { void run('stop', () => access.stopBudget(b.id)) }}>停止追加回测</button>}</div>)}
      <h2>回测记录</h2>{status.runs.length === 0 ? <p className={css.muted}>暂无回测记录。</p> : [...status.runs].reverse().slice(0, 50).map(r => <div key={`${r.budgetId}-${r.id}`} className={styles.row}><div><strong>{r.candidate.name}</strong><p>{factorStates[r.status]} · {contestTime(r.createdAt)} · {r.workflowId ?? '等待工作流编号'}</p></div>
        <div className={css.actions}><button type="button" onClick={() => setSelectedResult({ candidate: r.candidate as unknown as JsonValue, result: r.result ?? null })}>查看因子与结果</button>
          {r.runId && <button type="button" disabled={!ready || Boolean(busy)} onClick={() => { const current = epoch.current; void run('result', async signal => { const result = await waitForCompetition(s => access.query({ kind: 'factor-result', id: r.runId! }, s), '因子回测结果查询', 30_000, signal); if (!signal.aborted && current === epoch.current) setSelectedResult(result) }) }}>查询完整回测结果</button>}
          {r.status === 'unknown' && <button type="button" disabled={!ready || Boolean(busy)} onClick={() => { void run('reconcile', () => access.reconcileRun(r.id)) }}>只读核对回测</button>}</div></div>)}
    </>}
    {error && <p role="alert" className={css.error}>{error} <button type="button" onClick={() => { void refresh() }}>重新读取状态</button></p>}
    {login && status?.enabled && <ActionDialog title="连接 PandaAI 因子账户" onClose={() => { setLogin(false); setPassword('') }}>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); const credentials = { phone, password }; setPassword(''); void run('login', () => access.connect(credentials)).then(ok => { if (ok) setLogin(false) }) }}>
        <label>手机号<input autoComplete="username" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required/></label>
        <label>密码<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label>
        <p className={styles.notice}>使用 PandaAI 官网账户。登录信息由本机服务处理，专用 AI 对话只接收账户编号。</p>
        <button type="submit" disabled={Boolean(busy) || !phone || !password}>连接因子账户</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </ActionDialog>}
    {editing && <ActionDialog title={editing === 'create' ? '创建比赛因子池' : '修改比赛因子池'} onClose={() => setEditing(undefined)}>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); const action: FactorPoolAction = editing === 'create' ? { kind: 'create-pool', name, style, cycle }
        : { kind: 'update-pool', name, style, ...(pool.cycle_locked === true ? {} : { cycle }) }; void run('prepare', () => prepare(action)).then(ok => { if (ok) setEditing(undefined) }) }}>
        <label>因子池名称<input value={name} minLength={2} maxLength={30} onChange={e => setName(e.target.value)} required/></label><label>风格标签<input value={style} maxLength={50} onChange={e => setStyle(e.target.value)}/></label>
        <label>统一调仓周期（交易日）<input type="number" min={1} max={10} value={cycle} disabled={editing === 'update' && pool.cycle_locked === true} onChange={e => setCycle(Number(e.target.value))}/></label>
        <p className={styles.notice}>正式提交后周期锁定。下一步核对确认卡。</p><button type="submit" disabled={Boolean(busy)}>生成确认计划</button>{error && <p role="alert">{error}</p>}
      </form>
    </ActionDialog>}
    {replacement && <ActionDialog title="更新参赛因子工作流" onClose={() => setReplacement(undefined)}><form className={styles.form} onSubmit={event => { event.preventDefault(); void run('prepare', () => prepare({ kind: 'replace-factor', factorId: replacement, workflowId: workflow })).then(ok => { if (ok) setReplacement(undefined) }) }}>
      <label>工作流编号<input value={workflow} onChange={e => setWorkflow(e.target.value)} required/></label><p className={styles.notice}>需先在平台完成该工作流回测，并处于赛事允许的修改窗口。</p><button type="submit" disabled={Boolean(busy)}>生成更新确认计划</button>{error && <p role="alert">{error}</p>}
    </form></ActionDialog>}
    {selectedResult !== undefined && <ActionDialog title="因子回测记录" wide onClose={() => setSelectedResult(undefined)}><FactorDataView value={selectedResult}/></ActionDialog>}
  </section>
}
