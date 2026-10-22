// External measurement adapter. Uses the selected Host's public services; it
// does not replace prompting, context selection, model execution or team tools.
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
export const name = 'qs-local-benchmark-bridge'
export const inject = ['agents', 'sessionController', 'loader', 'skills', 'tools']
export function apply(ctx) {
  if (!process.send || !process.env.QS_BENCH_FIXTURE) throw new Error('Benchmark requires isolated IPC launch')
  const errors = [], eventCounts = new Map(), records = new Map()
  ctx.on('agent/error', ({ agent, error }) => errors.push({ session: String(agent.id), message: String(error).slice(0,500) }))
  ctx.on('session/event', (session, event) => {
    const counts = eventCounts.get(session.id) ?? {}
    counts[event.type] = (counts[event.type] ?? 0) + 1; eventCounts.set(session.id, counts)
    const record = records.get(session.id) ?? { id: String(session.id), parent: session.header.parentSession, events: [] }
    if (event.type === 'assistant/message' || event.type === 'turn/end') {
      record.events.push({ type: event.type, seq: event.seq, data: event.type === 'assistant/message'
        ? { content: (event.data.content ?? event.data.message?.content ?? []).filter(c => c.type === 'text') }
        : event.data })
      record.lastOutputAt = Date.now()
    }
    records.set(session.id, record)
  })
  const handle = async (method, params) => {
    await ctx.loader.await()
    await ctx.get('quantSkillsSessions')?.whenLifecycleReady?.()
    if (method === 'info') return { version: process.env.QS_BENCH_DSH, qs: !!ctx.get('quantSkillsSessions'),
      home: process.env.DSH_HOME, cwd: process.cwd(), pid: process.pid,
      inactive: [...ctx.loader.entries()].filter(e => !e.disabled && e.fiber?.state !== 2).map(e => ({ id: e.options.id, state: e.fiber?.state })),
      modelCatalog: await ctx.sessionController.modelCatalog() }
    if (method === 'setup') {
      const fixture = JSON.parse(await readFile(process.env.QS_BENCH_FIXTURE, 'utf8'))
      const sessionId = params.sessionId, cwd = process.env.QS_BENCH_WORKSPACE
      const qs = ctx.get('quantSkillsSessions')
      if (qs) {
        const versions = []
        for (const skill of fixture.skills) versions.push(await ctx.get('quantSkillsHost').manualSkillSave({ mode: 'create', markdown: skill.markdown }))
        if (fixture.kind === 'team') {
          const makeAgent = async role => qs.agentCreate({ name: role.name, role: role.role, mode: 'dynamic', permission: 'workspace-write',
            model: { provider:'benchmark',model:'kimi-k3',reasoningEffort:'high' },versionIds:role.skills.map(id => versions.find(v=>v.assetId===id).versionId) })
          const lead = await makeAgent(fixture.lead), members = []
          for (const member of fixture.members) { const a=await makeAgent(member);members.push({name:member.name,agentId:a.agentId,agentRevision:a.revision,context:'fresh',model:{kind:'default'}}) }
          const team=await qs.agentTeamCreate({name:'Offline audit team',description:fixture.objective,leadAgentId:lead.agentId,leadAgentRevision:lead.revision,leadModel:{kind:'default'},members})
          await qs.agentTeamSessionCreate({sessionId,cwd,teamId:team.teamId,expectedRevision:team.revision})
        } else if (fixture.kind === 'agent') {
          const definition = await qs.agentCreate({ name: fixture.roleName, role: fixture.role, mode: fixture.mode,
            permission: 'workspace-write', model: { provider: 'benchmark', model: 'kimi-k3', reasoningEffort: 'high' }, versionIds: versions.map(v => v.versionId) })
          await qs.agentSessionCreate({ sessionId, cwd, agentId: definition.agentId, expectedRevision: definition.revision })
        } else {
          await qs.plainSessionCreate({ sessionId, purpose: 'ordinary', cwd })
          for (const v of versions) await qs.residentSkillAttach({ sessionId, versionId: v.versionId })
        }
      } else await ctx.sessionController.create({ sessionId, cwd })
      await ctx.sessionController.selectModel({ sessionId, provider: 'benchmark', model: 'kimi-k3', reasoningEffort: 'high' })
      const agent = ctx.agents.get(sessionId)
      const prompt = await agent.ctx.systemPrompt.assemble({ scope: agent })
      const skillDefinitions = []
      for (const skill of fixture.skills) {
        // Team members own their own skill subsets; validate their installation
        // through the Host before they are activated by the Lead.
        if (qs && fixture.kind === 'team' && !fixture.lead.skills.includes(skill.id)) continue
        const definition = await ctx.skills.get(skill.id, { scope: agent, cwd })
        if (!definition) throw new Error('Fixture skill unavailable in runtime: '+skill.id)
        skillDefinitions.push({ id:skill.id,contentHash:createHash('sha256').update(definition.content).digest('hex'),normalizedHash:createHash('sha256').update(definition.content.trim()).digest('hex'),bytes:Buffer.byteLength(definition.content) })
      }
      return { sessionId, prompt, skillDefinitions, tools: agent.ctx.tools.schemas(agent).map(t => ({ name: t.name, description: t.description })) }
    }
    if (method === 'resume') {
      const qs=ctx.get('quantSkillsSessions')
      await ctx.sessionController.selectModel({sessionId:params.sessionId,provider:'benchmark',model:'kimi-k3',reasoningEffort:'high'})
      if(qs) await qs.sessionEnsure({sessionId:params.sessionId})
      return {sessionId:params.sessionId,resumed:!!ctx.agents.get(params.sessionId)}
    }
    if (method === 'compact') {
      const agent=ctx.agents.get(params.sessionId), compaction=ctx.get('compaction')
      if(!agent || typeof compaction?.compactNow!=='function') throw new Error('Native explicit compaction unavailable')
      const result=await compaction.compactNow(agent,new AbortController().signal)
      return {compacted:result!==null}
    }
    if (method === 'run') {
      const { sessionId, prompt } = params, agent = ctx.agents.get(sessionId)
      if (!agent) throw new Error('Task session missing')
      const before = eventCounts.get(sessionId)?.['turn/end'] ?? 0
      const since = Date.now()
      await ctx.sessionController.prompt({ sessionId, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text: prompt }] }, new AbortController().signal)
      let stable = 0
      while (Date.now() - since < 600000) {
        if (errors.length) throw new Error(JSON.stringify(errors))
        const ended = (eventCounts.get(sessionId)?.['turn/end'] ?? 0) > before
        const idle = ctx.agents.list().every(a => a.status === 'idle')
        if (ended && idle) stable++; else stable = 0
        if (stable >= 10) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (stable < 10) throw new Error('Task time limit')
      const sessions = [...records.values()].map(r => ({ ...r, counts: eventCounts.get(r.id) }))
      return { elapsedMs: Math.max(...sessions.map(s => s.lastOutputAt ?? since)) - since,
        observedStableMs: Date.now() - since, sessions, errors }
    }
    if (method === 'shutdown') { setTimeout(() => { void ctx.root.fiber.dispose().then(() => process.exit(0)) }, 50); return { closing: true } }
    throw new Error('Unknown benchmark method')
  }
  const listener = message => {
    if (message?.type !== 'qs-benchmark') return
    void handle(message.method, message.params ?? {}).then(result => process.send?.({ type: 'qs-benchmark-result', id: message.id, result }),
      error => process.send?.({ type: 'qs-benchmark-result', id: message.id, error: String(error?.stack ?? error) }))
  }
  ctx.effect(() => {
    const disconnected=()=>{void ctx.root.fiber.dispose().finally(()=>process.exit(0))}
    process.on('message', listener);process.once('disconnect',disconnected)
    process.send({ type: 'qs-benchmark-mounted' })
    return () => {process.off('message', listener);process.off('disconnect',disconnected)}
  })
}
