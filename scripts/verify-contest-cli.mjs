/** Explicit online smoke: installs the official CLI in an isolated temp directory; never logs in or trades. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { OfficialContestCli } from '../packages/quantskills-session/lib/types/contest-cli.js'

const root = await mkdtemp(join(tmpdir(), 'quantstudio-contest-cli-'))
const ctx = new Context()
try {
  await ctx.plugin(LocalSubprocessRuntime)
  const cli = new OfficialContestCli(() => ctx.subprocess, join(root, 'auth'))
  const runtime = join(root, 'runtime')
  const signal = AbortSignal.timeout(300_000)
  const installed = await cli.install(runtime, signal)
  const session = await cli.run(runtime, ['whoami'], signal)
  if (session.data?.loggedIn !== false) throw new Error('Isolated CLI unexpectedly inherited an account')
  const update = await cli.run(runtime, ['update', '--check'], signal)
  console.log(JSON.stringify({ cliVersion: installed.version, officialRules: installed.rules.includes('name: panda-trading'),
    accountInherited: false, updateCheck: Boolean(update.data?.latestVersion), traded: false }))
} finally {
  await ctx.fiber.dispose()
  const child = relative(tmpdir(), root)
  if (!child.startsWith('quantstudio-contest-cli-') || child.includes('..') || isAbsolute(child)) throw new Error('Unsafe temporary cleanup path')
  await rm(root, { recursive: true, force: true })
}
