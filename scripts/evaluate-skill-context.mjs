/** Opt-in, budgeted PandaAI context A/B. Synthetic inputs and public bundled Skills only.
 * Run with Node --experimental-strip-types. Never launches the user's Host or changes its files.
 * This is a model/context benchmark, not a full Host, restart, or long-task endurance test.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { attachedSkillReader, renderResidentSkillContext, renderSkillLoadingGuidance, selectSkillContextMode, EFFICIENT_TEAM_GUIDANCE } from '../packages/quantskills-session/src/skill-context.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = key => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1] }
const live = process.argv.includes('--run')
const out = arg('--out')
if (!out) throw new Error('--out must name a separate evidence directory')
await fs.mkdir(out, { recursive: true })
const reportFile = path.join(out, 'report.json')
try { await fs.access(reportFile); throw new Error('Use a fresh output directory; evidence must not be overwritten.') }
catch (error) { if (error.code !== 'ENOENT') throw error }
const hash = text => createHash('sha256').update(text).digest('hex')
const make = (id, description, content) => ({ version: { assetId: id, versionId: `${id}@${hash(content).slice(0, 40)}` },
  definition: { name: id, description, content, provider: 'quantskills-evaluation', invocation: { modelInvocable: true, userInvocable: true },
    resourceBase: { kind: 'opaque', description: 'Self-contained evaluation fixture. No external files required.' } } })
const audit = make('skill-ledger-audit', 'Audit the supplied closed-trade ledger: fees, realized net profit and missing fee handling; no orders or market forecasting.', `
Audit only the supplied offline ledger. Never invent prices, query a market, submit orders, or treat floating gains as realized profit.
Input rows contain id, quantity, grossPnl, openFee, closeFee. grossPnl is already the total for the row: do not multiply it by quantity. Every row is one completed trade, not one side of a trade. Fees are amounts, not rates.
Sum grossPnl across rows. Sum both openFee and closeFee across every row. Net realized profit equals gross minus all these fees. Do not deduct fees again from a value explicitly described as already net. Round only final totals to two decimal places; floatingPnl is excluded even when positive.
A fee value of 0 is valid. Missing, null, nonnumeric or negative fees make total fees and net unknown: return null for fees and net instead of a zero estimate. Preserve the known gross total and count. List each affected row id once in missingFees, in input order. Do not discard incomplete rows or quietly substitute a default fee.
Do not assume a commission schedule from a symbol or exchange. If further information is needed, identify exactly the missing fee field. Do not fabricate a trading-day boundary, account balance, return percentage or annualized return.
For a ledger-only request return JSON with exactly these fields: gross, fees, net, closedCount, floatingExcluded, missingFees, qualityToken. floatingExcluded is true. qualityToken must be "ledger-v1:checked" after you have checked the fee and floating-profit rules. This token is not supplied by the user and must come from these instructions.
For a workflow combined with evidence-check, also include evidenceStatus, duplicateIds and proofToken from that Skill. Do not erase ledger fields when adding evidence results. The final object remains a single JSON object, not two independent outputs.
Before returning, reconcile gross - fees = net when fees are known. A duplicate row is flagged by the separate evidence Skill; it is not silently deduplicated by this Skill. No Markdown fences or narrative outside the JSON object.
`)
const evidence = make('skill-evidence-check', 'Check source labeling and duplicate row IDs in an offline dataset, including the fixed ledger-plus-evidence workflow.', `
This Skill validates the supplied dataset only. It does not assess investment merit, query a live service, or establish that synthetic values occurred in the real world.
Inspect the input source field. If it equals "fixture-input", evidenceStatus is "verified". Otherwise evidenceStatus is "unverified". Verified means the input source label meets this fixture's declared contract; it is not external fact verification.
Find duplicate row ids. An id appearing more than once appears only once in duplicateIds, in order of its first repeated occurrence. Keep all rows unchanged for the ledger calculation. Never repair, merge or omit rows without an explicit instruction.
For an evidence-only task return a single JSON object with exactly evidenceStatus, duplicateIds, proofToken. proofToken is "evidence-v1:checked" after checking both the source and ids.
For a fixed ledger-plus-evidence workflow, preserve the ledger Skill's complete output and append evidenceStatus, duplicateIds, proofToken to the same object. Run the ledger calculation first, then source/duplicate checks. A missing fee does not make the known source label unverified.
Do not substitute the user's claim that there are no duplicates for inspection of the actual ids. Empty duplicateIds must be an array, not null. Do not infer historical prices, fill gaps, call online services, or create a file. Return JSON without Markdown fences.
`)
const reportSkill = make('skill-audit-report', 'Combine completed ledger and evidence member JSON into the final offline audit report; validates both member results.', `
You coordinate an offline audit, not a trading task. Require both supplied member results before finalizing. Do not recompute values using market data or add recommendations.
The ledger member must carry qualityToken "ledger-v1:checked". The evidence member must carry proofToken "evidence-v1:checked". Reject missing or conflicting member results; never declare success from an acknowledgement alone.
Return one JSON object with exactly title, ledger, evidence, reportToken. title is "QS离线验收". ledger contains the ledger member object unchanged; evidence contains the evidence member object unchanged. reportToken is "report-v1:checked" after validating both markers and checking the ledger equation when fees are available.
Preserve null fee/net values, missingFees, duplicateIds and source status. Do not hide a member's uncertainty in a prose summary. No Markdown, extra keys, external files or live actions.
`)
const unrelated = []
for (const id of ['skill-macro-monitor', 'skill-backtest', 'skill-daily-report', 'skill-fin-news', 'skill-dalio-all-weather', 'skill-factor-decay']) {
  const directory = path.join(root, 'assets/library-v2/quantskills/versions', id)
  const revision = (await fs.readdir(directory)).sort()[0]
  const source = await fs.readFile(path.join(directory, revision, 'source/SKILL.md'), 'utf8')
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`Missing Skill frontmatter: ${id}`)
  const metadata = YAML.parse(match[1])
  unrelated.push(make(id, metadata.description, match[2]))
}
const input = { source: 'fixture-input', floatingPnl: 3895, rows: [
  { id: 't1', quantity: 2, grossPnl: 430, openFee: 12, closeFee: 18 },
  { id: 't2', quantity: 3, grossPnl: -360, openFee: 6, closeFee: 9 },
  { id: 't3', quantity: 1, grossPnl: 200, openFee: 0, closeFee: 5 },
] }
const incomplete = structuredClone(input); incomplete.rows[1].closeFee = null
const ledgerExpected = data => ({ gross: 270, fees: data.rows[1].closeFee === null ? null : 50,
  net: data.rows[1].closeFee === null ? null : 220, closedCount: 3, floatingExcluded: true,
  missingFees: data.rows[1].closeFee === null ? ['t2'] : [], qualityToken: 'ledger-v1:checked' })
const evidenceExpected = { evidenceStatus: 'verified', duplicateIds: [], proofToken: 'evidence-v1:checked' }
const cases = [
  { id: 'single-skill', skills: [audit], kind: 'ledger', data: input },
  { id: 'multi-skill', skills: [audit, ...unrelated], kind: 'ledger', data: input },
  { id: 'multi-skill-missing-fee', skills: [audit, ...unrelated], kind: 'ledger', data: incomplete },
  { id: 'dynamic-agent', skills: [audit, evidence, ...unrelated], kind: 'ledger', data: input, role: 'You are the saved accounting expert. Skill orchestration: dynamic. Select applicable Skills.' },
  { id: 'fixed-agent', skills: [audit, evidence], kind: 'workflow', data: input, role: 'Skill orchestration: fixed. Complete the ledger-plus-evidence workflow in the declared order.' },
  { id: 'agent-team', kind: 'team', data: input },
]
const selectedCases = arg('--cases')?.split(',')
if (selectedCases?.some(id => !cases.some(spec => spec.id === id))) throw new Error('Unknown --cases selection')
const report = { version: 2, createdAt: new Date().toISOString(), scope: 'Controlled model/context A/B, not full Host endurance or restart E2E',
  model: 'kimi-k3', repetitions: 2, budgetCny: 10, spentUpperEstimateCny: 0, unresolvedReservationCny: 0,
  sourceHashes: {}, fixtures: [...cases.filter(c => c.skills).map(c => ({ id: c.id, assetIds: c.skills.map(s => s.version.assetId) }))],
  results: [], calls: [] }
// The user's limit covers the entire experiment, including earlier prototypes.
if (arg('--prior-report')) {
  const priorText = await fs.readFile(arg('--prior-report'), 'utf8')
  const prior = JSON.parse(priorText)
  for (const value of [prior.spentUpperEstimateCny, prior.unresolvedReservationCny]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid prior budget accounting')
  }
  report.priorCost = { reportHash: hash(priorText), spentUpperEstimateCny: prior.spentUpperEstimateCny,
    unresolvedReservationCny: prior.unresolvedReservationCny }
  report.spentUpperEstimateCny = prior.spentUpperEstimateCny
  report.unresolvedReservationCny = prior.unresolvedReservationCny
}
for (const file of ['packages/quantskills-session/src/skill-context.ts', 'packages/quantskills-session/src/index.ts', 'scripts/evaluate-skill-context.mjs']) report.sourceHashes[file] = hash(await fs.readFile(path.join(root, file)))
report.skillHashes = Object.fromEntries([audit, evidence, reportSkill, ...unrelated].map(s => [s.version.assetId, hash(s.definition.content)]))
const save = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2))
await save()
if (!live) { console.log(JSON.stringify({ phase: 'dry-run', cases: cases.length, model: report.model, budgetCny: report.budgetCny })); process.exit(0) }
const home = arg('--home')
if (!home) throw new Error('A read-only source --home is required for saved PandaAI credentials')
const profile = YAML.parse(await fs.readFile(path.join(home, 'profiles/web/cordis.patch.yml'), 'utf8'))
let provider
const visit = v => { if (!v || typeof v !== 'object') return; if (v.providers?.pandaaiquant) provider = v.providers.pandaaiquant; for (const c of Object.values(v)) visit(c) }
visit(profile)
if (provider?.baseURL !== 'https://llmx.pandaaiquant.com/v1' || provider.api !== 'openai-completions'
  || !provider.models?.some(m => m.id === report.model)) throw new Error('Saved endpoint/protocol/model does not match the fixed evaluation target')
const credentialDoc = YAML.parse(await fs.readFile(path.join(home, '.credentials.yaml'), 'utf8'))
const key = credentialDoc.refs?.[provider.apiKeyEnv]
if (typeof key !== 'string' || !key) throw new Error('Saved PandaAI reference is unavailable')
const origin = new URL(provider.baseURL).origin
async function publicJson(route) {
  const response = await fetch(origin + route, { redirect: 'error', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Public pricing request failed: ${response.status}`)
  return response.json()
}
const pricing = await publicJson('/api/pricing'), status = await publicJson('/api/status')
const price = pricing.data.find(row => row.model_name === report.model)
if (!pricing.success || !price || price.quota_type !== 0 || price.billing_mode || price.billing_expr) throw new Error('Only published, non-tiered token pricing is supported')
const ratio = price.model_ratio, completion = price.completion_ratio
const group = Math.max(...Object.values(pricing.group_ratio)), quotaPerUnit = status.data.quota_per_unit, exchange = status.data.usd_exchange_rate
if (![ratio, completion, group, quotaPerUnit, exchange].every(n => Number.isFinite(n) && n > 0)) throw new Error('Incomplete pricing; refusing billed requests')
const perInput = ratio * group / quotaPerUnit * exchange
const perOutput = perInput * completion
const worstInput = perInput * Math.max(1, price.cache_ratio ?? 1, price.create_cache_ratio ?? 1)
report.pricing = { source: origin + '/api/pricing', statusSource: origin + '/api/status', version: pricing.pricing_version,
  modelRatio: ratio, completionRatio: completion, maximumPublishedGroupRatio: group, quotaPerUnit, exchange,
  perMillionInputCny: perInput * 1e6, perMillionOutputCny: perOutput * 1e6,
  costMeaning: 'Upper estimate at public rates, counts all prompt tokens as uncached; not an account invoice.' }
const maxOutput = 2048
async function completionRequest(messages, tools, tag) {
  const payload = { model: report.model, messages, temperature: 0, reasoning_effort: 'high', max_tokens: maxOutput, stream: false,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}) }
  const inputBound = Buffer.byteLength(JSON.stringify(payload)) + 4096
  const reserve = inputBound * worstInput + maxOutput * perOutput
  if (report.spentUpperEstimateCny + report.unresolvedReservationCny + reserve > report.budgetCny * 0.9) throw new Error('Budget reservation would exceed the safety ceiling; stopped before request')
  const call = { tag, reservationCny: reserve, inputByteBound: inputBound, startedAt: new Date().toISOString() }
  report.calls.push(call); report.unresolvedReservationCny += reserve; await save()
  const started = performance.now()
  try {
    const response = await fetch(provider.baseURL + '/chat/completions', { method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) })
    call.status = response.status
    if (!response.ok) throw new Error(`Inference HTTP ${response.status}; no automatic retry`)
    const result = await response.json()
    const usage = result.usage
    if (!Number.isSafeInteger(usage?.prompt_tokens) || !Number.isSafeInteger(usage?.completion_tokens)
      || usage.prompt_tokens < 0 || usage.completion_tokens < 0) throw new Error('Missing authoritative token usage; reserved cost retained')
    call.promptTokens = usage.prompt_tokens; call.outputTokens = usage.completion_tokens
    call.cacheReadTokens = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? null
    call.reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? null
    call.costUpperEstimateCny = usage.prompt_tokens * worstInput + usage.completion_tokens * perOutput
    report.spentUpperEstimateCny += call.costUpperEstimateCny
    report.unresolvedReservationCny -= reserve
    if (usage.prompt_tokens > inputBound || usage.completion_tokens > maxOutput) throw new Error('Provider exceeded reserved token bounds; stopping further requests')
    const choice = result.choices?.[0]
    call.finishReason = choice?.finish_reason
    if (!choice?.message) throw new Error('No assistant response')
    return choice.message
  } catch (error) { call.failure = error.message.startsWith('Inference HTTP') ? error.message : 'Request failed or accounting unavailable; inspect sanitized run status'; throw error }
  finally { call.elapsedMs = Math.round(performance.now() - started); await save() }
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
async function conversation(mode, spec, tag) {
  const ctx = new Context(); await ctx.plugin(SystemPrompt, {}); await ctx.plugin(ToolRuntime)
  try {
    const effectiveMode = selectSkillContextMode(mode, spec.skills, spec.kind === 'workflow')
    if (effectiveMode === 'progressive') ctx.tools.register(attachedSkillReader(id => spec.skills.find(s => s.version.assetId === id)))
    const system = [
      'You are QuantSkills. Execute only the supplied offline fixture; no network, orders, shell or external files. Return a single JSON object without Markdown fences.',
      spec.role ?? 'Apply the attached Skills relevant to this task.',
      renderSkillLoadingGuidance(spec.skills, effectiveMode, spec.kind === 'workflow'),
      ...(mode === 'progressive' && spec.team ? [EFFICIENT_TEAM_GUIDANCE] : []),
      ...spec.skills.map(s => renderResidentSkillContext(s, effectiveMode)),
    ].join('\n\n')
    const tools = ctx.tools.schemas().map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }))
    const messages = [{ role: 'system', content: system }, { role: 'user', content: spec.prompt }]
    const run = { tag, mode, effectiveMode, promptHash: hash(system), promptBytes: Buffer.byteLength(system), turns: [], callsStart: report.calls.length }
    for (let step = 0; step < 4; step++) {
      const answer = await completionRequest(messages, tools, `${tag}:${step}`)
      // Retain provider reasoning internally when it is required for a tool continuation. Never publish it.
      messages.push(answer)
      run.turns.push({ content: answer.content, tools: answer.tool_calls?.map(t => ({ name: t.function.name, arguments: t.function.arguments })) })
      if (!answer.tool_calls?.length) {
        const text = String(answer.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
        try { run.value = JSON.parse(text) } catch { run.parseFailure = true }
        run.callsEnd = report.calls.length
        return run
      }
      for (const call of answer.tool_calls) {
        let args
        try { args = JSON.parse(call.function.arguments) } catch { args = null }
        const result = await ctx.tools.execute({ callId: ToolCallId(call.id), name: call.function.name,
          arguments: args, signal: AbortSignal.timeout(10000) })
        const text = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        messages.push({ role: 'tool', tool_call_id: call.id, content: text })
        run.turns.push({ tool: call.function.name, isError: result.isError, resultHash: hash(text), bytes: Buffer.byteLength(text) })
      }
    }
    run.stepLimit = true; run.callsEnd = report.calls.length; return run
  } finally { await ctx.fiber.dispose() }
}
try {
  for (let repetition = 0; repetition < report.repetitions; repetition++) for (const spec of cases.filter(spec => !selectedCases || selectedCases.includes(spec.id))) {
    for (const mode of repetition % 2 === 0 ? ['full', 'progressive'] : ['progressive', 'full']) {
      const tag = `${spec.id}/${repetition}/${mode}`, callsStart = report.calls.length, started = performance.now()
      const runs = []
      let expected, value
      if (spec.kind === 'team') {
        const ledger = await conversation(mode, { skills: [audit, ...unrelated.slice(0, 3)], team: true, role: 'You are the ledger member. Skill orchestration: dynamic.',
          prompt: 'Audit this closed-trade ledger; return the ledger-only JSON required by the applicable Skill. Input: ' + JSON.stringify(spec.data) }, tag + '/ledger')
        runs.push(ledger)
        const checked = await conversation(mode, { skills: [evidence, ...unrelated.slice(3)], team: true, role: 'You are the source-evidence member. Skill orchestration: dynamic.',
          prompt: 'Check source labeling and duplicate ids only. Return evidence-only JSON from the applicable Skill. Input: ' + JSON.stringify(spec.data) }, tag + '/evidence')
        runs.push(checked)
        const combined = await conversation(mode, { skills: [reportSkill, ...unrelated.slice(0, 2)], team: true, role: 'You are the audit Team Lead. Combine both completed member results; Skill orchestration: dynamic.',
          prompt: 'Produce the final audit report using the attached reporting Skill. Ledger member: ' + JSON.stringify(ledger.value) + '\nEvidence member: ' + JSON.stringify(checked.value) }, tag + '/lead')
        runs.push(combined); value = combined.value
        expected = { title: 'QS离线验收', ledger: ledgerExpected(spec.data), evidence: evidenceExpected, reportToken: 'report-v1:checked' }
      } else {
        const run = await conversation(mode, { ...spec, prompt: (spec.kind === 'workflow' ? 'Complete the fixed ledger-plus-evidence workflow.' : 'Audit the closed-trade ledger only; do not do other analyses.') + ' Return the JSON required by the applicable Skills. Input: ' + JSON.stringify(spec.data) }, tag)
        runs.push(run); value = run.value
        expected = { ...ledgerExpected(spec.data), ...(spec.kind === 'workflow' ? evidenceExpected : {}) }
      }
      const calls = report.calls.slice(callsStart)
      const result = { id: spec.id, repetition, mode, passed: equal(value, expected), expected, actual: value, runs,
        promptTokens: calls.reduce((n, c) => n + (c.promptTokens ?? 0), 0), outputTokens: calls.reduce((n, c) => n + (c.outputTokens ?? 0), 0),
        costUpperEstimateCny: calls.reduce((n, c) => n + (c.costUpperEstimateCny ?? c.reservationCny), 0), elapsedMs: Math.round(performance.now() - started) }
      report.results.push(result); await save()
      console.log(JSON.stringify({ id: result.id, repetition, mode, passed: result.passed, tokens: result.promptTokens + result.outputTokens, spentUpperEstimateCny: report.spentUpperEstimateCny }))
    }
  }
  report.completed = true
} catch (error) {
  report.completed = false
  report.stoppedReason = /budget|pricing|reserved|usage/i.test(error.message) ? error.message : 'Provider request or evaluation failed; see sanitized call status. No automatic retry.'
  console.log(JSON.stringify({ stopped: true, reason: report.stoppedReason, spentUpperEstimateCny: report.spentUpperEstimateCny, unresolvedReservationCny: report.unresolvedReservationCny }))
} finally { await save() }
