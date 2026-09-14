/** QuantSkills-owned immutable generic-file storage for stock DSH hosts. */
import type { QuantSkillsEncodedFileAttachment, QuantSkillsFileAttachmentLimits, QuantSkillsFileAttachmentRef } from './types.ts';
/** Decoded generic file admitted for plugin-owned persistence. */
export interface QuantSkillsSaveFileAttachment {
    readonly data: Uint8Array;
    readonly mediaType: string;
    readonly name: string;
}
/** Stored bytes paired with their verified immutable reference. */
export interface QuantSkillsStoredFileAttachment {
    readonly ref: QuantSkillsFileAttachmentRef;
    readonly data: Uint8Array;
}
/** Default maximum bytes accepted for one QuantSkills generic file. */
export declare const DEFAULT_MAX_FILE_ATTACHMENT_BYTES: number;
/** Default aggregate generic-file bytes accepted by one QuantSkills Session. */
export declare const DEFAULT_MAX_SESSION_FILE_ATTACHMENT_BYTES: number;
/**
 * Decode one strict base64 browser upload without trusting Node's permissive decoder.
 * @param input - encoded bytes and display metadata from the browser Remote.
 * @param maxBytes - deployment-resolved single-file byte limit.
 * @returns validated bytes and normalized display metadata.
 */
export declare function decodeQuantSkillsFileAttachment(input: QuantSkillsEncodedFileAttachment, maxBytes: number): QuantSkillsSaveFileAttachment;
/** Plugin-private content-addressed store for generic QuantSkills files. */
export declare class QuantSkillsFileStore {
    readonly limits: QuantSkillsFileAttachmentLimits;
    private readonly objectRoot;
    /**
     * @param dshHome - optional Harness home override from plugin configuration.
     * @param limits - deployment-resolved single-file and per-Session limits.
     */
    constructor(dshHome: string | undefined, limits: QuantSkillsFileAttachmentLimits);
    /**
     * Validate decoded bytes and metadata without publishing an object.
     * @param input - decoded candidate file.
     */
    validateFile(input: QuantSkillsSaveFileAttachment): void;
    /**
     * Persist one immutable content-addressed object.
     * @param input - fully validated decoded file.
     * @returns immutable reference safe to append to the Session log.
     */
    saveFile(input: QuantSkillsSaveFileAttachment): Promise<QuantSkillsFileAttachmentRef>;
    /**
     * Read and verify one immutable content-addressed object.
     * @param ref - Session-owned reference from the durable log.
     * @param signal - optional caller cancellation.
     * @returns verified bytes and the original reference.
     */
    readFile(ref: QuantSkillsFileAttachmentRef, signal?: AbortSignal): Promise<QuantSkillsStoredFileAttachment>;
    private objectPath;
}
//# sourceMappingURL=file-store.d.ts.map