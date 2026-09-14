import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';
interface NamespaceView {
    ns: string;
    schema: unknown;
    value: unknown;
    base?: unknown;
    user?: unknown;
    revision: number;
}
export interface PreferencesTransport {
    describe(): Promise<{
        writable: boolean;
        namespaces: NamespaceView[];
    }>;
    mutate(ns: string, ops: SettingsPathOpView[], revision: number): Promise<NamespaceView>;
}
export interface PreferencesSnapshot<T> extends SettingsScopeSnapshot<T> {
    error?: string;
}
/** QuantSkills preferences use authenticated Host capabilities, never the browser's hostname. */
export declare class QuantSkillsPreferences<T> {
    private readonly namespace;
    private readonly transport;
    private readonly decode;
    private snapshot;
    private readonly listeners;
    private tail;
    private refresh;
    private generation;
    private disposed;
    constructor(namespace: string, transport: PreferencesTransport, decode: (view: NamespaceView) => T | undefined);
    getSnapshot(): PreferencesSnapshot<T>;
    subscribe(listener: () => void): () => void;
    /** Coalesce invalidations; reads and writes share a queue so old reads cannot undo new choices. */
    reload(): Promise<void>;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
    private write;
    private read;
    private accept;
    private enqueue;
    private publish;
    dispose(): Promise<void>;
}
export {};
//# sourceMappingURL=preferences.d.ts.map