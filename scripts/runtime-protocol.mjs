/** Launcher protocol v2. Imported by installation, activation and the child Host. */
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, mkdir, lstat, readdir, realpath, rm, open } from 'node:fs/promises'
import { basename, dirname, join, resolve, relative, isAbsolute } from 'node:path'

export const BOOTSTRAP_PROTOCOL = 2
export const TARGET_DSH = '0.2.1-rc.2'
export const REQUIRED_SERVICES = ['agents', 'sessions', 'sessionPersistence', 'quantSkillsHost', 'quantSkillsSessions']
export const migrationPath = home => join(home, 'quantskills/application/migration.json')
export const BOOTSTRAP_FILES = ['application-bootstrap.mjs', 'profile-state.mjs', 'runtime-protocol.mjs']

/** A version is content-addressed, immutable, and fully checked before importing code. */
export async function verifyBootstrapVersion(directory, version) {
  if (!/^[a-f0-9]{64}$/.test(version)) throw new Error('Invalid launcher version.')
  const contents = []
  for (const file of [...BOOTSTRAP_FILES, 'config.json']) {
    const path = join(directory, file), info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Linked or invalid launcher file.')
    contents.push(await readFile(path, 'utf8'))
  }
  const config = JSON.parse(contents.pop())
  if (config.protocol !== BOOTSTRAP_PROTOCOL || artifactDigest(JSON.stringify([contents, config])) !== version) {
    throw new Error('Launcher integrity check failed; startup stopped.')
  }
  return config
}

export async function publishBootstrapVersion(base, source, config) {
  await mkdir(join(base, 'versions'), { recursive: true, mode: 0o700 })
  // An interrupted install leaves this lock deliberately: never guess whether its owner is alive.
  const lockPath = join(base, 'install.lock')
  const lock = await open(lockPath, 'wx', 0o600)
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }))
    const contents = await Promise.all(BOOTSTRAP_FILES.map(file => readFile(join(source, file), 'utf8')))
    const version = artifactDigest(JSON.stringify([contents, config])), target = join(base, 'versions', version)
    try { await verifyBootstrapVersion(target, version) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      // An existing incomplete directory must not be repaired in place.
      try { await lstat(target); throw new Error('Incomplete immutable launcher directory; repair required.') }
      catch (missing) { if (missing.code !== 'ENOENT') throw missing }
      const stage = join(base, 'versions', `.prepare-${randomUUID()}`)
      await mkdir(stage, { mode: 0o700 })
      for (let i = 0; i < BOOTSTRAP_FILES.length; i++) await writeFile(join(stage, BOOTSTRAP_FILES[i]), contents[i], { flag: 'wx', mode: 0o600 })
      await writeAtomic(join(stage, 'config.json'), config)
      await verifyBootstrapVersion(stage, version)
      await rename(stage, target)
    }
    await writeAtomic(join(base, 'current.json'), { protocol: BOOTSTRAP_PROTOCOL, version })
    return version
  } finally { await lock.close(); await rm(lockPath) }
}

export async function writeAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  const file = await open(temporary, 'wx', 0o600)
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync() }
  finally { await file.close() }
  await rename(temporary, path)
}

export function parseMigration(value) {
  if (!value || value.schemaVersion !== 1 || !['prepared', 'migrating', 'validated', 'failed'].includes(value.phase)
    || typeof value.sourceRuntime !== 'string' || typeof value.targetRuntime !== 'string'
    || typeof value.generation !== 'string' || !value.generation || typeof value.backupId !== 'string' || !value.backupId
    || !['yes', 'no', 'unknown'].includes(value.oldReadable)) throw new Error('Unsupported or corrupt migration record; startup stopped.')
  return value
}

export async function readMigration(home) {
  try { return parseMigration(JSON.parse(await readFile(migrationPath(home), 'utf8'))) }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
}

export async function assertMigrationReady(home, runtime) {
  const migration = await readMigration(home)
  if (!migration) {
    if (runtime === TARGET_DSH) throw new Error('Migration validation is required before starting the candidate core.')
    return
  }
  if (migration.phase !== 'validated') throw new Error(`Migration ${migration.phase}; automatic startup and rollback stopped.`)
  if (migration.targetRuntime !== runtime && (migration.sourceRuntime !== runtime || migration.oldReadable !== 'yes')) {
    throw new Error('This data generation is not verified readable by the selected core; rollback stopped.')
  }
  return migration
}

export async function assertRollbackSafe(home) {
  const migration = await readMigration(home)
  if (migration && (migration.phase !== 'validated' || migration.oldReadable !== 'yes')) {
    throw new Error('Data compatibility is unknown or incompatible; automatic rollback stopped. Preserve new data before restoring a snapshot.')
  }
}

