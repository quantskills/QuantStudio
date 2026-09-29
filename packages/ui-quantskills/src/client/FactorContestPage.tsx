import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon, ArrowsClockwiseIcon, ChartLineUpIcon, CheckIcon, FlaskIcon, GearSixIcon, StackIcon } from '@phosphor-icons/react'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { FactorInspection, FactorPoolAction, FactorQuery } from './plugin-types.ts'
import { ActionDialog } from './ActionDialog.tsx'
import { asRecord, contestTime, display } from './contest.ts'
import { factorPhases, factorStates, useFactorContest, type FactorContestAccess } from './factor-contest.ts'
import { FactorPlans } from './FactorPlans.tsx'
import { FactorDataView } from './FactorDataView.tsx'
import { FactorWorkflowUpdate } from './FactorWorkflowUpdate.tsx'
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
  const [settings, setSettings] = useState(false), [activity, setActivity] = useState<'plans' | 'budgets' | 'runs'>('plans')
  const [openPlanId, setOpenPlanId] = useState<string>(), [inspection, setInspection] = useState<FactorInspection>()
  const epoch = useRef(0), checked = useRef(false)
  const queryController = useRef<AbortController | undefined>(undefined)
  const [loading, setLoading] = useState(false), [dataError, setDataError] = useState('')
  const ready = status?.enabled && status.phase === 'connected'
  const canRead = ready && !['connect', 'login', 'disconnect', 'update', 'mode'].includes(busy)
  // Display the returned snapshot immediately; local status polling can lag behind a query.
  const snapshot = inspection && inspection.identity.accountId === status?.identity?.accountId
    && (!status.inspection || inspection.fetchedAt >= status.inspection.fetchedAt) ? inspection : status?.inspection
  const pool = asRecord(snapshot?.pool), factors = Array.isArray(pool.factors) ? pool.factors.map(asRecord) : []
  const read = async (kind = tab, nextPage = page) => {
    const current = ++epoch.current
    queryController.current?.abort(); queryController.current = new AbortController()
    setLoading(true); setDataError('')
    if (kind !== 'pool') setData(undefined)
    try {
      const next = await waitForCompetition(async signal => kind === 'pool' ? await access.inspect(undefined, signal)
        : access.query({ kind, ...(kind === 'workflows' || kind === 'factors' ? { page: nextPage } : {}) }, signal), '因子数据查询', 30_000, queryController.current.signal)
      if (current === epoch.current) {
        if (kind === 'pool') { setInspection(next as FactorInspection); setData((next as FactorInspection).pool) }
        else setData(next as JsonValue)
        void refresh()
      }
    } catch (error) { if (current === epoch.current) setDataError(error instanceof Error ? error.message : '因子数据查询未完成。') }
    finally { if (current === epoch.current) setLoading(false) }
  }
  useEffect(() => {
    setLogin(false); setPassword(''); setEditing(undefined); setReplacement(undefined); setSelectedResult(undefined)
    setInspection(undefined); setOpenPlanId(undefined)
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
    const plan = await access.prepare(action)
    setActivity('plans'); setOpenPlanId(plan.id)
  }
  const showResult = (kind: 'factor-info' | 'factor-result', id: string) => {
    const current = epoch.current
    void run('result', async signal => {
      const result = await waitForCompetition(s => access.query({ kind, id }, s), '因子详情查询', 30_000, signal)
      if (!signal.aborted && current === epoch.current) setSelectedResult(result)
    })
  }
  const records = asRecord(data), workflows = Array.isArray(records.items) ? records.items.map(asRecord) : []
  const pending = status?.plans.filter(p => ['prepared', 'unknown'].includes(p.status)).length ?? 0
  const buildingPool = pool.status === 'draft' || (pool.status === 'validating' && pool.submitted_at === null && pool.cycle_locked === false)
  const stage = !ready ? 0 : pool.status === 'active' || pool.status === 'submitting' ? 3 : factors.length > 0 ? 2 : 1
  const canNext = !loading && !dataError && data !== undefined && (typeof records.total === 'number'
    ? page * 50 < records.total : (Array.isArray(records.items) ? records.items : Array.isArray(records.factors) ? records.factors : []).length >= 50)
  return <section className={`${css.page} ${styles.workbench}`} aria-label="因子比赛工作台">
    <header className={styles.heading}><div className={styles.title}><span className={styles.icon}><FlaskIcon size={26}/></span><div><h1>第四届因子大赛</h1><p>把研究想法，变成可检验的参赛因子。</p></div></div>
      <button type="button" className={styles.settingsButton} onClick={() => setSettings(true)}><GearSixIcon size={18}/>账户与设置</button>
    </header>
    {status?.enabled && <div className={styles.accountBar}>
      <div className={styles.accountIdentity}><i data-ready={Boolean(ready)} aria-hidden="true"/><strong>{factorPhases[status.phase]}</strong><span>{status.identity ? `账户 ${status.identity.accountId}` : 'PandaAI 因子账户'}</span></div>
      <div className={css.actions}><button type="button" disabled={Boolean(busy)} onClick={() => { void run('connect', () => access.connect()) }}>{busy === 'connect' ? '连接中…' : '检查连接'}</button>
        {!ready && <button type="button" data-primary disabled={Boolean(busy)} onClick={() => setLogin(true)}>登录并连接<ArrowRightIcon size={15}/></button>}</div>
    </div>}
    {status?.enabled && status.phase === 'error' && status.message && <p className={styles.inlineNotice} role="status">{status.message}</p>}
    {!status ? <p role="status">读取状态…</p> : !status.enabled ? <div className={css.welcome}><h2>从因子想法到正式参赛</h2><p>开启后连接自己的 PandaAI 账户，进入专用 AI 对话。应用会准备独立 CLI，研究前确认预算，入池和参赛操作单独确认。</p>
      <button type="button" data-primary disabled={Boolean(busy)} onClick={() => { void run('mode', () => access.mode(true)) }}>开启因子比赛</button>
      <a href="https://www.pandaaiquant.com/factorhub/fourthFactorCompetition/" target="_blank" rel="noreferrer">查看赛事与报名</a></div> : <>
      <ol className={styles.journey} aria-label="参赛流程">{[
        ['连接账户', '读取算力与参赛信息'], ['研究与回测', '在对话中提出想法'], ['组建因子池', '筛选至少 5 只就绪因子'], ['确认参赛', '核对周期，提交因子池'],
      ].map(([label, detail], i) => <li key={label} data-current={stage === i} data-done={stage > i}><span>{stage > i ? <CheckIcon size={16}/> : String(i + 1).padStart(2, '0')}</span><div><strong>{label}</strong><small>{detail}</small></div></li>)}</ol>
      <div className={styles.researchHero}><div className={styles.heroCopy}><span className={styles.eyebrow}>RESEARCH WORKSPACE</span><h2>先有想法，再用回测验证。</h2><p>与 AI 因子研究助手一起写因子、比较结果。确认研究预算后开始回测，满意的候选再加入因子池。</p>
        <div className={css.actions}><button type="button" data-primary disabled={!ready || Boolean(busy)} onClick={() => { void run('research', signal => access.startResearch(undefined, signal)) }}>{busy === 'research' ? '正在打开对话…' : '进入 AI 因子助手'}<ArrowRightIcon size={17}/></button>
        {ready && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('research', signal => access.startResearch(true, signal)) }}>新建因子专题</button>}</div>
        {!ready && <small>连接账户后，即可开始研究。</small>}</div>
        <div className={styles.researchExample}><span><ChartLineUpIcon size={18}/>可以这样开始</span><p>“研究一个低换手的反转因子，<br/>先检验分年表现和稳定性。”</p><div><span>研究假设</span><ArrowRightIcon size={13}/><span>回测结果</span><ArrowRightIcon size={13}/><span>参赛因子</span></div></div>
      </div>
      {ready && <>
        <dl className={styles.balanceStrip}><div><dt>算力余额</dt><dd>{display(snapshot?.balance)}</dd></div><div><dt>有效 / 就绪因子</dt><dd>{display(pool.active_factor_count)} / {display(pool.ready_factor_count)}</dd></div>
          <div><dt>统一调仓周期</dt><dd>{display(pool.rebalance_cycle_days)} 日{pool.cycle_locked === true ? ' · 已锁定' : ''}</dd></div>
          <div><dt>修改窗口</dt><dd>{!snapshot ? '—' : !pool.pool_id ? '尚未建池' : buildingPool ? '建池中' : asRecord(pool.modification_window).open === true ? '开放' : '未开放'}</dd></div></dl>
        <div className={styles.sectionHeading}><h2>我的因子工作区</h2><span>{snapshot ? `更新于 ${contestTime(snapshot.fetchedAt)}` : '尚未读取账户快照'}</span></div>
        <div className={styles.dataWorkspace}><div className={styles.workspaceTop}><div className={styles.tabs} role="tablist" aria-label="因子比赛数据">{([['pool', '比赛因子池'], ['workflows', '可入池工作流'], ['scores', '积分与成绩'], ['factors', '全部研究因子']] as const).map(([key, label]) =>
          <button type="button" role="tab" key={key} id={`factor-tab-${key}`} aria-controls="factor-data-panel" aria-selected={tab === key} onClick={() => { setTab(key); setPage(1) }}>{label}</button>)}</div>
          <button type="button" aria-label="刷新当前数据" disabled={loading} onClick={() => { void read() }}><ArrowsClockwiseIcon size={17}/>{loading ? '读取中…' : '刷新'}</button></div>
          <div className={styles.panelContent} role="tabpanel" id="factor-data-panel" aria-labelledby={`factor-tab-${tab}`}>
          {dataError && <p role="alert" className={css.error}>{dataError}</p>}
          {loading && <p role="status">正在读取因子数据…</p>}
          {tab === 'pool' ? snapshot && <>
            <div className={css.toolbar}><strong>{display(pool.name)}</strong><span>{({ draft: '建池中', validating: '因子校验中', active: '已参赛', submitting: '提交处理中', suspended: '已暂停', archived: '已归档' } as Record<string, string>)[String(pool.status)] ?? (pool.pool_id ? '状态待核验' : '尚未创建因子池')}</span>
              <button type="button" disabled={Boolean(busy) || loading || Boolean(dataError) || !snapshot} onClick={() => { setName(String(pool.name ?? '')); setStyle(String(pool.style_tag ?? '')); setCycle(Number(pool.rebalance_cycle_days ?? 5)); setEditing(pool.pool_id ? 'update' : 'create') }}>{pool.pool_id ? '修改因子池设置' : '创建因子池'}</button>
              {Boolean(pool.pool_id) && <button type="button" data-primary disabled={Boolean(busy) || loading || Boolean(dataError) || !buildingPool || Number(pool.ready_factor_count ?? 0) < 5} onClick={() => { void run('prepare', () => prepare({ kind: 'submit-pool' })) }}>准备正式参赛</button>}
            </div>
            {factors.length === 0 ? <div className={styles.emptyState}><StackIcon size={32}/><h3>{pool.pool_id ? '把验证过的因子收进来' : '还没有比赛因子池'}</h3><p>{pool.pool_id ? '回测完成后，从“可入池工作流”选择候选。' : '先研究因子，或创建因子池整理已有成果。'}</p></div> : factors.map(f => <div className={styles.row} key={String(f.factor_instance_id)}><div><strong>{display(f.factor_name)}</strong><p>工作流 {display(f.workflow_id)} · {({ validating: '校验中', pending_effective: '待生效', ready: '已就绪', active: '已生效', rejected: '未通过', removed: '已移除' } as Record<string, string>)[String(f.status)] ?? display(f.status)}</p></div>
              <div className={css.actions}><button type="button" disabled={Boolean(busy) || loading || Boolean(dataError) || f.can_edit === false} onClick={() => { setWorkflow(String(f.workflow_id)); setReplacement(String(f.factor_instance_id)) }}>更新工作流</button>
                <button type="button" disabled={Boolean(busy) || loading || Boolean(dataError) || f.can_delete === false} onClick={() => { void run('prepare', () => prepare({ kind: 'remove-factor', factorId: String(f.factor_instance_id) })) }}>准备删除</button></div></div>)}
          </> : tab === 'workflows' ? <>
            {workflows.length === 0 ? !loading && !dataError && <p className={css.empty}>本页暂无工作流，请先完成因子回测。</p> : workflows.map(w => {
              const selectable = w.action === 'add' ? w.action_enabled === true : w.action === undefined && w.selectable === true
              return <div className={styles.row} key={String(w.workflow_id)}><div><strong>{display(w.name)}</strong><p>{display(w.workflow_id)} · {w.in_pool ? '已在池内' : selectable ? '可入池' : display(w.action_detail ?? w.disabled_detail ?? '尚不可入池')}</p></div>
                <div className={css.actions}><button type="button" disabled={Boolean(busy)} onClick={() => showResult('factor-info', String(w.workflow_id))}>查看因子定义</button>
                <button type="button" disabled={Boolean(busy) || !pool.pool_id || !selectable} onClick={() => { void run('prepare', () => prepare({ kind: 'add-factor', workflowId: String(w.workflow_id) })) }}>准备加入因子池</button></div></div>
            })}
          </> : tab === 'factors' && Array.isArray(records.factors) ? records.factors.length === 0
            ? <div className={styles.emptyState}><h3>还没有研究因子</h3><p>在因子助手中提出一个研究想法，完成回测后会出现在这里。</p></div>
            : records.factors.map(value => { const f = asRecord(value); return <div className={styles.row} key={String(f._id)}><div><strong>{display(f.name)}</strong><p>工作流 {display(f._id)} · {f.last_run_id ? '已有回测' : '尚未回测'}</p></div><div className={css.actions}>
              <button type="button" disabled={Boolean(busy)} onClick={() => showResult('factor-info', String(f._id))}>查看因子定义</button>
              {typeof f.last_run_id === 'string' && f.last_run_id && <button type="button" disabled={Boolean(busy)} onClick={() => showResult('factor-result', String(f.last_run_id))}>查看回测结果</button>}
            </div></div> }) : data === undefined ? !loading && !dataError && <p>等待查询…</p> : <FactorDataView value={data}/>}
          {(tab === 'workflows' || tab === 'factors') && <div className={styles.pagination}><button type="button" disabled={page <= 1 || Boolean(busy) || loading} onClick={() => setPage(p => p - 1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={Boolean(busy) || !canNext} onClick={() => setPage(p => p + 1)}>下一页</button></div>}
          </div>
        </div>
      </>}
      {(ready || status.plans.length + status.budgets.length + status.runs.length > 0) && <div className={styles.activity}>
      <div className={styles.tabs} role="tablist" aria-label="研究与操作记录">{([['plans', '操作计划与确认', pending], ['budgets', '研究批次', status.budgets.length], ['runs', '回测记录', status.runs.length]] as const).map(([key, label, count]) =>
        <button key={key} role="tab" type="button" aria-selected={activity === key} aria-controls={`factor-${key}-panel`} id={`factor-${key}-tab`} onClick={() => setActivity(key)}>{label}<span className={styles.count}>{count}</span></button>)}</div>
      <div className={styles.panelContent} role="tabpanel" id="factor-plans-panel" aria-labelledby="factor-plans-tab" hidden={activity !== 'plans'}>
      <FactorPlans status={status} access={access} openPlanId={openPlanId} hideHeading refresh={async () => { await refresh(); if (ready) await read() }}/></div>
      <div className={styles.panelContent} role="tabpanel" id="factor-budgets-panel" aria-labelledby="factor-budgets-tab" hidden={activity !== 'budgets'}>
      {status.budgets.length === 0 ? <div className={styles.emptyState}><h3>研究预算会记录在这里</h3><p>在因子助手中说明研究目标，确认批次预算后开始实验。</p></div> : [...status.budgets].reverse().slice(0, 20).map(b => <div key={b.id} className={styles.row}><div><strong>{b.hypothesis}</strong><p>{factorStates[b.status]} · 运行 {b.runsUsed}/{b.maxRuns} 次 · 观测消耗 {b.creditsUsed} / 停止阈值 {b.creditThreshold}</p></div>
        {b.status === 'active' && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('stop', () => access.stopBudget(b.id)) }}>停止追加回测</button>}</div>)}</div>
      <div className={styles.panelContent} role="tabpanel" id="factor-runs-panel" aria-labelledby="factor-runs-tab" hidden={activity !== 'runs'}>
      {status.runs.length === 0 ? <div className={styles.emptyState}><h3>还没有回测记录</h3><p>完成回测后，在这里查看公式、运行状态和完整结果。</p></div> : [...status.runs].reverse().slice(0, 50).map(r => <div key={`${r.budgetId}-${r.id}`} className={styles.row}><div><strong>{r.candidate.name}</strong><p>{factorStates[r.status]} · {contestTime(r.createdAt)} · {r.workflowId ?? (r.status === 'failed' ? '未创建工作流' : '等待工作流编号')}</p></div>
        <div className={css.actions}><button type="button" onClick={() => setSelectedResult({ candidate: r.candidate as unknown as JsonValue, result: r.result ?? null })}>查看因子与结果</button>
          {r.runId && <button type="button" disabled={!ready || Boolean(busy)} onClick={() => { const current = epoch.current; void run('result', async signal => { const result = await waitForCompetition(s => access.query({ kind: 'factor-result', id: r.runId! }, s), '因子回测结果查询', 30_000, signal); if (!signal.aborted && current === epoch.current) setSelectedResult(result) }) }}>查询完整回测结果</button>}
          {r.status === 'unknown' && <button type="button" disabled={!ready || Boolean(busy)} onClick={() => { void run('reconcile', () => access.reconcileRun(r.id)) }}>只读核对回测</button>}</div></div>)}</div></div>}
      {!ready && <div className={styles.firstSteps}><div><StackIcon size={22}/><h3>已有因子，也能直接用</h3><p>连接后读取你的工作流、比赛因子池和历史成绩，无需从头研究。</p></div><a href="https://www.pandaaiquant.com/factorhub/fourthFactorCompetition/" target="_blank" rel="noreferrer">查看赛事与报名 <ArrowRightIcon size={16}/></a></div>}
    </>}
    {settings && <ActionDialog title="因子账户与设置" dismissOnBackdrop onClose={() => setSettings(false)}><div className={styles.accountSettings}>
      <div><h3>因子比赛模式</h3><p>关闭后停止本应用追加操作；平台已启动的回测和参赛因子池继续运行。</p><button type="button" role="switch" aria-checked={status?.enabled ?? false} aria-label="因子比赛模式" className={css.switch} data-enabled={status?.enabled ?? false}
        disabled={!status || busy === 'mode'} onClick={() => { void run('mode', () => access.mode(!status?.enabled)) }}><span aria-hidden="true"/>{status?.enabled ? '已开启' : '已关闭'}</button></div>
      {status?.enabled && <><div><h3>账户连接</h3><p>{status.message || '连接你的 PandaAI 因子账户。'}</p><div className={css.actions}><button type="button" disabled={Boolean(busy)} onClick={() => { setSettings(false); setLogin(true) }}>{ready ? '切换因子账户' : '登录并连接'}</button>
        {ready && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('disconnect', () => access.disconnect()) }}>退出账户</button>}</div></div>
      <div><h3>因子 CLI</h3><p>当前版本 {status.cliVersion ?? '首次连接时安装'}{status.latestVersion ? ` · 最新 ${status.latestVersion}` : ''}</p><div className={css.actions}>
        <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update-check', () => access.checkUpdate()) }}>{busy === 'update-check' ? '检查中…' : '检查 CLI 更新'}</button>
        {status.updateAvailable && <button type="button" disabled={Boolean(busy)} onClick={() => { void run('update', () => access.update()) }}>更新因子 CLI</button>}</div></div></>}
      <a href="https://www.pandaaiquant.com/factorhub/fourthFactorCompetition/" target="_blank" rel="noreferrer">前往官网处理报名与身份资料 ↗</a>
      {error && <p role="alert" className={css.error}>{error}</p>}
    </div></ActionDialog>}
    {error && !settings && !login && !editing && !replacement && <p role="alert" className={css.error}>{error} <button type="button" onClick={() => { void refresh() }}>重新读取状态</button></p>}
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
    {replacement && <ActionDialog title="更新参赛因子工作流" onClose={() => setReplacement(undefined)}>
      <FactorWorkflowUpdate factorId={replacement} workflowId={workflow} access={access} busy={Boolean(busy)} submit={workflowId => { void run('prepare', () => prepare({ kind: 'replace-factor', factorId: replacement, workflowId })).then(ok => { if (ok) setReplacement(undefined) }) }}/>
      {error && <p role="alert">{error}</p>}
    </ActionDialog>}
    {selectedResult !== undefined && <ActionDialog title="因子详情与回测结果" wide dismissOnBackdrop onClose={() => setSelectedResult(undefined)}><FactorDataView value={selectedResult}/></ActionDialog>}
  </section>
}
