// All attempted requests, including failed tasks, remain in the numerator.
export function summarize(report) {
 const arms=['qs-old','qs-public','dsh-official','qs-candidate']
 const protocolComplete=!(report.notExecuted?.length || report.stopReason)
 const blocked=r=>r.calls.length===0&&/Budget safety ceiling/.test(r.failure??'')
 const tokens=r=>r.inputTokens+r.outputTokens
 const total=rows=>rows.reduce((s,r)=>s+tokens(r),0)
 const accepted=rows=>rows.filter(r=>r.passed===true).length
 const accounted=rows=>rows.every(r=>r.calls.every(c=>c.state==='settled'))
 const median=values=>{const a=values.toSorted((a,b)=>a-b),n=a.length;return n?(a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2:null}
 const summaries=Object.fromEntries(arms.map(arm=>{
  const rows=report.results.filter(r=>r.arm===arm),passes=accepted(rows)
  return [arm,{attempted:rows.length,blockedBeforeFirstRequest:rows.filter(blocked).length,passed:passes,calls:rows.reduce((s,r)=>s+r.calls.length,0),usageComplete:accounted(rows),knownTokens:total(rows),tokens:accounted(rows)?total(rows):null,
   tokensPerAccepted:passes&&accounted(rows)?total(rows)/passes:null,costUpperCny:rows.reduce((s,r)=>s+r.costCny,0),medianWallMs:median(rows.map(r=>r.totalWallMs))}]
 }))
 const candidate=report.results.filter(r=>r.arm==='qs-candidate'),comparisons=[]
 for(const arm of arms.filter(a=>a!=='qs-candidate')) {
  const pairs=candidate.flatMap(c=>{const b=report.results.find(r=>r.arm===arm&&r.id===c.id);return b?[{c,b}]:[]})
  const ratio=sample=>{const c=sample.map(p=>p.c),b=sample.map(p=>p.b);return accounted(c)&&accounted(b)&&accepted(c)&&accepted(b)&&total(b)>0?(total(c)/accepted(c))/(total(b)/accepted(b)):null}
  const clusters=[...new Set(pairs.map(p=>p.c.repetition))]
  // Two input datasets shared by six workflows are two clusters, not 12 independent tasks.
  // Exhaustive paired cluster resampling has only four outcomes: report its coarse range honestly.
  const boot=clusters.length===2?clusters.flatMap(a=>clusters.map(b=>ratio([...pairs.filter(p=>p.c.repetition===a),...pairs.filter(p=>p.c.repetition===b)]))):[]
  const finite=boot.length===4&&boot.every(v=>v!==null&&Number.isFinite(v))
  comparisons.push({baseline:arm,matchedTasks:pairs.length,independentInputClusters:clusters.length,
   candidateAccepted:accepted(pairs.map(p=>p.c)),baselineAccepted:accepted(pairs.map(p=>p.b)),
   protocolComplete,tokenRatioPerAccepted:protocolComplete?ratio(pairs):null,pairedCluster95Range:protocolComplete&&finite?[Math.min(...boot),Math.max(...boot)]:null,
   caveat:'No comparative ratio when the protocol is budget-truncated. Two reused input clusters cannot establish broad quality parity.'})
 }
 return {schema:1,candidateCommit:report.candidateCommit,corpusHash:report.corpusHash,plannedRuns:report.plannedRuns,
  attempted:report.results.length,notExecuted:report.notExecuted??[],stopReason:report.stopReason??null,
  arms:summaries,comparisons,activation:{default:'full',eligible:false,
   reason:'This small synthetic corpus cannot prove quality non-inferiority. Missing, failed or unmatched runs never authorize default activation.'}}
}
