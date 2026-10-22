import { bytesToBase64 } from '@deepseek-ai/dsh-util-crypto';
import { WeakMapWithValues } from '@deepseek-ai/dsh-util-values';
/** Resolve durable Conversation images and release their browser URLs with Session scope. */
export class HistoricalImageCache {
    sessions;
    entries = new WeakMapWithValues();
    scopeDisposers = new WeakMapWithValues();
    urls = new Set();
    disposed = false;
    /**
     * @param ctx - Owning ui-conversation fiber.
     * @param sessions - Session Controller object layer.
     */
    constructor(ctx, sessions) {
        this.sessions = sessions;
        ctx.effect(() => () => { this.dispose(); }, 'ui-conversation historical image cache');
    }
    /**
     * Resolve and cache one session-authorized image URL.
     * @param sessionId - Session authorization and lifetime scope.
     * @param attachment - Durable image reference.
     * @returns browser URL valid until the Session binding is released.
     */
    resolve(sessionId, attachment) {
        if (this.disposed)
            return Promise.reject(new Error('ui-conversation image cache is disposed'));
        const binding = this.sessions.binding(sessionId);
        if (binding === undefined) {
            return Promise.reject(new Error(`ui-conversation: unknown session "${sessionId}"`));
        }
        const entries = this.bindScope(binding);
        const key = attachment.attachmentId;
        const cached = entries.get(key);
        if (cached !== undefined)
            return cached.pending;
        const entry = {
            binding,
            pending: Promise.resolve(''),
        };
        entries.set(key, entry);
        entry.pending = this.loadCanonical(key, entry, attachment);
        return entry.pending;
    }
    /**
     * Return an already-displayable URL without starting a read.
     * @param sessionId - Session authorization and lifetime scope.
     * @param attachment - Durable image reference.
     * @returns current preview or canonical URL when cached.
     */
    peek(sessionId, attachment) {
        const binding = this.sessions.binding(sessionId);
        return binding === undefined ? undefined : this.entries.get(binding)?.get(attachment.attachmentId)?.current;
    }
    /**
     * Adopt a submission preview while fetching the durable admitted bytes.
     * The preview is available synchronously, then replaced and revoked when
     * the canonical attachment read completes.
     * @param sessionId - Session authorization and lifetime scope.
     * @param attachment - Durable image reference the URL temporarily displays.
     * @param url - browser URL to adopt.
     * @returns whether the cache took ownership.
     */
    seed(sessionId, attachment, url) {
        if (this.disposed)
            return false;
        const binding = this.sessions.binding(sessionId);
        if (binding === undefined)
            return false;
        const entries = this.bindScope(binding);
        const key = attachment.attachmentId;
        if (entries.has(key))
            return false;
        const entry = {
            binding,
            current: url,
            pending: Promise.resolve(url),
        };
        this.urls.add(url);
        entries.set(key, entry);
        entry.pending = this.loadCanonical(key, entry, attachment).catch((error) => {
            if (entries.get(key) === entry && entry.current === url) {
                entries.delete(key);
                this.releaseUrl(url);
            }
            throw error;
        });
        // Seed begins the durable read before a transcript image necessarily
        // mounts. Keep that legitimate no-consumer path from becoming an
        // unhandled rejection; resolve() still returns the rejecting promise.
        void entry.pending.catch(() => { });
        return true;
    }
    loadCanonical(key, entry, attachment) {
        return entry.binding.session.readAttachment(attachment.attachmentId)
            .then((result) => {
            if (!result.ok)
                throw new Error(`${result.error.code}: ${result.error.message}`);
            this.assertLive(key, entry);
            let url;
            if (typeof URL.createObjectURL !== 'function') {
                url = `data:${result.value.attachment.mediaType};base64,${bytesToBase64(result.value.data)}`;
            }
            else {
                const bytes = Uint8Array.from(result.value.data);
                url = URL.createObjectURL(new Blob([bytes.buffer], { type: result.value.attachment.mediaType }));
            }
            this.assertLive(key, entry);
            this.urls.add(url);
            const previous = entry.current;
            entry.current = url;
            if (previous !== undefined && previous !== url)
                this.releaseUrl(previous);
            return url;
        })
            .catch((error) => {
            const entries = this.entries.get(entry.binding);
            if (entries?.get(key) === entry && entry.current === undefined)
                entries.delete(key);
            throw error;
        });
    }
    assertLive(key, entry) {
        if (this.disposed)
            throw new Error('ui-conversation image cache was disposed before loading completed');
        if (this.entries.get(entry.binding)?.get(key) !== entry) {
            throw new Error('ui-conversation image scope was released before loading completed');
        }
    }
    bindScope(binding) {
        const existing = this.entries.get(binding);
        if (existing !== undefined)
            return existing;
        const entries = new Map();
        this.entries.set(binding, entries);
        const dispose = binding.ctx.effect(() => () => {
            this.scopeDisposers.delete(binding);
            this.release(binding, entries);
        }, 'ui-conversation historical image scope');
        const release = () => { void dispose(); };
        this.scopeDisposers.set(binding, release);
        return entries;
    }
    release(binding, entries) {
        if (this.entries.get(binding) === entries)
            this.entries.delete(binding);
        for (const entry of entries.values()) {
            if (entry.current !== undefined)
                this.releaseUrl(entry.current);
        }
        entries.clear();
    }
    releaseUrl(url) {
        if (!this.urls.delete(url))
            return;
        revokeUrl(url);
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const dispose of [...this.scopeDisposers.values])
            dispose();
        this.scopeDisposers.clear();
        for (const url of this.urls)
            revokeUrl(url);
        this.urls.clear();
        for (const entries of this.entries.values)
            entries.clear();
        this.entries.clear();
    }
}
function revokeUrl(url) {
    if (url.startsWith('blob:'))
        URL.revokeObjectURL(url);
}
//# sourceMappingURL=historical-images.js.map