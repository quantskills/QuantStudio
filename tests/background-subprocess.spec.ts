import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import childProcess from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'

it('collects background CLI output and cancels its process tree without opening Windows consoles', async () => {
  const spawn = vi.spyOn(childProcess, 'spawn')
  syncBuiltinESMExports()
  const ctx = new Context()
  try {
    await ctx.plugin(LocalSubprocessRuntime)
    const script = `const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});console.log(JSON.stringify({parent:process.pid,child:child.pid}));setInterval(()=>{},1000)`
    const handle = ctx.subprocess.spawn({ argv: [process.execPath, '-e', script],
      cwd: process.cwd(), signal: AbortSignal.timeout(10_000), graceMs: 100,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 1024 } } })
    let ids: { parent: number; child: number } | undefined
    let outcome = 'running'
    void handle.done.then(result => { outcome = JSON.stringify(result) }, () => { outcome = 'provider rejected launch' })
    try {
      await vi.waitFor(() => {
        const output = handle.collected.stdout?.readFrom(0)?.text ?? ''
        // A real child may take longer than Vitest's default 1 s under CI load.
        // Wait for its complete line before parsing a possibly partial pipe chunk.
        if (!output.endsWith('\n')) {
          const stderr = handle.collected.stderr?.readFrom(0)?.text ?? ''
          // This fixed fixture has no user input or credentials; never log spawn options/env.
          throw new Error(`Native fixture not ready (${outcome}); stderr=${stderr.slice(-1024)}`)
        }
        ids = JSON.parse(output)
        expect(ids?.child).toBeGreaterThan(0)
      }, { timeout: 5000 })
      // windowsHide is Windows-only; assert the scalar so a failure cannot dump env.
      if (process.platform === 'win32') expect(vi.mocked(spawn).mock.calls.at(-1)?.[2]?.windowsHide).toBe(true)
    } finally {
      handle.terminate()
      await handle.waitForExit(AbortSignal.timeout(5000))
    }
    // Assert the native provider's result, independent of taskkill vs Job Object implementation.
    await vi.waitFor(async () => {
      for (const pid of [ids!.parent, ids!.child]) {
        let alive = true
        try { process.kill(pid, 0) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; else throw error }
        if (alive && process.platform === 'linux') {
          try { alive = !/\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8')) } catch { alive = false }
        }
        expect(alive).toBe(false)
      }
    }, { timeout: 5000 })
  } finally { await ctx.fiber.dispose(); vi.restoreAllMocks(); syncBuiltinESMExports() }
}, 20_000)
