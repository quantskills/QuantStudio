import { type DatabaseAccess } from './DatabasePage.tsx';
import type { ContestAccess } from './contest.ts';
import type { FactorContestAccess } from './factor-contest.ts';
import type { FlyAccess } from './fly/transport.ts';
import { type ManualSkillSave } from './ManualSkillEditor.tsx';
import { type ReactNode, type RefObject } from 'react';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest, QuantSkillsAgentUpdateRequest, QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest, QuantSkillsAgentTeamUpdateRequest, QuantSkillsAssetReadme, QuantSkillsSessionBinding, QuantSkillsResultPreview, QuantSkillsApplicationUpdateCheckRequest, QuantSkillsApplicationUpdateStartResult, QuantSkillsApplicationUpdateStatus, QuantSkillsWorkspaceStatusResult, PandaMcpStatus } from './plugin-types.ts';
import type { InjectFace, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore, QuantSkillsAgentTeamBuilderSeed, QuantSkillsNotificationObservation } from './store.ts';
import type { QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsAgentModelOption, QuantSkillsAgentsSnapshot, QuantSkillsAuthoringKind, QuantSkillsInstalledVersion, QuantSkillsSessionsSnapshot } from './types.ts';
import { type QuantSkillsPreparedResultArtifact } from './result-data.ts';
import { type ModelAccess } from './QuantSkillsModelServices.tsx';
import type { ConversationTextScaleClaim, DetailsColumnClaim, DetailsColumnClaimOptions, SidebarColumnClaim, SidebarColumnClaimOptions } from './layout-contract.ts';
/** Registration-time injected application services and observable controllers. */
export interface QuantSkillsAppInjected {
    manualSkillSave?: ManualSkillSave;
    readSkillDeclaration: (versionId: string, signal: AbortSignal) => Promise<string>;
    renderPluginMarket?: () => ReactNode;
    databaseAccess?: DatabaseAccess;
    contestAccess?: ContestAccess;
    flyAccess?: FlyAccess;
    factorContestAccess?: FactorContestAccess;
    modelAccess?: ModelAccess;
    /** Whether new Sessions use the native plugin's managed-default Workspace policy. */
    managedWorkspace: boolean;
    hooks: {
        store: ViewInstance['store'];
        catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
        boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
        agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
    };
    actions: ViewActions;
    refreshCatalog: () => Promise<void>;
    applicationUpdateStatus: () => Promise<QuantSkillsApplicationUpdateStatus>;
    applicationUpdateCheck: (request: QuantSkillsApplicationUpdateCheckRequest) => Promise<QuantSkillsApplicationUpdateStartResult>;
    applicationUpdateStart: () => Promise<QuantSkillsApplicationUpdateStartResult>;
    readAssetReadme: (asset: QuantSkillsAsset, signal?: AbortSignal) => Promise<QuantSkillsAssetReadme>;
    installAsset: (asset: QuantSkillsAsset) => Promise<void>;
    uninstallAsset?: ((assetId: string) => Promise<void>) | undefined;
    uninstallAgent?: ((request: QuantSkillsAgentDeleteRequest) => Promise<void>) | undefined;
    openSession: (id: SessionId) => void;
    startSession: () => Promise<void>;
    startSkillSession: (asset: QuantSkillsAsset, version: QuantSkillsInstalledVersion) => Promise<void>;
    startBoundSession: (binding: QuantSkillsSessionBinding, label: string) => Promise<void>;
    createAgent: (request: QuantSkillsAgentCreateRequest) => Promise<QuantSkillsAgentDefinition>;
    updateAgent: (request: QuantSkillsAgentUpdateRequest) => Promise<QuantSkillsAgentDefinition>;
    deleteAgent: (request: QuantSkillsAgentDeleteRequest) => Promise<void>;
    startAgentSession: (definition: QuantSkillsAgentDefinition) => Promise<SessionId>;
    createAgentTeam: (request: QuantSkillsAgentTeamCreateRequest) => Promise<QuantSkillsAgentTeamDefinition>;
    updateAgentTeam: (request: QuantSkillsAgentTeamUpdateRequest) => Promise<QuantSkillsAgentTeamDefinition>;
    deleteAgentTeam: (request: QuantSkillsAgentTeamDeleteRequest) => Promise<void>;
    startAgentTeamSession: (definition: QuantSkillsAgentTeamDefinition) => Promise<SessionId>;
    testAgent: (definition: QuantSkillsAgentDefinition) => Promise<SessionId>;
    listAgentModels: () => Promise<readonly QuantSkillsAgentModelOption[]>;
    generateAgentRole: (request: QuantSkillsAgentRoleDraftRequest, signal?: AbortSignal) => Promise<string>;
    installAgent: (asset: QuantSkillsAsset) => Promise<QuantSkillsAgentDefinition>;
    refreshAgents: () => Promise<void>;
    refreshBoundSessions: () => Promise<void>;
    workspaceStatus: () => Promise<QuantSkillsWorkspaceStatusResult>;
    setDefaultWorkspace: (workspaceId?: string) => Promise<void>;
    pandaMcpStatus: () => Promise<PandaMcpStatus>;
    authenticatePandaMcp: () => Promise<PandaMcpStatus>;
    refreshPandaMcp: () => Promise<PandaMcpStatus>;
    logoutPandaMcp: () => Promise<PandaMcpStatus>;
    startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>;
    openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void;
    send: (text: string) => Promise<void>;
    startTask: (text: string, assetName?: string) => Promise<QuantSkillsTaskStartResult>;
}
/** Exact trusted catalog 技能 recommended by the AI task matcher. */
export interface QuantSkillsTaskSuggestion {
    /** Stable QuantSkills repository name. */
    readonly asset: string;
    /** User-facing catalog title. */
    readonly title: string;
    /** Model-authored explanation grounded in the user's current requirement. */
    readonly reason: string;
}
/** Outcome of resolving and optionally starting a task from the home composer. */
export type QuantSkillsTaskStartResult = Readonly<{
    readonly kind: 'started';
    readonly asset: string;
    readonly title: string;
} | {
    readonly kind: 'clarification';
    readonly message: string;
    readonly question: string;
    readonly options: readonly string[];
} | {
    readonly kind: 'recommendations';
    readonly message: string;
    readonly suggestions: readonly QuantSkillsTaskSuggestion[];
} | {
    readonly kind: 'creation';
    readonly message: string;
}>;
/** Model-visible inputs used to draft one 专家 role without mutating the editor. */
export interface QuantSkillsAgentRoleDraftRequest {
    /** User-facing 专家 name, or blank while creating a new definition. */
    readonly name: string;
    /** Existing role text used as revision context. */
    readonly currentRole: string;
    /** How the installed 技能 versions will be offered to the 专家. */
    readonly mode: AgentEditorDraft['mode'];
    /** Exact installed Skills currently selected in the editor. */
    readonly skills: readonly {
        readonly title: string;
        readonly versionId: string;
    }[];
    /** Optional user direction for this generation only. */
    readonly instruction: string;
    /** Optional editor-selected model. */
    readonly model?: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string;
    };
}
/** Injected navigation-rail state and actions. */
export interface QuantSkillsRailInjected {
    hooks: {
        store: ViewInstance['store'];
        notifications: NotificationInstance['store'];
    };
    actions: ViewActions;
    collapse: () => void;
}
/** Injected state and actions for the native DSH application adapter. */
export interface QuantSkillsPluginFrameInjected {
    modelAccess: ModelAccess;
    flyAccess: FlyAccess;
    hooks: {
        view: ViewInstance['store'];
        layout: LayoutInstance['store'];
        catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
        boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
        agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
        notifications: NotificationInstance['store'];
    };
    actions: ViewActions;
    openSession: (id: SessionId) => void;
    acknowledgeNotification: (id: SessionId) => void;
    renameSession: (id: SessionId, title: string) => Promise<void>;
    removeSessions: (ids: readonly SessionId[]) => Promise<void>;
    startSession: () => Promise<void>;
    startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>;
    openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void;
    claimSidebar: (options: SidebarColumnClaimOptions) => SidebarColumnClaim;
    claimDetails: (options: DetailsColumnClaimOptions) => DetailsColumnClaim;
    claimConversationTextScale: (scale: number) => ConversationTextScaleClaim;
    openResults: () => void;
    closeResults: () => void;
    close: () => void;
}
/** Injected action and notification state for the native DSH sidebar launcher. */
export interface QuantSkillsPluginLauncherInjected {
    hooks: {
        notifications: NotificationInstance['store'];
    };
    open: () => void;
}
/** Injected result-drawer actions. */
export interface QuantSkillsResultInjected {
    revealFile?: (path: string) => Promise<void>;
    saveFileAs?: (path: string) => Promise<void>;
    hooks: {
        resultRequest: ViewInstance['store'];
    };
    close: () => void;
    listFiles: (signal?: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>;
    prepareFiles: (paths: readonly string[], signal?: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>;
    openFile: (path: string) => Promise<void>;
    previewFile: (path: string) => Promise<QuantSkillsResultPreview>;
    openOutputDirectory: (path?: string) => Promise<void>;
    continueWithResults: (paths: readonly string[]) => Promise<void>;
    acknowledgePreviewFocus: (sequence: number) => void;
    triggerRef: RefObject<HTMLElement | null>;
    docked: boolean;
}
/** Injected action that opens the current bound Session's result workbench. */
export interface QuantSkillsResultActionInjected {
    open: (trigger: HTMLElement) => void;
    complete: (sessionId: SessionId) => void;
}
/** Authoring actions exposed in the resident conversation header. */
export interface QuantSkillsAuthoringActionInjected {
    start: (kind: QuantSkillsAuthoringKind) => Promise<void>;
    openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void;
}
type ViewStore = ReturnType<typeof createQuantSkillsViewStore>;
type ViewInstance = ReturnType<ViewStore['create']>;
type ViewActions = ViewInstance['actions'];
type LayoutStore = ReturnType<typeof createQuantSkillsLayoutStore>;
type LayoutInstance = ReturnType<LayoutStore['create']>;
type NotificationStore = ReturnType<typeof createQuantSkillsNotificationStore>;
type NotificationInstance = ReturnType<NotificationStore['create']>;
/** Shared page projection injected into the QuantSkills-owned root frame. */
export interface QuantSkillsFrameInjected {
    hooks: {
        view: ViewInstance['store'];
        catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
        boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
        agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
        notifications: NotificationInstance['store'];
    };
    openSession: (id: SessionId) => void;
    syncNotifications: (observations: readonly QuantSkillsNotificationObservation[]) => void;
    acknowledgeNotification: (id: SessionId) => void;
    renameSession: (id: SessionId, title: string) => Promise<void>;
    removeSessions: (ids: readonly SessionId[]) => Promise<void>;
    startSession: () => Promise<void>;
    startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>;
    openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void;
}
export type QuantSkillsFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'sidebar' | 'quantskills.page' | 'quantskills.results' | 'conversation' | 'details' | 'shell.overlay'> & PropsStore<LayoutStore> & InjectFace<QuantSkillsFrameInjected>;
export type QuantSkillsAppProps = PropsRuntime<'quantskills.page'> & InjectFace<QuantSkillsAppInjected>;
export type QuantSkillsRailProps = PropsRuntime<'sidebar'> & PropsRenderSlots<'sidebar.footer.action'> & InjectFace<QuantSkillsRailInjected>;
export type QuantSkillsPluginFrameProps = PropsRuntime<'shell.overlay'> & PropsRenderSlots<'quantskills.page' | 'quantskills.results'> & InjectFace<QuantSkillsPluginFrameInjected>;
export type QuantSkillsPluginLauncherProps = PropsRuntime<'sidebar.footer.action'> & InjectFace<QuantSkillsPluginLauncherInjected>;
export type QuantSkillsResultProps = PropsRuntime<'quantskills.results'> & InjectFace<QuantSkillsResultInjected>;
export type QuantSkillsResultActionProps = PropsRuntime<'conversation.session.header.actions'> & QuantSkillsResultActionInjected;
export type QuantSkillsAuthoringActionProps = QuantSkillsAuthoringActionInjected;
/** DSH-compatible root frame that keeps the stock conversation services while replacing the stock visual shell. */
export declare function QuantSkillsFrame({ useStore, actions, useSessions, useView, useCatalog, useBoundSessions, useAgents, useNotifications, renderSlot, openSession, syncNotifications, acknowledgeNotification, renameSession, removeSessions, startSession, startAuthoringSession, openAgentTeamBuilder, }: QuantSkillsFrameProps): import("react").JSX.Element;
/** Full-screen QuantSkills application hosted by the stock DSH shell. */
export declare function QuantSkillsPluginFrame({ useView, useLayout, useCatalog, useBoundSessions, useAgents, useSessions, useNotifications, renderSlot, actions, openSession, acknowledgeNotification, renameSession, removeSessions, startSession, startAuthoringSession, openAgentTeamBuilder, claimSidebar, claimDetails, claimConversationTextScale, openResults, closeResults, close, modelAccess, flyAccess, }: QuantSkillsPluginFrameProps): import("react").JSX.Element | null;
/** QuantSkills application launcher contributed to the stock Host sidebar. */
export declare function QuantSkillsPluginLauncher({ wide, useNotifications, open }: QuantSkillsPluginLauncherProps): import("react").JSX.Element;
/** Compact DSH-consistent application rail used by every QuantSkills screen. */
export declare function QuantSkillsRail({ collapsed, useStore, useNotifications, actions, collapse, renderSlot, }: QuantSkillsRailProps): import("react").JSX.Element;
/** Seven-screen QuantSkills application projected from DSH state and the published catalog. */
export declare function QuantSkillsApp(props: QuantSkillsAppProps): import("react").JSX.Element;
interface AgentEditorDraft {
    readonly name: string;
    readonly role: string;
    readonly mode: 'dynamic' | 'fixed';
    readonly versionIds: readonly string[];
    readonly modelKey: string;
    readonly reasoningEffort: string;
    readonly permission: 'read-only' | 'workspace-write' | 'danger-full-access';
}
/** Starts a durable, independent AI authoring conversation from any QuantSkills Session. */
export declare function QuantSkillsAuthoringAction({ start }: QuantSkillsAuthoringActionProps): import("react").JSX.Element;
/** Header action shown only when the Host projection binds this Session to QuantSkills. */
export declare function QuantSkillsResultAction({ useProjection, useSession, useChat, open, complete, }: QuantSkillsResultActionProps): import("react").JSX.Element | null;
/** Current QuantSkills Session's real, read-only result workbench. */
export declare function QuantSkillsResultPanel({ close, listFiles, prepareFiles, openFile, previewFile, revealFile, saveFileAs, continueWithResults, acknowledgePreviewFocus, triggerRef, docked, mode: panelMode, maximized, expand, toggleMaximized, useProjection, useSession, useChat, useSessions, useResultRequest, sessionId, }: QuantSkillsResultProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=QuantSkillsApp.d.ts.map