/** Read-only result facts derived from one loaded Conversation window. */
import { producedForClosing } from '@deepseek-ai/dsh-client-ui-deliverables/client';
const RESULT_CODE_EXTENSIONS = new Set([
    'bat', 'c', 'cc', 'cjs', 'conf', 'cpp', 'cs', 'css', 'cts', 'dart', 'fish', 'go', 'h', 'hpp',
    'ini', 'java', 'js', 'jsx', 'kt', 'kts', 'lua', 'm', 'mjs', 'mm', 'mts', 'php', 'pl', 'ps1',
    'py', 'r', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yaml',
    'yml', 'zsh',
]);
function deliverablesFor(turn) {
    if (turn === undefined)
        return undefined;
    return turn.data.get('deliverables');
}
/**
 * Read a normalized extension from a produced workspace path.
 * @param path - workspace-relative produced path.
 * @returns the lowercase extension without a leading period, or an empty string.
 */
export function resultExtension(path) {
    const separator = path.lastIndexOf('.');
    return separator === -1 ? '' : path.slice(separator + 1).toLowerCase();
}
/**
 * Decide whether a result path is a common source or configuration file.
 * @param path - workspace-relative produced path.
 * @returns true when the result workbench should use its code reader.
 */
export function isCodeResultPath(path) {
    return RESULT_CODE_EXTENSIONS.has(resultExtension(path));
}
/**
 * Rank result formats by their default reading value in the preview drawer.
 * @param path - workspace-relative produced path.
 * @returns a lower rank for a more useful default view; 4 means system-open fallback.
 */
export function resultPreviewRank(path) {
    const extension = resultExtension(path);
    if (['md', 'html', 'pdf', 'docx', 'odt', 'rtf', 'epub'].includes(extension))
        return 0;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'pptx', 'odp'].includes(extension))
        return 1;
    if (['csv', 'tsv', 'xlsx', 'ods', 'json'].includes(extension))
        return 2;
    if (isCodeResultPath(path) || ['txt', 'log'].includes(extension))
        return 3;
    return 4;
}
/**
 * Select viewable files produced by the latest loaded Turn.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns exact result paths from that Turn; uncommon formats use the system application.
 */
export function previewableResultPathsForLatestTurn(snapshot) {
    const latestTurn = snapshot.timeline.turnOrder.at(-1);
    if (latestTurn === undefined)
        return [];
    const produced = deliverablesFor(snapshot.timeline.turns.get(latestTurn));
    return producedForClosing(produced);
}
function activityFor(block) {
    if ('kind' in block) {
        return {
            callId: block.callId,
            name: block.call?.name ?? block.callId,
            time: block.time,
            status: block.isError ? 'failed' : 'succeeded',
        };
    }
    return {
        callId: block.callId,
        name: block.name,
        time: block.time,
        status: 'running',
    };
}
function visitTool(block, rows) {
    const activity = activityFor(block);
    const previous = rows.get(activity.callId);
    if (previous === undefined || previous.status === 'running')
        rows.set(activity.callId, activity);
    for (const child of block.subCalls)
        visitTool(child, rows);
}
function isToolResult(node) {
    return node.kind === 'tool-result';
}
function assistantArtifactFiles(snapshot) {
    const files = [];
    const paths = new Set();
    for (const node of [...snapshot.legacy.nodes].reverse()) {
        if (node.kind !== 'assistant')
            continue;
        for (const block of node.blocks) {
            if (block.kind !== 'text')
                continue;
            for (const match of block.text.matchAll(/`([^`\r\n]+)`/g)) {
                const path = artifactPath(match[1] ?? '');
                if (path === undefined || paths.has(path))
                    continue;
                paths.add(path);
                files.push({ path, name: path.slice(path.lastIndexOf('/') + 1) });
            }
        }
    }
    return files;
}
function artifactPath(value) {
    const path = value.trim().replaceAll('\\', '/');
    if (path.length === 0 || path.startsWith('/') || /^[A-Za-z]:\//.test(path)
        || path.includes('://') || path.split('/').includes('..')
        || /^(?:py(?:thon)?(?:\d+(?:\.\d+)*)?|node|pnpm|npm|npx|yarn|bun|bash|sh|pwsh|powershell|cmd|git)\s/i.test(path)) {
        return undefined;
    }
    return path.replace(/^\.\//, '');
}
function resultFiles(snapshot) {
    const byPath = new Map();
    for (const file of assistantArtifactFiles(snapshot)) {
        if (!byPath.has(file.path))
            byPath.set(file.path, file);
    }
    for (const turn of snapshot.timeline.turnOrder) {
        const produced = deliverablesFor(snapshot.timeline.turns.get(turn));
        for (const path of producedForClosing(produced)) {
            if (byPath.has(path))
                continue;
            byPath.set(path, { path, name: path.slice(path.lastIndexOf('/') + 1) });
        }
    }
    return [...byPath.values()];
}
/**
 * Project files and Tool activity from a single loaded Session window.
 *
 * Produced paths prioritize exact workspace paths explicitly
 * delivered in the newest Assistant messages, then add ui-deliverables'
 * mutation-location facts.
 * The Host still validates every path before preview. Tool rows reuse the
 * Conversation assembler's settled and in-flight lifecycle values; no metric
 * is recomputed in the browser.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns Session-isolated result facts, newest activity first.
 */
export function projectQuantSkillsResults(snapshot, hasOlderHistory = false) {
    const files = resultFiles(snapshot);
    const byCall = new Map();
    for (const node of snapshot.legacy.nodes.filter(isToolResult))
        visitTool(node, byCall);
    for (const call of snapshot.legacy.runningCalls)
        visitTool(call, byCall);
    const activity = [...byCall.values()].sort((left, right) => right.time - left.time || left.callId.localeCompare(right.callId));
    return {
        files,
        activity,
        settledToolCount: activity.filter(row => row.status !== 'running').length,
        failedToolCount: activity.filter(row => row.status === 'failed').length,
        runningToolCount: activity.filter(row => row.status === 'running').length,
        turnCount: snapshot.timeline.turnOrder.length,
        hasOlderHistory,
    };
}
//# sourceMappingURL=result-data.js.map