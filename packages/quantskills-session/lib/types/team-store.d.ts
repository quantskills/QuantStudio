/** Durable Host-owned storage for user-authored QuantSkills Agent Team definitions. */
import { z } from 'zod';
import type { QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamId, QuantSkillsAgentTeamModelChoice, QuantSkillsAgentTeamMemberSessionBinding } from './types.ts';
/** Maximum UTF-8 byte size accepted for the complete Agent Team document. */
export declare const MAX_AGENT_TEAM_DOCUMENT_BYTES: number;
/** Maximum number of declared teammates in one Agent Team. */
export declare const MAX_AGENT_TEAM_MEMBERS = 8;
/** Durable schema for one explicit Agent Team role model policy. */
export declare const quantSkillsAgentTeamModelChoiceSchema: z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"default">;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"fixed">;
    selection: z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
        reasoningEffort: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>], "kind">, z.ZodTransform<{
    readonly kind: "default";
} | {
    readonly kind: "fixed";
    readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
}, {
    kind: "default";
} | {
    kind: "fixed";
    selection: {
        provider: string;
        model: string;
        reasoningEffort?: string | undefined;
    };
}>>;
/** Durable schema for one complete Agent Team definition. */
export declare const quantSkillsAgentTeamDefinitionSchema: z.ZodPipe<z.ZodObject<{
    teamId: z.ZodString;
    revision: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodString;
    lead: z.ZodPipe<z.ZodObject<{
        agentId: z.ZodString;
        revision: z.ZodNumber;
        name: z.ZodString;
        role: z.ZodString;
        mode: z.ZodEnum<{
            dynamic: "dynamic";
            fixed: "fixed";
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
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
        mode: "dynamic" | "fixed";
        permission: "read-only" | "workspace-write" | "danger-full-access";
        skills: Readonly<{
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
    leadModel: z.ZodOptional<z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"default">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        selection: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
            reasoningEffort: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>], "kind">, z.ZodTransform<{
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    }, {
        kind: "default";
    } | {
        kind: "fixed";
        selection: {
            provider: string;
            model: string;
            reasoningEffort?: string | undefined;
        };
    }>>>;
    members: z.ZodArray<z.ZodPipe<z.ZodObject<{
        name: z.ZodString;
        context: z.ZodEnum<{
            fresh: "fresh";
            fork: "fork";
        }>;
        agent: z.ZodPipe<z.ZodObject<{
            agentId: z.ZodString;
            revision: z.ZodNumber;
            name: z.ZodString;
            role: z.ZodString;
            mode: z.ZodEnum<{
                dynamic: "dynamic";
                fixed: "fixed";
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
                assetId: import("./types.ts").QuantSkillsAssetId;
                versionId: import("./types.ts").QuantSkillsInstalledVersionId;
                commit: import("./types.ts").QuantSkillsCommitSha;
                treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
            mode: "dynamic" | "fixed";
            permission: "read-only" | "workspace-write" | "danger-full-access";
            skills: Readonly<{
                assetId: import("./types.ts").QuantSkillsAssetId;
                versionId: import("./types.ts").QuantSkillsInstalledVersionId;
                commit: import("./types.ts").QuantSkillsCommitSha;
                treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
        model: z.ZodOptional<z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"default">;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"fixed">;
            selection: z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
                reasoningEffort: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>;
        }, z.core.$strict>], "kind">, z.ZodTransform<{
            readonly kind: "default";
        } | {
            readonly kind: "fixed";
            readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
        }, {
            kind: "default";
        } | {
            kind: "fixed";
            selection: {
                provider: string;
                model: string;
                reasoningEffort?: string | undefined;
            };
        }>>>;
    }, z.core.$strict>, z.ZodTransform<Readonly<{
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model: QuantSkillsAgentTeamModelChoice;
    }>, {
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model?: {
            readonly kind: "default";
        } | {
            readonly kind: "fixed";
            readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
        } | undefined;
    }>>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>, z.ZodTransform<QuantSkillsAgentTeamDefinition, {
    teamId: string;
    revision: number;
    name: string;
    description: string;
    lead: QuantSkillsAgentDefinition;
    members: Readonly<{
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model: QuantSkillsAgentTeamModelChoice;
    }>[];
    createdAt: number;
    updatedAt: number;
    leadModel?: {
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    } | undefined;
}>>;
/** Durable schema for one immutable Agent Team Session binding. */
export declare const quantSkillsAgentTeamSessionSchema: z.ZodPipe<z.ZodObject<{
    teamId: z.ZodString;
    revision: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodString;
    lead: z.ZodPipe<z.ZodObject<{
        agentId: z.ZodString;
        revision: z.ZodNumber;
        name: z.ZodString;
        role: z.ZodString;
        mode: z.ZodEnum<{
            dynamic: "dynamic";
            fixed: "fixed";
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
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
        mode: "dynamic" | "fixed";
        permission: "read-only" | "workspace-write" | "danger-full-access";
        skills: Readonly<{
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
    leadModel: z.ZodOptional<z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"default">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        selection: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
            reasoningEffort: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>], "kind">, z.ZodTransform<{
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    }, {
        kind: "default";
    } | {
        kind: "fixed";
        selection: {
            provider: string;
            model: string;
            reasoningEffort?: string | undefined;
        };
    }>>>;
    members: z.ZodArray<z.ZodPipe<z.ZodObject<{
        name: z.ZodString;
        context: z.ZodEnum<{
            fresh: "fresh";
            fork: "fork";
        }>;
        agent: z.ZodPipe<z.ZodObject<{
            agentId: z.ZodString;
            revision: z.ZodNumber;
            name: z.ZodString;
            role: z.ZodString;
            mode: z.ZodEnum<{
                dynamic: "dynamic";
                fixed: "fixed";
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
                assetId: import("./types.ts").QuantSkillsAssetId;
                versionId: import("./types.ts").QuantSkillsInstalledVersionId;
                commit: import("./types.ts").QuantSkillsCommitSha;
                treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
            mode: "dynamic" | "fixed";
            permission: "read-only" | "workspace-write" | "danger-full-access";
            skills: Readonly<{
                assetId: import("./types.ts").QuantSkillsAssetId;
                versionId: import("./types.ts").QuantSkillsInstalledVersionId;
                commit: import("./types.ts").QuantSkillsCommitSha;
                treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
        model: z.ZodOptional<z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"default">;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"fixed">;
            selection: z.ZodObject<{
                provider: z.ZodString;
                model: z.ZodString;
                reasoningEffort: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>;
        }, z.core.$strict>], "kind">, z.ZodTransform<{
            readonly kind: "default";
        } | {
            readonly kind: "fixed";
            readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
        }, {
            kind: "default";
        } | {
            kind: "fixed";
            selection: {
                provider: string;
                model: string;
                reasoningEffort?: string | undefined;
            };
        }>>>;
    }, z.core.$strict>, z.ZodTransform<Readonly<{
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model: QuantSkillsAgentTeamModelChoice;
    }>, {
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model?: {
            readonly kind: "default";
        } | {
            readonly kind: "fixed";
            readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
        } | undefined;
    }>>>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>, z.ZodTransform<QuantSkillsAgentTeamDefinition, {
    teamId: string;
    revision: number;
    name: string;
    description: string;
    lead: QuantSkillsAgentDefinition;
    members: Readonly<{
        name: string;
        context: "fresh" | "fork";
        agent: QuantSkillsAgentDefinition;
        model: QuantSkillsAgentTeamModelChoice;
    }>[];
    createdAt: number;
    updatedAt: number;
    leadModel?: {
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    } | undefined;
}>>;
/** Durable schema for one continuable Agent Team member Session. */
export declare const quantSkillsAgentTeamMemberSessionSchema: z.ZodPipe<z.ZodObject<{
    teamId: z.ZodString;
    teamRevision: z.ZodNumber;
    memberName: z.ZodString;
    agent: z.ZodPipe<z.ZodObject<{
        agentId: z.ZodString;
        revision: z.ZodNumber;
        name: z.ZodString;
        role: z.ZodString;
        mode: z.ZodEnum<{
            dynamic: "dynamic";
            fixed: "fixed";
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
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
        mode: "dynamic" | "fixed";
        permission: "read-only" | "workspace-write" | "danger-full-access";
        skills: Readonly<{
            assetId: import("./types.ts").QuantSkillsAssetId;
            versionId: import("./types.ts").QuantSkillsInstalledVersionId;
            commit: import("./types.ts").QuantSkillsCommitSha;
            treeDigest: import("./types.ts").QuantSkillsTreeDigest;
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
    model: z.ZodOptional<z.ZodPipe<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"default">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        selection: z.ZodObject<{
            provider: z.ZodString;
            model: z.ZodString;
            reasoningEffort: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>], "kind">, z.ZodTransform<{
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    }, {
        kind: "default";
    } | {
        kind: "fixed";
        selection: {
            provider: string;
            model: string;
            reasoningEffort?: string | undefined;
        };
    }>>>;
}, z.core.$strict>, z.ZodTransform<Readonly<{
    teamId: QuantSkillsAgentTeamId;
    teamRevision: number;
    memberName: string;
    agent: QuantSkillsAgentDefinition;
    model: QuantSkillsAgentTeamModelChoice;
}>, {
    teamId: string;
    teamRevision: number;
    memberName: string;
    agent: QuantSkillsAgentDefinition;
    model?: {
        readonly kind: "default";
    } | {
        readonly kind: "fixed";
        readonly selection: import("./types.ts").QuantSkillsAgentModelSelection;
    } | undefined;
}>>;
/** Host-owned durable Agent Team definition store with serialized atomic mutations. */
export declare class QuantSkillsAgentTeamStore {
    private readonly root;
    private tail;
    /** @param dshHome - optional Harness home override. */
    constructor(dshHome?: string);
    /**
     * Read every validated definition ordered by most recent update.
     * @returns immutable Team definitions.
     */
    list(): Promise<readonly QuantSkillsAgentTeamDefinition[]>;
    /**
     * Serialize one read-modify-write transaction.
     * @param mutation - pure replacement calculated from the latest stored definitions.
     * @returns the mutation's result after the replacement is durable.
     */
    mutate<T>(mutation: (teams: readonly QuantSkillsAgentTeamDefinition[]) => {
        readonly teams: readonly QuantSkillsAgentTeamDefinition[];
        readonly result: T;
    }): Promise<T>;
    private read;
    private write;
    private path;
}
/**
 * Deep-freeze one parsed or newly constructed Agent Team definition.
 * @param definition - validated complete Team value.
 * @returns the immutable branded Team definition.
 */
export declare function freezeTeamDefinition(definition: {
    readonly teamId: string;
    readonly revision: number;
    readonly name: string;
    readonly description: string;
    readonly lead: QuantSkillsAgentDefinition;
    readonly leadModel?: QuantSkillsAgentTeamModelChoice | undefined;
    readonly members: readonly {
        readonly name: string;
        readonly context: 'fresh' | 'fork';
        readonly agent: QuantSkillsAgentDefinition;
        readonly model?: QuantSkillsAgentTeamModelChoice | undefined;
    }[];
    readonly createdAt: number;
    readonly updatedAt: number;
}): QuantSkillsAgentTeamDefinition;
/**
 * Freeze one Team member Session binding.
 * @param input - exact Team revision, member name, and Agent snapshot.
 * @returns the immutable member Session binding.
 */
export declare function freezeTeamMemberSessionBinding(input: {
    readonly teamId: string;
    readonly teamRevision: number;
    readonly memberName: string;
    readonly agent: QuantSkillsAgentDefinition;
    readonly model?: QuantSkillsAgentTeamModelChoice | undefined;
}): QuantSkillsAgentTeamMemberSessionBinding;
/**
 * Deep-freeze one explicit Team role model choice.
 * @param choice - default or exact provider/model selection.
 * @returns detached immutable choice.
 */
export declare function freezeTeamModelChoice(choice: QuantSkillsAgentTeamModelChoice): QuantSkillsAgentTeamModelChoice;
//# sourceMappingURL=team-store.d.ts.map