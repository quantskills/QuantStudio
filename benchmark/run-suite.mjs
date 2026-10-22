import { mkdir,writeFile,readFile,open } from 'node:fs/promises'
import { join,resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { launchHost } from './lib/native-host.mjs'
import { Budget } from './lib/budget.mjs'
import { publicPrice,providerCredentials,gateway } from './lib/gateway.mjs'
import { mockGateway } from './lib/mock-gateway.mjs'
import { corpus as historical, same } from './corpus.mjs'
import { corpus as fresh, teamAcceptance } from './corpus-v2.mjs'
import { readConfig } from './lib/config.mjs'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'..')
const arg=k=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1]}
const live=process.argv.includes('--run'),mock=process.argv.includes('--mock')
const suite=arg('--suite')??'v2'
const corpus=suite==='team'?teamAcceptance:suite==='historical'?historical:suite==='v2'?fresh:null
if(!corpus)throw new Error('Unknown suite')
const corpusHash=createHash('sha256').update(JSON.stringify(corpus)).digest('hex')
if(!live&&!mock){console.log(JSON.stringify({mode:'offline-preflight',suite,cases:corpus.length,corpusHash,paidRequests:0}));process.exit(0)}
if(live&&mock || live&&!arg('--home'))throw new Error('Choose --mock or --run --home; billed requests never implicit')
const config=await readConfig(),evidence=join(config.workspace,'evidence')
const out=arg('--out');if(!out||!/^[a-z0-9-]+$/.test(out))throw new Error('Unique --out lowercase name required')
await mkdir(evidence,{recursive:true})
const reportFile=join(evidence,out+'.json'), claim=await open(reportFile,'wx');await claim.close()
const hash=b=>createHash('sha256').update(b).digest('hex')
const sourceFiles=['benchmark/bridge.mjs','benchmark/corpus.mjs','benchmark/corpus-v2.mjs','benchmark/lib/config.mjs','benchmark/run-suite.mjs','benchmark/lib/native-host.mjs','benchmark/lib/gateway.mjs','benchmark/lib/budget.mjs',
 'packages/quantskills-session/lib/index.js','packages/quantskills-session/src/index.ts','packages/quantskills-session/src/skill-context.ts','pnpm-lock.yaml']
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(join(project,p)))])))
const selected=corpus.filter(c=>(!arg('--families')||arg('--families').split(',').includes(c.family))&&(!arg('--repetition')||c.repetition===Number(arg('--repetition'))))
if(!selected.length)throw new Error('No selected fixtures')
const report={schema:1,kind:mock?'mock-transport-calibration':'native-benchmark',createdAt:new Date().toISOString(),corpusHash,sourceHashes,
 candidateCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8',windowsHide:true}).trim(),
 suite, configurationHash:hash(JSON.stringify(config)),fixtureIds:selected.map(c=>c.id),
 officialPolicy:'Native catalog by default; native /skill invocation for explicit single/fixed/all-required selections. QS uses native attachments.',
 limitations:['Synthetic offline tasks; not an investment benchmark.','A small synthetic sample cannot establish broad quality non-inferiority.','Short multi-turn/restart tasks are not hour-long endurance or automatic-compaction proof.'],results:[]}
