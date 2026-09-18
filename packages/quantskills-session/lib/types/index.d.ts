/** Exact-version QuantSkills session composition and log-backed archive remotes. */
import type { ContestJevSettings, ContestJevUsage, ContestWatchConfig, ContestWatchDataset, ContestWatchTemplate, ContestWatchStatus } from './contest-watch-types.ts';
import type { FactorContestStatus, FactorCredentials, FactorInspection, FactorPlan, FactorPlanAction, FactorQuery, FactorRun } from './factor-contest-types.ts';
import type { ContestStatus, ContestData, ContestQuery, ContestPlan, ContestInspection } from './contest-types.ts';
import type { ContestSessionOpenRequest, ContestSessionOpenResult } from './types.ts';
import type { QuantSkillsLibrarySourceRecord } from './types.ts';
import type { Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type JsonValue } from '@deepseek-ai/dsh-util-values';
import { z } from 'zod';
import type { QuantSkillsFrequentRequest, QuantSkillsFrequentSkill, QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest, QuantSkillsAgentSessionArchiveItem, QuantSkillsAgentSessionBinding, QuantSkillsAgentSessionCreateRequest, QuantSkillsAgentSessionCreateResult, QuantSkillsAgentUpdateRequest, QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest, QuantSkillsAgentTeamMemberSessionBinding, QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsAgentTeamSessionBinding, QuantSkillsAgentTeamSessionCreateRequest, QuantSkillsAgentTeamSessionCreateResult, QuantSkillsAgentTeamUpdateRequest, QuantSkillsFileAttachRequest, QuantSkillsFileListRequest, QuantSkillsFileListResult, QuantSkillsFileReadRequest, QuantSkillsFileReadResult, QuantSkillsPromptFormListRequest, QuantSkillsPromptFormListResult, QuantSkillsPromptFormRenderRequest, QuantSkillsPromptFormRenderResult, QuantSkillsSessionFileAttachment, QuantSkillsResultPrepareRequest, QuantSkillsResultPrepareResult, QuantSkillsResultPreview, QuantSkillsResultPreviewRequest, QuantSkillsResidentSkillAttachRequest, QuantSkillsResidentSkillChange, QuantSkillsResidentSkillDetachRequest, QuantSkillsResidentSkillResult, QuantSkillsSessionArchiveItem, QuantSkillsPlainSessionArchiveItem, QuantSkillsSessionBinding, QuantSkillsSessionCreateRequest, QuantSkillsSessionCreateResult, QuantSkillsSessionEnsureRequest, QuantSkillsSessionEnsureResult, QuantSkillsPlainSessionBinding, QuantSkillsPlainSessionCreateRequest, QuantSkillsPlainSessionCreateResult, QuantSkillsSessionListRequest, QuantSkillsWorkspaceRequest, QuantSkillsWorkspaceResolveResult, QuantSkillsWorkspaceStatusResult, QuantSkillsPandaRuntimeBinding, QuantSkillsAuthoringKind, QuantSkillsAuthoringCommitRequest, QuantSkillsAuthoringCommitResult, QuantSkillsAuthoringCommitted, QuantSkillsAuthoringSessionCreateRequest, QuantSkillsAuthoringStarted } from './types.ts';
import type { ModelAccessRequest, ModelAccessResponse } from './model-access-types.ts';
export type * from './types.ts';
/** Default maximum bytes decoded by the built-in UTF-8 attachment reader. */
export declare const DEFAULT_MAX_TEXT_ATTACHMENT_BYTES: number;
/** Default maximum source bytes accepted by the built-in document parser. */
export declare const DEFAULT_MAX_DOCUMENT_ATTACHMENT_BYTES: number;
/** Default maximum workspace-file bytes returned by the result preview Remote. */
export declare const DEFAULT_MAX_RESULT_PREVIEW_BYTES: number;
/** Default maximum bytes copied from one legacy installed-Skill result into a Session workspace. */
export declare const DEFAULT_MAX_RESULT_ARCHIVE_BYTES: number;
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** QuantSkills session creator and log-backed archive service. */
        quantSkillsSessions: QuantSkillsSessionService;
    }
}
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /** Durable ownership and purpose for a plain QuantSkills Session. */
        'quantskills/plain-session': QuantSkillsPlainSessionBinding;
        /**
         * Exact installed Skill version that determines this session's scoped Skill provider.
         * Required-on-read and log-only; it does not enter the model message surface.
         */
        'quantskills/session-bound': QuantSkillsSessionBinding;
        /** Complete immutable user Agent composition that this Session runs. */
        'quantskills/agent-session': QuantSkillsAgentSessionBinding;
        /** Complete immutable Agent Team composition that this Team Lead Session runs. */
        'quantskills/agent-team-session': QuantSkillsAgentTeamSessionBinding;
        /** Exact declared Agent identity assigned to this continuable Team member Session. */
        'quantskills/agent-team-member': QuantSkillsAgentTeamMemberSessionBinding;
        /** Exact Skill version attached to or detached from the Session-resident composition. */
        'quantskills/resident-skill-changed': QuantSkillsResidentSkillChange;
        /** Immutable generic file owned by this QuantSkills Session. */
        'quantskills/file-attached': QuantSkillsSessionFileAttachment;
        /** Exact PandaData runtime used by this QuantSkills Session. */
        'panda/runtime-bound': QuantSkillsPandaRuntimeBinding;
        /** Dedicated authoring purpose that controls which draft tool the Session receives. */
        'quantskills/authoring-started': QuantSkillsAuthoringStarted;
        /** Explicitly confirmed immutable publication derived from one successful draft Tool Result. */
        'quantskills/authoring-committed': QuantSkillsAuthoringCommitted;
    }
}
/** Loader configuration for durable user Agent definitions. */
export interface Config {
    /** Harness home override. */
    readonly dshHome?: string;
    /** Maximum UTF-8 bytes exposed by the built-in attachment reader. */
    readonly maxTextAttachmentBytes?: number;
    /** Maximum PDF or Office source bytes admitted to the built-in parser. */
    readonly maxDocumentAttachmentBytes?: number;
    /** Maximum decoded bytes accepted for one generic file. */
    readonly maxFileAttachmentBytes?: number;
    /** Maximum aggregate generic-file bytes accepted by one Session. */
    readonly maxSessionFileAttachmentBytes?: number;
    /** Maximum complete workspace-file bytes returned to one result preview. */
    readonly maxResultPreviewBytes?: number;
    /** Maximum bytes copied from one legacy installed-Skill result into a Session workspace. */
    readonly maxResultArchiveBytes?: number;
    /** Exact DSH tool names that submit live orders and must ask on every call. */
    readonly liveTradingToolNames?: string[];
    /** Continuable-subagent provider used by fresh Agent Team members. */
    readonly teamFreshProvider?: string;
    /** Continuable-subagent provider used by forked Agent Team members. */
    readonly teamForkProvider?: string;
}
/** Rejection of a SessionId already owned by a different or ordinary session. */
export declare class QuantSkillsSessionConflictError extends Error {
    readonly name = "QuantSkillsSessionConflictError";
}
/**
 * Parse one plain QuantSkills ownership marker at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable ownership and purpose.
 */
