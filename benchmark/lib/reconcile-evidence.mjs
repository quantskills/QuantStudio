/** The gateway ledger is authoritative even when a stopped Host no longer
 * receives a paid request's final usage. Preserve the earlier observation. */
export function reconcileEvidence(row,ledger){
 const calls=ledger.filter(call=>call.tag===row.tag)
 if((row.calls?.length??0)>0&&!calls.length)throw new Error('Recorded task is absent from accounting ledger: '+row.tag)
 const inputTokens=calls.reduce((n,c)=>n+(c.inputTokens??0),0),outputTokens=calls.reduce((n,c)=>n+(c.outputTokens??0),0)
 const costCny=calls.reduce((n,c)=>n+(c.costCny??c.reserveCny),0)
 const changed=inputTokens!==row.inputTokens||outputTokens!==row.outputTokens||Math.abs(costCny-row.costCny)>1e-10||calls.length!==(row.calls?.length??0)
 return {...row,calls,inputTokens,outputTokens,costCny,
  accountingStatus:calls.some(c=>c.state!=='settled')?'incomplete':calls.length?'settled':'not-executed',
  accountingSnapshotAdjusted:changed,
  originalObservation:changed?{inputTokens:row.inputTokens,outputTokens:row.outputTokens,costCny:row.costCny,calls:row.calls?.length}:undefined}
}
