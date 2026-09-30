import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveDshHome, resolveProfile, prepareProfileStage, activateProfileStage, restoreProfileTransaction } from '../scripts/profile-state.mjs'
import { installProfile } from '../scripts/install-profile.mjs'

const roots: string[] = []
async function temp() { const root = await mkdtemp(join(tmpdir(), 'qs-profile-')); roots.push(root); return root }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('isolated profile installation', () => {
  it('leaves an ordinary DSH home separate, recognizes legacy QuantStudio data, and honors an explicit home', async () => {
    const root = await temp()
    await mkdir(join(root, '.dsh/profiles/web'), { recursive: true })
    await writeFile(join(root, '.dsh/profiles/web/package.json'), '{"dependencies":{"user-plugin":"1"}}')
    expect(resolveDshHome({}, root)).toBe(join(root, '.dsh-quantstudio'))
    const bootstrap = join(root, '.dsh/quantskills/application/bootstrap')
    await mkdir(bootstrap, { recursive: true })
    await writeFile(join(bootstrap, 'config.json'), JSON.stringify({schemaVersion:1,pnpmCli:'/old/pnpm.cjs',nodeExecutable:'/old/node'}))
    expect(resolveDshHome({}, root)).toBe(join(root, '.dsh'))
    expect(resolveDshHome({ DSH_HOME: join(root, 'custom') }, root)).toBe(join(root, 'custom'))
    expect(resolveProfile({})).toBe('quantstudio')
    expect(() => resolveProfile({ QUANTSKILLS_PROFILE: '../web' })).toThrow()
    expect(() => resolveProfile({ QUANTSKILLS_PROFILE: 'NUL' })).toThrow()
  })

  it('preserves all original profile files and links when the pinned installer fails', async () => {
    const home = await temp(), profile = join(home, 'profiles/quantstudio')
    await mkdir(join(profile, 'node_modules'), { recursive: true })
    const original = '{"dependencies":{"@quantskills/dsh-plugin":"1.0.0","dsh-context":"1.0.0"},"dsh":{"profile":{"bundles":["dsh-context"]}}}'
    await writeFile(join(profile, 'package.json'), original)
    await writeFile(join(profile, 'node_modules/original.txt'), 'original dependency files')
    await writeFile(join(profile, 'cordis.patch.yml'), '# original customization\n')
    const cli = join(home, 'pnpm-failure.mjs')
    await writeFile(cli, `import {writeFileSync} from 'node:fs'; if(process.argv[2]==='--version')console.log('11.7.0');else{writeFileSync('package.json','{"damaged":true}');process.exitCode=7}`)
    await expect(installProfile({ ...process.env, DSH_HOME: home, QUANTSKILLS_PROFILE:'quantstudio', QUANTSKILLS_PNPM_CLI:cli })).rejects.toThrow(/original profile was preserved/)
    expect(await readFile(join(profile, 'package.json'), 'utf8')).toBe(original)
    expect(await readFile(join(profile, 'node_modules/original.txt'), 'utf8')).toBe('original dependency files')
    expect(await readFile(join(profile, 'cordis.patch.yml'), 'utf8')).toBe('# original customization\n')
    expect((await readdir(join(home, 'profiles'))).filter(n => n.startsWith('.qs-stage-'))).toEqual([])
  })

  it('refuses an occupied foreign profile before changing its manifest', async () => {
    const home = await temp(), profile = join(home, 'profiles/web')
    await mkdir(profile, { recursive: true })
    const original = '{"dependencies":{"user-plugin":"^3.0.0"}}'
    await writeFile(join(profile, 'package.json'), original)
    const cli = join(home, 'pnpm-version.mjs'); await writeFile(cli, "console.log('11.7.0')")
    await expect(installProfile({ ...process.env, DSH_HOME:home, QUANTSKILLS_PROFILE:'web', QUANTSKILLS_PNPM_CLI:cli })).rejects.toThrow(/belongs to another installation/)
    expect(await readFile(join(profile, 'package.json'), 'utf8')).toBe(original)
  })

  it('restores a complete profile after activation, including the previous materialized dependencies', async () => {
    const home = await temp(), profile = join(home, 'profiles/quantstudio')
    await mkdir(join(profile, 'node_modules'), { recursive:true })
    await writeFile(join(profile, 'package.json'), '{"old":true}')
    await writeFile(join(profile, 'node_modules/old.txt'), 'keep this')
    const transaction = await prepareProfileStage(home, 'quantstudio')
    await writeFile(join(transaction.stage, 'package.json'), '{"new":true}')
    const activated = await activateProfileStage(transaction)
    expect(await readFile(join(profile,'package.json'),'utf8')).toBe('{"new":true}')
    await restoreProfileTransaction(activated)
    expect(await readFile(join(profile,'package.json'),'utf8')).toBe('{"old":true}')
    expect(await readFile(join(profile,'node_modules/old.txt'),'utf8')).toBe('keep this')
  })

  it('restores the previous profile when a real launcher child exits before becoming healthy', async () => {
    const home = await temp(), application = join(home, 'quantskills/application'), bootstrap = join(application, 'bootstrap')
    const profile = join(home, 'profiles/quantstudio')
    await mkdir(bootstrap, { recursive:true }); await mkdir(profile, { recursive:true })
    await writeFile(join(profile,'package.json'), '{"old":true}')
    const cli = join(home,'pnpm-startup-failure.mjs')
    const helper = pathToFileURL(resolve('scripts/profile-state.mjs')).href
    await writeFile(cli, `import {writeFile} from 'node:fs/promises'; import {join} from 'node:path'; import {prepareProfileStage,activateProfileStage} from ${JSON.stringify(helper)};
if(process.argv[2]==='run'){const t=await prepareProfileStage(process.env.DSH_HOME,process.env.QUANTSKILLS_PROFILE);await writeFile(join(t.stage,'package.json'),'{"new":true}');const r=await activateProfileStage(t);await writeFile(process.env.QUANTSKILLS_PROFILE_RECEIPT,JSON.stringify(r))}else process.exitCode=9;`)
    await writeFile(join(bootstrap,'config.json'), JSON.stringify({schemaVersion:1,nodeExecutable:process.execPath,pnpmCli:cli,profile:'quantstudio',fallbackSourceRoot:resolve('.'),defaultPort:39583,healthTimeoutMs:2000}))
    const result = spawnSync(process.execPath, ['scripts/application-bootstrap.mjs','--port','39583','--no-open'], {
      cwd:resolve('.'),env:{...process.env,DSH_HOME:home},encoding:'utf8',windowsHide:true,timeout:15000,
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('the previous profile was restored')
    expect(await readFile(join(profile,'package.json'),'utf8')).toBe('{"old":true}')
  })
})
