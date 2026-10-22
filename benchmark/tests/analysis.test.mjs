import test from 'node:test'
import assert from 'node:assert/strict'
import {summarize} from '../lib/analyze.mjs'
test('failed tasks retain their full cost and missing controls do not become paired wins',()=>{
 const result=(id,arm,passed,inputTokens)=>({id,arm,repetition:Number(id),passed,inputTokens,outputTokens:10,costCny:1,calls:[{state:'settled'}],totalWallMs:10})
 const report={plannedRuns:8,results:[result('0','qs-candidate',true,10),result('1','qs-candidate',false,100),result('0','qs-old',true,30)],notExecuted:[{id:'1',arm:'qs-old'}]}
 const summary=summarize(report)
 assert.equal(summary.arms['qs-candidate'].tokensPerAccepted,130)
 assert.equal(summary.arms['qs-candidate'].costUpperCny,2)
 assert.equal(summary.comparisons[0].matchedTasks,1)
 assert.equal(summary.comparisons[0].pairedCluster95Range,null)
 assert.equal(summary.comparisons[0].tokenRatioPerAccepted,null)
 assert.equal(summary.activation.eligible,false)
 assert.equal(summary.notExecuted.length,1)
})
test('the two reused inputs stay two statistical clusters even across many workflows',()=>{
 const results=[]
 for(let workflow=0;workflow<6;workflow++)for(let repetition=0;repetition<2;repetition++)for(const arm of ['qs-old','qs-public','dsh-official','qs-candidate'])results.push({id:workflow+'/'+repetition,arm,repetition,passed:true,inputTokens:arm==='qs-candidate'?80:100,outputTokens:0,costCny:1,calls:[{state:'settled'}],totalWallMs:10})
 const summary=summarize({plannedRuns:48,results,notExecuted:[]})
 assert.equal(summary.comparisons[0].independentInputClusters,2)
 assert.deepEqual(summary.comparisons[0].pairedCluster95Range,[0.8,0.8])
 assert.equal(summary.activation.eligible,false)
})

test('unknown billed usage cannot be reported as zero-token efficiency',()=>{
 const results=['qs-old','qs-candidate'].map(arm=>({id:'0',arm,repetition:0,passed:true,inputTokens:10,outputTokens:1,costCny:1,calls:[{state:arm==='qs-old'?'settled':'unknown'}],totalWallMs:10}))
 const summary=summarize({plannedRuns:2,results})
 assert.equal(summary.arms['qs-candidate'].knownTokens,11)
 assert.equal(summary.arms['qs-candidate'].tokens,null)
 assert.equal(summary.arms['qs-candidate'].tokensPerAccepted,null)
 assert.equal(summary.comparisons[0].tokenRatioPerAccepted,null)
})
