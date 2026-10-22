// Exercise the compiled, native DSH Host without a paid model or user Home.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchHost } from '../benchmark/lib/native-host.mjs'
import { mockGateway } from '../benchmark/lib/mock-gateway.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = await mkdtemp(join(tmpdir(), 'qs-team-verification-'))
const config = join(root, 'config.json'), previousConfig = process.env.QS_BENCH_CONFIG
const proxy = await mockGateway('Unexpected model request during offline verification')
const fixture = {
  kind:'team', objective:'Check synthetic warehouse counts with a frozen member output contract.',
  skills:[{id:'skill-verification-fixture',markdown:'---\nname: skill-verification-fixture\ndescription: Verify warehouse counts.\n---\nReturn exactly JSON fields count and missing. Keep each row occurrence. Do not add auditNotes.\n'}],
  lead:{name:'coordinator',role:'Delegate and verify the existing member contract.',skills:[]},
  members:[{name:'counter',role:'Count supplied rows. Return only the saved Skill fields.',skills:['skill-verification-fixture']}],
}
const results = []
let host
try {
  process.env.QS_BENCH_CONFIG = config
  for (const mode of ['full', 'progressive']) {
    await writeFile(config, JSON.stringify({schema:2,workspace:join(root,mode),
      arms:[{id:'qs-public',path:project,dsh:'0.2.1-rc.2',skillContextMode:mode}],
      budget:{limitCny:100,priorCny:0,stageLimitCny:25}}))
    host = await launchHost('qs-public',fixture,proxy.url)
    assert.deepEqual(host.info.inactive,[])
    const sessionId='offline-verification'
    const setup = await host.request('setup',{sessionId})
    for (const name of ['read_team_member_instructions','quantskills_calculate']) assert.ok(setup.tools.some(tool=>tool.name===name))
    const call = (name,args) => host.request('verify-team-tools',{sessionId,name,arguments:args})
    const instructions = await call('read_team_member_instructions',{members:['counter']})
    assert.ok(!instructions.isError)
    const text = instructions.content.filter(c=>c.type==='text').map(c=>c.text).join('\n')
    assert.ok(text.includes(fixture.members[0].role))
    assert.ok(text.includes('Return exactly JSON fields count and missing.'))
    assert.ok(text.includes('Do not add auditNotes.'))
    const input={calculations:[{label:'rows',operation:'sum',values:['5','2','5'],expected:'7'}]}
    const checked = await call('quantskills_calculate',input)
    assert.ok(!checked.isError)
    const calculation = JSON.parse(checked.content.find(c=>c.type==='text').text)
    assert.equal(calculation.calculations[0].value,'12')
    assert.equal(calculation.calculations[0].operandCount,3)
    assert.equal(calculation.calculations[0].matchesExpected,false)
    assert.equal(calculation.sourceCompleteness,'not-verified')
    const rejected=await call('quantskills_calculate',{calculations:[{label:'bad',operation:'sum',values:['1','unknown']}]})
    assert.equal(rejected.isError,true)
    await assert.rejects(()=>call('activate_team_member',{member:'counter',task:'Not allowed through this probe.'}),/Not a verification tool/)
    const run=host.run
    await host.stop();host=undefined
    host=await launchHost('qs-public',fixture,proxy.url,'offline-probe',run)
    await host.request('resume',{sessionId})
    assert.deepEqual(await call('read_team_member_instructions',{members:['counter']}),instructions)
    assert.deepEqual(await call('quantskills_calculate',input),checked)
    results.push({mode,instructions:'passed',exactArithmetic:'passed',invalidInputs:'rejected',restart:'passed'})
    await host.stop();host=undefined
  }
  assert.equal(proxy.calls.length,0,'Offline verification must not request a model')
  console.log(JSON.stringify({kind:'offline-team-tool-integration',modelRequests:0,
    bundleSha256:createHash('sha256').update(await readFile(join(project,'packages/quantskills-session/lib/index.js'))).digest('hex'),results}))
} finally {
  await host?.stop()
  await proxy.stop()
  if (previousConfig === undefined) delete process.env.QS_BENCH_CONFIG
  else process.env.QS_BENCH_CONFIG=previousConfig
}
