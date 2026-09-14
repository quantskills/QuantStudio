import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { QuantSkillsAgentTeamModelChoice } from './plugin-types.ts';
import { type QuantSkillsColorScheme, type QuantSkillsDarkBackground, type QuantSkillsDefaultAgentPermission, type QuantSkillsLightBackground, type QuantSkillsSettings, type QuantSkillsAssetDisplayNameOverride } from '../appearance-settings.ts';
import type { QuantSkillsPage } from './types.ts';
/** Viewing state shared by the QuantSkills rail, pages, and drawers. */
export interface QuantSkillsViewState {
    pluginOpen: boolean;
    pluginConversationOpen: boolean;
    page: QuantSkillsPage;
    agentWorkspaceTab: 'mine' | 'teams' | 'market';
    agentTeamCreationPending: boolean;
    agentTeamBuilderSeed: QuantSkillsAgentTeamBuilderSeed | undefined;
    selectedSkill: string | undefined;
    selectedCategory: string;
    selectedAgentCategory: string;
    search: string;
    catalogView: 'list' | 'grid';
    catalogSort: 'recommended' | 'name' | 'category';
    skillDrawerOpen: boolean;
    conversationsPinned: boolean;
    settingsSection: 'plugins' | 'models' | 'workspace' | 'updates' | 'permissions' | 'appearance' | 'panda-data' | 'brand-support';
    interfaceScale: number;
    conversationScale: number;
    conversationBrightness: number;
    conversationOverlayOpacity: number;
    colorScheme: QuantSkillsColorScheme;
    lightBackground: QuantSkillsLightBackground;
    darkBackground: QuantSkillsDarkBackground;
    autoCheckCatalog: boolean;
    autoCheckPanda: boolean;
    resumeAfterPandaLogin: boolean;
    favoriteAssetIds: string[];
    assetDisplayNameOverrides: QuantSkillsAssetDisplayNameOverride[];
    defaultAgentProvider: string;
    defaultAgentModel: string;
    defaultAgentReasoningEffort: string;
    defaultAgentPermission: QuantSkillsDefaultAgentPermission;
    defaultWorkspaceId: string | undefined;
    workspaceRecoveryNotice: string | undefined;
    settingsError?: string | undefined;
    settingsStatus: 'loading' | 'ready' | 'unavailable';
    settingsWritable: boolean;
    pendingPandaTaskLabel: string | undefined;
    resultPreviewRequest: {
        sessionId: SessionId;
        path: string;
        sequence: number;
        focusPending: boolean;
    } | undefined;
}
/** Optional values prepared by AI authoring before the manual Team builder opens. */
export interface QuantSkillsAgentTeamBuilderSeed {
    readonly name: string;
    readonly description: string;
    readonly leadAgentId: string;
    readonly leadModel: QuantSkillsAgentTeamModelChoice;
    readonly members: readonly {
        readonly name: string;
        readonly agentId: string;
        readonly context: 'fresh' | 'fork';
        readonly model: QuantSkillsAgentTeamModelChoice;
    }[];
}
type QuantSkillsViewActions = {
    openPlugin: (draft: QuantSkillsViewState) => void;
    closePlugin: (draft: QuantSkillsViewState) => void;
    openPluginConversation: (draft: QuantSkillsViewState) => void;
    showPluginConversationIndex: (draft: QuantSkillsViewState) => void;
    navigate: (draft: QuantSkillsViewState, page: QuantSkillsPage) => void;
    setAgentWorkspaceTab: (draft: QuantSkillsViewState, tab: QuantSkillsViewState['agentWorkspaceTab']) => void;
    requestAgentTeamCreation: (draft: QuantSkillsViewState, seed?: QuantSkillsAgentTeamBuilderSeed) => void;
    consumeAgentTeamCreation: (draft: QuantSkillsViewState) => void;
    selectSkill: (draft: QuantSkillsViewState, name?: string) => void;
    setCategory: (draft: QuantSkillsViewState, category: string) => void;
    setAgentCategory: (draft: QuantSkillsViewState, category: string) => void;
    setSearch: (draft: QuantSkillsViewState, search: string) => void;
    setCatalogView: (draft: QuantSkillsViewState, view: 'list' | 'grid') => void;
    setCatalogSort: (draft: QuantSkillsViewState, sort: QuantSkillsViewState['catalogSort']) => void;
    closeSkillDrawer: (draft: QuantSkillsViewState) => void;
    toggleConversationsPinned: (draft: QuantSkillsViewState) => void;
    setSettingsSection: (draft: QuantSkillsViewState, section: QuantSkillsViewState['settingsSection']) => void;
    setInterfaceScale: (draft: QuantSkillsViewState, scale: number) => void;
    setConversationScale: (draft: QuantSkillsViewState, scale: number) => void;
    setConversationOverlayOpacity: (draft: QuantSkillsViewState, opacity: number) => void;
    setConversationBrightness: (draft: QuantSkillsViewState, brightness: number) => void;
    setColorScheme: (draft: QuantSkillsViewState, scheme: QuantSkillsColorScheme) => void;
    setLightBackground: (draft: QuantSkillsViewState, background: QuantSkillsLightBackground) => void;
    setDarkBackground: (draft: QuantSkillsViewState, background: QuantSkillsDarkBackground) => void;
    setAutoCheckCatalog: (draft: QuantSkillsViewState, enabled: boolean) => void;
    setAutoCheckPanda: (draft: QuantSkillsViewState, enabled: boolean) => void;
    setResumeAfterPandaLogin: (draft: QuantSkillsViewState, enabled: boolean) => void;
    setFavoriteAssetIds: (draft: QuantSkillsViewState, assetIds: readonly string[]) => void;
    setAssetDisplayNameOverrides: (draft: QuantSkillsViewState, overrides: readonly QuantSkillsAssetDisplayNameOverride[]) => void;
    setDefaultAgentModel: (draft: QuantSkillsViewState, provider: string, model: string, reasoningEffort: string) => void;
    setDefaultAgentPermission: (draft: QuantSkillsViewState, permission: QuantSkillsDefaultAgentPermission) => void;
    setDefaultWorkspaceId: (draft: QuantSkillsViewState, workspaceId?: string) => void;
    setWorkspaceRecoveryNotice: (draft: QuantSkillsViewState, notice?: string) => void;
    syncSettings: (draft: QuantSkillsViewState, value: QuantSkillsSettings | undefined, status: QuantSkillsViewState['settingsStatus'], writable: boolean, error?: string) => void;
    setPendingPandaTask: (draft: QuantSkillsViewState, label?: string) => void;
    requestResultPreview: (draft: QuantSkillsViewState, sessionId: SessionId, path: string) => void;
    acknowledgeResultPreviewFocus: (draft: QuantSkillsViewState, sessionId: SessionId, sequence: number) => void;
};
/**
 * Create the root viewing-state store for the QuantSkills application.
 * @returns an exclusive store handle mounted by the root slot registration.
 */
