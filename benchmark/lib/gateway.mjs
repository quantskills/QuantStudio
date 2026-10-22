import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import YAML from 'yaml'
const hash = value => createHash('sha256').update(value).digest('hex')
export async function providerCredentials(home) {
  const profile = YAML.parse(await readFile(join(home,'profiles/web/cordis.patch.yml'),'utf8'))
  let provider
  const visit = v => { if (!v || typeof v !== 'object') return; if (v.providers?.pandaaiquant) provider=v.providers.pandaaiquant; for (const child of Object.values(v)) visit(child) }
  visit(profile)
  if (provider?.baseURL !== 'https://llmx.pandaaiquant.com/v1' || provider.api !== 'openai-completions'
    || !provider.models?.some(m => m.id === 'kimi-k3')) throw new Error('Existing PandaAI route/model mismatch')
  const credentials = YAML.parse(await readFile(join(home,'.credentials.yaml'),'utf8'))
  const key = credentials.refs?.[provider.apiKeyEnv]
  if (typeof key !== 'string' || !key) throw new Error('Existing PandaAI credential unavailable')
  return key
}
export async function publicPrice() {
  const get = async route => { const r=await fetch('https://llmx.pandaaiquant.com'+route,{redirect:'error',signal:AbortSignal.timeout(20000)}); if(!r.ok) throw new Error('Pricing HTTP '+r.status); return r.json() }
  const [pricing,status] = await Promise.all([get('/api/pricing'),get('/api/status')])
  const p=pricing.data?.find(p=>p.model_name==='kimi-k3')
  if(!pricing.success || !p || p.quota_type!==0 || p.billing_mode || p.billing_expr) throw new Error('Unsupported published pricing')
  const group=Math.max(...Object.values(pricing.group_ratio)), quota=status.data?.quota_per_unit, exchange=status.data?.usd_exchange_rate
  if(![p.model_ratio,p.completion_ratio,group,quota,exchange].every(n=>Number.isFinite(n)&&n>0)) throw new Error('Incomplete pricing')
  const rate=p.model_ratio*group/quota*exchange
  return { fetchedAt:new Date().toISOString(),source:'https://llmx.pandaaiquant.com/api/pricing',statusSource:'https://llmx.pandaaiquant.com/api/status',
    model:'kimi-k3',pricingVersion:pricing.pricing_version,inputRate:rate*Math.max(1,p.cache_ratio??1,p.create_cache_ratio??1),outputRate:rate*p.completion_ratio,
    meaning:'Conservative published-rate estimate; all input charged at worst input/cache rate. Not account billing.',modelRatio:p.model_ratio,group,quota,exchange }
}
export async function gateway({ key, budget, pricing, maxCalls = 32 }) {
  const tokens = new Map(), telemetry = [], active = new Set(), admitted = new Map()
  const handler = async (req,res) => {
    let id
    const started=performance.now()
    try {
      const tag=tokens.get(req.headers.authorization?.replace(/^Bearer /,''))
      if(!tag || req.method!=='POST' || req.url!=='/v1/chat/completions') { res.writeHead(403); res.end('benchmark route denied'); return }
      if ((admitted.get(tag) ?? 0) >= maxCalls) throw new Error('Per-task call cap reached')
      admitted.set(tag, (admitted.get(tag) ?? 0) + 1)
      let raw=''; for await(const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>4*1024*1024) throw new Error('Request exceeds fixture envelope') }
      const payload=JSON.parse(raw)
      if(payload.model!=='kimi-k3' || !Array.isArray(payload.messages)) throw new Error('Model/input mismatch')
      // Model controls, identical for every arm. Native tool and message bodies
      // are untouched. Preserve the original request hash for auditability.
      payload.temperature=0; payload.reasoning_effort='high'
      delete payload.max_completion_tokens; payload.max_tokens=4096
      if(payload.stream) payload.stream_options={...payload.stream_options,include_usage:true}
      const body=JSON.stringify(payload), inputByteBound=Buffer.byteLength(body)+4096
      id=await budget.reserve({tag,inputByteBound,maxOutput:4096,inputRate:pricing.inputRate,outputRate:pricing.outputRate})
      const call={ id,tag,requestHash:hash(body),nativeRequestHash:hash(raw),inputBytes:Buffer.byteLength(body),
        toolSchemaBytes:Buffer.byteLength(JSON.stringify(payload.tools??[])),toolNames:payload.tools?.map(t=>t.function?.name),startedAt:new Date().toISOString() }
      telemetry.push(call)
      const response=await fetch('https://llmx.pandaaiquant.com/v1/chat/completions',{method:'POST',redirect:'error',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(180000)})
      call.status=response.status
      if(!response.ok) throw new Error('Upstream HTTP '+response.status)
      let usage, firstVisible, carry=''
      if(payload.stream) {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'})
        const decoder=new TextDecoder()
        const parse = line => {
          if(!line.startsWith('data:') || line.slice(5).trim()==='[DONE]') return
          const frame=JSON.parse(line.slice(5).trim())
          if (frame.model) call.resolvedModel=frame.model
          if(frame.error) throw new Error('Upstream stream error')
          if(frame.usage) usage=frame.usage
          if(firstVisible===undefined && frame.choices?.some(c=>c.delta?.content)) firstVisible=performance.now()-started
        }
        for await(const bytes of response.body) {
          carry+=decoder.decode(bytes,{stream:true})
          let end
          while((end=carry.indexOf('\n'))>=0) { const line=carry.slice(0,end).replace(/\r$/,''); carry=carry.slice(end+1); parse(line) }
          res.write(bytes)
        }
        carry+=decoder.decode(); if(carry.trim()) parse(carry.trim())
      } else {
        const result=await response.json(); usage=result.usage
        call.resolvedModel=result.model
        firstVisible=performance.now()-started
        res.writeHead(200,{'Content-Type':'application/json'}); res.write(JSON.stringify(result))
      }
      call.elapsedMs=Math.round(performance.now()-started); call.firstVisibleMs=firstVisible??null
      await budget.settle(id,usage,{elapsedMs:call.elapsedMs,firstVisibleMs:call.firstVisibleMs,requestHash:call.requestHash})
      res.end()
    } catch(error) {
      // Do not relay upstream error bodies or credentials to logs or models.
      const safe = /^(Upstream HTTP \d+|Budget |Authoritative|Provider exceeded|Per-task|Model\/input|Request exceeds)/.test(error.message)
        ? error.message : 'Gateway request failed; inspect local accounting state'
      if(id) await budget.unknown(id,safe)
      telemetry.push({ tag: tokens.get(req.headers.authorization?.replace(/^Bearer /,'')), failure:safe, reservationId:id })
      if(!res.headersSent) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:{message:safe,type:'benchmark_error'}})) }
      else res.destroy()
    }
  }
  const server=createServer((req,res)=>{ const p=handler(req,res);active.add(p);void p.finally(()=>active.delete(p)) })
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok))
  return {url:`http://127.0.0.1:${server.address().port}/v1`,telemetry,
    register(tag){const token=randomUUID();tokens.set(token,tag);return token},
    async close(){await new Promise(ok=>server.close(ok));await Promise.allSettled([...active])} }
}
