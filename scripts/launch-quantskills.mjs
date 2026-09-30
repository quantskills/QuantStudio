/** Delegate `pnpm run web` to the stable launcher installed under DSH_HOME. */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { resolveDshHome } from './profile-state.mjs'

const dshHome = resolveDshHome()
const launcher = join(dshHome, 'quantskills', 'application', 'bootstrap', 'launcher.mjs')
const child = spawn(process.execPath, [
  launcher,
  '--source-root', process.cwd(),
  '--',
  ...process.argv.slice(2),
], {
  cwd: join(dshHome, 'quantskills', 'application', 'bootstrap'),
  env: { ...process.env, DSH_HOME: dshHome },
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.once('exit', (code) => { process.exitCode = code ?? 1 })
