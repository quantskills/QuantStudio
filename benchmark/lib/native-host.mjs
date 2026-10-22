import { mkdtemp, mkdir, writeFile, readFile, symlink, realpath, lstat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fork, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import YAML from 'yaml'
import { project, readConfig, within } from './config.mjs'
async function port() { const server = createServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok)); const n = server.address().port; await new Promise(ok => server.close(ok)); return n }
export async function launchHost(armId, fixture, gatewayURL = 'http://127.0.0.1:1/v1', token = 'offline-probe', existingRun) {
  const config = await readConfig()
  const arm = config.arms.find(a => a.id === armId)
  if (!arm) throw new Error('Unknown arm')
  const runtime = arm.path
  const req = createRequire(join(runtime, 'package.json'))
  const dshManifest = req.resolve('@deepseek-ai/dsh/package.json')
  const dshRequire = createRequire(dshManifest)
  const version = JSON.parse(await readFile(dshManifest, 'utf8')).version
  if (version !== arm.dsh) throw new Error('Runtime version mismatch')
  if (arm.commit && execFileSync('git', ['rev-parse', 'HEAD'], { cwd: runtime, encoding: 'utf8', windowsHide: true }).trim() !== arm.commit) throw new Error('Baseline commit mismatch')
  const runs = join(config.workspace, 'runs'); await mkdir(runs, { recursive: true })
  if (existingRun && !within(await realpath(runs), await realpath(existingRun))) throw new Error('Resume outside benchmark runs')
  const run = existingRun ?? await mkdtemp(join(runs, armId + '-'))
  if (existingRun) {
    const marker = JSON.parse(await readFile(join(run, 'benchmark-owner.json'), 'utf8'))
    if (marker.arm !== armId || marker.runtime !== runtime) throw new Error('Resume identity mismatch')
    for (const part of ['home', 'workspace', 'temp', 'user', 'appdata']) {
      if ((await lstat(join(run, part))).isSymbolicLink() || !within(await realpath(run), await realpath(join(run, part)))) throw new Error('Unsafe resume path')
    }
  } else await writeFile(join(run, 'benchmark-owner.json'), JSON.stringify({arm: armId, runtime}))
  const home = join(run, 'home'), workspace = join(run, 'workspace'), profile = join(home, 'profiles', 'benchmark')
  for (const dir of [home, workspace, profile, join(run, 'temp'), join(run, 'user'), join(run, 'appdata')]) await mkdir(dir, { recursive: true })
  const official = armId === 'dsh-official'
  const packages = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']
  if(official && fixture.kind==='team') packages.push('@deepseek-ai/dsh-experimental-agent-team-profile')
  const links = [...packages]
  if (!official) {
    packages.push('@quantskills/dsh-plugin')
    for (const dir of ['agent-team','tool-agent-team','quantskills-host','quantskills-session','panda-mcp','client-remotes-quantskills','client-ui-layout','client-ui-conversation','client-ui-chat','client-ui-input-trigger','ui-quantskills']) {
      const file = join(runtime, 'packages', dir, 'package.json')
      links.push({ name: JSON.parse(await readFile(file)).name, location: dirname(file) })
    }
    links.push({ name: '@quantskills/dsh-plugin', location: runtime })
  }
  const dependencies = {}
  for (const item of links) {
    const name = typeof item === 'string' ? item : item.name
    const location = typeof item === 'string' ? dirname(dshRequire.resolve(item + '/package.json')) : item.location
    const target = join(profile, 'node_modules', name)
    await mkdir(dirname(target), { recursive: true });
    if(!existingRun) await symlink(location, target, process.platform === 'win32' ? 'junction' : 'dir')
    dependencies[name] = 'link:' + location.replaceAll('\\', '/')
  }
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'isolated-benchmark-profile', private: true, dependencies, dsh: { profile: { bundles: packages, patchReload: 'startup' } } }, null, 2))
  const patches = [
    { id: 'hmr', disabled: true },
    { id: 'session-title-llm', disabled: true },
    { id: 'agent-default-model', config: { provider: 'benchmark', model: 'kimi-k3', reasoningEffort: 'high' } },
    { id: 'llm-pi-ai', config: { providers: { benchmark: { displayName: 'Isolated PandaAI benchmark', api: 'openai-completions', baseURL: gatewayURL,
      apiKeyEnv: 'QS_BENCH_GATEWAY_TOKEN', compat: { thinkingFormat: 'openai' }, retryPolicy: { mode: 'normal', maxRetries: 0 },
      models: [{ id: 'kimi-k3', name: 'kimi-k3', contextWindow: 262144, maxTokens: 4096, reasoningEfforts: { high: 'high' } }] } } } },
    { id: 'skill-filesystem', config: { includeDefaultRoots: false, customSkillDirs: official ? [join(workspace, '.skills')] : [], watch: false } },
    { id: 'workspace-controller', config: { documentsDirectory: join(run, 'documents') } },
    { insert: [{ id: 'benchmark-bridge', name: pathToFileURL(join(project, 'benchmark/bridge.mjs')).href }] }
  ]
  if (!official) patches.push({ id: 'quantskills-session', config: { dshHome: home, documentsDirectory: join(run, 'documents'),
    skillContextMode: arm.skillContextMode ?? 'full' } })
  await writeFile(join(profile, 'cordis.patch.yml'), YAML.stringify(patches))
  await writeFile(join(run, 'fixture.json'), JSON.stringify(fixture, null, 2))
  if (official) {
    for (const skill of fixture.skills) { const dir = join(workspace, '.dsh', 'skills', skill.id); await mkdir(dir, { recursive: true }); await writeFile(join(dir, 'SKILL.md'), skill.markdown) }
    const instructions=fixture.kind==='team'
      ? [fixture.objective,'Lead role: '+fixture.lead.role,...fixture.members.map(m=>`Member ${m.name}: ${m.role}\nSkills: ${m.skills.join(', ')}`),'Use native team tools to delegate to the named members; provide each member its role and task.'].join('\n\n')
      : fixture.role
    if (instructions) await writeFile(join(workspace, 'AGENTS.md'), instructions + '\n')
  }
  if(!existingRun) for(const [file,contents] of Object.entries(fixture.files??{})) {
    const destination=resolve(workspace,file)
    if(!within(workspace,destination)) throw new Error('Fixture path escape')
    await mkdir(dirname(destination),{recursive:true});await writeFile(destination,contents)
  }
  const env = {}
  for (const key of ['SystemRoot','WINDIR','PATH','PATHEXT','ComSpec','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS']) if (process.env[key]) env[key] = process.env[key]
  Object.assign(env, { DSH_HOME: home, DSH_AGENTS_HOME: join(run, 'agents'), HOME: join(run,'user'), USERPROFILE: join(run,'user'),
    APPDATA: join(run,'appdata'), LOCALAPPDATA: join(run,'appdata'), TEMP: join(run,'temp'), TMP: join(run,'temp'),
    XDG_CONFIG_HOME: join(run,'user'), XDG_DATA_HOME: join(run,'user'), XDG_CACHE_HOME: join(run,'user'),
    QUANTSKILLS_PROFILE: 'benchmark', QUANTSKILLS_DISABLE_APPLICATION_UPDATE: '1', DSH_TELEMETRY_DISABLED: '1',
    QS_BENCH_FIXTURE: join(run,'fixture.json'), QS_BENCH_WORKSPACE: workspace, QS_BENCH_DSH: version, QS_BENCH_GATEWAY_TOKEN: token })
  const bin = join(dirname(dshManifest), 'lib/bin.js')
  const child = fork(bin, ['--profile','benchmark','--port', String(await port()), '--no-open'], { cwd: workspace, env, stdio: ['ignore','pipe','pipe','ipc'], windowsHide: true, execArgv: [] })
  let log = '', mountedResolve, mountedReject
  const mounted = new Promise((yes,no) => { mountedResolve=yes; mountedReject=no })
  const pending = new Map()
  child.stdout.on('data', data => { log += data.toString().replace(/token=[A-Za-z0-9_-]+/g, 'token=[redacted]').replaceAll(token, '[local-token]') })
  child.stderr.on('data', data => { log += data.toString().replaceAll(token, '[local-token]') })
  child.on('message', message => {
    if (message.type === 'qs-benchmark-mounted') mountedResolve()
    if (message.type === 'qs-benchmark-result') { const p = pending.get(message.id); if (p) { pending.delete(message.id); clearTimeout(p.timer); message.error ? p.no(new Error(message.error)) : p.yes(message.result) } }
  })
  child.on('exit', code => { const error = new Error('Host exited ' + code); mountedReject(error); for (const p of pending.values()) { clearTimeout(p.timer); p.no(error) } pending.clear() })
  const request = (method, params = {}) => new Promise((yes,no) => {
    const id = randomUUID(), timer = setTimeout(() => { pending.delete(id); no(new Error('Bridge timeout: '+method)) }, method === 'run' ? 660000 : 90000)
    pending.set(id, { yes,no,timer }); child.send({ type: 'qs-benchmark', id, method, params })
  })
  const stop = async () => {
    if (child.exitCode === null) {
      try { await request('shutdown') } catch {}
      await Promise.race([new Promise(ok => child.once('exit',ok)), new Promise(ok => setTimeout(ok,5000))])
      if (child.exitCode === null) child.kill()
    }
    await writeFile(join(run, 'host.log'), log)
  }
  try {
    let timer
    try { await Promise.race([mounted, new Promise((_,no) => { timer = setTimeout(() => no(new Error('Host readiness timeout')), 90000) })]) }
    finally { clearTimeout(timer) }
    const info = await request('info')
    if (info.qs !== !official || info.home !== home || info.version !== arm.dsh) throw new Error('Runtime identity mismatch')
    return { request, stop, run, info, arm: {id: arm.id, version, commit: armId === 'dsh-official' ? undefined : execFileSync('git', ['rev-parse', 'HEAD'], {cwd: runtime, encoding: 'utf8', windowsHide: true}).trim()} }
  } catch (e) { await stop(); throw new Error(e.message + '; evidence: '+run) }
}
