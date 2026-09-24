/** Isolated Windows controller; the public client never receives the loopback token. */
import { createHash, randomBytes } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

export interface FlyRuntimeStatus { supported: boolean; installed: boolean; running: boolean; installing: boolean; message: string }
export interface FlyRequest { path: string; body?: JsonValue }
const routes = /^(?:state|settings|control|trade-filters|events(?:\?after=\d+)?|statistics(?:\?[^#]*)?|analytics(?:\?[^#]*)?|learning(?:\?[^#]*)?|oracle|report|models|models\/test|jev\/test|layout|layout\/reset|environment\/(?:prepare|config)|homes|homes\/restore|asset\/(?:default|[a-zA-Z0-9]+)\/(?:home\.glb|preview\.png))$/
const source = join(dirname(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-quantskills-session/package.json')), 'fly-runtime')
const exists = (path: string) => access(path).then(() => true, () => false)

export class FlyRuntime {
  private child: ChildProcessWithoutNullStreams | undefined
  private bridge: Server | undefined
  private port: number | undefined
  private starting: Promise<void> | undefined
  private installing = false
  private message = '首次使用需要准备果蝇运行环境。'
  private readonly lifetime = new AbortController()
  private readonly token = randomBytes(32).toString('hex')
  readonly python: string

  constructor(readonly root: string, private readonly callback: (path: string, body: unknown, signal: AbortSignal) => Promise<JsonValue>) {
    this.python = join(root, 'controller', 'python.exe')
  }

  async status(): Promise<FlyRuntimeStatus> {
    return { supported: process.platform === 'win32', installed: await exists(join(this.root, 'controller', '.ready')),
      running: this.port !== undefined, installing: this.installing, message: this.message }
  }

  async resume(): Promise<void> {
    if (process.platform === 'win32' && await exists(join(this.root, 'controller', '.ready'))) await this.start()
  }

  async install(input?: { blenderPath?: string }): Promise<FlyRuntimeStatus> {
    if (process.platform !== 'win32') throw new Error('果蝇首版支持 Windows。')
    if (input?.blenderPath && input.blenderPath.length > 1000) throw new Error('Blender 路径过长。')
    if (!this.installing) {
      this.installing = true; this.message = '正在准备果蝇控制器与神经环境…'
      void (async () => {
        if (!await exists(join(this.root, 'controller', '.ready'))) await this.prepare()
        else await this.start()
        if (input?.blenderPath?.trim()) await this.request({ path: 'environment/config', body: { blender_path: input.blenderPath.trim() } })
        await this.request({ path: 'environment/prepare', body: {} })
        while (!this.lifetime.signal.aborted) {
          const state = await this.request({ path: 'state' }) as { environment?: {
            brain_ready?: boolean; blender_ready?: boolean; progress?: { status?: string; stage?: string; message?: string }
          } }
          const environment = state.environment
          if (environment?.brain_ready && environment.blender_ready) { this.message = '神经环境与 Blender 已就绪。'; return }
          if (environment?.progress?.status === 'error') throw new Error(environment.progress.message || '神经环境准备失败')
          if (environment?.progress?.status === 'running') this.message = `正在准备${environment.progress.stage || '神经环境'}…`
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      })().catch(error => { if (!this.lifetime.signal.aborted) this.message = `环境准备失败：${error instanceof Error ? error.message : '请检查网络后重试'}` })
        .finally(() => { this.installing = false })
    }
    return this.status()
  }

  private async process(argv: string[]): Promise<void> {
    this.lifetime.signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      const child = spawn(argv[0]!, argv.slice(1), { windowsHide: true, shell: false, stdio: 'ignore', signal: this.lifetime.signal })
      child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('依赖准备失败')))
    })
  }

  private async prepare(): Promise<void> {
    await mkdir(join(this.root, 'controller'), { recursive: true })
    const manifest = JSON.parse(await readFile(join(source, 'fly', 'dependencies.json'), 'utf8')) as { python: { url: string; sha256: string } }
    const archive = join(this.root, 'python.zip')
    let data = await readFile(archive).catch(() => undefined)
    if (!data || createHash('sha256').update(data).digest('hex') !== manifest.python.sha256) {
      const response = await fetch(manifest.python.url, { signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(120000)]) })
      if (!response.ok) throw new Error('Python 下载失败')
      data = Buffer.from(await response.arrayBuffer())
      if (createHash('sha256').update(data).digest('hex') !== manifest.python.sha256) throw new Error('Python 校验失败')
      await writeFile(archive, data)
    }
    const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'"
    const script = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(join(this.root, 'controller'))} -Force`
    await this.process(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')])
    await this.process([this.python, '-X', 'utf8', '-B', join(source, 'bootstrap.py')])
    await writeFile(join(this.root, 'controller', '.ready'), '1')
    await this.start()
  }

  private start(): Promise<void> {
    if (this.port) return Promise.resolve()
    return this.starting ??= this.open().finally(() => { this.starting = undefined })
  }

  private async open(): Promise<void> {
    this.lifetime.signal.throwIfAborted()
    if (!await exists(join(this.root, 'controller', '.ready'))) throw new Error('请先准备果蝇运行环境。')
    const server = createServer(async (request, response) => {
      if (request.method !== 'POST' || request.headers.authorization !== `Bearer ${this.token}`) { response.writeHead(403).end(); return }
      try {
        let raw = ''
        for await (const chunk of request) { raw += String(chunk); if (raw.length > 256000) throw new Error('请求过大') }
        const result = await this.callback((request.url ?? '').slice(1), JSON.parse(raw), this.lifetime.signal)
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result))
      } catch (error) {
        const detail = error as { source?: string; code?: string; retryable?: boolean; retryAfterSeconds?: number }
        response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 400) : '宿主请求失败',
          ...(detail.source === 'competition' || detail.source === 'pandadata' ? { source: detail.source, code: detail.code, retryable: detail.retryable, retry_after: detail.retryAfterSeconds } : {}) }))
      }
    })
    this.bridge = server
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('本地桥接未就绪')
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SYSTEMROOT|WINDIR|PATH|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA)$/i.test(key)))
    const child = spawn(this.python, ['-u', '-X', 'utf8', '-B', join(source, 'server.py'), this.root], { windowsHide: true, shell: false,
      env: { ...env, PYTHONUTF8: '1', QUANTSTUDIO_FLY_TOKEN: this.token, QUANTSTUDIO_FLY_BRIDGE: `http://127.0.0.1:${address.port}` } })
    this.child = child
    child.stdin.on('error', () => { /* A concurrently exiting controller may close stdin first. */ })
    child.stderr.on('data', () => { /* Runtime failures are shown without paths, keys or model payloads. */ })
    child.on('error', () => { this.port = undefined; this.message = '果蝇进程启动失败，请重新准备运行环境。' })
    child.once('exit', () => { this.port = undefined; this.child = undefined; server.close(); if (!this.lifetime.signal.aborted) this.message = '果蝇进程已退出，重新打开可恢复记忆；交易建议保持停止。' })
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('果蝇控制器启动超时')) }, 30000)
      let output = ''
      child.stdout.on('data', chunk => {
        output += String(chunk)
        if (!output.includes('\n')) return
        try {
          const ready = JSON.parse(output.split('\n')[0]!) as { port: number }
          if (!Number.isInteger(ready.port) || ready.port < 1 || ready.port > 65535) throw new Error('invalid port')
          this.port = ready.port; clearTimeout(timer); resolve()
        } catch { clearTimeout(timer); child.kill(); reject(new Error('果蝇启动结果无效')) }
      })
      child.once('error', () => { clearTimeout(timer); reject(new Error('果蝇启动失败')) })
      child.once('exit', () => { clearTimeout(timer); reject(new Error('果蝇已退出')) })
    }).catch(error => { server.close(); throw error })
    this.message = '果蝇后台已连接。'
  }

  async request(input: FlyRequest): Promise<JsonValue> {
    if (!routes.test(input.path) || JSON.stringify(input).length > 240000) throw new Error('果蝇请求无效。')
    await this.start()
    const response = await fetch(`http://127.0.0.1:${this.port}`, { method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      signal: AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(130000)]) })
    const result = await response.json() as { ok: boolean; data: JsonValue; error?: string }
    if (!result.ok) throw new Error(result.error ?? '果蝇请求失败')
    return result.data
  }

  dispose(): Promise<void> {
    this.lifetime.abort(); this.bridge?.close()
    const child = this.child
    this.port = undefined
    if (!child || child.exitCode !== null) return Promise.resolve()
    return new Promise(resolve => {
      const timer = setTimeout(() => child.kill(), 45000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
      child.stdin.end('\n')
    })
  }
}
