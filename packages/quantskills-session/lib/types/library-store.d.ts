import { z } from 'zod';
declare const entrySchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        agent: "agent";
        "agent-team": "agent-team";
    }>;
    source: z.ZodEnum<{
        installed: "installed";
        personal: "personal";
        internal: "internal";
    }>;
    method: z.ZodEnum<{
        internal: "internal";
        manual: "manual";
        ai: "ai";
        installation: "installation";
        recovered: "recovered";
    }>;
}, z.core.$strict>;
export type LibrarySourceRecord = z.infer<typeof entrySchema>;
export declare class QuantSkillsLibraryStore {
    private readonly root;
    constructor(home?: string);
    private path;
    list(): Promise<readonly LibrarySourceRecord[]>;
    private read;
    put(entry: LibrarySourceRecord): Promise<void>;
}
export {};
//# sourceMappingURL=library-store.d.ts.map