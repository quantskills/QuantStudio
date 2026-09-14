/** Git tree validation for immutable QuantSkills installations. */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { QuantSkillsHostError } from "./error.js";
const TREE_LINE = /^([0-7]{6}) (blob|commit) ([a-f0-9]{40}) +(-|\d+)\t([\s\S]+)$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
function invalid(message) {
    throw new QuantSkillsHostError(message, 'INSTALL_INVALID_TREE');
}
function limit(message) {
    throw new QuantSkillsHostError(message, 'INSTALL_LIMIT_EXCEEDED');
}
function validateSegment(segment) {
    if (segment === '' || segment === '.' || segment === '..' || segment.toLowerCase() === '.git'
        || segment.endsWith('.') || segment.endsWith(' ')
        || segment.includes(':') || WINDOWS_DEVICE.test(segment)) {
        invalid('QuantSkills tree contains a path that is unsafe on supported hosts.');
    }
}
/**
 * Parse bounded `git ls-tree -rlz --full-tree` output and reject unsafe trees.
 * @param output - complete, non-lossy NUL-delimited Git output.
 * @param declaration - exact root declaration required by the catalog kind.
 * @param limits - configured complete-tree bounds.
 * @returns the validated entries and deterministic tree digest.
 */
export function validateGitTree(output, declaration, limits) {
    const records = output.split('\0');
    if (records.at(-1) !== '')
        invalid('QuantSkills Git tree output is incomplete.');
    records.pop();
    const entries = [];
    const pathNodes = new Map();
    let totalBytes = 0;
    for (const record of records) {
        const match = TREE_LINE.exec(record);
        if (match === null)
            invalid('QuantSkills Git tree contains an unsupported entry.');
        const [, mode, type, object, size, path] = match;
        if (mode === '120000' || mode === '160000' || type === 'commit') {
            invalid('QuantSkills Git tree may not contain symlinks or submodules.');
        }
        if ((mode !== '100644' && mode !== '100755') || type !== 'blob' || size === '-' || object === undefined || path === undefined) {
            invalid('QuantSkills Git tree may contain regular files only.');
        }
        if (path.startsWith('/') || path.includes('\\') || path.includes('\uFFFD') || CONTROL.test(path)
            || path !== path.normalize('NFC')) {
            invalid('QuantSkills Git tree contains an invalid path encoding.');
        }
        const segments = path.split('/');
        if (segments.length > limits.maxDepth)
            limit('QuantSkills Git tree exceeds the configured path depth.');
        if (Buffer.byteLength(path, 'utf8') > limits.maxPathBytes)
            limit('QuantSkills Git tree exceeds the configured path byte limit.');
        for (const segment of segments)
            validateSegment(segment);
        for (let index = 0; index < segments.length; index++) {
            const original = segments.slice(0, index + 1).join('/');
            const kind = index === segments.length - 1 ? 'file' : 'directory';
            const key = original.normalize('NFC').toLowerCase();
            const prior = pathNodes.get(key);
            if (prior !== undefined && (prior.original !== original || prior.kind !== kind)) {
                invalid('QuantSkills Git tree contains a case-folding or normalization collision.');
            }
            pathNodes.set(key, { original, kind });
        }
        const bytes = Number(size);
        if (!Number.isSafeInteger(bytes) || bytes < 0)
            invalid('QuantSkills Git tree contains an invalid blob size.');
        if (bytes > limits.maxFileBytes)
            limit('QuantSkills Git tree contains a file above the configured byte limit.');
        totalBytes += bytes;
        if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxTotalBytes) {
            limit('QuantSkills Git tree exceeds the configured total byte limit.');
        }
        entries.push({ mode, object, bytes, path });
        if (entries.length > limits.maxFiles)
            limit('QuantSkills Git tree exceeds the configured file-count limit.');
    }
    if (!entries.some(entry => entry.path === declaration)) {
        invalid(`QuantSkills Git tree is missing root declaration ${declaration}.`);
    }
    const hash = createHash('sha256');
    for (const entry of [...entries].sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)))) {
        hash.update(`${entry.mode}\0${entry.object}\0${entry.bytes}\0${entry.path}\0`);
    }
    return Object.freeze({
        entries: Object.freeze(entries),
        fileCount: entries.length,
        totalBytes,
        treeDigest: `sha256:${hash.digest('hex')}`,
    });
}
//# sourceMappingURL=tree.js.map