/** Compatible sidecar provenance; legacy definitions and frozen snapshots stay unchanged. */
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { z } from 'zod';
const entrySchema = z.object({
    id: z.string().min(1), kind: z.enum(['agent', 'agent-team']),
    source: z.enum(['personal', 'installed', 'internal']),
    method: z.enum(['manual', 'ai', 'installation', 'internal', 'recovered']),
}).strict();
const documentSchema = z.object({ schemaVersion: z.literal(1), entries: z.array(entrySchema) }).strict();
export class QuantSkillsLibraryStore {
    root;
    constructor(home) { this.root = join(resolveDshHome(home), 'quantskills'); }
    async path() {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const info = await lstat(this.root);
        if (!info.isDirectory() || info.isSymbolicLink())
            throw new Error('Invalid library root');
        return join(await realpath(this.root), 'library-sources.json');
    }
    async list() { return this.read(await this.path()); }
    async read(path) {
        try {
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 * 1024)
                throw new Error('Invalid library source document');
            return documentSchema.parse(JSON.parse(await readFile(path, 'utf8'))).entries;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                return [];
            throw error;
        }
    }
    async put(entry) {
        const parsed = entrySchema.parse(entry);
        const path = await this.path();
        await withFileLock(path, async () => {
            const entries = await this.read(path);
            const text = JSON.stringify({ schemaVersion: 1, entries: [...entries.filter(item => item.id !== parsed.id), parsed] });
            if (Buffer.byteLength(text) > 4 * 1024 * 1024)
                throw new Error('Library source document exceeds size limit');
            await writeFileAtomic(path, text, { mode: 0o600, dirMode: 0o700 });
        });
    }
}
//# sourceMappingURL=library-store.js.map