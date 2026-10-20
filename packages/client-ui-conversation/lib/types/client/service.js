/**
 * Scope-addressed conversation send, cancel, and history orchestration.
 *
 * Scope addressing rides the cordis Service tracker: property access through
 * `ctx.conversation` rebinds `this.ctx` to the caller's context, so methods
 * read the session tag with `scopeOf`. Mutable state must remain reachable
 * through one property read; assignment through the tracker proxy and `#`
 * private fields bypass that rebinding.
 */
import { Service } from '@deepseek-ai/cordis';
import { randomUUID } from '@deepseek-ai/dsh-util-crypto';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
/** Create one browser-only image draft descriptor; only its id enters input state. */
function browserDraftAttachment(file) {
    return {
        kind: 'image',
        id: randomUUID(),
        previewUrl: URL.createObjectURL(file),
        file,
    };
}
/**
 * Fill the draft's intrinsic dimensions once the browser parses the image
 * header (a metadata read off the preview URL, not a full decode). Failures
 * and non-browser runtimes leave them absent — consumers size those images
 * from CSS constraints instead. The descriptors stay registry-owned; submit
 * reads the dimensions into an immutable echo snapshot, so this late write
 * does not require a store notification.
 */
function probeDimensions(attachment) {
    if (typeof Image !== 'function')
        return;
    const probe = new Image();
    probe.onload = () => {
        attachment.width = probe.naturalWidth;
        attachment.height = probe.naturalHeight;
    };
    probe.src = attachment.previewUrl;
}
/** Give the echo one paint opportunity without letting a throttled frame clock block admission. */
function nextPaint() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                setTimeout(resolve, 0);
                return;
            }
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(fallback);
                setTimeout(resolve, 0);
            };
            const fallback = setTimeout(finish, 100);
            requestAnimationFrame(finish);
        }
        else {
            setTimeout(resolve, 0);
        }
    });
}
/** Native canonical base64 of one browser image (FileReader data-URL encode; no main-thread byte loop). */
function base64ImageOf(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const url = reader.result;
            resolve(url.slice(url.indexOf(',') + 1));
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('conversation: image read failed'));
        };
        reader.readAsDataURL(file);
    });
}
/** Unsupported browser-declared image type, localized by the UI boundary. */
export class UnsupportedImageMediaTypeError extends Error {
    /** Browser-declared MIME value, possibly empty. */
    mediaType;
    /** @param mediaType - Browser-declared MIME value, possibly empty. */
    constructor(mediaType) {
        super(`unsupported image media type: ${mediaType || '(empty)'}`);
        this.name = 'UnsupportedImageMediaTypeError';
        this.mediaType = mediaType;
    }
}
/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
export class ConversationController extends Service {
    /** The per-session input machine registry (SessionInputResolver face). */
    input;
    /** The per-session composer-block registry. */
    blocks;
    /** Live upload state per file-kind draft; images never appear here. */
    fileUploads = createSnapshotStore({});
    draftAttachments = new Map();
    fileUploadOperations = new Map();
    pendingFileUploads = new Set();
    fileUploadQueue = [];
    activeFileUploads = 0;
    maxConcurrentFileUploads;
    /**
     * @param ctx - owning root context (the plugin apply context; the service
     * registers itself and follows that fiber's lifetime).
     * @param config - carries the SessionInputResolver and composer-block registry
     * constructed by the plugin apply (the same instances the slot inject
     * factories close over).
     */
    constructor(ctx, config) {
        super(ctx, 'conversation');
        this.input = config.input;
        this.blocks = config.blocks;
        this.maxConcurrentFileUploads = config.maxConcurrentFileUploads;
        ctx.effect(() => async () => {
            const operations = [...this.fileUploadOperations.values()];
            for (const operation of operations)
                operation.controller.abort();
            await Promise.allSettled([...this.pendingFileUploads]);
            this.fileUploadOperations.clear();
            this.fileUploadQueue.length = 0;
            for (const attachment of this.draftAttachments.values()) {
                if (attachment.kind === 'image')
                    revokePreview(attachment.previewUrl);
            }
            this.draftAttachments.clear();
            this.fileUploads.set({});
        }, 'conversation draft attachments');
    }
    /**
     * Send a prompt into the scoped session. Business failures also land in the
     * session snapshot's promptError (object-layer state); the rejection here
     * exists for caller choreography (the composer restores the draft on it).
     * @param text - prompt text, sent verbatim as one text block.
     */
    async send(text) {
        const session = this.scopedSession('send');
        const result = await session.prompt([{ type: 'text', text }], 'queue');
        if (!result.ok)
            throw new Error(`conversation.send failed: ${result.error.code}: ${result.error.message}`);
    }
    /**
     * Submit ordered draft attachments with text through one host admission. A local
     * submission echo enters the session snapshot synchronously; serialization
     * and the prompt round-trip start after the browser can paint it. On the
     * echo's observed retirement seeds admitted image previews into the durable
     * cache and removes every attachment from the draft registry. On failure,
     * every attachment remains registered so the composer can restore it.
     * @param session - target session.
     * @param text - serialized prompt text.
     * @param attachmentIds - ordered draft-local attachment ids.
     * @param mode - queue or steer delivery selected by composer policy.
     * @param signal - optional cancellation for the complete Host admission.
     * @returns the Host admission outcome; local attachment preparation failures reject.
     */
    async sendSession(session, text, attachmentIds, mode, signal) {
        const attachments = this.resolveDraftAttachments(attachmentIds);
        if (attachments.length !== attachmentIds.length) {
            throw new Error('conversation.sendSession: one or more draft attachments are no longer available');
        }
        const uploads = this.fileUploads.getSnapshot();
        const uploadFor = (attachment) => {
            const upload = uploads[attachment.id];
            if (upload === undefined || upload.status !== 'ready') {
                throw new Error('conversation.sendSession: one or more files have not finished uploading');
            }
            return upload;
        };
        const pendingAttachments = attachments.map(attachment => attachment.kind === 'image'
            ? {
                type: 'image',
                value: {
                    previewUrl: attachment.previewUrl,
                    ...(attachment.file.name === '' ? {} : { name: attachment.file.name }),
                    ...(attachment.width === undefined ? {} : { width: attachment.width }),
                    ...(attachment.height === undefined ? {} : { height: attachment.height }),
                },
            }
            : { type: 'file', value: uploadFor(attachment).file });
        const serializeAttachments = () => Promise.all(attachments.map(async (attachment) => attachment.kind === 'image'
            ? { type: 'image', ...await this.encodeImage(attachment.file) }
            : { type: 'file', receiptId: uploadFor(attachment).receiptId }));
        let finishRetirement;
        const retirement = attachments.length === 0
            ? undefined
            : new Promise((resolve) => { finishRetirement = resolve; });
        const submission = session.beginSubmission({
            mode,
            text,
            attachments: pendingAttachments,
            onRetire: (settlement) => {
                this.settleSubmittedAttachments(session.sessionId, attachments, settlement);
                finishRetirement?.(settlement);
            },
        });
        let content;
        try {
            await nextPaint();
            const uploaded = await serializeAttachments();
            content = [...uploaded, ...(text === '' ? [] : [{ type: 'text', text }])];
        }
        catch (error) {
            submission.abandon();
            throw error;
        }
        const result = await session.prompt(content, mode, signal, submission.requestId);
        if (!result.ok)
            return { kind: 'error' };
        if (retirement !== undefined && (await retirement).reason !== 'observed')
            return { kind: 'error' };
        return { kind: 'success' };
    }
    /**
     * Create runtime-only draft attachments. Files whose browser MIME is an
     * accepted image type become image drafts (object URL preview, bytes sent
     * with the prompt); every other file becomes a file draft whose background
     * upload starts immediately and remains owned by this service across Session
     * navigation until completion or explicit removal.
     * @param sessionId - target Agent-scope identity.
     * @param files - browser files to register.
     * @returns ordered draft descriptors.
     */
    createDrafts(sessionId, files) {
        return files.map((file) => {
            if (isImageMediaType(file.type)) {
                const attachment = browserDraftAttachment(file);
                this.draftAttachments.set(attachment.id, attachment);
                probeDimensions(attachment);
                return attachment;
            }
            const attachment = {
                kind: 'file',
                id: randomUUID(),
                file,
            };
            this.draftAttachments.set(attachment.id, attachment);
            this.beginFileUpload(sessionId, attachment);
            return attachment;
        });
    }
    /**
     * Restart one failed file upload.
     * @param sessionId - target Agent-scope identity.
     * @param id - draft attachment id whose upload previously failed.
     */
    retryFileUpload(sessionId, id) {
        const attachment = this.draftAttachments.get(id);
        if (attachment === undefined || attachment.kind !== 'file')
            return;
        if (this.fileUploads.getSnapshot()[id]?.status !== 'error')
            return;
        this.beginFileUpload(sessionId, attachment);
    }
    /**
     * Stage carried file drafts again for a new Session.
     * @param sessionId - target Agent-scope identity after a Workspace switch.
     * @param ids - carried draft attachment ids.
     */
    rebindDraftFiles(sessionId, ids) {
        for (const id of ids) {
            const attachment = this.draftAttachments.get(id);
            if (attachment?.kind === 'file')
                this.beginFileUpload(sessionId, attachment);
        }
    }
    beginFileUpload(sessionId, attachment) {
        this.fileUploadOperations.get(attachment.id)?.controller.abort();
        const controller = new AbortController();
        this.fileUploads.update((draft) => {
            draft[attachment.id] = { status: 'uploading', loaded: 0 };
        });
        let settle;
        const done = new Promise((resolve) => { settle = resolve; });
        this.fileUploadOperations.set(attachment.id, { controller, done });
        this.pendingFileUploads.add(done);
        void done.then(() => { this.pendingFileUploads.delete(done); });
        const run = async () => {
            try {
                if (controller.signal.aborted
                    || this.fileUploadOperations.get(attachment.id)?.controller !== controller)
                    return;
                const result = await this.ctx.fileUpload.upload(sessionId, attachment.file, attachment.file.name === '' ? undefined : attachment.file.name, controller.signal, (progress) => {
                    if (this.fileUploadOperations.get(attachment.id)?.controller !== controller)
                        return;
                    this.fileUploads.update((draft) => {
                        if (!(attachment.id in draft))
                            return;
                        draft[attachment.id] = {
                            status: 'uploading',
                            loaded: progress.loaded,
                            ...(progress.total === undefined ? {} : { total: progress.total }),
                        };
                    });
                });
                if (this.fileUploadOperations.get(attachment.id)?.controller !== controller)
                    return;
                this.fileUploads.update((draft) => {
                    if (!(attachment.id in draft))
                        return;
                    draft[attachment.id] = result.ok
                        ? { status: 'ready', receiptId: result.value.receiptId, file: result.value.file }
                        : { status: 'error', message: result.error.message };
                });
            }
            catch (error) {
                if (this.fileUploadOperations.get(attachment.id)?.controller !== controller)
                    return;
                this.fileUploads.update((draft) => {
                    if (!(attachment.id in draft))
                        return;
                    draft[attachment.id] = {
                        status: 'error',
                        message: error instanceof Error ? error.message : String(error),
                    };
                });
            }
            finally {
                if (this.fileUploadOperations.get(attachment.id)?.controller === controller) {
                    this.fileUploadOperations.delete(attachment.id);
                }
            }
        };
        this.fileUploadQueue.push({ run, settle });
        this.pumpFileUploads();
    }
    /** Start queued upload Workers until the configured concurrency is occupied. */
    pumpFileUploads() {
        while (this.activeFileUploads < this.maxConcurrentFileUploads) {
            const task = this.fileUploadQueue.shift();
            if (task === undefined)
                return;
            this.activeFileUploads += 1;
            void task.run().finally(() => {
                this.activeFileUploads -= 1;
                task.settle();
                this.pumpFileUploads();
            });
        }
    }
    /**
     * Resolve ordered input-state ids to runtime-owned draft attachments.
     * @param ids - draft attachment ids.
     * @returns descriptors that remain live, in requested order.
     */
    resolveDraftAttachments(ids) {
        const attachments = [];
        for (const id of ids) {
            const attachment = this.draftAttachments.get(id);
            if (attachment !== undefined)
                attachments.push(attachment);
        }
        return attachments;
    }
    /**
     * Serialize ordered draft attachments to command-submit wire payloads without
     * sending or releasing them. Images are encoded; generic files cite receipts
     * from their completed background uploads and never reread browser bytes.
     * @param attachmentIds - ordered draft-local attachment ids.
     * @returns wire payloads in id order.
     */
    async serializeDraftAttachments(attachmentIds) {
        const attachments = this.resolveDraftAttachments(attachmentIds);
        if (attachments.length !== attachmentIds.length) {
            throw new Error('conversation.serializeDraftAttachments: one or more draft attachments are no longer available');
        }
        const uploads = this.fileUploads.getSnapshot();
        return {
            attachments: await Promise.all(attachments.map(async (attachment) => {
                if (attachment.kind === 'image')
                    return { type: 'image', ...await this.encodeImage(attachment.file) };
                const upload = uploads[attachment.id];
                if (upload === undefined || upload.status !== 'ready') {
                    throw new Error('conversation.serializeDraftAttachments: one or more files have not finished uploading');
                }
                return { type: 'file', receiptId: upload.receiptId };
            })),
        };
    }
    /**
     * Release one browser-owned draft attachment, aborting its active upload.
     * @param id - draft attachment id.
     */
    releaseDraftAttachment(id) {
        const attachment = this.draftAttachments.get(id);
        if (attachment === undefined)
            return;
        const operation = this.fileUploadOperations.get(id);
        this.fileUploadOperations.delete(id);
        operation?.controller.abort();
        this.draftAttachments.delete(id);
        if (attachment.kind === 'image') {
            revokePreview(attachment.previewUrl);
            return;
        }
        // The stored Host object stays durable; only the draft's upload state ends.
        this.fileUploads.set(Object.fromEntries(Object.entries(this.fileUploads.getSnapshot()).filter(([key]) => key !== id)));
    }
    /**
     * Release a set of browser-owned draft attachments.
     * @param attachments - descriptors to release.
     */
    releaseDraftAttachments(attachments) {
        for (const attachment of attachments)
            this.releaseDraftAttachment(attachment.id);
    }
    /** Apply one operation to a pending queue occurrence. */
    async updateQueue(itemId, action) {
        const session = this.scopedSession('updateQueue');
        const result = await session.updateQueue(itemId, action);
        if (!result.ok) {
            if (action.kind === 'steer'
                && (result.error.code === 'session/steer-unavailable' || result.error.code === 'session/queue-item-not-found'))
                return;
            throw new Error(`conversation.updateQueue failed: ${result.error.code}: ${result.error.message}`);
        }
    }
    /** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
    async cancel() {
        const session = this.scopedSession('cancel');
        const result = await session.cancel();
        if (!result.ok)
            throw new Error(`conversation.cancel failed: ${result.error.code}: ${result.error.message}`);
    }
    /** Pull one older history page for the scoped Session. */
    async loadOlder() {
        await this.scopedSession('loadOlder').loadOlder();
    }
    /** Resolve the caller scope's session face or throw on root contexts. */
    scopedSession(op) {
        const id = this.scopeId(op);
        const binding = this.requireSessions().binding(id);
        if (binding === undefined)
            throw new Error(`conversation.${op}: session "${id}" resolved no binding`);
        return binding.session;
    }
    /** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
    scopeId(op) {
        const id = this.requireSessions().scopeOf(this.ctx);
        if (id === undefined) {
            throw new Error(`conversation.${op} requires a session scope — address one via ctx.sessions.scope(id).conversation`);
        }
        return id;
    }
    requireSessions() {
        // Strict ctx.get, not the injection proxy: the scope-addressed pattern
        // reads the service off whatever context the tracker rebound.
        const sessions = this.ctx.get('sessions');
        if (sessions === undefined)
            throw new Error('conversation: sessions service unavailable');
        return sessions;
    }
    /**
     * Settle one submission's draft attachments when its echo retires. Observed:
     * each image leaves the registry, handing its preview URL to the durable
     * image cache (seeded under the admitted reference so the transcript node
     * renders immediately while the cache reads canonical bytes) or revoking it
     * when the cache already holds that reference. Failed: nothing changes;
     * the ids stay registered for the composer's rail restore.
     */
    settleSubmittedAttachments(sessionId, attachments, retirement) {
        if (retirement.reason !== 'observed')
            return;
        const uiConversation = this.ctx.get('uiConversation');
        let observedIndex = 0;
        for (const attachment of attachments) {
            const live = this.draftAttachments.get(attachment.id);
            const ref = retirement.attachments[observedIndex++];
            if (live === undefined)
                continue;
            if (attachment.kind === 'file') {
                this.releaseDraftAttachment(attachment.id);
                continue;
            }
            this.draftAttachments.delete(attachment.id);
            if (ref !== undefined && 'mediaType' in ref
                && uiConversation?.seedImageUrl(sessionId, ref, attachment.previewUrl) === true)
                continue;
            revokePreview(attachment.previewUrl);
        }
    }
    /** Canonical base64 wire form of one browser image file. */
    async encodeImage(file) {
        return {
            mediaType: imageMediaType(file.type),
            data: await base64ImageOf(file),
            ...(file.name === '' ? {} : { name: file.name }),
        };
    }
}
function imageMediaType(value) {
    switch (value) {
        case 'image/png':
        case 'image/jpeg':
        case 'image/webp':
        case 'image/gif':
            return value;
        default:
            throw new UnsupportedImageMediaTypeError(value);
    }
}
/**
 * Whether a browser-declared MIME selects the image draft path (all other files upload verbatim).
 * @param value - the browser's declared MIME type.
 * @returns whether the file is an accepted raster image.
 */
export function isImageMediaType(value) {
    return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp' || value === 'image/gif';
}
function revokePreview(url) {
    if (url.startsWith('blob:'))
        URL.revokeObjectURL(url);
}
//# sourceMappingURL=service.js.map