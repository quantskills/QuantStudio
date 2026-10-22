import { readFile, realpath, mkdir, readdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateBudgetLimits } from './budget.mjs'

export const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export function within(parent, child) {
  const path = relative(parent, child)
  return path !== '' && !path.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && path !== '..' && !isAbsolute(path)
}
export async function readConfig() {
  const file = process.env.QS_BENCH_CONFIG
  if (!file) throw new Error('Set QS_BENCH_CONFIG to an explicit local benchmark configuration')
  const config = JSON.parse(await readFile(resolve(file), 'utf8'))
  if (config.schema !== 2 || !config.workspace || !config.arms || !config.budget) throw new Error('Invalid benchmark configuration')
  const workspace = resolve(dirname(resolve(file)), config.workspace)
  if (workspace === project || !within(workspace, join(workspace, 'runs'))) throw new Error('Invalid isolated workspace')
  await mkdir(workspace, { recursive: true })
  config.workspace = await realpath(workspace)
  const marker = join(config.workspace, '.qs-benchmark-workspace.json')
  try {
    if (JSON.parse(await readFile(marker, 'utf8')).schema !== 1) throw new Error('Unknown workspace marker')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if ((await readdir(config.workspace)).length) throw new Error('Refusing an existing unowned workspace')
    await writeFile(marker, JSON.stringify({ schema: 1, purpose: 'isolated-qs-benchmark' }), { flag: 'wx' })
  }
  config.arms = await Promise.all(config.arms.map(async arm => ({ ...arm, path: await realpath(resolve(dirname(resolve(file)), arm.path)) })))
  validateBudgetLimits(config.budget)
  if (config.budget.stageLimitCny === undefined) throw new Error('Explicit additional-stage budget required')
  return config
}