export declare function parseQuantSkillsPlainSessionBinding(value: unknown): QuantSkillsPlainSessionBinding;
/**
 * Fold the once-only plain QuantSkills ownership marker from a Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the ownership marker, or null for every other Session.
 * @throws when the marker is malformed or repeated.
 */
export declare function foldQuantSkillsPlainSessionBinding(events: readonly SessionEvent[]): QuantSkillsPlainSessionBinding | null;
/**
 * Parse and freeze one binding at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated exact-version binding.
 */
export declare function parseQuantSkillsSessionBinding(value: unknown): QuantSkillsSessionBinding;
/**
 * Fold the once-only binding event from a complete or prefix session log.
 * @param events - live, restored, or persisted session events.
 * @returns the exact binding, or null for an ordinary session.
 * @throws when a binding is malformed or repeated.
 */
export declare function foldQuantSkillsSessionBinding(events: readonly SessionEvent[]): QuantSkillsSessionBinding | null;
/**
 * Parse and freeze one user Agent Session definition at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable Agent composition.
 */
export declare function parseQuantSkillsAgentSession(value: unknown): QuantSkillsAgentSessionBinding;
/**
 * Fold the once-only user Agent composition from a Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the immutable Agent composition, or null for every other Session.
 * @throws when the event is malformed or repeated.
 */
