/** QuantStudio-owned profile paths and recoverable profile replacement. */
import { existsSync, readFileSync } from 'node:fs'
import { cp, lstat, mkdir, rename, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export function resolveDshHome(environment = process.env, userHome = homedir()) {
  if (environment.DSH_HOME) return resolve(environment.DSH_HOME)
  const isolated = join(userHome, '.dsh-quantstudio')
  if (existsSync(isolated)) return isolated
  const legacy = join(userHome, '.dsh')
  // Reuse data only from an identifiable QuantStudio installation, never plain DSH.
  try {
    const config = JSON.parse(readFileSync(join(legacy, 'quantskills/application/bootstrap/config.json'), 'utf8'))
    if (config.schemaVersion === 1 && typeof config.pnpmCli === 'string' && typeof config.nodeExecutable === 'string') return legacy
  } catch { /* New installs have no legacy QuantStudio launcher. */ }
  return isolated
}

export function resolveProfile(environment = process.env) {
  const profile = environment.QUANTSKILLS_PROFILE || 'quantstudio'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(profile)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(profile)) {
    throw new Error('QUANTSKILLS_PROFILE must be a simple profile name (letters, numbers, _ or -).')
  }
  return profile
}

export async function prepareProfileStage(home, profile) {
  const profiles = resolve(home, 'profiles')
  const target = join(profiles, resolveProfile({ QUANTSKILLS_PROFILE: profile }))
  await mkdir(profiles, { recursive: true })
  let existed = false
  try {
    const info = await lstat(target)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('QuantStudio cannot replace a linked or non-directory profile.')
    existed = true
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const stage = join(profiles, `.qs-stage-${profile}-${randomUUID()}`)
  if (existed) {
    await cp(target, stage, { recursive: true, dereference: false, verbatimSymlinks: true,
      filter: source => relative(target, source).split(/[\\/]/)[0] !== 'node_modules' })
  } else await mkdir(stage)
  return { home: resolve(home), profile, stage, existed }
}

/** Delete only a verified staging directory belonging to this transaction. */
export async function discardProfileStage(transaction) {
  const profiles = resolve(transaction.home, 'profiles')
  const stage = resolve(transaction.stage)
  if (relative(profiles, stage) !== basename(stage) || !basename(stage).startsWith(`.qs-stage-${transaction.profile}-`)) {
    throw new Error('Refused profile staging path escape.')
  }
  await rm(stage, { recursive: true, force: true })
}

export async function activateProfileStage(transaction) {
  const { home, profile, stage, existed } = transaction
  const target = resolve(home, 'profiles', profile)
  const backup = existed ? join(home, 'profiles', '.qs-backups', `${profile}-${randomUUID()}`) : null
  if (backup) { await mkdir(join(home, 'profiles', '.qs-backups'), { recursive: true }); await rename(target, backup) }
  try { await rename(stage, target) }
  catch (error) { if (backup) await rename(backup, target); throw error }
  return { home, profile, backup }
}

export async function restoreProfileTransaction(transaction) {
  const profile = resolveProfile({ QUANTSKILLS_PROFILE: transaction.profile })
  const profiles = resolve(transaction.home, 'profiles')
  const target = resolve(profiles, profile)
  const backup = transaction.backup === null ? null : resolve(transaction.backup)
  if (relative(profiles, target) !== profile || (backup && (
    relative(join(profiles, '.qs-backups'), backup) !== basename(backup)
    || !basename(backup).startsWith(`${profile}-`) || !existsSync(backup)))) {
    throw new Error('Refused invalid profile restore paths.')
  }
  // target is an exact validated profile directory, never the home or workspace.
  await rm(target, { recursive: true, force: true })
  if (backup) await rename(backup, target)
}
