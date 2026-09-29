import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { SessionId } from '@deepseek-ai/dsh-session';
import { collectGeneratedFiles, removeGeneratedFile } from "./session-generated-files.js";
/** The pinned DSH patches provide ordered teardown, durable erasure and restore. */
export class SessionLifecycle {
    ctx;
    ready;
    tail = Promise.resolve();
    journal;
    pending = new Set();
    pendingFiles = [];
    previews = new Map();
    constructor(ctx, home) {
        this.ctx = ctx;
        this.journal = join(home, 'quantskills', 'pending-session-deletions.json');
        this.ready = this.recover();
        // Keep a startup disk failure observable to callers without an unhandled rejection.
        void this.ready.catch(() => { });
    }
    run(request, assertOwned) {
        const operation = this.tail.then(async () => {
            await this.ready;
            await this.finishPending();
            await assertOwned();
            const { sessionId: id, action } = request;
            if (request.filesToken !== undefined && action !== 'delete')
                throw new Error('文件删除仅适用于完整删除操作。');
            if (this.ctx.agents.get(id)?.status === 'running')
                throw new Error('会话正在运行，请停止后再操作。');
            if (action === 'archive')
                return this.ctx.workspaceRegistry.archiveSession(id);
            if (action === 'restore')
                return this.ctx.workspaceRegistry.restoreSession(id);
            const headers = new Map();
            for (const header of await this.ctx.sessionPersistence.list())
                headers.set(header.id, header);
            for (const session of this.ctx.sessions.list())
                headers.set(session.id, session.header);
            const ids = new Set([id]);
            // Child worker logs belong to the conversation. Independent forks do not.
            for (let size = -1; size !== ids.size;) {
                size = ids.size;
                for (const header of headers.values()) {
                    if (header.origin === 'subagent' && header.parentSession && ids.has(header.parentSession))
                        ids.add(header.id);
                }
            }
            for (const target of ids) {
                if (this.ctx.agents.get(target)?.status === 'running')
                    throw new Error('会话或其子任务正在运行，请停止后再删除。');
            }
            this.requireDeletionSupport();
            let files = [];
            if (request.filesToken !== undefined) {
                const preview = this.previews.get(request.filesToken);
                if (!preview || preview.id !== id || preview.expires < Date.now())
                    throw new Error('文件清单已过期，请重新预览完整删除。');
                const current = await collectGeneratedFiles(this.ctx, headers, ids);
                if (JSON.stringify(preview.files) !== JSON.stringify(current.files))
                    throw new Error('文件或引用已变化，请重新预览完整删除。');
                files = preview.files;
            }
            try {
                for (const target of [...ids].reverse())
                    await this.ctx.agents.retireSession(target);
                this.pending = ids;
                this.pendingFiles = [...files];
                await this.savePending();
            }
            catch (error) {
                this.pending = new Set();
                this.pendingFiles = [];
                for (const target of ids)
                    this.ctx.agents.releaseSessionRemoval(target);
                throw error;
            }
            await this.finishPending();
            if (request.filesToken)
                this.previews.delete(request.filesToken);
        });
        this.tail = operation.catch(() => { });
        return operation;
    }
    preview(id, assertOwned) {
        const operation = this.tail.then(async () => {
            await this.ready;
            await this.finishPending();
            await assertOwned();
            const headers = new Map();
            for (const header of await this.ctx.sessionPersistence.list())
                headers.set(header.id, header);
            for (const session of this.ctx.sessions.list())
                headers.set(session.id, session.header);
            const ids = new Set([id]);
            for (let size = -1; size !== ids.size;) {
                size = ids.size;
                for (const header of headers.values())
                    if (header.origin === 'subagent' && header.parentSession && ids.has(header.parentSession))
                        ids.add(header.id);
            }
            for (const target of ids)
                if (this.ctx.agents.get(target)?.status === 'running')
                    throw new Error('会话或子任务正在运行，请停止后再删除。');
            const result = await collectGeneratedFiles(this.ctx, headers, ids);
            const token = randomUUID();
            for (const [key, value] of this.previews)
                if (value.expires < Date.now())
                    this.previews.delete(key);
            this.previews.set(token, { id, files: result.files, expires: Date.now() + 15 * 60_000 });
            return { sessionId: id, token, files: result.files.map(({ path, bytes }) => ({ path, bytes })), retained: result.retained };
        });
        this.tail = operation.catch(() => { });
        return operation;
    }
    requireDeletionSupport() {
        const persistence = this.ctx.sessionPersistence;
        if (typeof persistence.deleteSession !== 'function' || typeof this.ctx.agents.retireSession !== 'function') {
            throw new Error('会话删除组件未就绪，请更新依赖并重新启动应用。');
        }
    }
    async recover() {
        let text;
        try {
            text = await readFile(this.journal, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return;
            throw error;
        }
        const record = JSON.parse(text);
        const ids = Array.isArray(record) ? record : record?.ids;
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id))
            throw new Error('会话删除日志无效。');
        const files = Array.isArray(record) ? [] : record?.files;
        if (!Array.isArray(files) || files.some(file => !file || typeof file.root !== 'string' || typeof file.path !== 'string'
            || typeof file.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(file.digest)
            || ['bytes', 'mtime', 'birthtime', 'ino', 'dev'].some(key => typeof file[key] !== 'number' || !Number.isFinite(file[key]))))
            throw new Error('会话文件删除日志无效。');
        this.pending = new Set(ids.map(id => SessionId(id)));
        this.pendingFiles = files;
        await this.finishPending();
    }
    async savePending() {
        await writeFileAtomic(this.journal, JSON.stringify(this.pendingFiles.length ? { ids: [...this.pending], files: this.pendingFiles } : [...this.pending]), { mode: 0o600, dirMode: 0o700 });
    }
    async finishPending() {
        if (!this.pending.size)
            return;
        this.requireDeletionSupport();
        // Persist reviewed file versions before touching them, and finish files before erasing their provenance.
        while (this.pendingFiles.length) {
            await removeGeneratedFile(this.pendingFiles[0]);
            this.pendingFiles.shift();
            await this.savePending();
        }
        const persistence = this.ctx.sessionPersistence;
        const query = this.ctx.get('sessionQuery');
        for (const id of [...this.pending]) {
            await this.ctx.agents.retireSession(id);
            await persistence.deleteSession(id);
            await this.ctx.sessionProjectionCache.deleteSession(id);
            await query?.deleteSession?.(id);
            await this.ctx.workspaceRegistry.forgetSession(id);
            this.pending.delete(id);
            await this.savePending();
        }
    }
}
//# sourceMappingURL=session-lifecycle.js.map