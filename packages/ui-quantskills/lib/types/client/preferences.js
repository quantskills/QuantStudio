import { retryHostRead } from "./remote-read.js";
/** QuantSkills preferences use authenticated Host capabilities, never the browser's hostname. */
export class QuantSkillsPreferences {
    namespace;
    transport;
    decode;
    snapshot = {
        status: 'loading', value: undefined, base: undefined, user: undefined,
        revision: undefined, writable: false, mode: 'host',
    };
    listeners = new Set();
    tail = Promise.resolve();
    refresh;
    generation = 0;
    disposed = false;
    constructor(namespace, transport, decode) {
        this.namespace = namespace;
        this.transport = transport;
        this.decode = decode;
    }
    getSnapshot() { return this.snapshot; }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    /** Coalesce invalidations; reads and writes share a queue so old reads cannot undo new choices. */
    reload() {
        if (this.refresh)
            return this.refresh;
        const refresh = this.enqueue(async () => {
            try {
                await this.read();
            }
            catch {
                this.snapshot = { ...this.snapshot, status: 'unavailable', writable: false, error: '设置读取失败，请刷新页面重试。' };
            }
            this.publish();
        });
        this.refresh = refresh;
        void refresh.finally(() => { if (this.refresh === refresh)
            this.refresh = undefined; });
        return refresh;
    }
    set(field, value) {
        return this.write([{ op: 'set', path: [field], value: value }]);
    }
    unset(field) { return this.write([{ op: 'unset', path: [field] }]); }
    write(ops) {
        const generation = ++this.generation;
        const copied = structuredClone(ops);
        return this.enqueue(async () => {
            try {
                for (let attempt = 0;; attempt++) {
                    if (!this.snapshot.writable || this.snapshot.revision === undefined)
                        throw new Error('Settings are read-only');
                    try {
                        const view = await this.transport.mutate(this.namespace, copied, this.snapshot.revision);
                        this.accept(view, true);
                        break;
                    }
                    catch (error) {
                        // Only a known revision conflict is safe to replay; preserve other users' fields.
                        if (attempt >= 2 || error?.code !== 'settings/conflict')
                            throw error;
                        await this.read();
                    }
                }
            }
            catch (error) {
                try {
                    await this.read();
                    this.snapshot = { ...this.snapshot, error: '设置未保存，已恢复服务器设置。请重试。' };
                }
                catch {
                    this.snapshot = { ...this.snapshot, status: 'unavailable', writable: false, error: '设置同步失败，请刷新页面重试。' };
                }
                throw error;
            }
            finally {
                if (generation === this.generation)
                    this.publish();
            }
        });
    }
    async read() {
        const result = await retryHostRead(() => this.transport.describe());
        const view = result.namespaces.find(item => item.ns === this.namespace);
        if (!view)
            throw new Error('QuantSkills settings namespace is unavailable');
        this.accept(view, result.writable);
    }
    accept(view, writable) {
        const value = view.ns === this.namespace ? this.decode(view) : undefined;
        if (value === undefined)
            throw new Error('Invalid QuantSkills settings');
        this.snapshot = {
            status: 'ready', value, base: view.base, user: view.user,
            revision: view.revision, writable, mode: 'host',
        };
    }
    enqueue(operation) {
        const result = this.tail.then(async () => { if (!this.disposed)
            await operation(); });
        this.tail = result.catch(() => { });
        return result;
    }
    publish() { if (!this.disposed)
        for (const listener of this.listeners)
            listener(); }
    async dispose() { this.disposed = true; this.listeners.clear(); await this.tail; }
}
//# sourceMappingURL=preferences.js.map