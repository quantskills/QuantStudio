/** QuantSkills-owned immutable generic-file storage for stock DSH hosts. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
/** Default maximum bytes accepted for one QuantSkills generic file. */
export const DEFAULT_MAX_FILE_ATTACHMENT_BYTES = 100 * 1024 * 1024;
/** Default aggregate generic-file bytes accepted by one QuantSkills Session. */
export const DEFAULT_MAX_SESSION_FILE_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_MEDIA_TYPE_LENGTH = 255;
const BASE64_PATTERN = /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;
/**
 * Decode one strict base64 browser upload without trusting Node's permissive decoder.
 * @param input - encoded bytes and display metadata from the browser Remote.
 * @param maxBytes - deployment-resolved single-file byte limit.
 * @returns validated bytes and normalized display metadata.
 */
export function decodeQuantSkillsFileAttachment(input, maxBytes) {
    if (input.data.length === 0 || input.data.length > Math.ceil(maxBytes / 3) * 4 + 4) {
        throw new Error('QuantSkills attachment is empty or exceeds the configured file limit.');
    }
    if (input.data.length % 4 !== 0 || !BASE64_PATTERN.test(input.data)) {
        throw new Error('QuantSkills attachment data must be canonical base64.');
    }
    const data = Buffer.from(input.data, 'base64');
    if (data.byteLength === 0 || data.byteLength > maxBytes) {
        throw new Error('QuantSkills attachment is empty or exceeds the configured file limit.');
    }
    if (data.toString('base64') !== input.data) {
        throw new Error('QuantSkills attachment data must be canonical base64.');
    }
    const name = normalizeFileName(input.name);
    const mediaType = normalizeMediaType(input.mediaType);
    return Object.freeze({ data: new Uint8Array(data), mediaType, name });
}
/** Plugin-private content-addressed store for generic QuantSkills files. */
export class QuantSkillsFileStore {
    limits;
    objectRoot;
    /**
     * @param dshHome - optional Harness home override from plugin configuration.
     * @param limits - deployment-resolved single-file and per-Session limits.
     */
    constructor(dshHome, limits) {
        this.objectRoot = join(resolveDshHome(dshHome), 'quantskills', 'attachments', 'v1', 'objects');
        this.limits = Object.freeze({ ...limits });
    }
    /**
     * Validate decoded bytes and metadata without publishing an object.
     * @param input - decoded candidate file.
     */
    validateFile(input) {
        if (input.data.byteLength === 0 || input.data.byteLength > this.limits.maxFileBytes) {
            throw new Error('QuantSkills attachment is empty or exceeds the configured file limit.');
        }
        normalizeFileName(input.name);
        normalizeMediaType(input.mediaType);
    }
    /**
     * Persist one immutable content-addressed object.
     * @param input - fully validated decoded file.
     * @returns immutable reference safe to append to the Session log.
     */
    async saveFile(input) {
        this.validateFile(input);
        const digest = createHash('sha256').update(input.data).digest('hex');
        const objectPath = this.objectPath(digest);
        await mkdir(join(this.objectRoot, digest.slice(0, 2)), { recursive: true, mode: 0o700 });
        try {
            await writeFile(objectPath, input.data, { flag: 'wx', mode: 0o600 });
        }
        catch (error) {
            if (!hasCode(error, 'EEXIST'))
                throw error;
            const existing = await readFile(objectPath);
            if (existing.byteLength !== input.data.byteLength
                || createHash('sha256').update(existing).digest('hex') !== digest) {
                throw new Error('QuantSkills attachment object conflicts with its content digest.');
            }
        }
        return Object.freeze({
            attachmentId: AttachmentId(`sha256:${digest}`),
            mediaType: input.mediaType,
            bytes: input.data.byteLength,
            name: input.name,
        });
    }
    /**
     * Read and verify one immutable content-addressed object.
     * @param ref - Session-owned reference from the durable log.
     * @param signal - optional caller cancellation.
     * @returns verified bytes and the original reference.
     */
    async readFile(ref, signal) {
        signal?.throwIfAborted();
        const digest = digestFromAttachmentId(ref.attachmentId);
        const data = await readFile(this.objectPath(digest));
        signal?.throwIfAborted();
        if (data.byteLength !== ref.bytes || createHash('sha256').update(data).digest('hex') !== digest) {
            throw new Error('QuantSkills attachment object failed integrity verification.');
        }
        return Object.freeze({ ref, data: new Uint8Array(data) });
    }
    objectPath(digest) {
        return join(this.objectRoot, digest.slice(0, 2), digest);
    }
}
function normalizeFileName(value) {
    const name = basename(value.replaceAll('\\', '/')).trim();
    if (name.length === 0 || name.length > MAX_FILE_NAME_LENGTH || /[\u0000-\u001f\u007f]/u.test(name)) {
        throw new Error('QuantSkills attachment name is invalid.');
    }
    return name;
}
function normalizeMediaType(value) {
    const mediaType = value.trim().toLowerCase();
    if (mediaType.length === 0 || mediaType.length > MAX_MEDIA_TYPE_LENGTH
        || !/^[^\s/]+\/[^\s/]+$/u.test(mediaType)) {
        throw new Error('QuantSkills attachment media type is invalid.');
    }
    return mediaType;
}
function digestFromAttachmentId(value) {
    const match = /^sha256:([\da-f]{64})$/u.exec(value);
    if (match === null)
        throw new Error('QuantSkills attachment id is invalid.');
    return match[1];
}
function hasCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error
        && error.code === code;
}
//# sourceMappingURL=file-store.js.map