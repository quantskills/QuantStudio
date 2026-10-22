import { mkdir,writeFile,readFile,open } from 'node:fs/promises'
import { join,resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { launchHost } from './lib/native-host.mjs'
import { Budget } from './lib/budget.mjs'
import { publicPrice,providerCredentials,gateway } from './lib/gateway.mjs'
import { mockGateway } from './lib/mock-gateway.mjs'
import { corpus,corpusHash,same } from './corpus.mjs'
const here=dirname(fileURLToPath(import.meta.url)),project=resolve(here,'..'),evidence=join(project,'evidence')
const arg=k=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1]}
const live=process.argv.includes('--run'),mock=process.argv.includes('--mock')
if(live===mock || live&&!arg('--home')) throw new Error('Choose --mock or --run --home; billed requests never implicit')
const out=arg('--out');if(!out||!/^[a-z0-9-]+$/.test(out))throw new Error('Unique --out lowercase name required')
await mkdir(evidence,{recursive:true})
const reportFile=join(evidence,out+'.json'), claim=await open(reportFile,'wx');await claim.close()
const hash=b=>createHash('sha256').update(b).digest('hex')
const sourceFiles=['benchmark/bridge.mjs','benchmark/corpus.mjs','benchmark/run-suite.mjs','benchmark/lib/native-host.mjs','benchmark/lib/gateway.mjs','benchmark/lib/budget.mjs',
 'packages/quantskills-session/lib/index.js','packages/quantskills-session/src/index.ts','packages/quantskills-session/src/skill-context.ts','pnpm-lock.yaml']
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(join(project,p)))])))
const selected=corpus.filter(c=>(!arg('--families')||arg('--families').split(',').includes(c.family))&&(!arg('--repetition')||c.repetition===Number(arg('--repetition'))))
if(!selected.length)throw new Error('No selected fixtures')
const report={schema:1,kind:mock?'mock-transport-calibration':'native-benchmark',createdAt:new Date().toISOString(),corpusHash,sourceHashes,
 candidateCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8',windowsHide:true}).trim(),
 protocolHash:hash(await readFile(join(here,'protocol.json'))),fixtureIds:selected.map(c=>c.id),
 officialPolicy:'Native catalog by default; native /skill invocation for explicit single/fixed/all-required selections. QS uses native attachments.',
 limitations:['Synthetic offline tasks; not an investment benchmark.','Three generated variants per family; insufficient breadth for a blanket quality non-inferiority claim.','Short multi-turn/restart tasks are not hour-long endurance or automatic-compaction proof.'],results:[]}
await writeFile(reportFile,JSON.stringify(report,null,2))
let budget,proxy
try {
 if(live) {budget=await Budget.open(join(evidence,'budget.json'),{limitCny:100,priorCny:2.4527854000000002});report.pricing=await publicPrice();proxy=await gateway({key:await providerCredentials(arg('--home')),budget,pricing:report.pricing})}
 else proxy=await mockGateway('{}')
 for(const spec of selected) {
  const ordered=['qs-old','qs-public','dsh-official','qs-commercial'];ordered.push(...ordered.splice(0,spec.repetition%4))
  for(const arm of ordered.filter(a=>!arg('--arms')||arg('--arms').split(',').includes(a))) {
   const tag=out+'/'+spec.id+'/'+arm,result={id:spec.id,family:spec.family,repetition:spec.repetition,arm,tag,phases:[],skillDefinitions:[]}
   report.results.push(result)
   const before=budget?.value.calls.length??0,token=live?proxy.register(tag):'offline-probe',started=Date.now()
   let host,run,stage=0
   try {
    host=await launchHost(arm,spec.fixture,proxy.url,token);run=host.run;result.evidence=run;result.runtime=host.info.version
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
     const observation=await host.request('run',{sessionId:'benchmark-task',prompt})
     const root=observation.sessions.find(s=>s.id==='benchmark-task')
     const text=root?.events.filter(e=>e.type==='assistant/message').flatMap(e=>e.data.content).map(c=>c.text).at(-1)??''
     let actual;try{actual=JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{}
     const phaseResult={stage,expected:phase.expected,actual,finalOutput:text,passed:same(actual,phase.expected),elapsedMs:observation.elapsedMs,
       sessions:observation.sessions.map(s=>({id:s.id,parent:s.parent,counts:s.counts}))}
     if(phase.artifact) {try{const contents=await readFile(join(run,'workspace',phase.artifact),'utf8');phaseResult.artifactHash=hash(contents);phaseResult.artifactPassed=same(JSON.parse(contents),phase.expected)}catch{phaseResult.artifactPassed=false}phaseResult.passed&&=phaseResult.artifactPassed}
     const children=new Set(phaseResult.sessions.filter(s=>s.id!=='benchmark-task').map(s=>s.id)).size
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
   if(budget?.value.halted)throw new Error('Accounting halted; no further calls')
  }
 }
 report.completedAt=new Date().toISOString();await writeFile(reportFile,JSON.stringify(report,null,2)+'\n')
} finally {if(live)await proxy?.close();else await proxy?.stop();await budget?.close()}
