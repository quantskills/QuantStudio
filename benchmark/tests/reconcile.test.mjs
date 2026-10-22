import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileEvidence} from '../lib/reconcile-evidence.mjs'
test('late settlement after cancellation counts tokens and releases only the surplus reserve',()=>{
 const row={tag:'task/arm',inputTokens:100,outputTokens:10,costCny:1.1,calls:[{id:'a'},{id:'b'}]}
 const calls=[{id:'a',tag:row.tag,state:'settled',inputTokens:100,outputTokens:10,costCny:0.1},
 {id:'b',tag:row.tag,state:'settled',inputTokens:200,outputTokens:20,costCny:0.2,reserveCny:1},
 {id:'c',tag:'another/task',state:'settled',inputTokens:9000,outputTokens:999,costCny:5}]
 const result=reconcileEvidence(row,calls)
 assert.equal(result.inputTokens,300);assert.equal(result.outputTokens,30)
 assert.ok(Math.abs(result.costCny-0.3)<1e-12);assert.equal(result.accountingStatus,'settled')
 assert.equal(result.accountingSnapshotAdjusted,true);assert.equal(result.originalObservation.inputTokens,100)
 assert.equal(row.inputTokens,100)
})
test('unknown requests retain their upper bound and cannot masquerade as complete accounting',()=>{
 const r=reconcileEvidence({tag:'x',calls:[],inputTokens:0,outputTokens:0,costCny:0},[{tag:'x',state:'unknown',reserveCny:2}])
 assert.equal(r.accountingStatus,'incomplete');assert.equal(r.costCny,2)
 assert.throws(()=>reconcileEvidence({tag:'x',calls:[{id:'a'}]},[]),/absent/)
})