export declare function foldQuantSkillsAgentSession(events: readonly SessionEvent[]): QuantSkillsAgentSessionBinding | null;
/**
 * Parse one immutable Agent Team Session binding at the durable-log boundary.
 * @param value - untrusted durable payload.
 * @returns the validated immutable Team binding.
 */
export declare function parseQuantSkillsAgentTeamSession(value: unknown): QuantSkillsAgentTeamSessionBinding;
/**
 * Fold the Team Lead composition from a Session log. A forked teammate inherits
 * the Lead prefix, then its member event replaces that inherited identity.
 * @param events - live, restored, or persisted Session events.
 * @returns the immutable Team binding, or null for a non-Lead Session.
 */
export declare function foldQuantSkillsAgentTeamSession(events: readonly SessionEvent[]): QuantSkillsAgentTeamSessionBinding | null;
/**
 * Parse one immutable Agent Team member binding at the durable-log boundary.
 * @param value - untrusted durable payload.
 * @returns the validated immutable member binding.
 */
export declare function parseQuantSkillsAgentTeamMemberSession(value: unknown): QuantSkillsAgentTeamMemberSessionBinding;
/**
 * Fold the once-only exact Agent identity of a continuable Team member.
 * @param events - live, restored, or persisted Session events.
 * @returns the member binding, or null for every other Session.
 */
export declare function foldQuantSkillsAgentTeamMemberSession(events: readonly SessionEvent[]): QuantSkillsAgentTeamMemberSessionBinding | null;
/**
 * Fold the effective resident Skill set from immutable base bindings and later hot-plug transitions.
 * @param events - live, restored, or persisted Session events.
 * @returns exact Skill bindings in stable attachment order.
 */
export declare function foldQuantSkillsResidentSkills(events: readonly SessionEvent[]): readonly QuantSkillsSessionBinding[];
/**
 * Parse one generic-file ownership event at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable attachment metadata.
 */
export declare function parseQuantSkillsSessionFileAttachment(value: unknown): QuantSkillsSessionFileAttachment;
/**
 * Fold generic-file ownership records from a complete or prefix Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns attachments in append order.
 */
export declare function foldQuantSkillsSessionFileAttachments(events: readonly SessionEvent[]): readonly QuantSkillsSessionFileAttachment[];
/**
 * Parse one exact PandaData runtime binding at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable environment identity.
 */
export declare function parseQuantSkillsPandaRuntimeBinding(value: unknown): QuantSkillsPandaRuntimeBinding;
/**
 * Fold the once-only PandaData runtime selected for one Session.
 * @param events - live, restored, or persisted Session events.
 * @returns the exact environment binding, or null for a non-Panda Session.
 */
export declare function foldQuantSkillsPandaRuntimeBinding(events: readonly SessionEvent[]): QuantSkillsPandaRuntimeBinding | null;
/**
 * Fold the once-only authoring purpose from one Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the dedicated authoring kind, or null for ordinary Sessions.
 */
export declare function foldQuantSkillsAuthoringStarted(events: readonly SessionEvent[]): QuantSkillsAuthoringKind | null;
/**
 * Parse one confirmed authoring publication at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable publication result and idempotency identity.
 */
export declare function parseQuantSkillsAuthoringCommitted(value: unknown): QuantSkillsAuthoringCommitted;
/**
 * Fold all explicitly confirmed authoring publications in durable order.
 * @param events - live, restored, or persisted Session events.
 * @returns immutable committed publications with duplicate identities rejected.
 */
