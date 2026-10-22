import { afterEach, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const cli = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))
const runner = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-subprocess-local/runner'))

function run(args: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'qs-entrypoint-'))
  roots.push(root)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SystemRoot|ComSpec|TEMP|TMP|PATHEXT)$/i.test(key)))
  for (const key of ['DSH_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    env[key] = join(root, key.toLowerCase())
    mkdirSync(env[key]!, { recursive: true })
  }
  return spawnSync(process.execPath, args, { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 10_000 })
}

it('executes the published CLI entry and reports the fixed runtime version', () => {
  const result = run([cli, '--version'])
  expect(result.status).toBe(0)
  expect(result.stdout.trim()).toBe('0.2.1-rc.2')
}, 15_000)

it('executes the private runner entry and rejects missing launch authority', () => {
  const result = run([runner, '--', process.execPath, '-e', 'console.log("must-not-run")'])
  expect(result.status).toBe(127)
  expect(result.stdout).toBe('')
}, 15_000)

it('keeps importing the CLI and runner inert', () => {
  // Imported modules must not interpret the host argv or consume a runner selector.
  const script = `process.env.DSH_SUBPROCESS_RUNNER='fixture-marker';
    await import(${JSON.stringify(import.meta.resolve('@deepseek-ai/dsh/lib/bin.js'))});
    await import(${JSON.stringify(import.meta.resolve('@deepseek-ai/dsh-subprocess-local/runner'))});
    console.log(JSON.stringify({selector:process.env.DSH_SUBPROCESS_RUNNER,exitCode:process.exitCode??0}));`
  const result = run(['--input-type=module', '-e', script])
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ selector: 'fixture-marker', exitCode: 0 })
}, 15_000)
