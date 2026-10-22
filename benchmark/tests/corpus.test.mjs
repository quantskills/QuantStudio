import test from 'node:test'
import assert from 'node:assert/strict'
import { corpus, oracle, evidenceOracle, same } from '../corpus.mjs'
test('golden accounting preserves quantity, floating exclusion and decimal fees',()=>{
 const input={floatingPnl:90000,rows:[{id:'a',quantity:7,grossPnl:100,openFee:0.1,closeFee:0.2},{id:'b',grossPnl:-20,openFee:0,closeFee:1}]}
 assert.deepEqual(oracle(input),{gross:80,fees:1.3,net:78.7,closedCount:2,floatingExcluded:true,missingFees:[]})
})
test('unknown fees do not remove rows or become zero; duplicate provenance is independent',()=>{
 const input={source:'untrusted',rows:[{id:'a',grossPnl:12,openFee:null,closeFee:-1},{id:'a',grossPnl:12,openFee:0,closeFee:0}]}
 assert.deepEqual(oracle(input),{gross:24,fees:null,net:null,closedCount:2,floatingExcluded:true,missingFees:['a']})
 assert.deepEqual(evidenceOracle(input),{evidenceStatus:'unverified',duplicateIds:['a']})
})
test('strict rubric allows JSON key ordering but rejects missing or extra fields',()=>{
 assert.ok(same({a:1,b:null},{b:null,a:1}))
 assert.ok(!same({a:1},{a:1,b:null}))
 assert.ok(!same({a:0},{a:null}))
})
test('frozen factorial structure and fixtures never contain oracle answers',()=>{
 assert.equal(corpus.length,36)
 assert.equal(new Set(corpus.map(c=>c.family)).size,12)
 for(const c of corpus){assert.ok(c.phases.every(p=>p.expected));assert.equal(c.fixture.expected,undefined)}
 assert.equal(new Set(corpus.map(c=>c.id)).size,36)
})
