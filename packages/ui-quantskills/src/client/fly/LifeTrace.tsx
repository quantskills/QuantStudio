export type LifeFeedback = { decision_id: string; goal: string; reward: number; reason: string; active_seconds: number; distance: number; meals: unknown[]; before: {energy: number}; after: {energy: number}; blocked_seconds: number }
export type LifeTraceData = { decision_id: string; perception: {values: Record<string, number>; visible_food: number; obstacle_distance: number | null}; response: Record<string, {value: number; mean_spikes: number; active: number; neurons: number; valid: boolean}>; choice: {action: string; scores: Record<string, number>}; motor: {confidence: number; drive: number}; navigation: {cue: string}; feedback?: LifeFeedback | null }
const channels: Record<string, string> = {food: '食物', hunger: '饥饿', fatigue: '疲劳', obstacle: '障碍', novelty: '探索需求'}
export const lifeGoals: Record<string, string> = {eat: '靠近食物', rest: '主动休息', explore: '探索家园', idle: '无有效目标'}
export function LifeTrace({trace, previous}: {trace?: LifeTraceData | undefined; previous?: LifeFeedback | undefined}) {
  if (!trace) return <div className="fv-empty"><p>等待第一轮生活神经感知</p><small>感知 → 神经响应 → 行动 → 实际反馈</small></div>
  const result=trace.feedback
  return <div className="fv-life-chain" aria-label="生活因果链">
    <section><small>01 · 感知到了什么</small><h3>工程模拟输入</h3>{Object.entries(trace.perception.values).map(([key,value]) => <div className="fv-life-row" key={key}><span>{channels[key] || key}</span><meter min="0" max="1" value={value} /><b>{Math.round(value*100)}%</b></div>)}<p>食物来自几何探测；饥饿、疲劳来自身体模拟。通过人工视网膜通道送入连接组。</p></section>
    <section><small>02 · 神经如何响应</small><h3>下游实际放电</h3>{Object.entries(trace.response).map(([key,value]) => <div className="fv-life-row" key={key}><span>{channels[key] || key}</span><b>{value.active}/{value.neurons}</b><span>{value.valid ? `${(value.mean_spikes/0.2).toFixed(1)} Hz` : '无效'}</span><b title="标定信号强度，不是神经占比">{value.value.toFixed(2)}</b></div>)}<p>活跃 / 读出数 · 均值 Hz · 标定强度 0–1。取 200 ms 神经窗口；抑制信号可表现为放电下降，强度不是神经占比。</p></section>
    <section><small>03 · 做了什么</small><h3>{lifeGoals[trace.choice.action] || trace.choice.action}</h3>{Object.entries(trace.choice.scores).map(([key,value]) => <div className="fv-life-row" key={key}><span>{lifeGoals[key]}</span><b>{value.toFixed(3)}</b></div>)}<p>工程目标读出按神经特征竞争，确定性选择，不抽签。运动仍须经过视觉神经读出。</p></section>
    <section><small>04 · 得到了什么反馈</small><h3>{result ? `反馈 ${result.reward.toFixed(3)}` : '行动执行中'}</h3>{result ? <><p>移动 {result.distance.toFixed(2)} m · 取食 {result.meals.length} 次</p><p>精力变化 {((result.after.energy-result.before.energy)*100).toFixed(1)}% · 受阻 {result.blocked_seconds.toFixed(1)} s</p></> : <p>当前决策完成后记账，再用于读出层学习。</p>}{!result && previous && <small>上一决策 #{previous.decision_id.slice(0,8)}：{lifeGoals[previous.goal]}，反馈 {previous.reward.toFixed(3)}</small>}<p>连接组冻结。环境、读出和奖励均有工程设定，不代表意识或天然目标回路已还原。</p></section>
    <footer>本轮决策 #{trace.decision_id.slice(0,12)} · 原始输入、放电、动作与反馈按同一编号保存</footer>
  </div>
}
