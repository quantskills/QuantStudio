import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  QuantSkillsFrequentSkill, QuantSkillsPlainSessionArchiveItem, QuantSkillsSessionArchiveItem, QuantSkillsSessionCreateRequest,
  QuantSkillsSessionCreateResult,
} from './plugin-types.ts'
import type { QuantSkillsSessionsSnapshot } from './types.ts'

/** Typed QuantSkills-bound Session Remote consumed by the browser controller. */
export interface QuantSkillsSessionsPort {
  /** Read ordinary QuantSkills conversations that have no asset composition. */
  plainList: (signal?: AbortSignal) => Promise<readonly QuantSkillsPlainSessionArchiveItem[]>
  /** Read only Host-verified QuantSkills-bound Session archives. */
  list: (signal?: AbortSignal) => Promise<readonly QuantSkillsSessionArchiveItem[]>
  /** Read Host-computed Skill usage frequency from the same bound Session set. */
  frequent: (signal?: AbortSignal) => Promise<readonly QuantSkillsFrequentSkill[]>
  /** Create one new Session and bind its immutable installed Skill version atomically. */
  create: (
    request: QuantSkillsSessionCreateRequest,
    signal?: AbortSignal,
  ) => Promise<QuantSkillsSessionCreateResult>
}

/** Observable browser controller over authoritative QuantSkills-bound Session state. */
export class QuantSkillsSessionsController {
  /** Current Host projection for framework selector hooks. */
  readonly source: ObservableSnapshot<QuantSkillsSessionsSnapshot>
  private readonly listeners = new Set<() => void>()
  private snapshot: QuantSkillsSessionsSnapshot = {
    phase: 'loading',
    plainArchives: [],
    archives: [],
    frequent: [],
  }
  private revision = 0

  /**
   * Create a controller around the typed Host Remote.
   * @param host - Remote adapter returning only verified bound Session projections.
   */
  constructor(private readonly host: QuantSkillsSessionsPort) {
    this.source = {
      getSnapshot: () => this.snapshot,
      subscribe: listener => this.listen(listener),
    }
  }

  /**
   * Refresh archives and usage frequency as one browser projection.
   * @param signal - optional caller cancellation for both Host reads.
   */
  async refresh(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const revision = ++this.revision
    const hadProjection = this.snapshot.refreshedAt !== undefined
    const { error: _error, ...current } = this.snapshot
    this.publish({ ...current, phase: hadProjection ? this.snapshot.phase : 'loading' })
    try {
      const [plainArchives, archives, frequent] = await Promise.all([
        signal === undefined ? this.host.plainList() : this.host.plainList(signal),
        signal === undefined ? this.host.list() : this.host.list(signal),
        signal === undefined ? this.host.frequent() : this.host.frequent(signal),
      ])
      if (revision !== this.revision) return
      this.publish({ phase: 'ready', plainArchives, archives, frequent, refreshedAt: Date.now() })
    } catch {
      signal?.throwIfAborted()
      if (revision !== this.revision) return
      this.publish({
        ...this.snapshot,
        phase: hadProjection ? 'stale' : 'error',
        error: '无法从宿主读取 QuantSkills 会话，请稍后重试。',
      })
    }
  }

  /**
   * Create and bind one Session, then refresh authoritative archive projections.
   * @param request - fresh Session id plus one committed installed Skill version.
   * @param signal - cancellation shared by creation and the following archive refresh.
   * @returns the Host-created bound Session identity and immutable binding.
   */
  async create(
    request: QuantSkillsSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsSessionCreateResult> {
    const created = signal === undefined
      ? await this.host.create(request)
      : await this.host.create(request, signal)
    signal?.throwIfAborted()
    await this.refresh(signal)
    return created
  }

  private publish(snapshot: QuantSkillsSessionsSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }

  private listen(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { void this.listeners.delete(listener) }
  }
}
