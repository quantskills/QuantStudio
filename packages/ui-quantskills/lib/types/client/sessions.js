/** Observable browser controller over authoritative QuantSkills-bound Session state. */
export class QuantSkillsSessionsController {
    host;
    /** Current Host projection for framework selector hooks. */
    source;
    listeners = new Set();
    snapshot = {
        phase: 'loading',
        plainArchives: [],
        archives: [],
        frequent: [],
    };
    revision = 0;
    /**
     * Create a controller around the typed Host Remote.
     * @param host - Remote adapter returning only verified bound Session projections.
     */
    constructor(host) {
        this.host = host;
        this.source = {
            getSnapshot: () => this.snapshot,
            subscribe: listener => this.listen(listener),
        };
    }
    /**
     * Refresh archives and usage frequency as one browser projection.
     * @param signal - optional caller cancellation for both Host reads.
     */
    async refresh(signal) {
        signal?.throwIfAborted();
        const revision = ++this.revision;
        const hadProjection = this.snapshot.refreshedAt !== undefined;
        const { error: _error, ...current } = this.snapshot;
        this.publish({ ...current, phase: hadProjection ? this.snapshot.phase : 'loading' });
        try {
            const [plainArchives, archives, frequent] = await Promise.all([
                signal === undefined ? this.host.plainList() : this.host.plainList(signal),
                signal === undefined ? this.host.list() : this.host.list(signal),
                signal === undefined ? this.host.frequent() : this.host.frequent(signal),
            ]);
            if (revision !== this.revision)
                return;
            this.publish({ phase: 'ready', plainArchives, archives, frequent, refreshedAt: Date.now() });
        }
        catch {
            signal?.throwIfAborted();
            if (revision !== this.revision)
                return;
            this.publish({
                ...this.snapshot,
                phase: hadProjection ? 'stale' : 'error',
                error: '无法从宿主读取 QuantSkills 会话，请稍后重试。',
            });
        }
    }
    /**
     * Create and bind one Session, then refresh authoritative archive projections.
     * @param request - fresh Session id plus one committed installed Skill version.
     * @param signal - cancellation shared by creation and the following archive refresh.
     * @returns the Host-created bound Session identity and immutable binding.
     */
    async create(request, signal) {
        const created = signal === undefined
            ? await this.host.create(request)
            : await this.host.create(request, signal);
        signal?.throwIfAborted();
        await this.refresh(signal);
        return created;
    }
    publish(snapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners)
            listener();
    }
    listen(listener) {
        this.listeners.add(listener);
        return () => { void this.listeners.delete(listener); };
    }
}
//# sourceMappingURL=sessions.js.map