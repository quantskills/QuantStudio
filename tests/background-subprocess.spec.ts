import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'

it('collects background CLI output and cancels its process tree without opening Windows consoles', async () => {
  const spawn = vi.spyOn(childProcess, 'spawn'), spawnSync = vi.spyOn(childProcess, 'spawnSync')
  syncBuiltinESMExports()
  const ctx = new Context()
  try {
    await ctx.plugin(LocalSubprocessRuntime)
    const handle = ctx.subprocess.spawn({ argv: [process.execPath, '-e', 'console.log("ready"); setInterval(() => {}, 1000)'],
      cwd: process.cwd(), signal: AbortSignal.timeout(10_000), graceMs: 100,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 1024 } } })
    try {
      await vi.waitFor(() => expect(handle.collected.stdout?.readFrom(0)?.text).toContain('ready'))
      expect(vi.mocked(spawn).mock.calls.at(-1)?.[2]).toMatchObject({ windowsHide: true })
    } finally {
      handle.terminate()
      await handle.waitForExit(AbortSignal.timeout(5000))
    }
    if (process.platform === 'win32') {
      const kills = vi.mocked(spawnSync).mock.calls.filter(call => call[0] === 'taskkill')
      expect(kills.length).toBeGreaterThan(0)
      for (const call of kills) expect(call[2]).toMatchObject({ windowsHide: true })
    }
  } finally { await ctx.fiber.dispose(); vi.restoreAllMocks(); syncBuiltinESMExports() }
})
