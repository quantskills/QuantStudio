import type { ContestWatchStatus } from './plugin-types.ts'
import { contestTime } from './contest.ts'
import css from './ContestPage.module.css'
import { JevEvidence } from './JevEvidence.tsx'

export const watchActions: Record<string, string> = { hold: '观望', open_long: '开多', open_short: '开空', close_long: '平多', close_short: '平空' }
const clockTime = (time: number) => new Date(time).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
type Analysis = NonNullable<ContestWatchStatus['analyses']>[number]
const restrictedHold = (decision: ContestWatchStatus['lastDecision']) => decision?.action === 'hold' && Object.keys(decision.probabilities).length === 1
const restrictionReason = (analysis?: Analysis) => analysis?.evidence?.checks.filter(check => check.enforcement !== 'reference' && check.actions.length && check.state !== 'pass')
  .map(check => `${check.label}：${check.detail}`).join('；') || '本轮只有观望可选，当前账户或交易约束不允许其他动作。'
const outcomeText = (analysis: Analysis) => restrictedHold(analysis.decision) && /^Jev 观望 · 置信度 [\d.]+%；未生成交易计划。$/.test(analysis.outcome)
  ? `受限观望 · 置信度不适用：${restrictionReason(analysis)}` : analysis.outcome

export function ContestWatchVisuals({ status, active }: { status: ContestWatchStatus | undefined; active: boolean }) {
  const samples = status?.samples ?? [], last = samples.at(-1), decision = status?.lastDecision
  const analyses = status?.analyses ?? [], current = analyses.at(-1)
  const restricted = restrictedHold(decision), decisionAnalysis = decision && analyses.find(item => item.decision?.time === decision.time)
  const minSamples = status?.config?.minSamples ?? 8
  const low = samples.length ? Math.min(...samples.map(item => item.price)) : 0
  const high = samples.length ? Math.max(...samples.map(item => item.price)) : 0
  const range = high - low || Math.max(high * .0001, 1)
  const points = samples.map(sample => ({ x: 12 + (sample.time - samples[0]!.time) / Math.max(last!.time - samples[0]!.time, 1) * 616, y: 150 - (sample.price - low + (high === low ? range / 2 : 0)) / range * 120, ...sample }))
  return <>
    <div className={css.jevDashboard}>
      <section className={css.jevPanel} aria-label="行情采样曲线">
        <div className={css.jevPanelHeading}><div><span className={css.jevCaption}>行情采样</span><h3>{status?.config?.symbol || '待选择合约'}</h3></div>
          <div className={css.jevPrice}>{last ? last.price.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—'}<small>最新采样价</small></div>
        </div>
        {samples.length ? <>
          <svg viewBox="0 0 640 180" className={css.jevChart} role="img" aria-label={`${samples.length} 个行情快照，最低 ${low}，最高 ${high}，最新 ${last!.price}`}>
            {[30, 90, 150].map(y => <line key={y} x1="12" y1={y} x2="628" y2={y} className={css.jevGridLine}/>)}
            <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" className={css.jevPriceLine}/>
            {points.map(point => <circle key={point.time} cx={point.x} cy={point.y} r="2.5" className={css.jevQuoteDot}><title>{clockTime(point.time)} · {point.price}</title></circle>)}
          </svg>
          <div className={css.jevChartAxis}><span>{clockTime(samples[0]!.time)}</span><span>低 {low} / 高 {high}</span><span>{clockTime(last!.time)}</span></div>
        </> : <div className={css.jevChartEmpty}><span aria-hidden="true">⌁</span><strong>等待有效行情</strong><p>启动后逐步绘制真实采样价格。</p></div>}
        <div className={css.jevSampling}><span>有效快照 <b>{status?.sampleCount ?? 0}</b> / {minSamples}</span><progress aria-label="决策所需采样进度" max={minSamples} value={Math.min(status?.sampleCount ?? 0, minSamples)}/></div>
      </section>
      <section className={css.jevPanel} aria-label="Jev 决策输出" aria-busy={active && status?.phase === 'deciding'}>
        <div className={css.jevPanelHeading}><div><span className={css.jevCaption}>最近一次输出</span><h3>{decision ? restricted ? '受限观望' : watchActions[decision.action] : '等待 Jev 判断'}</h3></div>
          <span className={css.jevModel}>jev-1.13.0</span></div>
        {decision ? <>
          <p className={css.jevConfidence}>置信度 <strong>{restricted ? '不适用' : <>{(decision.confidence * 100).toFixed(1)}<small>%</small></>}</strong></p>
          {restricted && decisionAnalysis !== current && <p className={css.jevFine}>{restrictionReason(decisionAnalysis)}</p>}
          {!restricted && <div className={css.jevProbabilities} aria-label="各动作概率">
            {Object.entries(decision.probabilities).map(([action, probability]) => <div key={action} data-selected={decision.action === action}>
              <span>{watchActions[action] ?? action}</span><div className={css.jevProbabilityTrack} aria-hidden="true"><i style={{ width: `${probability * 100}%` }}/></div>
              <b>{(probability * 100).toFixed(1)}%</b>
            </div>)}
          </div>}
          <p className={css.jevFine}>输出时间 {contestTime(decision.time)} · 置信度和动作概率均不是交易胜率。</p>
        </> : <div className={css.jevDecisionEmpty}><p>采样完成后，Jev 根据当前持仓和约束选择允许的动作。</p><p>结果返回后展示实际概率分布。</p></div>}
        {current && <div className={css.jevOutcome}><span>{current.responseAt ? `Jev 响应 ${((current.responseAt - current.startedAt) / 1000).toFixed(1)} 秒` : current.finishedAt ? '本轮已结束' : '正在等待 Jev 响应'}</span><p>{outcomeText(current)}</p></div>}
        {current?.reviewNotes?.map(note => <p key={note} className={css.error}>{note}</p>)}
      </section>
    </div>
    {current && <details className={css.jevHistory}><summary>查看判断依据</summary><JevEvidence analysis={current}/></details>}
    {analyses.length > 0 && <details className={css.jevHistory}><summary>分析历史 <span>最近 {analyses.length} 轮</span></summary>
      {[...analyses].reverse().map(item => <details key={item.id} className={css.jevHistoryItem}><summary>
        <time>{clockTime(item.startedAt)}</time><strong>{item.decision ? restrictedHold(item.decision) ? '受限观望' : watchActions[item.decision.action] : item.finishedAt ? '分析结束' : '分析中'}</strong><span>{item.sampleCount} 个快照</span>
      </summary><div><p>{outcomeText(item)}</p><dl><dt>输入时间范围</dt><dd>{contestTime(item.fromTime)} — {clockTime(item.toTime)}</dd>
        <dt>输入最新价</dt><dd>{item.price}</dd><dt>允许动作</dt><dd>{item.allowedActions.map(action => watchActions[action]).join(' / ')}</dd>
        {item.strategyName && <><dt>策略及版本指纹</dt><dd>{item.strategyName} · {item.strategyVersion}</dd></>}
        {item.decision?.usage && <><dt>输入 / 输出 token</dt><dd>{item.decision.usage.input_tokens} / {item.decision.usage.output_tokens}</dd></>}
        {item.decision && <><dt>动作概率</dt><dd>{restrictedHold(item.decision) ? '不适用（只有观望可选）' : Object.entries(item.decision.probabilities).map(([action, value]) => `${watchActions[action] ?? action} ${(value * 100).toFixed(1)}%`).join(' / ')}</dd><dt>置信度</dt><dd>{restrictedHold(item.decision) ? '不适用' : `${(item.decision.confidence * 100).toFixed(1)}%`}</dd></>}
        {item.planId && <><dt>关联计划</dt><dd>{item.planId}</dd></>}
      </dl><JevEvidence analysis={item}/></div></details>)}
    </details>}
  </>
}
