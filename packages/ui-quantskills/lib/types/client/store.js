import { defineStore } from '@deepseek-ai/dsh-client-store';
import { DEFAULT_QUANTSKILLS_AGENT_PERMISSION, DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG, DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA, DEFAULT_QUANTSKILLS_COLOR_SCHEME, DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS, DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, DEFAULT_QUANTSKILLS_DARK_BACKGROUND, DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND, DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN, } from "../appearance-settings.js";
/**
 * Create the root viewing-state store for the QuantSkills application.
 * @returns an exclusive store handle mounted by the root slot registration.
 */
export function createQuantSkillsViewStore() {
    return defineStore({
        init: () => ({
            pluginOpen: false,
            pluginConversationOpen: false,
            page: 'home',
            agentWorkspaceTab: 'mine',
            agentTeamCreationPending: false,
            agentTeamBuilderSeed: undefined,
            selectedSkill: undefined,
            selectedCategory: 'all',
            selectedAgentCategory: 'all',
            search: '',
            catalogView: 'list',
            catalogSort: 'recommended',
            skillDrawerOpen: false,
            conversationsPinned: true,
            settingsSection: 'workspace',
            interfaceScale: 1,
            conversationScale: 1,
            conversationBrightness: DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
            conversationOverlayOpacity: DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
            colorScheme: DEFAULT_QUANTSKILLS_COLOR_SCHEME,
            lightBackground: DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND,
            darkBackground: DEFAULT_QUANTSKILLS_DARK_BACKGROUND,
            autoCheckCatalog: DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
            autoCheckPanda: DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA,
            resumeAfterPandaLogin: DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
            favoriteAssetIds: [],
            assetDisplayNameOverrides: [],
            defaultAgentProvider: '',
            defaultAgentModel: '',
            defaultAgentReasoningEffort: '',
            defaultAgentPermission: DEFAULT_QUANTSKILLS_AGENT_PERMISSION,
            defaultWorkspaceId: undefined,
            workspaceRecoveryNotice: undefined,
            settingsStatus: 'loading',
            settingsWritable: false,
            pendingPandaTaskLabel: undefined,
            resultPreviewRequest: undefined,
        }),
        actions: {
            openPlugin: (draft) => { draft.pluginOpen = true; },
            closePlugin: (draft) => {
                draft.pluginOpen = false;
                draft.pluginConversationOpen = false;
            },
            openPluginConversation: (draft) => {
                draft.pluginOpen = true;
                draft.pluginConversationOpen = true;
                draft.page = 'conversations';
            },
            showPluginConversationIndex: (draft) => {
                draft.pluginConversationOpen = false;
                draft.page = 'conversations';
            },
            navigate: (draft, page) => {
                draft.page = page;
                if (page === 'teams')
                    draft.agentWorkspaceTab = 'teams';
                if (page === 'agents' && draft.agentWorkspaceTab === 'teams')
                    draft.agentWorkspaceTab = 'mine';
                if (page !== 'conversations')
                    draft.pluginConversationOpen = false;
                if (page !== 'skills')
                    draft.skillDrawerOpen = false;
            },
            setAgentWorkspaceTab: (draft, tab) => {
                draft.agentWorkspaceTab = tab;
                if (tab === 'teams')
                    draft.page = 'teams';
                else if (draft.page === 'teams')
                    draft.page = 'agents';
            },
            requestAgentTeamCreation: (draft, seed) => {
                draft.pluginConversationOpen = false;
                draft.page = 'teams';
                draft.agentWorkspaceTab = 'teams';
                draft.agentTeamCreationPending = true;
                draft.agentTeamBuilderSeed = seed === undefined ? undefined : {
                    ...seed,
                    members: seed.members.map(member => ({ ...member })),
                };
                draft.skillDrawerOpen = false;
            },
            consumeAgentTeamCreation: (draft) => {
                draft.agentTeamCreationPending = false;
                draft.agentTeamBuilderSeed = undefined;
            },
            selectSkill: (draft, name) => {
                draft.selectedSkill = name;
                draft.skillDrawerOpen = name !== undefined;
            },
            setCategory: (draft, category) => { draft.selectedCategory = category; },
            setAgentCategory: (draft, category) => { draft.selectedAgentCategory = category; },
            setSearch: (draft, search) => { draft.search = search; },
            setCatalogView: (draft, view) => { draft.catalogView = view; },
            setCatalogSort: (draft, sort) => { draft.catalogSort = sort; },
            closeSkillDrawer: (draft) => { draft.skillDrawerOpen = false; },
            toggleConversationsPinned: (draft) => { draft.conversationsPinned = !draft.conversationsPinned; },
            setSettingsSection: (draft, section) => { draft.settingsSection = section; },
            setInterfaceScale: (draft, scale) => { draft.interfaceScale = scale; },
            setConversationScale: (draft, scale) => { draft.conversationScale = scale; },
            setConversationOverlayOpacity: (draft, opacity) => { draft.conversationOverlayOpacity = opacity; },
            setConversationBrightness: (draft, brightness) => { draft.conversationBrightness = brightness; },
            setColorScheme: (draft, scheme) => { draft.colorScheme = scheme; },
            setLightBackground: (draft, background) => { draft.lightBackground = background; },
            setDarkBackground: (draft, background) => { draft.darkBackground = background; },
            setAutoCheckCatalog: (draft, enabled) => { draft.autoCheckCatalog = enabled; },
            setAutoCheckPanda: (draft, enabled) => { draft.autoCheckPanda = enabled; },
            setResumeAfterPandaLogin: (draft, enabled) => { draft.resumeAfterPandaLogin = enabled; },
            setFavoriteAssetIds: (draft, assetIds) => { draft.favoriteAssetIds = [...assetIds]; },
            setAssetDisplayNameOverrides: (draft, overrides) => {
                draft.assetDisplayNameOverrides = overrides.map(entry => ({ ...entry }));
            },
            setDefaultAgentModel: (draft, provider, model, reasoningEffort) => {
                draft.defaultAgentProvider = provider;
                draft.defaultAgentModel = model;
                draft.defaultAgentReasoningEffort = reasoningEffort;
            },
            setDefaultAgentPermission: (draft, permission) => { draft.defaultAgentPermission = permission; },
            setDefaultWorkspaceId: (draft, workspaceId) => { draft.defaultWorkspaceId = workspaceId; },
            setWorkspaceRecoveryNotice: (draft, notice) => { draft.workspaceRecoveryNotice = notice; },
            syncSettings: (draft, value, status, writable, error) => {
                draft.settingsError = error;
                draft.settingsStatus = status;
                draft.settingsWritable = writable;
                if (value === undefined)
                    return;
                draft.interfaceScale = value.interfaceScale;
                draft.conversationScale = value.conversationScale;
                draft.conversationBrightness = value.conversationBrightness;
                draft.conversationOverlayOpacity = value.conversationOverlayOpacity ?? DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY;
                draft.colorScheme = value.colorScheme;
                draft.lightBackground = value.lightBackground;
                draft.darkBackground = value.darkBackground;
                draft.autoCheckCatalog = value.autoCheckCatalog;
                draft.autoCheckPanda = value.autoCheckPanda;
                draft.resumeAfterPandaLogin = value.resumeAfterPandaLogin;
                draft.favoriteAssetIds = [...value.favoriteAssetIds];
                draft.assetDisplayNameOverrides = value.assetDisplayNameOverrides.map(entry => ({ ...entry }));
                draft.defaultAgentProvider = value.defaultAgentProvider;
                draft.defaultAgentModel = value.defaultAgentModel;
                draft.defaultAgentReasoningEffort = value.defaultAgentReasoningEffort;
                draft.defaultAgentPermission = value.defaultAgentPermission;
                draft.defaultWorkspaceId = value.defaultWorkspaceId;
            },
            setPendingPandaTask: (draft, label) => { draft.pendingPandaTaskLabel = label; },
            requestResultPreview: (draft, sessionId, path) => {
                draft.resultPreviewRequest = {
                    sessionId,
                    path,
                    sequence: (draft.resultPreviewRequest?.sequence ?? 0) + 1,
                    focusPending: true,
                };
            },
            acknowledgeResultPreviewFocus: (draft, sessionId, sequence) => {
                const request = draft.resultPreviewRequest;
                if (request?.sessionId === sessionId && request.sequence === sequence)
                    request.focusPending = false;
            },
        },
    });
}
/**
 * Create the root frame store used by the layout-compatible service.
 * @returns an exclusive layout store handle mounted by the root slot registration.
 */
