/** Delegate `pnpm run web` to the stable launcher installed under DSH_HOME. */

import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const dshHome = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'))
const launcher = join(dshHome, 'quantskills', 'application', 'bootstrap', 'launcher.mjs')
const child = spawn(process.execPath, [
  launcher,
  '--source-root', process.cwd(),
  '--',
  ...process.argv.slice(2),
], {
  cwd: join(dshHome, 'quantskills', 'application', 'bootstrap'),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.once('exit', (code) => { process.exitCode = code ?? 1 })
