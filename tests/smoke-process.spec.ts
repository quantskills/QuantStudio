import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { expect, it, vi } from 'vitest'
import { stopSmokeProcess } from '../scripts/smoke-process.mjs'

it.skipIf(process.platform === 'win32')('terminates the isolated launcher group including a descendant ignoring TERM', async () => {
  const script = `const c=require('node:child_process').spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','inherit']});c.stdout.once('data',()=>console.log(c.pid));setInterval(()=>{},1000)`
  const child = spawn(process.execPath, ['-e', script], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', data => { output += data })
  try {
    await vi.waitFor(() => {
      expect(output.endsWith('\n')).toBe(true)
      expect(Number(output.trim())).toBeGreaterThan(0)
    }, { timeout: 5000 })
    const descendant = Number(output.trim())
    await stopSmokeProcess(child)
    await vi.waitFor(async () => {
      let alive = true
      try { process.kill(descendant, 0) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; else throw error }
      if (alive && process.platform === 'linux') {
        try { alive = !/\) Z /.test(await readFile(`/proc/${descendant}/stat`, 'utf8')) } catch { alive = false }
      }
      expect(alive).toBe(false)
    }, { timeout: 5000 })
  } finally { await stopSmokeProcess(child) }
}, 20_000)