export function createQuantSkillsLayoutStore() {
    return defineStore({
        init: () => ({
            sidebarOpen: true,
            sidebarReservation: 0,
            detailsOpen: false,
            detailsReservation: 0,
            resultsOpen: false,
            conversationTextScale: 1,
            conversationTextScaleClaimed: false,
        }),
        actions: {
            toggleSidebar: (draft) => { draft.sidebarOpen = !draft.sidebarOpen; },
            setSidebarReservation: (draft, px) => {
                draft.sidebarReservation = Math.max(0, Math.round(px));
            },
            setDetailsReservation: (draft, px) => {
                draft.detailsReservation = Math.max(0, Math.round(px));
            },
            openDetails: (draft) => {
                draft.detailsOpen = true;
                draft.resultsOpen = false;
            },
            closeDetails: (draft) => { draft.detailsOpen = false; },
            openResults: (draft) => {
                draft.detailsOpen = false;
                draft.resultsOpen = true;
            },
            closeResults: (draft) => { draft.resultsOpen = false; },
            setConversationTextScale: (draft, scale, claimed) => {
                draft.conversationTextScale = scale;
                draft.conversationTextScaleClaimed = claimed;
            },
        },
    });
}
function withoutRecordKey(record, key) {
    return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key));
}
/**
 * Create the persisted browser-local projection for completed and failed Session runs.
 * @returns an exclusive store handle mounted once by the QuantSkills root registration.
 */
