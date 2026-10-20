/** Offline provenance from the installed Profile and lockfile, never a recommendation catalog. */
import { readFile, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseDocument } from 'yaml'

export function classifyPluginSource(name, spec, locked, resolution, installed, target) {
  const base = { name, actualName: installed?.name ?? name, originalSpec: spec,
    resolvedVersion: installed?.version ?? null, locked: locked ?? null,
    integrity: resolution?.integrity ?? null, updateAllowed: false }
  if (typeof spec !== 'string') return { ...base, kind: 'unknown' }
  if (/^(?:link:|file:)/.test(spec) || /^[A-Za-z]:[\\/]|^\//.test(spec)) {
    return { ...base, kind: 'local', linkProtocol: spec.startsWith('link:') ? 'link' : spec.startsWith('file:') ? 'file' : 'path', target: target ?? null }
  }
  const git = /^(?:git(?:\+[^:]+)?:|github:|gitlab:|bitbucket:|ssh:)|\.git(?:#|$)/.test(spec)
  const shortGithub = /^[\w.-]+\/[\w.-]+(?:#.*)?$/.test(spec)
  if (git || shortGithub) {
    const repository = spec.split('#')[0]
    const commit = resolution?.commit ?? /(?:#|\/)([0-9a-f]{40})(?:$|[(&?])/.exec(locked ?? '')?.[1]
      ?? /(?:#|:|&)([0-9a-f]{40})(?:$|&)/.exec(spec)?.[1] ?? null
    const subdirectory = resolution?.path ?? /(?:#|&)(?:path:|path=)([^&]+)/.exec(spec)?.[1] ?? null
    return { ...base, kind: 'git', repository, commit, subdirectory,
      updateAllowed: Boolean(commit && installed?.name && installed?.version) }
  }
  if (/^https?:\/\//.test(spec)) {
    let repository = null
    try { const url = new URL(spec); const match = /^\/([^/]+\/[^/]+)\/releases\/download\//.exec(url.pathname)
      if (match) repository = `${url.origin}/${match[1]}` } catch { /* Retain unknown original address. */ }
    return { ...base, kind: 'archive', url: spec, repository,
      updateAllowed: Boolean(repository && base.integrity && installed?.name && installed?.version) }
  }
  if (/^(?:npm:)?(?:@[^/\s]+\/)?[\w.-]+@/.test(spec) || /^[~^]?\d+\.\d+\.\d+(?:[-+].*)?$/.test(spec)) {
    return { ...base, kind: 'npm', updateAllowed: Boolean(base.integrity && installed?.name && installed?.version) }
  }
  // Tags, unrecognized transports and missing evidence remain installed but cannot be replaced automatically.
  return { ...base, kind: 'unknown' }
}

export async function capturePluginSources(profile, excluded = []) {
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  let lock = {}
  try {
    const document = parseDocument(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'), { uniqueKeys: true })
    if (document.errors.length || document.warnings.length) throw new Error('Unreadable plugin lockfile; provenance migration stopped.')
    lock = document.toJS()
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const result = []
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (excluded.includes(name)) continue
      const declaration = lock.importers?.['.']?.[section]?.[name], locked = declaration?.version
      let installed, target
      try { const directory = join(profile, 'node_modules', name); target = await realpath(directory)
        installed = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) } catch { /* Record absence; never guess from catalog. */ }
      const versionKey = typeof locked === 'string' ? locked.split('(')[0] : ''
      const resolution = lock.packages?.[`${installed?.name ?? name}@${versionKey}`]?.resolution
        ?? lock.packages?.[versionKey]?.resolution ?? lock.packages?.[`${name}@${spec}`]?.resolution
      const localTarget = /^(?:link:|file:)/.test(spec) ? resolve(profile, spec.slice(spec.indexOf(':') + 1)) : target
      result.push({ ...classifyPluginSource(name, spec, locked, resolution, installed, target ?? localTarget), section })
    }
  }
  return result.sort((a, b) => `${a.name}:${a.section}`.localeCompare(`${b.name}:${b.section}`, 'en'))
}

/** pnpm may change physical staging locations, but it must preserve the installed source and resolved content. */
export function assertPluginSourcesPreserved(before, after) {
  for (const prior of before) {
    const current = after.find(item => item.name === prior.name && item.section === prior.section)
    if (!current) throw new Error(`Installed plugin disappeared during Profile migration: ${prior.name}`)
    for (const key of ['kind', 'actualName', 'resolvedVersion', 'integrity', 'repository', 'commit', 'subdirectory', 'url']) {
      if (prior[key] !== current[key]) throw new Error(`Plugin provenance changed (${key}): ${prior.name}`)
    }
    if (prior.kind === 'local') {
      if (prior.linkProtocol !== current.linkProtocol || prior.target !== current.target) throw new Error(`Local plugin link changed: ${prior.name}`)
    } else if (prior.originalSpec !== current.originalSpec || prior.locked !== current.locked) {
      throw new Error(`Plugin installation source changed: ${prior.name}`)
    }
  }
}
