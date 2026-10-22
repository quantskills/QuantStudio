import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const script=fileURLToPath(new URL('../export-run.mjs',import.meta.url))
test('publication retains failures and authoritative usage but excludes private payloads and cannot overwrite',async()=>{
 const source=await mkdtemp(join(tmpdir(),'qs-publication-')),out=join(source,'public')
 const call={id:'one',tag:'test/one',state:'settled',inputTokens:25,outputTokens:5,costCny:0.01,privateCredential:'secret-never-publish'}
 const ledger={schema:1,priorCny:59.93,limitCny:120,stageLimitCny:15.01,exhausted:true,calls:[call],amendments:[{
  id:'fixture-grant',authorizedAt:'2026-10-22',beforeSha256:'a'.repeat(64),cumulativeBeforeCny:59.94,settledCallsBefore:1,additionalCny:15,
  before:{limitCny:100,priorCny:59.93,stageLimitCny:25},after:{limitCny:120,priorCny:59.93,stageLimitCny:15.01},
  authorization:'private-authorization-text',privateCredential:'secret-never-publish'}]}
 const report={schema:1,suite:'v2',candidateCommit:'fixed',plannedRuns:2,notExecuted:[{id:'two',arm:'qs-old'}],stopReason:'budget-safety-ceiling',
  nativeReasoning:'private-thoughts',results:[{id:'one',tag:call.tag,passed:false,inputTokens:25,outputTokens:5,costCny:0.01,
   failure:'Fixture error at C:/Users/private/work/file.json',evidence:'C:/Users/private/full-host',calls:[call],
   phases:[{stage:0,passed:false,expected:{n:1},actual:{n:2},finalOutput:'{"n":2}'}]}]}
 await writeFile(join(source,'budget.json'),JSON.stringify(ledger))
 await writeFile(join(source,'test-run.json'),JSON.stringify(report))
 const args=[script,'--source',source,'--out',out,'--reports','test-run.json']
 execFileSync(process.execPath,args,{windowsHide:true})
 const exported=await readFile(join(out,'test-run.json'),'utf8'),value=JSON.parse(exported)
 assert.equal(value.results[0].passed,false)
 assert.deepEqual(value.results[0].phases[0].actual,{n:2})
 assert.equal(value.results[0].inputTokens,25)
 assert.equal(value.results[0].costCny,0.01)
 assert.deepEqual(value.notExecuted,report.notExecuted)
 assert.equal(value.stopReason,report.stopReason)
 assert.doesNotMatch(exported,/secret-never-publish|private-thoughts|C:\/Users|full-host/)
 const publicBudget=await readFile(join(out,'budget.json'),'utf8')
 assert.doesNotMatch(publicBudget,/private-authorization-text|secret-never-publish/)
 assert.equal(JSON.parse(publicBudget).amendments[0].additionalCny,15)
 const manifest=JSON.parse(await readFile(join(out,'publication-manifest.json')))
 assert.equal(manifest.summary[0].passed,0)
 assert.equal(manifest.files.find(f=>f.name==='test-run.json').publishedSha256,createHash('sha256').update(exported).digest('hex'))
 const verifier=fileURLToPath(new URL('../verify-results.mjs',import.meta.url))
 execFileSync(process.execPath,[verifier,out],{windowsHide:true,stdio:'pipe'})
 assert.throws(()=>execFileSync(process.execPath,args,{windowsHide:true,stdio:'pipe'}))
 assert.equal(await readFile(join(out,'test-run.json'),'utf8'),exported)
 await writeFile(join(out,'test-run.json'),exported.replace('"inputTokens": 25','"inputTokens": 1'))
 assert.throws(()=>execFileSync(process.execPath,[verifier,out],{windowsHide:true,stdio:'pipe'}))
})