export function createQuantSkillsNotificationStore() {
    return defineStore({
        init: () => ({
            initialized: false,
            observedBySession: {},
            unreadBySession: {},
        }),
        persist: 'dsh.quantskills.notifications.v1',
        actions: {
            sync: (draft, observations) => {
                const activeIds = new Set(observations.map(observation => observation.sessionId));
                draft.observedBySession = Object.fromEntries(Object.entries(draft.observedBySession).filter(([sessionId]) => activeIds.has(sessionId)));
                draft.unreadBySession = Object.fromEntries(Object.entries(draft.unreadBySession).filter(([sessionId]) => activeIds.has(sessionId)));
                for (const observation of observations) {
                    const previous = draft.observedBySession[observation.sessionId];
                    const terminal = observation.runState === 'completed' || observation.runState === 'failed';
                    const changed = previous === undefined
                        || previous.runState !== observation.runState
                        || previous.updatedAt !== observation.updatedAt;
                    if (draft.initialized && changed
                        && (observation.runState === 'completed' || observation.runState === 'failed')) {
                        draft.unreadBySession[observation.sessionId] = {
                            updatedAt: observation.updatedAt,
                            runState: observation.runState,
                        };
                    }
                    else if (!terminal) {
                        draft.unreadBySession = withoutRecordKey(draft.unreadBySession, observation.sessionId);
                    }
                    draft.observedBySession[observation.sessionId] = { ...observation };
                }
                draft.initialized = true;
            },
            acknowledge: (draft, sessionId) => {
                draft.unreadBySession = withoutRecordKey(draft.unreadBySession, sessionId);
            },
        },
    });
}
//# sourceMappingURL=store.js.map