import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {summarize} from './lib/analyze.mjs'
const base=join(dirname(fileURLToPath(import.meta.url)),'results')
const roots=process.argv[2]?[process.argv[2]]:(await readdir(base,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>join(base,e.name))
let cases=0
for(const root of roots){
 const json=async name=>JSON.parse(await readFile(join(root,name),'utf8'))
 const manifest=await json('publication-manifest.json'),ledger=await json('budget.json')
 for(const file of manifest.files){
  assert.equal(basename(file.name),file.name)
  assert.equal(createHash('sha256').update(await readFile(join(root,file.name))).digest('hex'),file.publishedSha256)
 }
 assert.ok(Math.abs(manifest.cumulativeCostUpperCny-ledger.priorCny-ledger.calls.reduce((n,c)=>n+(c.costCny??c.reserveCny),0))<1e-9)
 const amendments=ledger.amendments??[]
 assert.equal(new Set(amendments.map(a=>a.id)).size,amendments.length)
 for(const [i,a] of amendments.entries()){
  assert.match(a.beforeSha256,/^[a-f0-9]{64}$/)
  assert.ok(Number.isSafeInteger(a.settledCallsBefore)&&a.settledCallsBefore>=0&&a.settledCallsBefore<=ledger.calls.length)
  const prefix=ledger.calls.slice(0,a.settledCallsBefore)
  assert.ok(prefix.every(c=>c.state==='settled'&&Number.isFinite(c.costCny)&&c.costCny>=0))
  const spent=prefix.reduce((n,c)=>n+c.costCny,0)
  assert.equal(a.before.priorCny,ledger.priorCny);assert.equal(a.after.priorCny,ledger.priorCny)
  assert.ok(Math.abs(a.cumulativeBeforeCny-ledger.priorCny-spent)<1e-9)
  assert.ok(Number.isFinite(a.additionalCny)&&a.additionalCny>0)
  assert.ok(Math.abs(a.after.stageLimitCny-spent-a.additionalCny)<1e-9)
  assert.ok(a.after.limitCny>=a.before.limitCny)
  if(i>0)assert.deepEqual(a.before,amendments[i-1].after)
 }
 if(amendments.length)assert.deepEqual(amendments.at(-1).after,{limitCny:ledger.limitCny,priorCny:ledger.priorCny,stageLimitCny:ledger.stageLimitCny})
 for(const entry of manifest.summary){
  const report=await json(entry.name)
  assert.equal(entry.attempted,report.results.length)
  assert.equal(entry.passed,report.results.filter(r=>r.passed).length)
  assert.equal(new Set(report.results.map(r=>r.tag)).size,report.results.length)
  if(report.plannedRuns!==undefined)assert.equal(report.results.length+report.notExecuted.length,report.plannedRuns)
  for(const r of report.results){
   const calls=ledger.calls.filter(c=>c.tag===r.tag)
   assert.deepEqual(r.calls,calls)
   for(const key of ['inputTokens','outputTokens'])assert.equal(r[key],calls.reduce((n,c)=>n+(c[key]??0),0))
   assert.ok(Math.abs(r.costCny-calls.reduce((n,c)=>n+(c.costCny??c.reserveCny),0))<1e-9)
  }
  if(report.suite==='v2') {
   try {assert.deepEqual(await json(entry.name.replace('.json','-summary.json')),summarize(report))}
   catch(e){if(e.code!=='ENOENT')throw e}
  }
  cases+=report.results.length
 }
}
console.log(JSON.stringify({status:'passed',publications:roots.length,observations:cases,meaning:'Integrity and accounting checks only; not a quality pass'}))