export async function assertBootstrapInstalled(home, environment) {
  const base = join(home, 'quantskills/application/bootstrap')
  let pointer
  try { pointer = JSON.parse(await readFile(join(base, 'current.json'), 'utf8')) } catch { /* Fail closed below. */ }
  if (pointer?.protocol !== BOOTSTRAP_PROTOCOL || !/^[a-f0-9]{64}$/.test(pointer.version ?? '')
    || environment.QUANTSKILLS_BOOTSTRAP_PROTOCOL !== String(BOOTSTRAP_PROTOCOL)) {
    throw new Error('Upgrade the QuantStudio launcher first, then start through pnpm run web. No Profile or data files were changed.')
  }
  await verifyBootstrapVersion(join(base, 'versions', pointer.version), pointer.version)
}

export function validateReady(message, expected) {
  if (!message || message.type !== 'quantskills:ready' || message.protocol !== BOOTSTRAP_PROTOCOL) return false
  for (const key of ['nonce', 'commit', 'runtime', 'generation', 'artifact']) {
    if (typeof expected[key] !== 'string' || message[key] !== expected[key]) throw new Error(`Candidate readiness mismatch: ${key}`)
  }
  if (message.migrationPhase !== 'validated' || !REQUIRED_SERVICES.every(name => message.services?.[name] === true)) {
    throw new Error('Candidate services or migration are not ready.')
  }
  return true
}

export async function waitForReady(child, expected, timeoutMs) {
  await new Promise((accept, reject) => {
    const finish = error => { clearTimeout(timer); child.off('message', message); child.off('exit', exit); child.off('error', finish); error ? reject(error) : accept() }
    const message = value => { try { if (validateReady(value, expected)) finish() } catch (error) { finish(error) } }
    const exit = () => finish(new Error('Candidate exited before readiness handshake.'))
    const timer = setTimeout(() => finish(new Error('Candidate readiness handshake timed out.')), timeoutMs)
    child.on('message', message); child.once('exit', exit); child.once('error', finish)
    if (child.exitCode !== null || child.signalCode !== null) exit()
  })
}

