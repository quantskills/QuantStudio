import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { retryHostRead } from './remote-read.ts'

interface NamespaceView {
  ns: string
  schema: unknown
  value: unknown
  base?: unknown
  user?: unknown
  revision: number
}

export interface PreferencesTransport {
  describe(): Promise<{ writable: boolean; namespaces: NamespaceView[] }>
  mutate(ns: string, ops: SettingsPathOpView[], revision: number): Promise<NamespaceView>
}

export interface PreferencesSnapshot<T> extends SettingsScopeSnapshot<T> {
  error?: string
}

/** QuantSkills preferences use authenticated Host capabilities, never the browser's hostname. */
export class QuantSkillsPreferences<T> {
  private snapshot: PreferencesSnapshot<T> = {
    status: 'loading', value: undefined, base: undefined, user: undefined,
    revision: undefined, writable: false, mode: 'host',
  }
  private readonly listeners = new Set<() => void>()
  private tail = Promise.resolve()
  private refresh: Promise<void> | undefined
  private generation = 0
  private disposed = false

  constructor(
    private readonly namespace: string,
    private readonly transport: PreferencesTransport,
    private readonly decode: (view: NamespaceView) => T | undefined,
  ) {}

  getSnapshot(): PreferencesSnapshot<T> { return this.snapshot }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Coalesce invalidations; reads and writes share a queue so old reads cannot undo new choices. */
  reload(): Promise<void> {
    if (this.refresh) return this.refresh
    const refresh = this.enqueue(async () => {
      try { await this.read() }
      catch { this.snapshot = { ...this.snapshot, status: 'unavailable', writable: false, error: '设置读取失败，请刷新页面重试。' } }
      this.publish()
    })
    this.refresh = refresh
    void refresh.finally(() => { if (this.refresh === refresh) this.refresh = undefined })
    return refresh
  }

  set(field: string, value: unknown): Promise<void> {
    return this.write([{ op: 'set', path: [field], value: value as Extract<SettingsPathOpView, { op: 'set' }>['value'] }])
  }

  unset(field: string): Promise<void> { return this.write([{ op: 'unset', path: [field] }]) }

  private write(ops: SettingsPathOpView[]): Promise<void> {
    const generation = ++this.generation
    const copied = structuredClone(ops)
    return this.enqueue(async () => {
      try {
        for (let attempt = 0; ; attempt++) {
          if (!this.snapshot.writable || this.snapshot.revision === undefined) throw new Error('Settings are read-only')
          try {
            const view = await this.transport.mutate(this.namespace, copied, this.snapshot.revision)
            this.accept(view, true)
            break
          } catch (error) {
            // Only a known revision conflict is safe to replay; preserve other users' fields.
            if (attempt >= 2 || (error as { code?: string } | null)?.code !== 'settings/conflict') throw error
            await this.read()
          }
        }
      } catch (error) {
        try {
          await this.read()
          this.snapshot = { ...this.snapshot, error: '设置未保存，已恢复服务器设置。请重试。' }
        } catch {
          this.snapshot = { ...this.snapshot, status: 'unavailable', writable: false, error: '设置同步失败，请刷新页面重试。' }
        }
        throw error
      } finally {
        if (generation === this.generation) this.publish()
      }
    })
  }

  private async read(): Promise<void> {
    const result = await retryHostRead(() => this.transport.describe())
    const view = result.namespaces.find(item => item.ns === this.namespace)
    if (!view) throw new Error('QuantSkills settings namespace is unavailable')
    this.accept(view, result.writable)
  }

  private accept(view: NamespaceView, writable: boolean): void {
    const value = view.ns === this.namespace ? this.decode(view) : undefined
    if (value === undefined) throw new Error('Invalid QuantSkills settings')
    this.snapshot = {
      status: 'ready', value, base: view.base, user: view.user,
      revision: view.revision, writable, mode: 'host',
    }
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(async () => { if (!this.disposed) await operation() })
    this.tail = result.catch(() => {})
    return result
  }

  private publish(): void { if (!this.disposed) for (const listener of this.listeners) listener() }
  async dispose(): Promise<void> { this.disposed = true; this.listeners.clear(); await this.tail }
}
