/** Durable Host-owned storage for user-authored QuantSkills Agent definitions. */
import { z } from 'zod';
import type { QuantSkillsAgentDefinition, QuantSkillsAssetId, QuantSkillsCommitSha, QuantSkillsInstalledVersionId, QuantSkillsTreeDigest } from './types.ts';
/** Maximum UTF-8 byte size accepted and published for the complete Agent document. */
export declare const MAX_AGENT_DOCUMENT_BYTES: number;
/** Maximum instruction text retained from one native `AGENTS.md` template. */
export declare const MAX_AGENT_ROLE_CHARS = 128000;
/** Durable schema shared by single-Skill and user Agent Session bindings. */
export declare const quantSkillsSessionBindingSchema: z.ZodPipe<z.ZodObject<{
    assetId: z.ZodString;
    versionId: z.ZodString;
    commit: z.ZodString;
    treeDigest: z.ZodString;
}, z.core.$strict>, z.ZodTransform<Readonly<{
    assetId: QuantSkillsAssetId;
    versionId: QuantSkillsInstalledVersionId;
    commit: QuantSkillsCommitSha;
    treeDigest: QuantSkillsTreeDigest;
}>, {
    assetId: string;
    versionId: string;
    commit: string;
    treeDigest: string;
}>>;
/** Durable schema for one complete immutable user Agent definition. */
export declare const quantSkillsAgentDefinitionSchema: z.ZodPipe<z.ZodObject<{
    agentId: z.ZodString;
    revision: z.ZodNumber;
    name: z.ZodString;
    role: z.ZodString;
    mode: z.ZodEnum<{
        fixed: "fixed";
        dynamic: "dynamic";
    }>;
    model: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
        reasoningEffort: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    permission: z.ZodDefault<z.ZodEnum<{
        "read-only": "read-only";
        "workspace-write": "workspace-write";
        "danger-full-access": "danger-full-access";
    }>>;
    sourceVersionId: z.ZodOptional<z.ZodString>;
    skills: z.ZodArray<z.ZodPipe<z.ZodObject<{
        assetId: z.ZodString;
        versionId: z.ZodString;
        commit: z.ZodString;
        treeDigest: z.ZodString;
    }, z.core.$strict>, z.ZodTransform<Readonly<{
        assetId: QuantSkillsAssetId;
        versionId: QuantSkillsInstalledVersionId;
        commit: QuantSkillsCommitSha;
        treeDigest: QuantSkillsTreeDigest;
    }>, {
        assetId: string;
        versionId: string;
        commit: string;
        treeDigest: string;
    }>>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>, z.ZodTransform<QuantSkillsAgentDefinition, {
    agentId: string;
    revision: number;
    name: string;
    role: string;
    mode: "fixed" | "dynamic";
    permission: "read-only" | "workspace-write" | "danger-full-access";
    skills: Readonly<{
        assetId: QuantSkillsAssetId;
        versionId: QuantSkillsInstalledVersionId;
        commit: QuantSkillsCommitSha;
        treeDigest: QuantSkillsTreeDigest;
    }>[];
    createdAt: number;
    updatedAt: number;
    model?: {
        provider: string;
        model: string;
        reasoningEffort?: string | undefined;
    } | undefined;
    sourceVersionId?: string | undefined;
}>>;
/** Host-owned durable Agent definition store with serialized atomic mutations. */
export declare class QuantSkillsAgentStore {
    private readonly root;
    private tail;
    /**
     * @param dshHome - optional Harness home override.
     */
    constructor(dshHome?: string);
    /**
     * Read every validated definition ordered by most recent update.
     * @returns immutable validated definitions.
     */
    list(): Promise<readonly QuantSkillsAgentDefinition[]>;
    /**
     * Serialize one read-modify-write transaction.
     * @param mutation - operation producing the next complete definition set.
     * @returns the operation result after durable publication.
     */
    mutate<T>(mutation: (agents: readonly QuantSkillsAgentDefinition[]) => {
        readonly agents: readonly QuantSkillsAgentDefinition[];
        readonly result: T;
    } | Promise<{
        readonly agents: readonly QuantSkillsAgentDefinition[];
        readonly result: T;
    }>): Promise<T>;
    private read;
    private write;
    private path;
}
/**
 * Deep-freeze one parsed or newly constructed definition.
 * @param definition - validated Agent data.
 * @returns immutable branded definition.
 */
export declare function freezeDefinition(definition: {
    readonly agentId: string;
    readonly revision: number;
    readonly name: string;
    readonly role: string;
    readonly mode: 'dynamic' | 'fixed';
    readonly model?: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string | undefined;
    } | undefined;
    readonly permission: 'read-only' | 'workspace-write' | 'danger-full-access';
    readonly sourceVersionId?: string | undefined;
    readonly skills: readonly {
        readonly assetId: string;
        readonly versionId: string;
        readonly commit: string;
        readonly treeDigest: string;
    }[];
    readonly createdAt: number;
    readonly updatedAt: number;
}): QuantSkillsAgentDefinition;
//# sourceMappingURL=agent-store.d.ts.map