/** Inspect a runnable fixture before any service constructor can replay deletion or automation. */
export async function assertIsolatedFixture(home, allowedRoot, runtime = undefined, generated = undefined) {
  const root = await realpath(allowedRoot)
  const lexicalRoot = resolve(allowedRoot)
  const within = child => child === '' || (child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(child))
  // macOS /var and /tmp aliases (or a Windows test junction) can name the same
  // isolated root. Only translate that verified root prefix; nested links are
  // still checked against their real targets by walk().
  const inside = path => {
    const absolute = resolve(path), lexical = relative(lexicalRoot, absolute)
    const canonical = within(lexical) ? resolve(root, lexical) : absolute
    return within(relative(root, canonical))
  }
  if (!inside(await realpath(home))) throw new Error('Fixture home is outside the isolated root.')
  // Only the fresh smoke harness can certify an auth record created after its
  // empty-home preflight. Never admit a copied vault merely because it is well formed.
  const vaultPath = join(home, '.credentials.yaml')
  const fixtureRefs = new Set()
  try {
    const info = await lstat(vaultPath)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid fixture credential store.')
    const { parseDocument } = await import('yaml')
    const document = parseDocument(await readFile(vaultPath, 'utf8'), { uniqueKeys: true })
    if (document.errors.length || document.warnings.length) throw new Error('Invalid fixture credential store.')
    const vault = document.toJS(), records = vault?.records, record = records?.['client-connection/browser-session']
    const only = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every(key => keys.includes(key))
    if (!only(vault, ['version', 'records', 'refs']) || vault.version !== 1
      || !only(records, ['client-connection/browser-session'])
      || !only(record, ['kind', 'payload']) || record.kind !== 'grant'
      || !only(record.payload, ['version', 'secret']) || record.payload.version !== 1
      || typeof record.payload.secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(record.payload.secret)
      || !generated?.browserSecretHash || artifactDigest(record.payload.secret) !== generated.browserSecretHash
      || !only(vault.refs ?? {}, Object.keys(vault.refs ?? {}))) throw new Error('Fixture contains unverified credentials.')
    for (const [ref, value] of Object.entries(vault.refs ?? {})) {
      if (!/^QS_MODEL_[A-F0-9_]{36}$/.test(ref) || value !== 'local-no-auth') throw new Error('Fixture contains non-test credentials.')
      fixtureRefs.add(ref)
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  // Only launcher configuration created for this exact candidate may reference its code/runtime.
  const trustedConfigs = new Set()
  const trustedPackages = new Map()
  if (runtime) {
    const base = join(home, 'quantskills/application/bootstrap')
    const pointer = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'))
    if (pointer.protocol !== BOOTSTRAP_PROTOCOL) throw new Error('Untrusted fixture launcher.')
    const directory = join(base, 'versions', pointer.version)
    const config = await verifyBootstrapVersion(directory, pointer.version)
    if (await realpath(config.fallbackSourceRoot) !== await realpath(runtime.source)
      || await realpath(config.nodeExecutable) !== await realpath(process.execPath)
      || await realpath(config.pnpmCli) !== await realpath(runtime.pnpm)) throw new Error('Unexpected fixture runtime paths.')
    if (JSON.stringify(JSON.parse(await readFile(join(base, 'config.json'), 'utf8'))) !== JSON.stringify(config)) throw new Error('Fixture launcher configurations disagree.')
    trustedConfigs.add(join(base, 'config.json')); trustedConfigs.add(join(directory, 'config.json'))
    const application = JSON.parse(await readFile(join(runtime.source, 'package.json'), 'utf8'))
    trustedPackages.set(application.name, await realpath(runtime.source))
    for (const name of Object.keys(application.dependencies ?? {})) {
      const directory = await realpath(join(runtime.source, 'node_modules', name))
      const installed = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
      if (installed.name === name) trustedPackages.set(name, directory)
    }
    // pnpm may materialize an injected workspace copy in node_modules; the Profile links the actual workspace build.
    for (const entry of await readdir(join(runtime.source, 'packages'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const directory = await realpath(join(runtime.source, 'packages', entry.name))
      const local = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
      if (application.dependencies?.[local.name]?.startsWith('workspace:')) trustedPackages.set(local.name, directory)
    }
  }
  const inspect = (value, key = '', file = '', metadata = false) => {
    if (!metadata && typeof value === 'string' && /^(link:|file:)/.test(value)) {
      const target = resolve(dirname(file), value.slice(value.indexOf(':') + 1))
      const lockedCode = basename(file) === 'pnpm-lock.yaml' && ['specifier', 'version'].includes(key)
        && [...trustedPackages.values()].includes(target)
      if (!inside(target) && trustedPackages.get(key) !== target && !lockedCode) throw new Error(`Fixture dependency escapes isolated root (${basename(file)}:${key}).`)
    }
    if (typeof value === 'string' && /^(?:command|script|shell|executable)$/i.test(key) && value.trim()) {
      throw new Error('Runnable fixture contains an executable command.')
    }
    if (typeof value === 'string' && /^(?:cron|rrule|schedule)$/i.test(key) && value.trim()) {
      throw new Error('Runnable fixture contains an automatic task schedule.')
    }
    if (typeof value === 'string' && /(?:path|root|cwd|directory|workspace|target|file|command|args|script|home)/i.test(key)) {
      const codeEvidence = metadata && key === 'target' && [...trustedPackages.values()].includes(value)
      if (/^file:\/\//i.test(value) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)) throw new Error(`Unresolved fixture path in ${key}`)
      if ((isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) && !inside(value) && !codeEvidence) throw new Error(`Unsafe fixture path in ${key}`)
    } else if (Array.isArray(value)) value.forEach(item => inspect(item, key, file, metadata))
    else if (value && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) {
        const syntheticReference = field === 'apiKeyEnv' && fixtureRefs.has(item)
        if (/(?:api.?key|password|access.?token|refresh.?token|secret)/i.test(field) && item && item !== 'TEST_ONLY' && !syntheticReference) throw new Error('Fixture contains credentials.')
        inspect(item, field, file, metadata)
      }
    }
  }
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), info = await lstat(path)
      if (info.isSymbolicLink()) { if (!inside(await realpath(path))) throw new Error('Fixture link escapes isolated root.'); continue }
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      if (info.isDirectory()) { await walk(path); continue }
      if (path === vaultPath) continue // Strictly validated above, including all opaque ref values.
      if (/^\.env(?:\.|$)/.test(entry.name) && (await readFile(path, 'utf8')).trim()) throw new Error('Fixture contains environment configuration.')
      if (/\.ya?ml$/.test(entry.name)) {
        const { parseDocument } = await import('yaml')
        const doc = parseDocument(await readFile(path, 'utf8'), { uniqueKeys: true })
        if (doc.errors.length || doc.warnings.length) throw new Error('Unsupported fixture YAML or executable tag.')
        inspect(doc.toJS(), '', path)
      }
      if (/\.(?:json|jsonl)$/.test(entry.name) && !trustedConfigs.has(path)) {
        const source = await readFile(path, 'utf8')
        const values = entry.name.endsWith('.jsonl') ? source.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [JSON.parse(source)]
        values.forEach(value => inspect(value, '', path, entry.name === 'quantskills-plugin-sources.json'))
      }
    }
  }
  await walk(home)
}

export const artifactDigest = value => createHash('sha256').update(value).digest('hex')

/** Hash the actual application build and configuration, independently in parent and child. */
export async function candidateArtifact(root) {
  const entries = []
  async function visit(path) {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error('Candidate artifacts must not be symbolic links.')
    if (info.isDirectory()) {
      for (const item of (await readdir(path)).sort()) await visit(join(path, item))
    } else if (info.isFile()) entries.push([relative(root, path).replaceAll('\\', '/'), artifactDigest(await readFile(path))])
    else throw new Error('Unsupported candidate artifact.')
  }
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'lib', 'scripts', 'patches']) await visit(join(root, file))
  for (const name of (await readdir(join(root, 'packages'))).sort()) {
    const dir = join(root, 'packages', name)
    if (!(await lstat(dir)).isDirectory()) continue
    await visit(join(dir, 'package.json')); await visit(join(dir, 'lib'))
  }
  return artifactDigest(JSON.stringify(entries))
}
