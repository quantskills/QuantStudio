import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
const key = (path) => process.platform === 'win32' ? path.toLowerCase() : path;
const missing = (error) => error.code === 'ENOENT';
function contained(root, path) {
    const rel = relative(root, path);
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
/** Never follows links, deletes directories, or accepts a path outside the recorded workspace. */
async function regularFile(root, path) {
    if (!isAbsolute(root) || !isAbsolute(path) || !contained(root, path))
        throw new Error('文件不在会话工作区内');
    const parts = relative(root, path).split(sep);
    if (parts.some(part => part.startsWith('.') || /[:\u0000-\u001f]/u.test(part)))
        throw new Error('保留工作区配置或特殊路径');
    if (key(await realpath(root)) !== key(root))
        throw new Error('工作区路径含链接');
    let current = root;
    for (const part of parts) {
        current = resolve(current, part);
        const stat = await lstat(current);
        if (stat.isSymbolicLink())
            throw new Error('保留符号链接及其目标');
    }
    const stat = await lstat(path);
    if (!stat.isFile())
        throw new Error('仅清理明确列出的文件，保留目录');
    if (key(await realpath(path)) !== key(path))
        throw new Error('文件路径含链接');
    return stat;
}
async function fingerprint(root, path) {
    const before = await regularFile(root, path);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path))
        hash.update(chunk);
    const after = await regularFile(root, path);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino)
        throw new Error('文件正在变化，请稍后重试');
    return { root, path, bytes: after.size, digest: hash.digest('hex'), mtime: after.mtimeMs, birthtime: after.birthtimeMs, ino: after.ino, dev: after.dev };
}
function identical(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
/** A reviewed file may not silently become a different file while the dialog is open. */
export async function removeGeneratedFile(file) {
    let current;
    try {
        current = await fingerprint(file.root, file.path);
    }
    catch (error) {
        if (missing(error))
            return;
        throw error;
    }
    if (!identical(current, file))
        throw new Error(`文件已变化，未删除：${file.path}`);
    // Only unlink this exact, validated regular file; never recursively remove a directory.
    await unlink(file.path);
}
function strings(value) {
    if (typeof value === 'string')
        return [value];
    if (Array.isArray(value))
        return value.flatMap(strings);
    if (value && typeof value === 'object')
        return Object.values(value).flatMap(strings);
    return [];
}
function pathsIn(text) {
    const paths = [];
    for (const match of text.matchAll(/`([^`\r\n]+)`|"path"\s*:\s*"([^"\r\n]+)"|\]\(([^)\r\n]+)\)/gu)) {
        const value = match[1] ?? match[2] ?? match[3];
        if (value)
            paths.push(value.replaceAll('\\\\', '\\'));
    }
    return paths;
}
function evidence(header, events) {
    const found = new Map();
    const root = header.cwd;
    if (!root || !isAbsolute(root))
        return found;
    const add = (raw, kind) => {
        const path = resolve(root, raw);
        if (!contained(root, path))
            return;
        const entry = found.get(key(path)) ?? { path, created: false, declared: false, protected: false };
        entry[kind] = true;
        found.set(key(path), entry);
    };
    const calls = new Map();
    for (const event of events.slice(header.seedLength ?? 0)) {
        if (event.type === 'tool/call')
            calls.set(String(event.data.callId), event);
        if (event.type === 'assistant/message') {
            for (const block of event.data.message.content)
                if (block.type === 'text') {
                    for (const path of pathsIn(block.text))
                        add(path, 'declared');
                }
        }
        if (event.type.includes('attach'))
            for (const value of strings(event.data))
                add(value, 'protected');
        if (event.type !== 'tool/result')
            continue;
        const result = event.data.message.content[0];
        if (result.isError)
            continue;
        const call = calls.get(String(result.toolCallId));
        if (call?.data.name !== 'write')
            continue;
        const output = result.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        // The backend's write result, not an assistant claim, distinguishes create from overwrite.
        const match = /^<path>([^\r\n]+)<\/path>\s*<type>file<\/type>\s*<content>\s*(Created|Updated) file\s*<\/content>\s*$/u.exec(output);
        if (!match)
            continue;
        add(match[1], match[2] === 'Created' ? 'created' : found.get(key(resolve(root, match[1])))?.created ? 'created' : 'protected');
    }
    return found;
}
export async function collectGeneratedFiles(ctx, headers, ids) {
    const logs = new Map();
    // If a log cannot be inspected, fail closed instead of assuming it has no shared references.
    for (const header of headers.values())
        logs.set(header.id, ctx.sessions.get(header.id)?.events ?? (await ctx.sessionPersistence.inspect(header.id)).events);
    const found = new Map();
    for (const id of ids) {
        const header = headers.get(id);
        if (!header)
            continue;
        for (const [path, item] of evidence(header, logs.get(id) ?? [])) {
            const previous = found.get(path);
            if (previous) {
                previous.item.created ||= item.created;
                previous.item.declared ||= item.declared;
                previous.item.protected ||= item.protected;
            }
            else
                found.set(path, { item, header });
        }
    }
    const files = [], retained = [];
    for (const { item, header } of found.values()) {
        if (!item.created && !item.declared)
            continue;
        const root = resolve(header.cwd);
        try {
            const stat = await regularFile(root, item.path);
            if (item.protected || stat.birthtimeMs < header.createdAt || stat.birthtimeMs <= 0)
                throw new Error('已有文件或输入文件，保留');
            // Legacy script outputs lack write-tool provenance. Limit those to explicitly delivered output/ files.
            if (!item.created && !contained(resolve(root, 'output'), item.path))
                throw new Error('缺少新建文件记录，保留');
            for (const other of headers.values()) {
                if (ids.has(other.id))
                    continue;
                const otherRoot = other.cwd ? resolve(other.cwd) : undefined;
                if (otherRoot && key(otherRoot) === key(root) && ctx.agents.get(other.id)?.status === 'running')
                    throw new Error('同一工作区有其他会话正在运行，请停止后重试');
                const variants = [item.path.replaceAll('\\', '/')];
                if (otherRoot && contained(otherRoot, item.path))
                    variants.push(relative(otherRoot, item.path).replaceAll('\\', '/'));
                const referenced = strings(logs.get(other.id)).some(value => variants.some(path => key(value.replaceAll('\\', '/')).includes(key(path))));
                if (referenced)
                    throw new Error('其他会话也引用了此文件，保留');
            }
            files.push(await fingerprint(root, item.path));
        }
        catch (error) {
            if (!missing(error))
                retained.push({ path: item.path, reason: error instanceof Error ? error.message : String(error) });
        }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, retained };
}
//# sourceMappingURL=session-generated-files.js.map