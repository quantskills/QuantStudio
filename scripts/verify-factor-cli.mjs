/** Explicit online installation check. Uses a temporary account directory and never runs a paid analysis. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { OfficialFactorRuntime } from '../packages/quantskills-session/lib/types/factor-contest-cli.js'

const root = await mkdtemp(join(tmpdir(), 'quantstudio-factor-cli-'))
const ctx = new Context()
try {
  await ctx.plugin(LocalSubprocessRuntime)
  const cli = new OfficialFactorRuntime(() => ctx.subprocess, join(root, 'auth'))
  const signal = AbortSignal.timeout(300_000), runtime = join(root, 'runtime')
  const latest = await cli.latest(signal)
  const installed = await cli.install(runtime, latest, signal)
  try {
    await cli.cli(runtime, ['balance'], signal)
    throw new Error('Isolated factor CLI unexpectedly inherited credentials')
  } catch (error) {
    if (!['LOGIN_REQUIRED', 'CONFIG_ERROR'].includes(error.code)) throw error
  }
  console.log(JSON.stringify({ cliVersion: installed, accountInherited: false, paidAnalysisStarted: false }))
} finally {
  await ctx.fiber.dispose()
  const child = relative(tmpdir(), root)
  if (!child.startsWith('quantstudio-factor-cli-') || child.includes('..') || isAbsolute(child)) throw new Error('Unsafe temporary cleanup path')
  await rm(root, { recursive: true, force: true })
}
