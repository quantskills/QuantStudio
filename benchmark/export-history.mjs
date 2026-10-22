// Explicit publication boundary: export only synthetic measurement fields.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const option=n=>process.argv[process.argv.indexOf(n)+1]
if(!process.argv.includes('--source')||!process.argv.includes('--out'))throw new Error('Explicit --source and --out required')
const source=resolve(option('--source')),out=resolve(option('--out'))
await mkdir(out,{recursive:true})
const sha=v=>createHash('sha256').update(v).digest('hex')
const paths=new Map(),files=[]
const scrub=value=>{
 if(typeof value==='string') return value.replace(/(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp)\/)[^\s"'<>`|]+/g,path=>{
   const id='[local-path:'+sha(path).slice(0,12)+']';paths.set(id,sha(path));return id
 })
 if(Array.isArray(value))return value.map(scrub)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v)]))
 return value
}
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]))
const ledger=JSON.parse(await readFile(join(source,'evidence/budget.json'),'utf8'))
const callKeys=['id','tag','state','inputByteBound','maxOutput','inputRate','outputRate','reserveCny','startedAt','inputTokens','outputTokens','cachedInputTokens','reasoningTokens','costCny','elapsedMs','firstVisibleMs','requestHash','failure']
async function save(input,output,transform=v=>v){
 const original=await readFile(join(source,input));const data=scrub(transform(JSON.parse(original)))
 const bytes=JSON.stringify(data,null,2)+'\n';await writeFile(join(out,output),bytes)
 files.push({source:input,published:output,originalSha256:sha(original),publishedSha256:sha(bytes)})
 return data
}
const publishedLedger=await save('evidence/budget.json','budget.json',v=>({...pick(v,['schema','limitCny','priorCny','halted']),calls:v.calls.map(c=>pick(c,callKeys))}))
assert.equal(ledger.calls.length,publishedLedger.calls.length)
for(let i=0;i<ledger.calls.length;i++)for(const field of ['inputTokens','outputTokens','cachedInputTokens','reasoningTokens','costCny','reserveCny'])assert.deepEqual(ledger.calls[i][field],publishedLedger.calls[i][field])
const all=[]
for(let repetition=0;repetition<3;repetition++){
 const data=await save(`evidence/native-suite-r${repetition}.json`,`native-suite-r${repetition}.json`,v=>({
   ...pick(v,['schema','kind','createdAt','completedAt','corpusHash','sourceHashes','candidateCommit','protocolHash','fixtureIds','officialPolicy','limitations','pricing','cumulativeCostUpperCny']),
   results:v.results.map(r=>({...pick(r,['id','family','repetition','arm','tag','runtime','skillDefinitions','toolCount','promptHash','resume','passed','failure','completedPhases','totalWallMs','inputTokens','outputTokens','costCny']),
     phases:r.phases.map(p=>pick(p,['stage','expected','actual','finalOutput','passed','elapsedMs','sessions','artifactHash','artifactPassed','childCount'])),
     calls:r.calls.map(c=>pick(c,callKeys))}))
 }));all.push(...data.results)
}
for(const name of ['summary.json','runtime-provenance.json','verification.json'])await save('evidence/'+name,name)
// The original summary uses the final ledger; raw snapshots remain as measured.
const summary=JSON.parse(await readFile(join(out,'summary.json'),'utf8'))
for(const arm of ['qs-old','qs-public','dsh-official','qs-commercial']){
 const rows=all.filter(r=>r.arm===arm),calls=publishedLedger.calls.filter(c=>rows.some(r=>r.tag===c.tag)),a=summary.aggregate[arm]
 assert.equal(rows.length,36);assert.equal(a.accepted,rows.filter(r=>r.passed).length)
 for(const field of ['inputTokens','outputTokens'])assert.equal(a[field],calls.reduce((n,c)=>n+c[field],0))
 assert.ok(Math.abs(a.costUpperCny-calls.reduce((n,c)=>n+c.costCny,0))<1e-9)
}
await save('evidence/native-log-audit.json','native-log-audit.json',v=>({...pick(v,['schema','createdAt','summary']),rows:v.rows.map(r=>pick(r,['id','arm','failure','runFailure','models','persistedModelResponses','gatewaySettledCalls','responseCountReconciled','lastOutputMatchesNative']))}))
for(const name of ['context-model-fixed-evidence.json','context-model-hybrid-evidence.json','context-optimization-20261021.json'])await save('docs/dsh-upgrade/'+name,name)
await writeFile(join(out,'publication-manifest.json'),JSON.stringify({schema:1,sourceCandidate:'62b2d8c8580b7077fdcdc3215fe0c529c839c262',
 observations:all.length,settledCalls:publishedLedger.calls.length,policy:'Whitelisted synthetic results; local paths replaced by deterministic hashes. No native reasoning or user sessions exported.',
 pathMapping:Object.fromEntries(paths),files},null,2)+'\n')
console.log(JSON.stringify({observations:all.length,settledCalls:publishedLedger.calls.length,redactedPaths:paths.size,files:files.length}))