export declare function foldQuantSkillsAuthoringCommitted(events: readonly SessionEvent[]): readonly QuantSkillsAuthoringCommitted[];
/** Host service for product-owned QuantSkills Sessions, exact asset composition, and durable archives. */
export declare class QuantSkillsSessionService extends TypertRemoteService {
    static inject: string[];
    static Config: s<Config>;
    private readonly libraryStore;
    private readonly modelAccess;
    /** Manage model providers through the Host settings and credential services. */
    modelsAccess(request: ModelAccessRequest): Promise<ModelAccessResponse>;
    private readonly reservations;
    private readonly plainReservations;
    private readonly agentReservations;
    private readonly agentStore;
    private readonly teamReservations;
    private readonly teamMemberReservations;
    private readonly teamRuntimes;
    private readonly teamStore;
    private readonly lifetime;
    private readonly attachmentTails;
    private readonly resultPrepareTails;
    private readonly residentSkillTails;
    private readonly authoringCommitTails;
    private readonly agentSetups;
    private readonly residentSkillRuntimes;
    private readonly maxTextAttachmentBytes;
    private readonly maxDocumentAttachmentBytes;
    private readonly maxResultPreviewBytes;
    private readonly maxResultArchiveBytes;
    private readonly fileStore;
    private readonly liveTradingToolNames;
    private readonly teamFreshProvider;
    private readonly teamForkProvider;
    private readonly workspaceResolver;
    private readonly contest;
    private readonly contestWatcher;
    private readonly factorContest;
    private factorSessionOpening;
    private contestSessionOpening;
    /**
     * @param ctx - assembled QuantSkills Host context.
     */
    constructor(ctx: Context, config: Config);
    /**
     * Inspect the optional preferred and managed QuantSkills Workspace without creating it.
     * @param request - optional user-selected Workspace.
     * @returns current Workspace targets and preference health.
     */
    workspaceStatus(request: QuantSkillsWorkspaceRequest): Promise<QuantSkillsWorkspaceStatusResult>;
    /**
     * Select the preferred Workspace or create and register the managed fallback.
     * @param request - optional user-selected Workspace.
     * @returns the explicit Workspace target for a new Session.
     */
    workspaceResolve(request: QuantSkillsWorkspaceRequest): Promise<QuantSkillsWorkspaceResolveResult>;
    /** Read local contest status without starting processes or opening a browser. */
    factorStatus(request: {
        sessionId?: string;
    }): Promise<FactorContestStatus>;
    factorMode(request: {
        enabled: boolean;
    }): Promise<FactorContestStatus>;
    factorConnect(request: {
        credentials?: FactorCredentials;
    }): Promise<FactorContestStatus>;
    factorDisconnect(): Promise<FactorContestStatus>;
    factorCheckUpdate(): Promise<FactorContestStatus>;
    factorUpdate(): Promise<FactorContestStatus>;
    factorInspect(request: {
        sessionId?: SessionId;
    }, signal?: AbortSignal): Promise<FactorInspection>;
    private factorIdentityForSession;
    factorQuery(request: FactorQuery, signal?: AbortSignal): Promise<JsonValue>;
    factorPrepare(request: {
        action: FactorPlanAction;
        sessionId?: SessionId;
    }): Promise<FactorPlan>;
    factorConfirm(request: {
        planId: string;
        sessionId: string;
    }): Promise<FactorPlan>;
    factorDismiss(request: {
        planId: string;
        sessionId: string;
    }): Promise<void>;
    factorStopBudget(request: {
        budgetId: string;
    }): Promise<void>;
    factorReconcileRun(request: {
        runId: string;
    }): Promise<FactorRun>;
    factorReconcilePlan(request: {
        planId: string;
    }): Promise<FactorPlan>;
    factorSessionOpen(request: ContestSessionOpenRequest, signal?: AbortSignal): Promise<ContestSessionOpenResult>;
    contestStatus(request: {
        sessionId?: string;
    }): Promise<ContestStatus>;
    /** Explicit application mode toggle; never changes ordinary Session composition. */
    contestMode(request: {
        enabled: boolean;
    }): Promise<ContestStatus>;
    contestConnect(): Promise<ContestStatus>;
    contestDisconnect(): Promise<ContestStatus>;
    contestCheckUpdate(): Promise<ContestStatus>;
    contestUpdate(): Promise<ContestStatus>;
    contestWatchStatus(): Promise<ContestWatchStatus>;
    contestJevSettings(): Promise<ContestJevSettings>;
    contestJevUsage(): Promise<ContestJevUsage>;
    contestWatchTemplates(): Promise<ContestWatchTemplate[]>;
    contestWatchSaveTemplate(request: ContestWatchTemplate): Promise<ContestWatchTemplate[]>;
    contestWatchDatasets(): Promise<ContestWatchDataset[]>;
    contestWatchPrepareHistory(request: {
        symbol: string;
        barSeconds: number;
    }): Promise<NonNullable<ContestWatchConfig['history']>>;
    contestJevConfigure(request: {
        apiKey?: string;
        translator?: {
            provider: string;
            model: string;
        };
    }): Promise<ContestJevSettings>;
    contestWatchStart(request: {
        config: ContestWatchConfig;
        confirmed: boolean;
    }): Promise<ContestWatchStatus>;
    contestWatchStop(): Promise<ContestWatchStatus>;
    contestQuery(request: ContestQuery, signal?: AbortSignal): Promise<ContestData>;
    /** Entry inspection is bound to the persisted conversation, never a caller-supplied account. */
    contestInspect(request: {
        sessionId: SessionId;
    }, signal?: AbortSignal): Promise<ContestInspection>;
    /** Serialize entry across clients so each account reuses one main conversation. */
    contestSessionOpen(request: ContestSessionOpenRequest, signal?: AbortSignal): Promise<ContestSessionOpenResult>;
    /** Client-only execution endpoint. The model is never given an execute tool. */
    contestExecute(request: {
        planId: string;
        sessionId: string;
    }): Promise<ContestPlan>;
    contestDismiss(request: {
        planId: string;
        sessionId: string;
    }): Promise<ContestStatus>;
    contestReconcile(request: {
        planId: string;
        sessionId: string;
    }): Promise<ContestPlan>;
    /**
     * Resume one persisted QuantSkills Session and restore its plugin-owned composition.
     * @param request - existing QuantSkills Session identity.
     * @param signal - optional caller cancellation.
     * @returns the live Session identity after setup completes.
     */
    sessionEnsure(request: QuantSkillsSessionEnsureRequest, signal?: AbortSignal): Promise<QuantSkillsSessionEnsureResult>;
    /**
     * Create or idempotently adopt one product-owned QuantSkills Session without an asset composition.
     * @param request - preallocated SessionId, explicit purpose, and ordinary create options.
     * @param signal - optional caller cancellation.
     * @returns the published Session identity and durable QuantSkills ownership marker.
     */
    plainSessionCreate(request: QuantSkillsPlainSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsPlainSessionCreateResult>;
    /**
     * Create or idempotently adopt one session under an exact installed Skill version.
     * @param request - preallocated SessionId, exact installed version, and ordinary create options.
     * @param signal - optional caller cancellation.
     * @returns the published session identity and durable binding.
     */
    create(request: QuantSkillsSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsSessionCreateResult>;
    /**
     * List real QuantSkills conversation archives from live and persisted session truth.
     * @param request - archive visibility filter.
     * @param signal - optional caller cancellation.
     * @returns Skill-bound ordinary sessions ordered by most recent activity.
     */
    list(request: QuantSkillsSessionListRequest, signal?: AbortSignal): Promise<readonly QuantSkillsSessionArchiveItem[]>;
    /**
     * List ordinary QuantSkills conversations that do not yet load a Skill, Agent, or Team.
     * @param request - archive visibility filter.
     * @param signal - optional caller cancellation.
     * @returns ordinary product-owned Sessions ordered by most recent activity.
     */
    plainSessionList(request: QuantSkillsSessionListRequest, signal?: AbortSignal): Promise<readonly QuantSkillsPlainSessionArchiveItem[]>;
    /**
     * Aggregate frequently used Skills from real bound conversation archives.
     * @param request - archive visibility and bounded result count.
     * @param signal - optional caller cancellation.
     * @returns usage rows ordered by session count and recency.
     */
    frequent(request: QuantSkillsFrequentRequest, signal?: AbortSignal): Promise<readonly QuantSkillsFrequentSkill[]>;
    /**
     * Attach one exact installed Skill as resident Session context without creating a user message.
     * @param request - live QuantSkills Session and exact installed version.
     * @param signal - optional caller cancellation.
     * @returns the authoritative resident Skill set after the append.
     */
    residentSkillAttach(request: QuantSkillsResidentSkillAttachRequest, signal?: AbortSignal): Promise<QuantSkillsResidentSkillResult>;
    /**
     * Detach one resident Skill by stable asset identity without rewriting conversation history.
     * @param request - live QuantSkills Session and resident asset identity.
     * @returns the authoritative resident Skill set after the append.
     */
    residentSkillDetach(request: QuantSkillsResidentSkillDetachRequest): Promise<QuantSkillsResidentSkillResult>;
    /**
     * List optional parameter forms reachable from the live Session composition.
     * @param request - live QuantSkills Session identity.
     * @param signal - optional caller cancellation.
     * @returns exact-version forms for resident Skills and declared Agent sources.
     */
    promptFormList(request: QuantSkillsPromptFormListRequest, signal?: AbortSignal): Promise<QuantSkillsPromptFormListResult>;
    /**
     * Render a parameter form only when its exact version belongs to the live Session.
     * @param request - Session, exact version, task, and declared field values.
     * @param signal - optional caller cancellation.
     * @returns plain text suitable for an ordinary logged user message.
     */
    promptFormRender(request: QuantSkillsPromptFormRenderRequest, signal?: AbortSignal): Promise<QuantSkillsPromptFormRenderResult>;
    /**
     * Read durable user Agent definitions ordered by most recent update.
     * @returns immutable validated definitions.
     */
    agentList(): Promise<readonly QuantSkillsAgentDefinition[]>;
    /**
     * Create one durable user Agent after resolving every exact Skill version.
     * @param request - role, orchestration mode, and ordered installed versions.
     * @param signal - optional caller cancellation.
     * @returns the Host-owned Agent definition.
     */
    /** Explicit provenance only; absent legacy rows remain unknown in the UI. */
    agentLibrarySources(): Promise<readonly QuantSkillsLibrarySourceRecord[]>;
    agentCreate(request: QuantSkillsAgentCreateRequest, signal?: AbortSignal): Promise<QuantSkillsAgentDefinition>;
    private createAgentDefinition;
    /**
     * Replace one durable user Agent through optimistic revision matching.
     * @param request - identity, expected revision, and complete editable fields.
     * @param signal - optional caller cancellation.
     * @returns the committed next revision.
     */
    agentUpdate(request: QuantSkillsAgentUpdateRequest, signal?: AbortSignal): Promise<QuantSkillsAgentDefinition>;
    /**
     * Delete one durable user Agent through optimistic revision matching.
     * Existing Agent Sessions remain reconstructable from their logs.
     * @param request - identity and expected revision.
     */
    agentDelete(request: QuantSkillsAgentDeleteRequest): Promise<void>;
    /** Uninstall an imported Agent; frozen Team definitions and session histories remain valid. */
    agentUninstall(request: QuantSkillsAgentDeleteRequest): Promise<void>;
    /**
     * Atomically create or adopt one Session under an immutable user Agent composition.
     * @param request - fresh Session id, exact Agent revision, and ordinary create options.
     * @param signal - optional caller cancellation.
     * @returns the published Session and logged Agent composition.
     */
    agentSessionCreate(request: QuantSkillsAgentSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsAgentSessionCreateResult>;
    /**
     * Atomically create one Agent Session whose authoring purpose is durable before its tools are exposed.
     * @param request - fresh Session identity, exact Agent revision, Workspace, and authoring kind.
     * @param signal - optional caller cancellation.
     * @returns the published Agent Session and exact composition.
     */
    authoringSessionCreate(request: QuantSkillsAuthoringSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsAgentSessionCreateResult>;
    /**
     * Commit one successful logged draft after an explicit Client confirmation.
     * @param request - Session-owned Tool call identity and observed content digest.
     * @param signal - optional caller cancellation.
     * @returns the immutable local asset, Agent, or Team publication.
     */
    authoringCommit(request: QuantSkillsAuthoringCommitRequest, signal?: AbortSignal): Promise<QuantSkillsAuthoringCommitResult>;
    private createAgentSession;
    /**
     * List real user Agent conversation archives from live and persisted Session truth.
     * @param request - archive visibility filter.
     * @param signal - optional caller cancellation.
     * @returns Agent-bound Sessions ordered by most recent activity.
     */
    agentSessionList(request: QuantSkillsSessionListRequest, signal?: AbortSignal): Promise<readonly QuantSkillsAgentSessionArchiveItem[]>;
    /**
     * Read saved Agent Team definitions ordered by most recent update.
     * @returns immutable Agent Team definitions.
     */
    agentTeamList(): Promise<readonly QuantSkillsAgentTeamDefinition[]>;
    /**
     * Resolve Agent references and create one immutable saved Agent Team.
     * @param request - Team name, goal, Lead revision, and member revisions.
     * @returns the saved exact Team definition.
     */
    agentTeamCreate(request: QuantSkillsAgentTeamCreateRequest): Promise<QuantSkillsAgentTeamDefinition>;
    /**
     * Replace one saved Agent Team through optimistic revision matching.
     * @param request - replacement composition and observed Team revision.
     * @returns the updated exact Team definition.
     */
    agentTeamUpdate(request: QuantSkillsAgentTeamUpdateRequest): Promise<QuantSkillsAgentTeamDefinition>;
    /**
     * Delete one saved Agent Team while preserving every existing Team Session log.
     * @param request - Team identity and observed revision.
     */
    agentTeamDelete(request: QuantSkillsAgentTeamDeleteRequest): Promise<void>;
    /**
     * Atomically create or adopt one Team Lead Session under an exact Team revision.
     * @param request - Session identity, exact Team revision, and optional Workspace selection.
     * @param signal - optional caller cancellation.
     * @returns the published Lead Session and its immutable Team binding.
     */
    agentTeamSessionCreate(request: QuantSkillsAgentTeamSessionCreateRequest, signal?: AbortSignal): Promise<QuantSkillsAgentTeamSessionCreateResult>;
    /**
     * List real Agent Team Lead conversation archives from live and persisted Session truth.
     * @param request - archive visibility filter.
     * @param signal - optional caller cancellation.
     * @returns Team Lead Sessions ordered by most recent activity.
     */
    agentTeamSessionList(request: QuantSkillsSessionListRequest, signal?: AbortSignal): Promise<readonly QuantSkillsAgentTeamSessionArchiveItem[]>;
    /**
     * Attach one immutable generic file to a live QuantSkills Session.
     * Per-Session serialization makes the aggregate byte check authoritative
     * even when browser uploads overlap.
     * @param request - Session identity, canonical base64 bytes, and display metadata.
     * @param signal - optional caller cancellation.
     * @returns the durable ownership record appended to the Session log.
     */
    fileAttach(request: QuantSkillsFileAttachRequest, signal?: AbortSignal): Promise<QuantSkillsSessionFileAttachment>;
    /**
     * List immutable generic files already owned by one QuantSkills Session.
     * @param request - Session identity.
     * @param signal - optional caller cancellation.
     * @returns durable file records plus Host-enforced limits.
     */
    fileList(request: QuantSkillsFileListRequest, signal?: AbortSignal): Promise<QuantSkillsFileListResult>;
    /**
     * Read bounded text extracted from a supported attachment owned by a QuantSkills Session.
     * @param request - Session identity and opaque attachment id.
     * @param signal - optional caller cancellation.
     * @returns verified metadata and decoded text.
     */
    fileRead(request: QuantSkillsFileReadRequest, signal?: AbortSignal): Promise<QuantSkillsFileReadResult>;
    /**
     * Normalize discovered result paths to one Session workspace. Authorized legacy Skill output
     * and successful external mutation results are copied into the Session workspace first.
     * @param request - Session identity and bounded candidate path list.
     * @param signal - optional caller cancellation.
     * @returns one ordered readiness or diagnostic result per candidate.
     */
    resultPrepare(request: QuantSkillsResultPrepareRequest, signal?: AbortSignal): Promise<QuantSkillsResultPrepareResult>;
    /**
     * Restore every previewable result referenced by the complete durable Session log.
     * The returned paths pass through the same workspace and installed-version checks as
     * candidates discovered in the currently loaded browser window.
     * @param request - QuantSkills Session identity.
     * @param signal - optional caller cancellation.
     * @returns newest-reference-first verified results from the full Session history.
     */
    resultList(request: {
        readonly sessionId: SessionId;
    }, signal?: AbortSignal): Promise<QuantSkillsResultPrepareResult>;
    /**
     * Read a bounded preview from a path contained by the addressed QuantSkills Session workspace.
     * Supported text is returned as UTF-8, Office documents as bounded extracted text,
     * and verified image/PDF bytes as canonical base64.
     * @param request - Session identity and workspace-relative produced path.
     * @param signal - optional caller cancellation.
     * @returns evidence-backed preview or an explicit unsupported result.
     */
    resultPreview(request: QuantSkillsResultPreviewRequest, signal?: AbortSignal): Promise<QuantSkillsResultPreview>;
    private resolveResultPreviewTarget;
    private resultFileResponse;
    private resolveResultSources;
    private prepareResultPath;
    private archiveExternalMutationResult;
    private archiveLegacyResult;
    private ensureAgentSetup;
    private setupAgent;
    private setupTeamMember;
    private registerTeamActivationTool;
    private registerAssetDraftTool;
    private registerAgentTeamDraftTool;
    private authoringPermission;
    private agentTeamModelCatalog;
    private reportInvalidTeamModelChoice;
    private validateTeamModelChoice;
    private installResidentRuntime;
    private registerResidentSkill;
    private requireResidentRuntime;
    private registerAttachmentTool;
    private registerLiveTradingApproval;
    private classifyFile;
    private readTextAttachment;
    /** Complete-log result candidates, newest reference first and bounded for one prepare request. */
    private resultCandidates;
    private requireLiveQuantSkillsAgent;
    private listPromptForms;
    private requireQuantSkillsSession;
    private withSessionLock;
    private agentHasResolvedSkill;
    private agentMatchesResidentLog;
    private agentHasResolvedSkills;
    private resolveAgentSkills;
    private resolveTeamRequest;
    private resolveTeamRuntime;
    private resolveBindings;
    private inspectExisting;
    private listArchives;
    private listPlainArchives;
    private listAgentArchives;
    private listTeamArchives;
    private operationSignal;
    private conflict;
}
declare const authoringReviewStateSchema: z.ZodObject<{
    kind: z.ZodNullable<z.ZodEnum<{
        skill: "skill";
        agent: "agent";
        "agent-team": "agent-team";
    }>>;
    calls: z.ZodArray<z.ZodString>;
    pending: z.ZodNullable<z.ZodObject<{
        toolCallId: z.ZodString;
        treeDigest: z.ZodString;
        kind: z.ZodEnum<{
            skill: "skill";
            agent: "agent";
            "agent-team": "agent-team";
        }>;
        name: z.ZodString;
        description: z.ZodString;
        members: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Derive a review outside collapsed tool views; replay also restores unfinished drafts. */
export declare function applyAuthoringReview(state: z.infer<typeof authoringReviewStateSchema>, event: SessionEvent): z.infer<typeof authoringReviewStateSchema>;
export default QuantSkillsSessionService;
//# sourceMappingURL=index.d.ts.map