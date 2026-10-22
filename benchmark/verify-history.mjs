import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=join(dirname(fileURLToPath(import.meta.url)),'history/2026-10-21')
const json=async p=>JSON.parse(await readFile(join(root,p),'utf8'))
const manifest=await json('publication-manifest.json'),ledger=await json('budget.json'),summary=await json('summary.json')
for(const file of manifest.files)assert.equal(createHash('sha256').update(await readFile(join(root,file.published))).digest('hex'),file.publishedSha256)
const rows=(await Promise.all([0,1,2].map(n=>json(`native-suite-r${n}.json`)))).flatMap(r=>r.results)
assert.equal(rows.length,144);assert.equal(new Set(rows.map(r=>r.id+'/'+r.arm)).size,144)
assert.equal(ledger.calls.length,539);assert.ok(ledger.calls.every(c=>c.state==='settled'))
for(const [arm,a] of Object.entries(summary.aggregate)){
 const cases=rows.filter(r=>r.arm===arm),calls=ledger.calls.filter(c=>cases.some(r=>r.tag===c.tag))
 assert.equal(a.accepted,cases.filter(r=>r.passed).length)
 for(const key of ['inputTokens','outputTokens'])assert.equal(a[key],calls.reduce((n,c)=>n+c[key],0))
 assert.ok(Math.abs(a.costUpperCny-calls.reduce((n,c)=>n+c.costCny,0))<1e-9)
}
console.log(JSON.stringify({status:'passed',observations:rows.length,settledCalls:ledger.calls.length,meaning:'Measurement integrity only; no performance superiority claim'}))
