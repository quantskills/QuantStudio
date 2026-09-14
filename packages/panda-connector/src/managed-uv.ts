/** Pinned, checksum-verified uv binary provisioning for managed PandaData Python. */

import { createHash, randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { unzipSync } from 'fflate'
import { extract } from 'tar'

const UV_VERSION = '0.12.5'
const UV_RELEASE_ROOT = `https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}`
const UV_ARCHIVE_LIMIT = 80 * 1024 * 1024

interface UvArchive {
  readonly name: string
  readonly sha256: string
  readonly kind: 'zip' | 'tar.gz'
}

/** Pinned uv download, verification, or extraction failure. */
export class ManagedUvError extends Error {
  override readonly name = 'ManagedUvError'
}

const UV_ARCHIVES: Readonly<Record<string, UvArchive>> = Object.freeze({
  'win32-x64': Object.freeze({
    name: 'uv-x86_64-pc-windows-msvc.zip',
    sha256: '4c4d49d8738847d9b71ba319e49a5688c93eac0fe6204b1df24e98528dddf39a',
    kind: 'zip',
  }),
  'win32-arm64': Object.freeze({
    name: 'uv-aarch64-pc-windows-msvc.zip',
    sha256: '724279317fee6e5fa8ad1908e4eba2bbe764ef1ece5b3f4597927b62b1fe562a',
    kind: 'zip',
  }),
  'darwin-x64': Object.freeze({
    name: 'uv-x86_64-apple-darwin.tar.gz',
    sha256: 'b3b2137477cf96c9686ebfb71524614cec780c673fd73e59bce099aef02e70e8',
    kind: 'tar.gz',
  }),
  'darwin-arm64': Object.freeze({
    name: 'uv-aarch64-apple-darwin.tar.gz',
    sha256: '5bb0e5fe008a773c3dbcb97ff79cd89e1241464fe9d2f986d52ad8f1b037bd62',
    kind: 'tar.gz',
  }),
  'linux-x64-gnu': Object.freeze({
    name: 'uv-x86_64-unknown-linux-gnu.tar.gz',
    sha256: '68a509da24b06b4223a1c0175fb5eb5bc79342b76cbeff0cfe51ac3f5b17b6b2',
    kind: 'tar.gz',
  }),
  'linux-arm64-gnu': Object.freeze({
    name: 'uv-aarch64-unknown-linux-gnu.tar.gz',
    sha256: '9bf43b4d1a07665bf64d4c4e710930b382321a785e0eb10aac07f46471f86a31',
    kind: 'tar.gz',
  }),
  'linux-x64-musl': Object.freeze({
    name: 'uv-x86_64-unknown-linux-musl.tar.gz',
    sha256: 'a4742988791c9aeae68c78150d6cba762062ad2a47e53738c2779d2b596bfcdb',
    kind: 'tar.gz',
  }),
  'linux-arm64-musl': Object.freeze({
    name: 'uv-aarch64-unknown-linux-musl.tar.gz',
    sha256: '8767a0e77f2cd45436401b1b42bf7e9ed5a4a91a74a5305d6fe93249d0f6dbc5',
    kind: 'tar.gz',
  }),
})

function platformKey(): string {
  if (process.platform !== 'linux') return `${process.platform}-${process.arch}`
  const report = process.report.getReport() as { header?: { glibcVersionRuntime?: string } }
  return `linux-${process.arch}-${report.header?.glibcVersionRuntime === undefined ? 'musl' : 'gnu'}`
}

async function boundedDownload(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { accept: 'application/octet-stream' }, signal })
  if (!response.ok || response.body === null) throw new ManagedUvError('uv download failed')
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > UV_ARCHIVE_LIMIT) {
    throw new ManagedUvError('uv archive exceeds the download limit')
  }
  const chunks: Uint8Array[] = []
  let bytes = 0
  const reader = response.body.getReader()
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > UV_ARCHIVE_LIMIT) throw new ManagedUvError('uv archive exceeds the download limit')
    chunks.push(chunk.value)
  }
  const output = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

async function executableAt(path: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    return info.isFile() && !info.isSymbolicLink()
  } catch {
    return false
  }
}

async function removeOwnedStage(managerRoot: string, stage: string): Promise<void> {
  const root = resolve(managerRoot)
  const target = resolve(stage)
  const child = relative(root, target)
  if (child === '' || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('panda-connector: refused to remove a uv staging path outside the runtime root')
  }
  await rm(target, { recursive: true, force: true })
}

/**
 * Install or reuse the pinned uv binary for this operating system and architecture.
 * @param managerRoot - connector-owned PandaData runtime root.
 * @param signal - download and extraction lifetime.
 * @returns absolute executable path without modifying PATH or shell profiles.
 */
export async function resolveManagedUv(managerRoot: string, signal: AbortSignal): Promise<string> {
  const key = platformKey()
  const archive = UV_ARCHIVES[key]
  if (archive === undefined) throw new ManagedUvError('uv has no pinned artifact for this platform')
  const executableName = process.platform === 'win32' ? 'uv.exe' : 'uv'
  const finalRoot = join(managerRoot, 'uv', UV_VERSION, key)
  const finalExecutable = join(finalRoot, executableName)
  if (await executableAt(finalExecutable)) return finalExecutable
  await mkdir(managerRoot, { recursive: true, mode: 0o700 })
  const stage = await mkdtemp(join(managerRoot, `.uv-stage-${randomUUID()}-`))
  try {
    const bytes = await boundedDownload(`${UV_RELEASE_ROOT}/${archive.name}`, signal)
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== archive.sha256) throw new ManagedUvError('uv archive checksum mismatch')
    const installRoot = join(stage, 'install')
    await mkdir(installRoot, { recursive: true, mode: 0o700 })
    if (archive.kind === 'zip') {
      const entries = unzipSync(bytes)
      const executable = Object.entries(entries).find(([path]) => basename(path) === executableName)
      if (executable === undefined) throw new ManagedUvError('uv archive has no executable')
      await writeFile(join(installRoot, executableName), executable[1], { flag: 'wx', mode: 0o700 })
    } else {
      const archivePath = join(stage, archive.name)
      await writeFile(archivePath, bytes, { flag: 'wx', mode: 0o600 })
      await extract({ file: archivePath, cwd: installRoot, strip: 1 })
    }
    const stagedExecutable = join(installRoot, executableName)
    if (!(await executableAt(stagedExecutable))) throw new ManagedUvError('uv archive has no regular executable')
    await chmod(stagedExecutable, 0o700)
    await mkdir(join(managerRoot, 'uv', UV_VERSION), { recursive: true, mode: 0o700 })
    try {
      await rename(installRoot, finalRoot)
    } catch (error: unknown) {
      if (!(await executableAt(finalExecutable))) throw error
    }
    return finalExecutable
  } catch (error: unknown) {
    if (error instanceof ManagedUvError) throw error
    throw new ManagedUvError('uv provisioning failed', { cause: error })
  } finally {
    await removeOwnedStage(managerRoot, stage)
  }
}