export declare function createQuantSkillsViewStore(): EngineStoreHandle<QuantSkillsViewState, QuantSkillsViewActions>;
/** Frame geometry owned by the QuantSkills root entry. */
export interface QuantSkillsLayoutState {
    sidebarOpen: boolean;
    sidebarReservation: number;
    detailsOpen: boolean;
    detailsReservation: number;
    resultsOpen: boolean;
    conversationTextScale: number;
    conversationTextScaleClaimed: boolean;
}
type QuantSkillsLayoutActions = {
    toggleSidebar: (draft: QuantSkillsLayoutState) => void;
    setSidebarReservation: (draft: QuantSkillsLayoutState, px: number) => void;
    setDetailsReservation: (draft: QuantSkillsLayoutState, px: number) => void;
    openDetails: (draft: QuantSkillsLayoutState) => void;
    closeDetails: (draft: QuantSkillsLayoutState) => void;
    openResults: (draft: QuantSkillsLayoutState) => void;
    closeResults: (draft: QuantSkillsLayoutState) => void;
    setConversationTextScale: (draft: QuantSkillsLayoutState, scale: number, claimed: boolean) => void;
};
/**
 * Create the root frame store used by the layout-compatible service.
 * @returns an exclusive layout store handle mounted by the root slot registration.
 */
export declare function createQuantSkillsLayoutStore(): EngineStoreHandle<QuantSkillsLayoutState, QuantSkillsLayoutActions>;
/** Session state observed by the local result-notification projection. */
export interface QuantSkillsNotificationObservation {
    sessionId: string;
    updatedAt: number;
    runState: 'idle' | 'running' | 'failed' | 'cancelled' | 'completed';
}
/** One unread terminal run result. */
export interface QuantSkillsUnreadNotification {
    updatedAt: number;
    runState: 'failed' | 'completed';
}
/** Browser-local notification projection shared by the frame and navigation rail. */
export interface QuantSkillsNotificationState {
    initialized: boolean;
    observedBySession: Record<string, QuantSkillsNotificationObservation>;
    unreadBySession: Record<string, QuantSkillsUnreadNotification>;
}
type QuantSkillsNotificationActions = {
    sync: (draft: QuantSkillsNotificationState, observations: readonly QuantSkillsNotificationObservation[]) => void;
    acknowledge: (draft: QuantSkillsNotificationState, sessionId: string) => void;
};
/**
 * Create the persisted browser-local projection for completed and failed Session runs.
 * @returns an exclusive store handle mounted once by the QuantSkills root registration.
 */
export declare function createQuantSkillsNotificationStore(): EngineStoreHandle<QuantSkillsNotificationState, QuantSkillsNotificationActions>;
export {};
//# sourceMappingURL=store.d.ts.map