await writeFile(reportFile,JSON.stringify(report,null,2))
let budget,proxy
const planned = selected.flatMap(spec => {
 const arms=suite==='team'?['qs-public']:['qs-old','qs-public','dsh-official','qs-candidate']
 arms.push(...arms.splice(0,spec.repetition%4))
 return arms.filter(arm=>!arg('--arms')||arg('--arms').split(',').includes(arm)).map(arm=>({id:spec.id,arm}))
})
report.plannedRuns=planned.length
try {
 if(live) {budget=await Budget.open(join(evidence,'budget.json'),config.budget);report.pricing=await publicPrice();proxy=await gateway({key:await providerCredentials(arg('--home')),budget,pricing:report.pricing,maxCalls:suite==='team'?64:32})}
 else proxy=await mockGateway('{}')
 runs: for(const spec of selected) {
  const ordered=suite==='team'?['qs-public']:['qs-old','qs-public','dsh-official','qs-candidate'];ordered.push(...ordered.splice(0,spec.repetition%4))
  for(const arm of ordered.filter(a=>!arg('--arms')||arg('--arms').split(',').includes(a))) {
   if(budget?.value.exhausted || budget?.value.halted) {report.stopReason=budget.value.halted?'unresolved-accounting':'budget-safety-ceiling';break runs}
   const tag=out+'/'+spec.id+'/'+arm,result={id:spec.id,family:spec.family,repetition:spec.repetition,arm,tag,phases:[],skillDefinitions:[]}
   report.results.push(result)
   const before=budget?.value.calls.length??0,started=Date.now(),deadline=started+600000,token=live?proxy.register(tag,{deadline}):'offline-probe'
   let host,run,stage=0,memberIds
   try {
    host=await launchHost(arm,spec.fixture,proxy.url,token);run=host.run;result.evidence=run;result.runtime=host.info.version;result.runtimeIdentity=host.arm
    if(host.info.inactive.length)throw new Error('Inactive runtime entries: '+JSON.stringify(host.info.inactive))
    const setup=await host.request('setup',{sessionId:'benchmark-task'})
    result.skillDefinitions=setup.skillDefinitions;result.toolCount=setup.tools.length;result.promptHash=hash(JSON.stringify(setup.prompt))
    for(const definition of setup.skillDefinitions) {
     const fixture=spec.fixture.skills.find(s=>s.id===definition.id)
     const body=fixture?.markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)?.[1]
     if(!body || hash(body.trim())!==definition.normalizedHash)throw new Error('Skill definition parity failed: '+definition.id)
    }
    for(const phase of spec.phases) {
     if(phase.restartBefore) {await host.stop();host=await launchHost(arm,spec.fixture,proxy.url,token,run);result.resume=await host.request('resume',{sessionId:'benchmark-task'})}
     let prompt=phase.prompt
     if(arm==='dsh-official' && stage===0 && spec.fixture.explicitSkills)prompt=spec.fixture.explicitSkills.map(id=>'/'+id).join(' ')+'\n'+prompt
     const observation=await host.request('run',{sessionId:'benchmark-task',prompt,quietMs:spec.quietMs??1000,deadline})
     const root=observation.sessions.find(s=>s.id==='benchmark-task')
     const text=root?.events.filter(e=>e.type==='assistant/message').flatMap(e=>e.data.content).map(c=>c.text).at(-1)??''
     let actual;try{actual=JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{}
     const phaseResult={stage,expected:phase.expected,actual,finalOutput:text,passed:same(actual,phase.expected),elapsedMs:observation.elapsedMs,
       sessions:observation.sessions.map(s=>({id:s.id,parent:s.parent,counts:s.counts})),
       roster:observation.roster,agents:observation.agents,tasks:observation.tasks,quietMs:observation.quietMs,errors:observation.errors}
     if(phase.artifact) {try{const contents=await readFile(join(run,'workspace',phase.artifact),'utf8');phaseResult.artifactHash=hash(contents);phaseResult.artifactPassed=same(JSON.parse(contents),phase.expected)}catch{phaseResult.artifactPassed=false}phaseResult.passed&&=phaseResult.artifactPassed}
     const ids=observation.roster?.filter(m=>m.id!=='benchmark-task').map(m=>m.id).sort()??[]
     const children=ids.length||new Set(phaseResult.sessions.filter(s=>s.id!=='benchmark-task').map(s=>s.id)).size
     if(spec.requireStableMembers){
       phaseResult.sameMembers=memberIds===undefined||same(ids,memberIds);memberIds??=ids
       phaseResult.passed&&=phaseResult.sameMembers&&ids.length===2&&observation.quietMs>=spec.quietMs&&observation.agents.every(a=>a.status==='idle'&&a.pending===0)&&observation.errors.length===0
     }
     if(spec.minimumChildren!==undefined){phaseResult.childCount=children;phaseResult.passed&&=children>=spec.minimumChildren}
     if(spec.maximumChildren!==undefined)phaseResult.passed&&=children<=spec.maximumChildren
     result.phases.push(phaseResult);stage++
    }
    result.passed=result.phases.every(p=>p.passed)
   } catch(error){result.passed=false;result.failure=error.message.slice(0,1800);result.completedPhases=stage}
   finally {
    await host?.stop();result.totalWallMs=Date.now()-started
    result.calls=budget?.value.calls.slice(before)??[];result.telemetry=proxy.telemetry?.filter(c=>c.tag===tag)??[]
    result.inputTokens=result.calls.reduce((s,c)=>s+(c.inputTokens??0),0);result.outputTokens=result.calls.reduce((s,c)=>s+(c.outputTokens??0),0)
    result.costCny=result.calls.reduce((s,c)=>s+(c.costCny??c.reserveCny),0)
    report.cumulativeCostUpperCny=budget?.used()??0;await writeFile(reportFile,JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify({task:spec.id,arm,passed:result.passed,failure:result.failure?.split('\n')[0],calls:result.calls.length,input:result.inputTokens,output:result.outputTokens,cost:result.costCny,cumulative:report.cumulativeCostUpperCny}))
   }
   if(budget?.value.halted || budget?.value.exhausted) {report.stopReason=budget.value.halted?'unresolved-accounting':'budget-safety-ceiling';break runs}
  }
 }
 report.completedAt=new Date().toISOString()
} finally {
 if(live)await proxy?.close();else await proxy?.stop()
 for(const result of report.results){if(budget){result.calls=budget.value.calls.filter(c=>c.tag===result.tag);result.inputTokens=result.calls.reduce((n,c)=>n+(c.inputTokens??0),0);result.outputTokens=result.calls.reduce((n,c)=>n+(c.outputTokens??0),0);result.costCny=result.calls.reduce((n,c)=>n+(c.costCny??c.reserveCny),0)}}
 report.notExecuted=planned.filter(p=>!report.results.some(r=>r.id===p.id&&r.arm===p.arm))
 report.cumulativeCostUpperCny=budget?.used()??0;await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');await budget?.close()
}
