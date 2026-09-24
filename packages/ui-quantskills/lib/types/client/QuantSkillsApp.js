import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { EXPERT_PRESETS } from "./expert-presets.js";
import { TEAM_PRESETS } from "./team-presets.js";
import { ProductIntro } from "./ProductIntro.js";
import { findMinimalTheme, minimalThemeStyle } from "./minimal-themes.js";
import { capabilitySummary } from '@deepseek-ai/dsh-quantskills-session/display';
import { declarationDisplay } from "./declaration-display.js";
import { hasChinese } from "./catalog-zh.js";
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react';
import { DatabasePage } from "./DatabasePage.js";
import { CompetitionHub } from "./CompetitionHub.js";
import { FlyPage } from "./FlyPage.js";
import { TrophyIcon } from '@phosphor-icons/react';
import { ExpertPresets } from "./ExpertPresets.js";
import { TeamPresets } from "./TeamPresets.js";
import { InteractiveHtml } from "./InteractiveHtml.js";
import { PdfPreview } from "./PdfPreview.js";
import { ZoomableImage } from "./ZoomableImage.js";
import { ActionDialog } from "./ActionDialog.js";
import { ManualSkillEditor } from "./ManualSkillEditor.js";
import { skillLibraryAssets, agentLibrarySource } from "./capability-library.js";
import { publicCatalogLabel } from "./brand-copy.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState, } from 'react';
import { pandaMcpPhaseLabel } from "./panda-mcp-presentation.js";
import { CodeBlock, MarkdownText, Menu, } from '@deepseek-ai/dsh-client-ui-primitives';
import { ArrowDownIcon as ArrowDown, ArrowUpIcon as ArrowUp, CubeIcon as Cube, DnaIcon as Dna, CaretDownIcon as CaretDown, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight, ArrowSquareOutIcon as ArrowSquareOut, ChartLineUpIcon as ChartLineUp, ArrowClockwiseIcon as ArrowClockwise, CheckCircleIcon as CheckCircle, BellIcon as Bell, BellRingingIcon as BellRinging, ChatsCircleIcon as ChatsCircle, CircleIcon as Circle, ClockIcon as Clock, DatabaseIcon as Database, DotsSixVerticalIcon as DotsSixVertical, DotsThreeVerticalIcon as DotsThreeVertical, FileCodeIcon as FileCode, FileCsvIcon as FileCsv, FilePdfIcon as FilePdf, FileTextIcon as FileText, FloppyDiskIcon as FloppyDisk, FolderOpenIcon as FolderOpen, GearSixIcon as GearSix, GlobeIcon as Globe, GridFourIcon as GridFour, HouseIcon as House, ListIcon as List, LockKeyIcon as LockKey, MagnifyingGlassIcon as MagnifyingGlass, MagicWandIcon as MagicWand, PaletteIcon as Palette, PaperPlaneTiltIcon as PaperPlaneTilt, PlusIcon as Plus, PencilSimpleIcon as PencilSimple, ShieldIcon as Shield, StarIcon as Star, TrashIcon as Trash, WrenchIcon as Wrench, XIcon as X, } from '@phosphor-icons/react';
import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react';
import { ArrowsInSimpleIcon as ArrowsInSimple } from '@phosphor-icons/react';
import { ArrowsOutSimpleIcon as ArrowsOutSimple } from '@phosphor-icons/react';
import clsx from 'clsx';
import { csvParseRows, tsvParseRows } from 'd3-dsv';
import { isCodeResultPath, previewableResultPathsForLatestTurn, projectQuantSkillsResults, resultExtension, resultPreviewRank, } from "./result-data.js";
import { applyAssetDisplayNameOverrides } from "./catalog.js";
import { QuantSkillsBrandLockup, QuantSkillsBrandMark } from "./QuantSkillsBrand.js";
import { QuantSkillsBrandSupportPanel, QuantSkillsBrandSupportSettings, } from "./QuantSkillsBrandSupportSettings.js";
import { QuantSkillsModelServices } from "./QuantSkillsModelServices.js";
import { ModelStartup } from "./ModelStartup.js";
import { QuantSkillsThemePicker } from "./QuantSkillsThemePicker.js";
import { DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS, DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MAX_QUANTSKILLS_SCALE, MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MIN_QUANTSKILLS_SCALE, } from "../appearance-settings.js";
import { resolveQuantSkillsBackground } from "./theme-backgrounds.js";
import { CapabilityIcon } from "./CapabilityIcon.js";
import { useAnimatedBackground } from "./animated-background.js";
import { useThemePreset } from "./theme-presets.js";
import css from './QuantSkillsApp.module.css';
const MARKDOWN_LABELS = {
    code: { copyLabel: '复制', copiedLabel: '已复制' },
    footnotes: '脚注',
};
/** Apply the owned palette and background to native Host surfaces for this mounted frame. */
function useQuantSkillsDocumentAppearance(enabled, scheme, background, conversationBrightness, conversationOverlayOpacity, inConversation = false) {
    const preset = useThemePreset();
    useAnimatedBackground(enabled, background, inConversation);
    useEffect(() => {
        if (!enabled)
            return;
        const minimal = findMinimalTheme(background.id);
        const previousMinimal = document.body.dataset.qsMinimal;
        const themeProperties = minimal ? minimalThemeStyle(minimal) : {};
        const previousTokens = Object.fromEntries(Object.keys(themeProperties).map(key => [key, document.body.style.getPropertyValue(key)]));
        for (const [key, value] of Object.entries(themeProperties))
            document.body.style.setProperty(key, value);
        if (minimal)
            document.body.dataset.qsMinimal = minimal.id;
        else
            delete document.body.dataset.qsMinimal;
        const previousPreset = document.body.dataset.qsPreset;
        document.body.dataset.qsPreset = preset;
        const previousTheme = document.body.dataset.qsPluginTheme;
        const previousBackground = document.body.dataset.qsBackground;
        const previousImage = document.body.style.getPropertyValue('--qs-background-image');
        const previousPosition = document.body.style.getPropertyValue('--qs-background-position');
        const previousConversationColor = document.body.style.getPropertyValue('--qs-conversation-text-color');
        const previousConversationOverlayOpacity = document.body.style.getPropertyValue('--qs-conversation-surface-opacity');
        const strength = Math.max(MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS, Math.min(MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, conversationBrightness));
        const channel = scheme === 'dark'
            ? Math.round(255 * strength)
            : Math.round(10 + (1 - strength) * 210);
        document.body.dataset.qsPluginTheme = scheme;
        document.body.dataset.qsBackground = background.id;
        document.body.style.setProperty('--qs-background-image', background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`));
        document.body.style.setProperty('--qs-background-position', background.position);
        const foreground = minimal
            ? [1, 3, 5].map(offset => Number.parseInt(minimal.tokens.ink.slice(offset, offset + 2), 16))
                .map(value => Math.round(scheme === 'dark' ? value * strength : value + (255 - value) * (1 - strength)))
            : [channel, channel, channel];
        document.body.style.setProperty('--qs-conversation-text-color', `rgb(${foreground.join(' ')})`);
        document.body.style.setProperty('--qs-conversation-surface-opacity', `${String(Math.round(Math.max(MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, Math.min(MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, conversationOverlayOpacity)) * 100))}%`);
        return () => {
            for (const [key, value] of Object.entries(previousTokens)) {
                if (value)
                    document.body.style.setProperty(key, value);
                else
                    document.body.style.removeProperty(key);
            }
            if (previousMinimal === undefined)
                delete document.body.dataset.qsMinimal;
            else
                document.body.dataset.qsMinimal = previousMinimal;
            if (previousPreset === undefined)
                delete document.body.dataset.qsPreset;
            else
                document.body.dataset.qsPreset = previousPreset;
            if (previousTheme === undefined)
                delete document.body.dataset.qsPluginTheme;
            else
                document.body.dataset.qsPluginTheme = previousTheme;
            if (previousBackground === undefined)
                delete document.body.dataset.qsBackground;
            else
                document.body.dataset.qsBackground = previousBackground;
            if (previousImage === '')
                document.body.style.removeProperty('--qs-background-image');
            else
                document.body.style.setProperty('--qs-background-image', previousImage);
            if (previousPosition === '')
                document.body.style.removeProperty('--qs-background-position');
            else
                document.body.style.setProperty('--qs-background-position', previousPosition);
            if (previousConversationColor === '')
                document.body.style.removeProperty('--qs-conversation-text-color');
            else
                document.body.style.setProperty('--qs-conversation-text-color', previousConversationColor);
            if (previousConversationOverlayOpacity === '')
                document.body.style.removeProperty('--qs-conversation-surface-opacity');
            else
                document.body.style.setProperty('--qs-conversation-surface-opacity', previousConversationOverlayOpacity);
        };
    }, [background, conversationBrightness, conversationOverlayOpacity, enabled, scheme, preset]);
}
/** DSH-compatible root frame that keeps the stock conversation services while replacing the stock visual shell. */
export function QuantSkillsFrame({ useStore, actions, useSessions, useView, useCatalog, useBoundSessions, useAgents, useNotifications, renderSlot, openSession, syncNotifications, acknowledgeNotification, renameSession, removeSessions, startSession, startAuthoringSession, openAgentTeamBuilder, }) {
    const sidebarOpen = useStore(state => state.sidebarOpen);
    const detailsOpen = useStore(state => state.detailsOpen);
    const currentSessionId = useSessions(state => state.current);
    const plainArchives = useBoundSessions(state => state.plainArchives);
    const archives = useBoundSessions(state => state.archives);
    const boundSessionsReady = useBoundSessions(state => state.phase === 'ready');
    const agentArchives = useAgents(state => state.archives);
    const teamArchives = useAgents(state => state.teamArchives);
    const agentsReady = useAgents(state => state.phase === 'ready');
    const unreadBySession = useNotifications(state => state.unreadBySession);
    const unreadCount = Object.keys(unreadBySession).length;
    const catalogSnapshot = useCatalog(snapshot => snapshot);
    const displayNameOverrides = useView(state => state.assetDisplayNameOverrides);
    const catalog = useMemo(() => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides), [catalogSnapshot, displayNameOverrides]);
    const currentArchive = archives.find(archive => archive.sessionId === currentSessionId);
    const currentPlainArchive = plainArchives.find(archive => archive.sessionId === currentSessionId);
    const currentAgentArchive = agentArchives.find(archive => archive.sessionId === currentSessionId);
    const currentTeamArchive = teamArchives.find(archive => archive.sessionId === currentSessionId);
    const page = useView(state => state.page);
    const interfaceScale = useView(state => state.interfaceScale);
    const conversationScale = useView(state => state.conversationScale);
    const conversationBrightness = useView(state => state.conversationBrightness);
    const conversationOverlayOpacity = useView(state => state.conversationOverlayOpacity);
    const colorScheme = useView(state => state.colorScheme);
    const lightBackground = useView(state => state.lightBackground);
    const darkBackground = useView(state => state.darkBackground);
    const background = useMemo(() => resolveQuantSkillsBackground(colorScheme, lightBackground, darkBackground), [colorScheme, darkBackground, lightBackground]);
    useQuantSkillsDocumentAppearance(true, colorScheme, background, conversationBrightness, conversationOverlayOpacity);
    const claimedConversationTextScale = useStore(state => state.conversationTextScale);
    const conversationTextScaleClaimed = useStore(state => state.conversationTextScaleClaimed);
    const resultsOpen = useStore(state => state.resultsOpen);
    const sidebarReservation = useStore(state => state.sidebarReservation);
    const detailsReservation = useStore(state => state.detailsReservation);
    const previousSessionId = useRef(currentSessionId);
    const notificationObservations = useMemo(() => [
        ...plainArchives.map(archive => ({
            sessionId: archive.sessionId,
            updatedAt: archive.updatedAt,
            runState: archive.runState,
        })),
        ...archives.map(archive => ({
            sessionId: archive.sessionId,
            updatedAt: archive.updatedAt,
            runState: archive.runState,
        })),
        ...agentArchives.map(archive => ({
            sessionId: archive.sessionId,
            updatedAt: archive.updatedAt,
            runState: archive.runState,
        })),
        ...teamArchives.map(archive => ({
            sessionId: archive.sessionId,
            updatedAt: archive.updatedAt,
            runState: archive.runState,
        })),
    ], [agentArchives, archives, plainArchives, teamArchives]);
    useEffect(() => {
        if (boundSessionsReady && agentsReady)
            syncNotifications(notificationObservations);
    }, [agentsReady, boundSessionsReady, notificationObservations, syncNotifications]);
    useEffect(() => {
        const badgeNavigator = navigator;
        const update = unreadCount === 0
            ? badgeNavigator.clearAppBadge?.()
            : badgeNavigator.setAppBadge?.(unreadCount);
        // The in-app counters remain authoritative when the browser does not expose OS badging.
        if (update !== undefined)
            void update.catch(() => { });
    }, [unreadCount]);
    const openNotifiedSession = useCallback((id) => {
        acknowledgeNotification(id);
        openSession(id);
    }, [acknowledgeNotification, openSession]);
    useEffect(() => {
        if (previousSessionId.current !== currentSessionId)
            actions.closeResults();
        previousSessionId.current = currentSessionId;
    }, [actions, currentSessionId]);
    const conversationVisible = page === 'conversations';
    const quantSkillsConversationSelected = currentPlainArchive !== undefined
        || currentArchive !== undefined
        || currentAgentArchive !== undefined
        || currentTeamArchive !== undefined;
    const detailsVisible = conversationVisible && quantSkillsConversationSelected && detailsOpen;
    const resultsVisible = conversationVisible && quantSkillsConversationSelected && resultsOpen;
    const sidebarWidth = Math.max(Math.round((sidebarOpen ? 78 : 56) * interfaceScale), sidebarReservation);
    const style = {
        '--qs-interface-scale': interfaceScale,
        '--qs-conversation-scale': conversationScale,
        '--qs-background-image': background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`),
        '--qs-background-position': background.position,
        gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr) ${Math.max(detailsVisible ? 430 : 0, detailsReservation)}px`,
    };
    const resolvedConversationScale = conversationTextScaleClaimed
        ? claimedConversationTextScale
        : conversationScale;
    const conversationStyle = {
        '--qs-conversation-scale': resolvedConversationScale,
        '--dsh-conversation-text-scale': resolvedConversationScale,
        '--dsh-conversation-text-base-size': `${String(16 * resolvedConversationScale)}px`,
    };
    return _jsxs("div", { className: css.rootFrame, style: style, "data-details-open": detailsVisible || undefined, "data-interface-scale": interfaceScale, "data-qs-theme": colorScheme, "data-qs-background": background.id, children: [_jsx("div", { className: css.rootSidebar, children: renderSlot('sidebar', { collapsed: !sidebarOpen, width: sidebarWidth }) }), _jsx("div", { className: css.rootConversation, style: conversationStyle, "data-conversation-scale": conversationScale, "data-stock-conversation": conversationVisible || undefined, children: conversationVisible
                    ? _jsx(ConversationFrame, { currentPlain: currentPlainArchive, currentSkill: currentArchive, currentAgent: currentAgentArchive, currentTeam: currentTeamArchive, plainArchives: plainArchives, skillArchives: archives, agentArchives: agentArchives, teamArchives: teamArchives, catalog: catalog, unreadBySession: unreadBySession, archivesOpen: !resultsVisible, openSession: openNotifiedSession, renameSession: renameSession, removeSessions: removeSessions, startSession: startSession, startAuthoringSession: startAuthoringSession, openAgentTeamBuilder: openAgentTeamBuilder, children: renderSlot('conversation', {}) })
                    : renderSlot('quantskills.page', {}) }), _jsx("div", { className: css.rootDetails, children: renderSlot('details', {}) }), _jsx("div", { className: css.rootResults, "data-open": resultsVisible || undefined, onPointerDown: (event) => {
                    if (event.target === event.currentTarget)
                        actions.closeResults();
                }, children: resultsVisible ? renderSlot('quantskills.results', {}) : null }), _jsx("div", { className: css.rootOverlay, children: renderSlot('shell.overlay', {}) })] });
}
function ConversationFrame({ currentPlain, currentSkill, currentAgent, currentTeam, plainArchives, skillArchives, agentArchives, teamArchives, catalog, archivesOpen, unreadBySession, openSession, renameSession, removeSessions, startSession, startAuthoringSession, openAgentTeamBuilder, sidebarOnly = false, drawerWidth: controlledDrawerWidth, onDrawerWidthChange, onCollapseDrawer, interfaceScale = 1, children, }) {
    const [error, setError] = useState();
    const [pendingRename, setPendingRename] = useState();
    const [renameDraft, setRenameDraft] = useState('');
    const [renameError, setRenameError] = useState();
    const [renaming, setRenaming] = useState(false);
    const [pendingRemoval, setPendingRemoval] = useState();
    const [removing, setRemoving] = useState(false);
    const [managing, setManaging] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState(() => new Set());
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [kindFilter, setKindFilter] = useState(currentTeam !== undefined ? 'team' : currentAgent !== undefined ? 'agent'
        : currentSkill !== undefined ? 'skill' : 'plain');
    const [sessionSearch, setSessionSearch] = useState('');
    const [localDrawerWidth, setLocalDrawerWidth] = useState(readSessionDrawerWidth);
    const drawerWidth = controlledDrawerWidth ?? localDrawerWidth;
    const drag = useRef();
    const notificationsRef = useRef(null);
    const currentSessionId = currentPlain?.sessionId ?? currentSkill?.sessionId
        ?? currentAgent?.sessionId ?? currentTeam?.sessionId;
    const currentKind = currentTeam !== undefined ? 'team' : currentAgent !== undefined ? 'agent'
        : currentSkill !== undefined ? 'skill' : currentPlain !== undefined ? 'plain' : undefined;
    const allRows = [
        ...plainArchives.map(archive => ({ kind: 'plain', archive })),
        ...skillArchives.map(archive => ({ kind: 'skill', archive })),
        ...agentArchives.map(archive => ({ kind: 'agent', archive })),
        ...teamArchives.map(archive => ({ kind: 'team', archive })),
    ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt);
    const normalizedSearch = sessionSearch.trim().toLocaleLowerCase('zh-CN');
    const matchesSearch = (row) => normalizedSearch === ''
        || conversationRowSearchText(row, catalog).includes(normalizedSearch);
    const running = allRows.filter(row => row.archive.running && matchesSearch(row));
    const recent = allRows.filter(row => row.kind === kindFilter && !row.archive.running && matchesSearch(row));
    const rows = [...running, ...recent];
    const deletableSessionIds = recent.map(row => row.archive.sessionId);
    const deletableSessionKey = deletableSessionIds.join('\u0000');
    const allDeletableSelected = deletableSessionIds.length > 0
        && deletableSessionIds.every(id => selectedSessionIds.has(id));
    const recentGroups = groupConversationRowsByDate(recent);
    const notificationRows = allRows.filter(row => unreadBySession[row.archive.sessionId] !== undefined).slice(0, 8);
    const unreadCount = Object.keys(unreadBySession).length;
    useEffect(() => {
        if (currentTeam !== undefined)
            setKindFilter('team');
        else if (currentAgent !== undefined)
            setKindFilter('agent');
        else if (currentSkill !== undefined)
            setKindFilter('skill');
        else if (currentPlain !== undefined)
            setKindFilter('plain');
    }, [currentAgent?.sessionId, currentPlain?.sessionId, currentSkill?.sessionId, currentTeam?.sessionId]);
    useEffect(() => {
        const available = new Set(deletableSessionIds);
        setSelectedSessionIds((previous) => {
            const next = new Set([...previous].filter(id => available.has(id)));
            return next.size === previous.size ? previous : next;
        });
    }, [deletableSessionKey]);
    useEffect(() => {
        if (!notificationsOpen)
            return;
        const closeNotifications = (event) => {
            if (event.target instanceof Node && !notificationsRef.current?.contains(event.target)) {
                setNotificationsOpen(false);
            }
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape')
                setNotificationsOpen(false);
        };
        document.addEventListener('pointerdown', closeNotifications, true);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeNotifications, true);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [notificationsOpen]);
    const resize = (next, persist) => {
        const width = clampSessionDrawerWidth(next);
        if (controlledDrawerWidth === undefined)
            setLocalDrawerWidth(width);
        onDrawerWidthChange?.(width);
        if (persist)
            writeSessionDrawerWidth(width);
    };
    const beginResize = (event) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: drawerWidth };
    };
    const continueResize = (event) => {
        const active = drag.current;
        if (active === undefined || active.pointerId !== event.pointerId)
            return;
        resize(active.startWidth + (event.clientX - active.startX) / interfaceScale, false);
    };
    const finishResize = (event) => {
        const active = drag.current;
        if (active === undefined || active.pointerId !== event.pointerId)
            return;
        drag.current = undefined;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        resize(active.startWidth + (event.clientX - active.startX) / interfaceScale, true);
    };
    const resizeByKeyboard = (event) => {
        const next = event.key === 'ArrowLeft'
            ? drawerWidth - SESSION_DRAWER_KEYBOARD_STEP
            : event.key === 'ArrowRight'
                ? drawerWidth + SESSION_DRAWER_KEYBOARD_STEP
                : event.key === 'Home'
                    ? SESSION_DRAWER_MIN_WIDTH
                    : event.key === 'End'
                        ? SESSION_DRAWER_MAX_WIDTH
                        : undefined;
        if (next === undefined)
            return;
        event.preventDefault();
        resize(next, true);
    };
    const confirmRemoval = async () => {
        if (pendingRemoval === undefined)
            return;
        const ids = pendingRemoval.rows
            .filter(row => !row.archive.running)
            .map(row => row.archive.sessionId);
        if (ids.length === 0)
            return;
        setRemoving(true);
        setError(undefined);
        try {
            await removeSessions(ids);
            setPendingRemoval(undefined);
            setSelectedSessionIds(new Set());
            setManaging(false);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setRemoving(false);
        }
    };
    const requestRename = (row) => {
        setPendingRename(row);
        setRenameDraft(conversationRowTitle(row, catalog));
        setRenameError(undefined);
    };
    const confirmRename = async (row, title) => {
        setRenaming(true);
        setRenameError(undefined);
        try {
            await renameSession(row.archive.sessionId, title);
            setPendingRename(undefined);
        }
        catch (cause) {
            setRenameError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setRenaming(false);
        }
    };
    const layoutStyle = { '--qs-session-drawer-width': `${String(drawerWidth)}px` };
    return _jsxs("div", { className: clsx(css.boundConversationLayout, archivesOpen && css.withSessionDrawer, sidebarOnly && archivesOpen && css.sessionDrawerOnly), style: layoutStyle, children: [archivesOpen && _jsxs("aside", { className: css.sessionDrawer, "aria-label": "\u4F1A\u8BDD\u5207\u6362", children: [_jsxs("header", { className: css.sessionHeader, children: [_jsxs("div", { className: css.sessionSummary, children: [_jsx("b", { children: "\u4F1A\u8BDD\u4E2D\u5FC3" }), _jsxs("small", { children: [allRows.filter(row => row.archive.running).length, " \u4E2A\u8FD0\u884C\u4E2D \u00B7 ", allRows.length, " \u4E2A\u4F1A\u8BDD"] }), _jsxs("small", { className: css.catalogSync, "data-state": catalog.sync.state, children: [_jsx("i", {}), catalog.sync.mode === 'manual'
                                                ? 'QS 目录按需检查'
                                                : catalog.sync.state === 'connected'
                                                    ? 'QS 目录已实时同步'
                                                    : 'QS 实时同步重连中'] })] }), _jsxs("div", { className: css.sessionHeaderActions, children: [!managing && _jsxs("div", { ref: notificationsRef, className: css.sessionNotifications, children: [_jsxs("button", { type: "button", className: css.notificationButton, "aria-label": `会话通知${unreadCount === 0 ? '' : `，${String(unreadCount)} 条未读结果`}`, "aria-expanded": notificationsOpen, onClick: () => { setNotificationsOpen(open => !open); }, children: [unreadCount === 0 ? _jsx(Bell, { size: 18 }) : _jsx(BellRinging, { size: 18 }), unreadCount > 0 && _jsx("mark", { children: unreadCount })] }), notificationsOpen && _jsx(ConversationNotificationMenu, { rows: notificationRows, unreadCount: unreadCount, catalog: catalog, openSession: (id) => { setNotificationsOpen(false); openSession(id); } })] }), !managing && _jsx(QuantSkillsAuthoringAction, { start: startAuthoringSession, openAgentTeamBuilder: openAgentTeamBuilder }), !managing && _jsxs("button", { type: "button", title: "\u521B\u5EFA\u4E0D\u52A0\u8F7D \u6280\u80FD\u3001\u4E13\u5BB6 \u6216 \u4E13\u5BB6\u56E2 \u7684\u666E\u901A\u4F1A\u8BDD", onClick: () => {
                                            setError(undefined);
                                            void startSession().catch((cause) => {
                                                setError(cause instanceof Error ? cause.message : String(cause));
                                            });
                                        }, children: [_jsx(Plus, {}), "\u65B0\u5BF9\u8BDD"] }), managing && _jsx("button", { type: "button", className: css.sessionManageDone, onClick: () => {
                                            setManaging(false);
                                            setSelectedSessionIds(new Set());
                                        }, children: "\u5B8C\u6210" })] })] }), _jsxs("label", { className: css.sessionSearch, children: [_jsx(MagnifyingGlass, { size: 17 }), _jsx("input", { type: "search", value: sessionSearch, placeholder: "\u641C\u7D22\u4F1A\u8BDD\u540D\u79F0\u6216 ID", "aria-label": "\u641C\u7D22 QuantSkills \u4F1A\u8BDD", onChange: (event) => { setSessionSearch(event.currentTarget.value); } })] }), _jsx("div", { className: css.sessionKindTabs, role: "tablist", "aria-label": "\u6309\u4F1A\u8BDD\u7C7B\u578B\u7B5B\u9009", children: [
                            ['plain', '普通', plainArchives.length],
                            ['skill', '技能', skillArchives.length],
                            ['agent', '专家', agentArchives.length],
                            ['team', '专家团', teamArchives.length],
                        ].map(([kind, label, count]) => _jsxs("button", { type: "button", role: "tab", "aria-selected": kindFilter === kind, className: kindFilter === kind ? css.selected : undefined, onClick: () => {
                                setKindFilter(kind);
                                setSelectedSessionIds(new Set());
                                const latest = allRows.find(row => row.kind === kind);
                                if (latest !== undefined && currentKind !== kind)
                                    openSession(latest.archive.sessionId);
                            }, children: [label, _jsx("mark", { children: count })] }, kind)) }), managing && _jsxs("div", { className: css.sessionBulkBar, role: "toolbar", "aria-label": "\u6279\u91CF\u7BA1\u7406\u4F1A\u8BDD", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", "aria-label": "\u5168\u9009\u53EF\u5220\u9664\u4F1A\u8BDD", checked: allDeletableSelected, onChange: () => {
                                            setSelectedSessionIds(allDeletableSelected ? new Set() : new Set(deletableSessionIds));
                                        } }), _jsx("span", { children: allDeletableSelected ? '取消全选' : '全选' })] }), _jsxs("small", { children: [selectedSessionIds.size, " \u5DF2\u9009"] }), _jsxs("button", { type: "button", disabled: selectedSessionIds.size === 0, onClick: () => {
                                    setError(undefined);
                                    setPendingRemoval({
                                        kind: 'selected',
                                        rows: recent.filter(row => selectedSessionIds.has(row.archive.sessionId)),
                                    });
                                }, children: [_jsx(Trash, { size: 15 }), "\u5220\u9664"] }), _jsx("button", { type: "button", className: css.sessionClearButton, disabled: recent.length === 0, onClick: () => {
                                    setError(undefined);
                                    setPendingRemoval({ kind: 'clear', rows: recent });
                                }, children: "\u6E05\u7A7A" })] }), _jsx(ConversationSwitchGroup, { title: "\u8FD0\u884C\u4E2D", rows: running, catalog: catalog, currentSessionId: currentSessionId, openSession: openSession, requestRename: requestRename, requestRemoval: (row) => {
                            setError(undefined);
                            setPendingRemoval({ kind: 'single', rows: [row] });
                        }, managing: managing, selectedSessionIds: selectedSessionIds, toggleSelection: () => { } }), recentGroups.map(group => _jsx(ConversationSwitchGroup, { title: group.label, rows: group.rows, catalog: catalog, currentSessionId: currentSessionId, openSession: openSession, requestRename: requestRename, requestRemoval: (row) => {
                            setError(undefined);
                            setPendingRemoval({ kind: 'single', rows: [row] });
                        }, managing: managing, selectedSessionIds: selectedSessionIds, toggleSelection: (id) => {
                            setSelectedSessionIds((previous) => {
                                const next = new Set(previous);
                                if (next.has(id))
                                    next.delete(id);
                                else
                                    next.add(id);
                                return next;
                            });
                        } }, group.key)), running.length === 0 && recent.length === 0 && _jsx("div", { className: css.sessionEmpty, children: kindFilter === 'team'
                            ? _jsxs(_Fragment, { children: [_jsx(CapabilityIcon, { kind: "agent-team", size: 28 }), _jsx("b", { children: "\u8FD8\u6CA1\u6709 \u4E13\u5BB6\u56E2 \u4F1A\u8BDD" }), _jsx("small", { children: "\u4E13\u5BB6\u56E2 \u7F16\u6392\u5B8C\u6210\u540E\u4F1A\u5728\u8FD9\u91CC\u4FDD\u7559\u72EC\u7ACB\u5B58\u6863\u3002" })] })
                            : kindFilter === 'plain'
                                ? _jsxs(_Fragment, { children: [_jsx(ChatsCircle, { size: 28 }), _jsx("b", { children: "\u8FD8\u6CA1\u6709\u666E\u901A\u4F1A\u8BDD" }), _jsx("small", { children: "\u70B9\u51FB\u201C\u65B0\u5BF9\u8BDD\u201D\u5373\u53EF\u5F00\u59CB\uFF0C\u4E0D\u9700\u8981\u5148\u914D\u7F6E Python \u6216 PandaData\u3002" })] })
                                : _jsxs(_Fragment, { children: [_jsx(MagnifyingGlass, { size: 28 }), _jsx("b", { children: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD" }), _jsx("small", { children: "\u6E05\u9664\u641C\u7D22\u8BCD\u6216\u5207\u6362\u4F1A\u8BDD\u7C7B\u578B\u3002" })] }) }), !managing && _jsxs("footer", { className: css.sessionFooter, children: [_jsxs("small", { children: ["\u5171 ", rows.length, " \u6761"] }), _jsxs("button", { type: "button", className: css.sessionManageButton, title: "\u6279\u91CF\u7BA1\u7406\u4F1A\u8BDD", disabled: recent.length === 0, onClick: () => {
                                    setNotificationsOpen(false);
                                    setManaging(true);
                                }, children: [_jsx(List, { size: 16 }), "\u6279\u91CF\u7BA1\u7406"] })] }), error && _jsx("p", { className: css.error, role: "alert", children: error })] }), archivesOpen && _jsx("div", { className: css.sessionDivider, role: "separator", "aria-label": "\u8C03\u6574\u4F1A\u8BDD\u5217\u8868\u5BBD\u5EA6", "aria-orientation": "vertical", "aria-valuemin": SESSION_DRAWER_MIN_WIDTH, "aria-valuemax": SESSION_DRAWER_MAX_WIDTH, "aria-valuenow": drawerWidth, tabIndex: 0, title: "\u62D6\u62FD\u8C03\u6574\u4F1A\u8BDD\u5217\u8868\u5BBD\u5EA6\uFF1B\u53CC\u51FB\u6062\u590D\u9ED8\u8BA4\u5BBD\u5EA6", onDoubleClick: () => { resize(SESSION_DRAWER_DEFAULT_WIDTH, true); }, onKeyDown: resizeByKeyboard, onPointerDown: beginResize, onPointerMove: continueResize, onPointerUp: finishResize, onPointerCancel: finishResize, children: onCollapseDrawer !== undefined && _jsx("button", { type: "button", className: `${css.sidebarToggle} ${css.sessionDividerButton}`, "aria-label": "\u9690\u85CF\u4F1A\u8BDD\u4FA7\u680F", title: "\u9690\u85CF\u4F1A\u8BDD\u4FA7\u680F", onPointerDown: (event) => { event.stopPropagation(); }, onClick: (event) => {
                        event.stopPropagation();
                        onCollapseDrawer();
                    }, children: _jsx(CaretLeft, { size: 15 }) }) }), !sidebarOnly && _jsx("section", { className: css.stockConversation, children: currentKind === undefined || currentKind === kindFilter
                    ? children
                    : _jsx(ConversationKindEmpty, { kind: kindFilter }) }), pendingRename !== undefined && _jsx(RenameSessionDialog, { row: pendingRename, catalog: catalog, draft: renameDraft, busy: renaming, error: renameError, onDraftChange: (draft) => {
                    setRenameDraft(draft);
                    setRenameError(undefined);
                }, onCancel: () => { if (!renaming)
                    setPendingRename(undefined); }, onConfirm: (title) => { void confirmRename(pendingRename, title); } }), pendingRemoval !== undefined && _jsx(RemoveSessionDialog, { request: pendingRemoval, catalog: catalog, retainedRunningCount: pendingRemoval.kind === 'clear' ? running.length : 0, busy: removing, error: error, onCancel: () => { if (!removing)
                    setPendingRemoval(undefined); }, onConfirm: () => { void confirmRemoval(); } })] });
}
function ConversationKindEmpty({ kind }) {
    const label = kind === 'plain' ? '普通' : kind === 'skill' ? '技能' : kind === 'agent' ? '专家' : '专家团';
    return _jsxs("div", { className: css.conversationKindEmpty, children: [_jsx(CapabilityIcon, { kind: kind === 'skill' ? 'skill' : kind === 'team' ? 'agent-team' : 'agent', size: 38 }), _jsxs("h2", { children: ["\u6682\u65E0 ", label, " \u4F1A\u8BDD"] }), _jsx("p", { children: "\u5DE6\u4FA7\u53EA\u663E\u793A\u8FD9\u4E00\u7C7B\u578B\u7684\u5B58\u6863\u3002\u70B9\u51FB\u201C\u521B\u5EFA\u201D\u6216\u4ECE\u6280\u80FD\u3001\u4E13\u5BB6\u9875\u9762\u660E\u786E\u5F00\u59CB\u540E\uFF0C\u4F1A\u5728\u8FD9\u91CC\u5EFA\u7ACB\u72EC\u7ACB\u4E0A\u4E0B\u6587\u3002" })] });
}
const SESSION_DRAWER_MIN_WIDTH = 320;
const SESSION_DRAWER_MAX_WIDTH = 560;
const SESSION_DRAWER_DEFAULT_WIDTH = 420;
const SESSION_DRAWER_KEYBOARD_STEP = 16;
const SESSION_DRAWER_STORAGE_KEY = 'dsh.quantskills.session-drawer-width';
function clampSessionDrawerWidth(width) {
    return Math.min(SESSION_DRAWER_MAX_WIDTH, Math.max(SESSION_DRAWER_MIN_WIDTH, Math.round(width)));
}
function readSessionDrawerWidth() {
    if (typeof window === 'undefined')
        return SESSION_DRAWER_DEFAULT_WIDTH;
    try {
        const stored = Number(window.localStorage.getItem(SESSION_DRAWER_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0
            ? clampSessionDrawerWidth(stored)
            : SESSION_DRAWER_DEFAULT_WIDTH;
    }
    catch (_storageUnavailable) {
        return SESSION_DRAWER_DEFAULT_WIDTH;
    }
}
function writeSessionDrawerWidth(width) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(SESSION_DRAWER_STORAGE_KEY, String(clampSessionDrawerWidth(width)));
    }
    catch (_storageUnavailable) {
        // Browser-local presentation remains usable for this mount when persistent storage is unavailable.
    }
}
function conversationRowTitle(row, catalog) {
    return row.archive.title ?? (row.kind === 'plain'
        ? '新会话'
        : row.kind === 'skill'
            ? catalog === undefined ? row.archive.binding.assetId : assetTitle(catalog, row.archive.binding.assetId)
            : row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name);
}
function conversationRowSearchText(row, catalog) {
    const technicalId = row.kind === 'plain'
        ? row.archive.sessionId
        : row.kind === 'skill'
            ? row.archive.binding.assetId
            : row.kind === 'agent' ? row.archive.agent.agentId : row.archive.team.teamId;
    const ownerName = row.kind === 'plain'
        ? '普通会话'
        : row.kind === 'skill'
            ? assetTitle(catalog, row.archive.binding.assetId)
            : row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name;
    return `${conversationRowTitle(row, catalog)} ${ownerName} ${technicalId}`.toLocaleLowerCase('zh-CN');
}
/** Group conversations into stable local-time recency buckets. */
function groupConversationRowsByDate(rows, now = Date.now()) {
    const today = new Date(now);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const yesterdayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();
    const sevenDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
    const hourStart = now - 60 * 60 * 1000;
    const groups = [
        { key: 'last-hour', label: '最近1小时', rows: [] },
        { key: 'today', label: '今天', rows: [] },
        { key: 'yesterday', label: '昨天', rows: [] },
        { key: 'last-seven-days', label: '最近7天', rows: [] },
        { key: 'history', label: '历史', rows: [] },
    ];
    for (const row of [...rows].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt)) {
        const updatedAt = row.archive.updatedAt;
        const group = updatedAt >= hourStart
            ? groups[0]
            : updatedAt >= todayStart
                ? groups[1]
                : updatedAt >= yesterdayStart
                    ? groups[2]
                    : updatedAt >= sevenDayStart
                        ? groups[3]
                        : groups[4];
        group?.rows.push(row);
    }
    return groups.filter(group => group.rows.length > 0).map(group => ({
        key: group.key,
        label: group.label,
        rows: Object.freeze(group.rows),
    }));
}
function conversationNotificationLabel(row) {
    if (row.archive.runState === 'failed')
        return '运行失败，点击查看';
    return '运行完成，点击查看';
}
function conversationNotificationStatus(row) {
    return row.archive.runState === 'idle' ? 'waiting' : row.archive.runState;
}
function ConversationNotificationMenu({ rows, unreadCount, catalog, openSession }) {
    return _jsxs("section", { className: css.notificationMenu, role: "dialog", "aria-label": "\u4F1A\u8BDD\u901A\u77E5\u5217\u8868", children: [_jsx("header", { children: _jsxs("span", { children: [_jsx("b", { children: "\u4F1A\u8BDD\u901A\u77E5" }), _jsx("small", { children: unreadCount === 0 ? '没有未读运行结果' : `${String(unreadCount)} 条运行结果未查看` })] }) }), _jsxs("div", { children: [rows.map(row => _jsxs("button", { type: "button", onClick: () => { openSession(row.archive.sessionId); }, children: [row.kind === 'skill'
                                ? _jsx(SkillMark, { small: true })
                                : _jsx("span", { className: css.agentMark, children: row.kind === 'plain' ? _jsx(ChatsCircle, {}) : _jsx(CapabilityIcon, { kind: row.kind === 'team' ? 'agent-team' : 'agent' }) }), _jsxs("span", { children: [_jsx("b", { children: conversationRowTitle(row, catalog) }), _jsxs("small", { children: [conversationNotificationLabel(row), " \u00B7 ", formatUpdated(row.archive.updatedAt)] })] }), _jsx(StatusDot, { status: conversationNotificationStatus(row) })] }, row.archive.sessionId)), rows.length === 0 && _jsx("p", { children: "\u5B8C\u6210\u6216\u5931\u8D25\u7684\u8FD0\u884C\u7ED3\u679C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" })] })] });
}
function RemoveSessionDialog({ request, catalog, retainedRunningCount, busy, error, onCancel, onConfirm }) {
    const cancelRef = useRef(null);
    useEffect(() => {
        cancelRef.current?.focus();
        const closeOnEscape = (event) => {
            if (event.key === 'Escape' && !busy)
                onCancel();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => { window.removeEventListener('keydown', closeOnEscape); };
    }, [busy, onCancel]);
    const single = request.kind === 'single' ? request.rows[0] : undefined;
    const heading = request.kind === 'single' && single !== undefined
        ? `删除“${conversationRowTitle(single, catalog)}”会话？`
        : request.kind === 'clear'
            ? `清空 ${String(request.rows.length)} 个可删除会话？`
            : `删除选中的 ${String(request.rows.length)} 个会话？`;
    const confirmLabel = request.kind === 'clear' ? '清空会话' : '删除会话';
    return _jsx("div", { className: css.dialogBackdrop, children: _jsxs("section", { className: css.removeDialog, role: "dialog", "aria-modal": "true", "aria-labelledby": "remove-session-title", children: [_jsx("span", { className: css.removeDialogIcon, children: _jsx(Trash, { size: 20 }) }), _jsxs("div", { children: [_jsx("h2", { id: "remove-session-title", children: heading }), _jsxs("p", { children: [request.kind === 'single' ? '该会话' : '这些会话', "\u4F1A\u4ECE QuantSkills \u5217\u8868\u4E2D\u79FB\u9664\uFF0C\u539F\u59CB\u8BB0\u5F55\u4ECD\u4FDD\u7559\u5728\u4F1A\u8BDD\u5F52\u6863\u4E2D\u3002"] }), retainedRunningCount > 0 && _jsxs("p", { children: [retainedRunningCount, " \u4E2A\u8FD0\u884C\u4E2D\u7684\u4F1A\u8BDD\u4F1A\u4FDD\u7559\u3002"] }), error !== undefined && _jsx("p", { className: css.removeDialogError, role: "alert", children: error })] }), _jsxs("footer", { children: [_jsx("button", { ref: cancelRef, type: "button", disabled: busy, onClick: onCancel, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", disabled: busy, className: css.removeConfirmButton, onClick: onConfirm, children: busy ? '处理中…' : confirmLabel })] })] }) });
}
function RenameSessionDialog({ row, catalog, draft, busy, error, onDraftChange, onCancel, onConfirm }) {
    const inputRef = useRef(null);
    const titleId = useId();
    const trimmed = draft.trim();
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key === 'Escape' && !busy)
                onCancel();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => { window.removeEventListener('keydown', closeOnEscape); };
    }, [busy, onCancel]);
    const submit = (event) => {
        event.preventDefault();
        if (!busy && trimmed !== '')
            onConfirm(trimmed);
    };
    return _jsx("div", { className: css.dialogBackdrop, children: _jsxs("form", { className: css.renameDialog, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, onSubmit: submit, children: [_jsx("span", { className: css.renameDialogIcon, children: _jsx(PencilSimple, { size: 20 }) }), _jsxs("div", { children: [_jsx("h2", { id: titleId, children: "\u91CD\u547D\u540D\u4F1A\u8BDD" }), _jsxs("p", { children: ["\u4E3A\u201C", conversationRowTitle(row, catalog), "\u201D\u8BBE\u7F6E\u4FBF\u4E8E\u8BC6\u522B\u7684\u540D\u79F0\u3002\u65B0\u540D\u79F0\u4F1A\u4FDD\u5B58\u5230\u4F1A\u8BDD\u8BB0\u5F55\u4E2D\u3002"] })] }), _jsxs("label", { children: [_jsx("span", { children: "\u4F1A\u8BDD\u540D\u79F0" }), _jsx("input", { ref: inputRef, value: draft, "aria-label": "\u4F1A\u8BDD\u540D\u79F0", disabled: busy, onChange: (event) => { onDraftChange(event.currentTarget.value); } })] }), error !== undefined && _jsx("p", { className: css.renameDialogError, role: "alert", children: error }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: onCancel, children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", disabled: busy || trimmed === '', className: css.renameConfirmButton, children: busy ? '保存中…' : '重命名' })] })] }) });
}
function ConversationSwitchGroup({ title, rows, catalog, currentSessionId, openSession, requestRename, requestRemoval, managing, selectedSessionIds, toggleSelection, }) {
    if (rows.length === 0)
        return null;
    return _jsxs("section", { className: css.sessionGroup, children: [_jsxs("h2", { children: [title, _jsx("mark", { children: rows.length })] }), _jsx("div", { className: css.sessionTabs, children: rows.map(row => _jsxs("div", { className: clsx(css.sessionTab, managing && css.sessionTabManaging, row.archive.sessionId === currentSessionId && css.selected), children: [managing && _jsx("label", { className: css.sessionSelect, title: row.archive.running ? '运行中的会话不能删除' : '选择会话', children: _jsx("input", { type: "checkbox", "aria-label": `选择会话 ${conversationRowTitle(row, catalog)}`, checked: selectedSessionIds.has(row.archive.sessionId), disabled: row.archive.running, onChange: () => { toggleSelection(row.archive.sessionId); } }) }), _jsxs("button", { type: "button", className: css.sessionOpen, "aria-current": row.archive.sessionId === currentSessionId ? 'page' : undefined, onClick: () => { openSession(row.archive.sessionId); }, children: [row.kind === 'skill'
                                    ? _jsx(SkillMark, { small: true })
                                    : _jsx("span", { className: css.agentMark, children: row.kind === 'plain' ? _jsx(ChatsCircle, {}) : _jsx(CapabilityIcon, { kind: row.kind === 'team' ? 'agent-team' : 'agent' }) }), _jsxs("span", { children: [_jsx("b", { children: conversationRowTitle(row, catalog) }), _jsxs("small", { children: [row.kind === 'plain'
                                                    ? '普通会话'
                                                    : row.kind === 'skill'
                                                        ? `${assetTitle(catalog, row.archive.binding.assetId)} · 技能`
                                                        : row.kind === 'agent' ? `专家 · ${row.archive.agent.name}` : `专家团 · ${row.archive.team.name}`, " \u00B7 ", formatUpdated(row.archive.updatedAt)] })] }), row.archive.running ? _jsx(StatusDot, { status: "running" }) : _jsx(CaretRight, {})] }), !managing && _jsxs("span", { className: css.sessionActions, children: [_jsx("button", { type: "button", className: clsx(css.sessionAction, css.sessionRename), "aria-label": `重命名会话 ${conversationRowTitle(row, catalog)}`, title: "\u91CD\u547D\u540D\u4F1A\u8BDD", onClick: () => { requestRename(row); }, children: _jsx(PencilSimple, { size: 16 }) }), _jsx("button", { type: "button", className: clsx(css.sessionAction, css.sessionRemove), "aria-label": `删除会话 ${conversationRowTitle(row, catalog)}`, title: row.archive.running ? '运行中的会话不能删除' : '删除会话', disabled: row.archive.running, onClick: () => { requestRemoval(row); }, children: _jsx(Trash, { size: 16 }) })] })] }, row.archive.sessionId)) })] });
}
function SkillMark({ tone = 'blue', small = false }) {
    return _jsx("span", { className: clsx(css.skillMark, css[tone], small && css.skillMarkSmall), children: _jsx(CapabilityIcon, { kind: "skill", size: small ? 18 : 24 }) });
}
function StatusDot({ status }) {
    return _jsx("span", { className: clsx(css.statusDot, css[status]), "aria-label": status === 'running' ? '运行中' : status === 'waiting' ? '等待回复' : status === 'failed' ? '失败' : status === 'cancelled' ? '已取消' : '已完成' });
}
const NAV_ITEMS = [
    { page: 'home', label: '首页', icon: _jsx(House, { size: 24 }) },
    { page: 'skills', label: '技能', icon: _jsx(CapabilityIcon, { kind: "skill" }) },
    { page: 'agents', label: '专家', icon: _jsx(CapabilityIcon, { kind: "agent" }) },
    { page: 'teams', label: '专家团', icon: _jsx(CapabilityIcon, { kind: "agent-team" }) },
    { page: 'conversations', label: '会话', icon: _jsx(ChatsCircle, { size: 25 }) },
    { page: 'database', label: '数据库', icon: _jsx(Database, { size: 24 }) },
    { page: 'favorites', label: '收藏', icon: _jsx(Star, { size: 24 }) },
];
const PRODUCT_NAV_ITEMS = [
    { page: 'qube', label: 'QUBE', icon: _jsx(Cube, { size: 24 }) },
    { page: 'evo', label: 'EVO', icon: _jsx(Dna, { size: 24 }) },
    { page: 'contest', label: '比赛', icon: _jsx(TrophyIcon, { size: 24 }) },
    { page: 'fly', label: '果蝇交易员', icon: _jsx(Dna, { size: 24 }) },
];
const PLUGIN_NAV_WIDTH = 96;
const PLUGIN_SESSION_DIVIDER_WIDTH = 9;
const RESULT_WORKBENCH_MIN_WIDTH = 360;
const RESULT_WORKBENCH_MAX_WIDTH = 960;
const RESULT_WORKBENCH_DEFAULT_WIDTH = 420;
const RESULT_WORKBENCH_KEYBOARD_STEP = 24;
const RESULT_WORKBENCH_STORAGE_KEY = 'dsh.quantskills.result-workbench-width';
function clampResultWorkbenchWidth(width) {
    return Math.min(RESULT_WORKBENCH_MAX_WIDTH, Math.max(RESULT_WORKBENCH_MIN_WIDTH, Math.round(width)));
}
function readResultWorkbenchWidth() {
    if (typeof window === 'undefined')
        return RESULT_WORKBENCH_DEFAULT_WIDTH;
    try {
        const stored = Number(window.localStorage.getItem(RESULT_WORKBENCH_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0
            ? clampResultWorkbenchWidth(stored)
            : RESULT_WORKBENCH_DEFAULT_WIDTH;
    }
    catch (_storageUnavailable) {
        return RESULT_WORKBENCH_DEFAULT_WIDTH;
    }
}
function writeResultWorkbenchWidth(width) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(RESULT_WORKBENCH_STORAGE_KEY, String(clampResultWorkbenchWidth(width)));
    }
    catch (_storageUnavailable) {
        // The current split remains usable when browser-local persistence is unavailable.
    }
}
/** Full-screen QuantSkills application hosted by the stock DSH shell. */
export function QuantSkillsPluginFrame({ useView, useLayout, useCatalog, useBoundSessions, useAgents, useSessions, useNotifications, renderSlot, actions, openSession, acknowledgeNotification, renameSession, removeSessions, startSession, startAuthoringSession, openAgentTeamBuilder, claimSidebar, claimDetails, claimConversationTextScale, openResults, closeResults, close, modelAccess, flyAccess, }) {
    const open = useView(state => state.pluginOpen);
    const page = useView(state => state.page);
    const conversationOpen = useView(state => state.pluginConversationOpen);
    const interfaceScale = useView(state => state.interfaceScale);
    const conversationScale = useView(state => state.conversationScale);
    const conversationBrightness = useView(state => state.conversationBrightness);
    const conversationOverlayOpacity = useView(state => state.conversationOverlayOpacity);
    const colorScheme = useView(state => state.colorScheme);
    const lightBackground = useView(state => state.lightBackground);
    const darkBackground = useView(state => state.darkBackground);
    const background = useMemo(() => resolveQuantSkillsBackground(colorScheme, lightBackground, darkBackground), [colorScheme, darkBackground, lightBackground]);
    const displayNameOverrides = useView(state => state.assetDisplayNameOverrides);
    const resultsOpen = useLayout(state => state.resultsOpen);
    const currentSessionId = useSessions(state => state.current);
    const catalogSnapshot = useCatalog(snapshot => snapshot);
    const catalog = useMemo(() => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides), [catalogSnapshot, displayNameOverrides]);
    const plainArchives = useBoundSessions(state => state.plainArchives);
    const skillArchives = useBoundSessions(state => state.archives);
    const agentArchives = useAgents(state => state.archives);
    const teamArchives = useAgents(state => state.teamArchives);
    const unreadBySession = useNotifications(state => state.unreadBySession);
    const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length);
    const workspaceRecoveryNotice = useView(state => state.workspaceRecoveryNotice);
    const [drawerWidth, setDrawerWidth] = useState(readSessionDrawerWidth);
    const [sessionDrawerOpen, setSessionDrawerOpen] = useState(true);
    const [resultWidth, setResultWidth] = useState(readResultWorkbenchWidth);
    const [resultMaximized, setResultMaximized] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const mobile = viewportWidth <= 840;
    const frameScale = mobile ? 1 : interfaceScale;
    const [mobilePanel, setMobilePanel] = useState();
    const navigationRef = useRef(null);
    const mobileSessionsRef = useRef(null);
    const mobileHeaderRef = useRef(null);
    const mobileNavId = useId();
    const mobileSessionsId = useId();
    const mobileResultsId = useId();
    useEffect(() => {
        const resize = () => { setViewportWidth(window.innerWidth); };
        window.addEventListener('resize', resize);
        return () => { window.removeEventListener('resize', resize); };
    }, []);
    const resultFrameRef = useRef(null);
    const sidebarClaim = useRef();
    const resultDrag = useRef();
    const resultClaim = useRef();
    const conversationScaleClaim = useRef();
    const resultSession = useRef(currentSessionId);
    const quantSkillsConversationSelected = plainArchives.some(archive => archive.sessionId === currentSessionId)
        || skillArchives.some(archive => archive.sessionId === currentSessionId)
        || agentArchives.some(archive => archive.sessionId === currentSessionId)
        || teamArchives.some(archive => archive.sessionId === currentSessionId);
    const resultSurfaceVisible = open && conversationOpen && quantSkillsConversationSelected;
    const resultWorkbenchOpen = resultSurfaceVisible && resultsOpen;
    const claimedSidebarWidth = mobile ? 0 : Math.round((PLUGIN_NAV_WIDTH + (sessionDrawerOpen ? drawerWidth + PLUGIN_SESSION_DIVIDER_WIDTH : 0)) * frameScale);
    const resultOverlay = mobile || viewportWidth - claimedSidebarWidth - resultWidth < 520;
    const actualResultWidth = Math.min(resultWidth, Math.max(280, viewportWidth - 88));
    const claimedSidebarWidthRef = useRef(claimedSidebarWidth);
    claimedSidebarWidthRef.current = claimedSidebarWidth;
    useQuantSkillsDocumentAppearance(open, colorScheme, background, conversationBrightness, conversationOverlayOpacity, conversationOpen);
    useEffect(() => {
        if (!open || !mobile)
            return;
        document.body.setAttribute('data-qs-mobile', '');
        const updateHeight = () => {
            // Follow the on-screen keyboard without changing layout during pinch zoom.
            const visual = window.visualViewport;
            const height = visual && visual.scale === 1 ? visual.height : window.innerHeight;
            document.body.style.setProperty('--qs-mobile-height', `${height}px`);
        };
        updateHeight();
        window.visualViewport?.addEventListener('resize', updateHeight);
        window.addEventListener('resize', updateHeight);
        return () => {
            document.body.removeAttribute('data-qs-mobile');
            document.body.style.removeProperty('--qs-mobile-height');
            window.visualViewport?.removeEventListener('resize', updateHeight);
            window.removeEventListener('resize', updateHeight);
        };
    }, [mobile, open]);
    useEffect(() => { setMobilePanel(undefined); }, [page, currentSessionId, conversationOpen, mobile]);
    useEffect(() => { if (resultWorkbenchOpen)
        setMobilePanel(undefined); }, [resultWorkbenchOpen]);
    useEffect(() => {
        if (!mobile || !open)
            return;
        const panel = mobilePanel === 'navigation' ? navigationRef.current
            : mobilePanel === 'sessions' ? mobileSessionsRef.current
                : resultWorkbenchOpen ? resultFrameRef.current : null;
        if (!panel)
            return;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusables = () => [...panel.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')]
            .filter(element => element.getClientRects().length > 0);
        focusables()[0]?.focus({ preventScroll: true });
        const onKey = (event) => {
            if (document.querySelector('dialog[open]'))
                return;
            if (event.key === 'Escape') {
                event.preventDefault();
                setMobilePanel(undefined);
                closeResults();
                return;
            }
            if (event.key !== 'Tab')
                return;
            // Include the toolbar's close/toggle controls in the drawer focus cycle.
            const items = [...(mobileHeaderRef.current?.querySelectorAll('button:not(:disabled)') ?? []), ...focusables()];
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); if (trigger?.isConnected)
            trigger.focus({ preventScroll: true }); };
    }, [mobile, mobilePanel, open, resultWorkbenchOpen, closeResults]);
    useEffect(() => {
        if (!open || !conversationOpen)
            return;
        const claim = claimSidebar({
            width: claimedSidebarWidthRef.current,
            exclusive: true,
            onDisplaced: close,
        });
        sidebarClaim.current = claim;
        return () => {
            if (sidebarClaim.current === claim)
                sidebarClaim.current = undefined;
            claim.release();
        };
    }, [claimSidebar, close, conversationOpen, open]);
    useEffect(() => { sidebarClaim.current?.update(claimedSidebarWidth); }, [claimedSidebarWidth]);
    useEffect(() => {
        if (!open || !conversationOpen)
            return;
        const claim = claimConversationTextScale(conversationScale);
        conversationScaleClaim.current = claim;
        return () => {
            if (conversationScaleClaim.current === claim)
                conversationScaleClaim.current = undefined;
            claim.release();
        };
    }, [claimConversationTextScale, conversationOpen, open]);
    useEffect(() => { conversationScaleClaim.current?.update(conversationScale); }, [conversationScale]);
    useEffect(() => {
        if (!mobile && (!resultWorkbenchOpen || resultOverlay || resultMaximized))
            return;
        if (!open || !conversationOpen)
            return;
        const claim = claimDetails({
            width: mobile ? 0 : resultWidth,
            exclusive: true,
            onDisplaced: closeResults,
        });
        resultClaim.current = claim;
        return () => {
            if (resultDrag.current !== undefined) {
                resultDrag.current = undefined;
                claim.setDragging(false);
            }
            if (resultClaim.current === claim)
                resultClaim.current = undefined;
            claim.release();
        };
    }, [claimDetails, closeResults, resultWorkbenchOpen, resultOverlay, resultMaximized, mobile, open, conversationOpen]);
    useEffect(() => { resultClaim.current?.update(mobile ? 0 : resultWidth); }, [resultWidth, mobile]);
    useEffect(() => {
        if (resultWorkbenchOpen)
            return;
        setResultMaximized(false);
        if (resultDrag.current !== undefined) {
            resultDrag.current = undefined;
            resultClaim.current?.setDragging(false);
        }
    }, [resultWorkbenchOpen]);
    useEffect(() => {
        if (resultSession.current !== currentSessionId)
            closeResults();
        resultSession.current = currentSessionId;
    }, [closeResults, currentSessionId]);
    useEffect(() => {
        if (resultsOpen && !resultWorkbenchOpen)
            closeResults();
    }, [closeResults, resultWorkbenchOpen, resultsOpen]);
    useEffect(() => {
        if (!resultWorkbenchOpen || !resultMaximized)
            return;
        const panel = resultFrameRef.current;
        if (!panel)
            return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusFirst = () => { panel.querySelector('button:not(:disabled), [tabindex="0"]')?.focus(); };
        const containFocus = (event) => {
            if (!panel.contains(event.target) && !document.querySelector('dialog[open]'))
                focusFirst();
        };
        focusFirst();
        document.addEventListener('focusin', containFocus);
        return () => { document.removeEventListener('focusin', containFocus); if (previous?.isConnected)
            previous.focus(); };
    }, [resultWorkbenchOpen, resultOverlay, resultMaximized]);
    if (!open)
        return null;
    const currentPlain = plainArchives.find(archive => archive.sessionId === currentSessionId);
    const currentSkill = skillArchives.find(archive => archive.sessionId === currentSessionId);
    const currentAgent = agentArchives.find(archive => archive.sessionId === currentSessionId);
    const currentTeam = teamArchives.find(archive => archive.sessionId === currentSessionId);
    const openNotifiedSession = (id) => {
        acknowledgeNotification(id);
        openSession(id);
    };
    const resizeResult = (next, persist) => {
        const width = clampResultWorkbenchWidth(next);
        setResultWidth(width);
        if (persist)
            writeResultWorkbenchWidth(width);
    };
    const beginResultResize = (event) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        resultDrag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: resultWidth };
        resultClaim.current?.setDragging(true);
    };
    const continueResultResize = (event) => {
        const active = resultDrag.current;
        if (active === undefined || active.pointerId !== event.pointerId)
            return;
        resizeResult(active.startWidth - (event.clientX - active.startX), false);
    };
    const finishResultResize = (event) => {
        const active = resultDrag.current;
        if (active === undefined || active.pointerId !== event.pointerId)
            return;
        resultDrag.current = undefined;
        resultClaim.current?.setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        resizeResult(active.startWidth - (event.clientX - active.startX), true);
    };
    const cancelResultResize = (event) => {
        const active = resultDrag.current;
        if (active === undefined || active.pointerId !== event.pointerId)
            return;
        resultDrag.current = undefined;
        resultClaim.current?.setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        writeResultWorkbenchWidth(resultWidth);
    };
    const resizeResultByKeyboard = (event) => {
        const next = event.key === 'ArrowLeft'
            ? resultWidth + RESULT_WORKBENCH_KEYBOARD_STEP
            : event.key === 'ArrowRight'
                ? resultWidth - RESULT_WORKBENCH_KEYBOARD_STEP
                : event.key === 'Home'
                    ? RESULT_WORKBENCH_MIN_WIDTH
                    : event.key === 'End'
                        ? RESULT_WORKBENCH_MAX_WIDTH
                        : undefined;
        if (next === undefined)
            return;
        event.preventDefault();
        resizeResult(next, true);
    };
    return _jsxs("section", { className: css.pluginFrame, style: {
            '--qs-plugin-nav-width': `${String(mobile ? 0 : Math.round(PLUGIN_NAV_WIDTH * frameScale))}px`,
            '--qs-interface-scale': frameScale,
            '--qs-interface-inverse-scale': 1 / frameScale,
            '--qs-background-image': background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`),
            '--qs-background-position': background.position,
        }, "aria-label": "QuantSkills \u63D2\u4EF6\u5E94\u7528", "data-conversation-open": conversationOpen || undefined, "data-mobile-panel": mobile ? mobilePanel : undefined, "data-plugin-interface-scale": interfaceScale, "data-qs-theme": colorScheme, "data-qs-background": background.id, children: [_jsx(ModelStartup, { access: modelAccess, flyAccess: flyAccess }), mobile && _jsxs("header", { ref: mobileHeaderRef, className: css.mobileHeader, "aria-label": "\u79FB\u52A8\u7AEF\u5DE5\u5177\u680F", children: [_jsx("button", { type: "button", "aria-label": mobilePanel === 'navigation' ? '关闭导航' : '打开导航', "aria-expanded": mobilePanel === 'navigation', "aria-controls": mobileNavId, onClick: () => { closeResults(); setMobilePanel(current => current === 'navigation' ? undefined : 'navigation'); }, children: mobilePanel === 'navigation' ? _jsx(X, { size: 22 }) : _jsx(List, { size: 22 }) }), _jsxs("span", { className: css.mobileTitle, children: [_jsx(QuantSkillsBrandMark, { size: 20 }), _jsx("b", { children: conversationOpen ? '会话' : [...NAV_ITEMS, ...PRODUCT_NAV_ITEMS].find(item => item.page === page)?.label ?? (page === 'settings' ? '设置' : 'QuantSkills') })] }), conversationOpen && _jsx("button", { type: "button", "aria-label": mobilePanel === 'sessions' ? '关闭会话列表' : '打开会话列表', "aria-expanded": mobilePanel === 'sessions', "aria-controls": mobileSessionsId, onClick: () => { closeResults(); setMobilePanel(current => current === 'sessions' ? undefined : 'sessions'); }, children: _jsx(ChatsCircle, { size: 22 }) }), resultSurfaceVisible && _jsx("button", { type: "button", "aria-label": resultWorkbenchOpen ? '关闭结果预览' : '打开结果预览', "aria-expanded": resultWorkbenchOpen, "aria-controls": mobileResultsId, onClick: () => { setMobilePanel(undefined); if (resultWorkbenchOpen)
                            closeResults();
                        else
                            openResults(); }, children: _jsx(FolderOpen, { size: 22 }) })] }), workspaceRecoveryNotice !== undefined && _jsxs("div", { className: css.pluginNotice, role: "status", children: [_jsx("span", { children: workspaceRecoveryNotice }), _jsx("button", { type: "button", onClick: () => { actions.setWorkspaceRecoveryNotice(undefined); }, children: "\u77E5\u9053\u4E86" })] }), !conversationOpen && _jsx("header", { className: css.pluginHeader, children: _jsx("span", { className: css.pluginBrand, children: _jsx(QuantSkillsBrandLockup, {}) }) }), _jsxs("div", { className: css.pluginBody, children: [mobile && (mobilePanel || resultWorkbenchOpen) && _jsx("button", { type: "button", className: css.mobileScrim, "aria-label": "\u5173\u95ED\u5C55\u5F00\u9762\u677F", tabIndex: -1, onClick: () => { setMobilePanel(undefined); closeResults(); } }), _jsxs("nav", { ref: navigationRef, id: mobileNavId, className: css.pluginNav, "aria-label": "QuantSkills \u63D2\u4EF6\u5BFC\u822A", onClick: event => { if (mobile && event.target.closest('button'))
                            setMobilePanel(undefined); }, children: [conversationOpen && _jsx("span", { className: css.pluginConversationBrand, title: "QuantSkills", children: _jsx(QuantSkillsBrandMark, { size: 30 }) }), NAV_ITEMS.map(item => _jsxs("button", { type: "button", className: clsx(css.pluginNavItem, (page === item.page || (item.page === 'conversations' && page === 'parallel')) && css.pluginNavItemActive), "aria-current": page === item.page ? 'page' : undefined, onClick: () => {
                                    if (item.page === 'conversations')
                                        actions.showPluginConversationIndex();
                                    else
                                        actions.navigate(item.page);
                                }, children: [_jsxs("span", { className: css.railIcon, children: [item.icon, item.page === 'conversations' && unreadCount > 0 && _jsx("b", { className: css.badge, children: unreadCount })] }), _jsx("span", { children: item.label })] }, item.page)), _jsx("div", { className: css.productLinks, role: "group", "aria-label": "PandaAI \u4EA7\u54C1", children: PRODUCT_NAV_ITEMS.map(item => _jsxs("button", { type: "button", className: clsx(css.pluginNavItem, page === item.page && css.pluginNavItemActive), "aria-current": page === item.page ? 'page' : undefined, onClick: () => actions.navigate(item.page), title: `${item.label} · ${item.page === 'contest' ? 'AI 交易助手' : '产品介绍'}`, children: [item.icon, _jsx("span", { children: item.label })] }, item.page)) }), _jsxs("button", { type: "button", className: clsx(css.pluginNavItem, page === 'settings' && css.pluginNavItemActive), "aria-current": page === 'settings' ? 'page' : undefined, onClick: () => { actions.navigate('settings'); }, children: [_jsx(GearSix, { size: 24 }), _jsx("span", { children: "\u8BBE\u7F6E" })] })] }), _jsx("div", { ref: mobileSessionsRef, id: mobileSessionsId, className: css.pluginPage, children: _jsx("div", { className: css.pluginScaleViewport, "data-interface-scale-viewport": "page", children: conversationOpen
                                ? _jsx(ConversationFrame, { currentPlain: currentPlain, currentSkill: currentSkill, currentAgent: currentAgent, currentTeam: currentTeam, plainArchives: plainArchives, skillArchives: skillArchives, agentArchives: agentArchives, teamArchives: teamArchives, catalog: catalog, archivesOpen: mobile ? mobilePanel === 'sessions' : sessionDrawerOpen, unreadBySession: unreadBySession, openSession: id => { setMobilePanel(undefined); openNotifiedSession(id); }, renameSession: renameSession, removeSessions: removeSessions, startSession: startSession, startAuthoringSession: startAuthoringSession, openAgentTeamBuilder: openAgentTeamBuilder, sidebarOnly: true, drawerWidth: drawerWidth, onDrawerWidthChange: setDrawerWidth, onCollapseDrawer: () => { setSessionDrawerOpen(false); }, interfaceScale: frameScale })
                                : renderSlot('quantskills.page', {}) }) })] }), !mobile && conversationOpen && !sessionDrawerOpen && _jsx("button", { type: "button", className: `${css.sidebarToggle} ${css.sessionDrawerRestore}`, "aria-label": "\u663E\u793A\u4F1A\u8BDD\u4FA7\u680F", title: "\u663E\u793A\u4F1A\u8BDD\u4FA7\u680F", onClick: () => { setSessionDrawerOpen(true); }, children: _jsx(CaretRight, { size: 15 }) }), !mobile && resultSurfaceVisible && !resultWorkbenchOpen && _jsx("button", { type: "button", className: `${css.sidebarToggle} ${css.resultDrawerRestore}`, "aria-label": "\u663E\u793A\u7ED3\u679C\u4FA7\u680F", title: "\u663E\u793A\u7ED3\u679C\u4FA7\u680F", onClick: openResults, children: _jsx(CaretLeft, { size: 15 }) }), resultWorkbenchOpen && _jsxs("div", { ref: resultFrameRef, id: mobileResultsId, className: css.pluginResults, role: "complementary", "aria-label": "\u6587\u4EF6\u4E0E\u9884\u89C8", "data-floating": resultOverlay || undefined, "data-open": true, "data-expanded": true, "data-maximized": resultMaximized || undefined, style: {
                    '--qs-result-workbench-width': `${String(actualResultWidth)}px`,
                }, children: [_jsx("div", { className: css.resultDivider, role: "separator", "aria-label": "\u8C03\u6574\u7ED3\u679C\u5DE5\u4F5C\u53F0\u5BBD\u5EA6", "aria-orientation": "vertical", "aria-valuemin": RESULT_WORKBENCH_MIN_WIDTH, "aria-valuemax": RESULT_WORKBENCH_MAX_WIDTH, "aria-valuenow": resultWidth, tabIndex: 0, title: "\u62D6\u62FD\u8C03\u6574\u7ED3\u679C\u5DE5\u4F5C\u53F0\u5BBD\u5EA6\uFF1B\u53CC\u51FB\u6062\u590D\u9ED8\u8BA4\u5BBD\u5EA6", onDoubleClick: () => { resizeResult(RESULT_WORKBENCH_DEFAULT_WIDTH, true); }, onKeyDown: resizeResultByKeyboard, onPointerDown: beginResultResize, onPointerMove: continueResultResize, onPointerUp: finishResultResize, onPointerCancel: cancelResultResize, onLostPointerCapture: cancelResultResize, children: _jsx("button", { type: "button", className: `${css.sidebarToggle} ${css.resultDividerButton}`, "aria-label": "\u9690\u85CF\u7ED3\u679C\u4FA7\u680F", title: "\u9690\u85CF\u7ED3\u679C\u4FA7\u680F", onPointerDown: (event) => { event.stopPropagation(); }, onClick: (event) => {
                                event.stopPropagation();
                                closeResults();
                            }, children: _jsx(CaretRight, { size: 15 }) }) }), _jsx("div", { className: css.resultDock, children: _jsx("div", { className: css.pluginScaleViewport, "data-interface-scale-viewport": "results", children: renderSlot('quantskills.results', {
                                mode: 'expanded',
                                maximized: resultMaximized,
                                expand: openResults,
                                toggleMaximized: () => { setResultMaximized(current => !current); },
                            }) }) })] })] });
}
/** QuantSkills application launcher contributed to the stock Host sidebar. */
export function QuantSkillsPluginLauncher({ wide, useNotifications, open }) {
    const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length);
    return _jsxs("button", { type: "button", className: clsx(css.pluginLauncher, !wide && css.pluginLauncherRail), "aria-label": "\u6253\u5F00 QuantSkills", title: "\u6253\u5F00 QuantSkills", onClick: open, children: [_jsxs("span", { className: css.railIcon, children: [_jsx(QuantSkillsBrandMark, { size: wide ? 18 : 22 }), unreadCount > 0 && _jsx("b", { className: css.badge, children: unreadCount })] }), wide && _jsx("span", { children: "QuantSkills" })] });
}
/** Compact DSH-consistent application rail used by every QuantSkills screen. */
export function QuantSkillsRail({ collapsed, useStore, useNotifications, actions, collapse, renderSlot, }) {
    const page = useStore(state => state.page);
    const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length);
    return (_jsxs("nav", { className: css.rail, "aria-label": "QuantSkills \u4E3B\u5BFC\u822A", children: [_jsx("div", { className: css.railLogo, children: _jsx(QuantSkillsBrandMark, { size: 38 }) }), _jsx("div", { className: css.railItems, children: [...NAV_ITEMS, ...PRODUCT_NAV_ITEMS].map((item) => {
                    const active = page === item.page || (item.page === 'conversations' && page === 'parallel');
                    return _jsxs("button", { type: "button", className: clsx(css.railItem, active && css.railItemActive), "aria-current": active ? 'page' : undefined, "aria-label": item.page === 'conversations' ? item.label : undefined, onClick: () => { actions.navigate(item.page); }, children: [_jsxs("span", { className: css.railIcon, children: [item.icon, item.page === 'conversations' && unreadCount > 0
                                        && _jsx("b", { className: css.badge, children: unreadCount })] }), _jsx("span", { children: item.label })] }, item.page);
                }) }), _jsx("div", { className: css.railFooterActions, children: renderSlot('sidebar.footer.action', { wide: false }) }), _jsxs("button", { type: "button", className: clsx(css.railItem, page === 'settings' && css.railItemActive), onClick: () => { actions.navigate('settings'); }, children: [_jsx(GearSix, { size: 25 }), _jsx("span", { children: "\u8BBE\u7F6E" })] }), collapsed && _jsx("button", { type: "button", className: css.railExpand, "aria-label": "\u5C55\u5F00\u5BFC\u822A", onClick: collapse, children: _jsx(CaretRight, {}) })] }));
}
/** Seven-screen QuantSkills application projected from DSH state and the published catalog. */
export function QuantSkillsApp(props) {
    const page = props.useStore(state => state.page);
    const catalogSnapshot = props.useCatalog(snapshot => snapshot);
    const displayNameOverrides = props.useStore(state => state.assetDisplayNameOverrides);
    const catalog = useMemo(() => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides), [catalogSnapshot, displayNameOverrides]);
    const boundSessions = props.useBoundSessions(snapshot => snapshot);
    const agents = props.useAgents(snapshot => snapshot);
    const pageProps = { ...props, catalog, boundSessions, agents };
    const openModelSettings = () => { props.actions.setSettingsSection('models'); props.actions.navigate('settings'); };
    return (_jsxs("main", { className: css.app, "data-page": page, children: [page === 'home' && _jsx(HomePage, { ...pageProps }), page === 'skills' && _jsx(SkillsPage, { ...pageProps }), page === 'conversations' && _jsx(ConversationPage, { ...pageProps }), page === 'parallel' && _jsx(ParallelPage, { ...pageProps }), page === 'favorites' && _jsx(FavoritesPage, { ...pageProps }), (page === 'agents' || page === 'teams') && _jsx(AgentsPage, { ...pageProps }), page === 'settings' && _jsx(SettingsPage, { ...pageProps }), page === 'database' && _jsx(DatabasePage, { access: pageProps.databaseAccess }), page === 'contest' && _jsx(CompetitionHub, { access: pageProps.contestAccess, flyAccess: pageProps.flyAccess, openFly: () => props.actions.navigate('fly'), factorAccess: pageProps.factorContestAccess, researchSessions: boundSessions.plainArchives, openResearch: props.openSession, openModelSettings: openModelSettings }), page === 'fly' && _jsx(FlyPage, { access: pageProps.flyAccess, contest: pageProps.contestAccess, openContest: () => props.actions.navigate('contest'), openModelSettings: openModelSettings }), (page === 'qube' || page === 'evo') && _jsx(ProductIntro, { product: page, navigate: props.actions.navigate })] }));
}
const DRAWER_OVERLAY_QUERY = '(max-width: 1180px)';
function drawerOverlayMatches() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia(DRAWER_OVERLAY_QUERY).matches;
}
function useDrawerBehavior(open, onClose, triggerRef, overlayEnabled = true) {
    const labelId = useId();
    const closeButtonRef = useRef(null);
    const [overlay, setOverlay] = useState(() => overlayEnabled && drawerOverlayMatches());
    const close = useCallback(() => {
        onClose();
        queueMicrotask(() => { triggerRef.current?.focus(); });
    }, [onClose, triggerRef]);
    useEffect(() => {
        if (!overlayEnabled) {
            setOverlay(false);
            return;
        }
        if (typeof window.matchMedia !== 'function')
            return;
        const media = window.matchMedia(DRAWER_OVERLAY_QUERY);
        const update = (event) => { setOverlay(event.matches); };
        media.addEventListener('change', update);
        return () => { media.removeEventListener('change', update); };
    }, [overlayEnabled]);
    useEffect(() => {
        if (!open)
            return;
        const escape = (event) => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            close();
        };
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('keydown', escape); };
    }, [close, open]);
    useEffect(() => {
        if (!open || !overlay)
            return;
        queueMicrotask(() => { closeButtonRef.current?.focus(); });
    }, [open, overlay]);
    return { close, closeButtonRef, labelId, overlay, panelId: `${labelId}-panel` };
}
function PageHeader({ title, subtitle, action }) {
    return _jsxs("header", { className: css.pageHeader, children: [_jsxs("div", { children: [_jsx("h1", { children: title }), subtitle && _jsx("p", { children: subtitle })] }), action] });
}
function applicationUpdateSourceLabel(source) {
    return source === 'gitee' ? 'Gitee（国内）' : 'GitHub（国外）';
}
function describeApplicationUpdate(status) {
    if (status.state === 'idle')
        return undefined;
    const source = applicationUpdateSourceLabel(status.source);
    if (status.state === 'checking')
        return `正在通过 ${source} 检查正式发布版本。当前会话不会受影响。`;
    if (status.state === 'current') {
        return `${source}：当前${status.currentVersion === undefined ? '' : ` ${status.currentVersion}`}已是最新正式版本。`;
    }
    if (status.state === 'available') {
        const version = status.candidateVersion ?? status.candidateCommit?.slice(0, 7);
        return `${source}：发现新版本${version === undefined ? '' : ` ${version}`}。只有你确认后才会下载、安装依赖并验证。`;
    }
    if (status.state === 'ready') {
        const version = status.candidateVersion ?? status.candidateCommit?.slice(0, 7);
        return `${source}：新版本${version === undefined ? '' : ` ${version}`}已准备好，将在下次正常启动时生效。`;
    }
    if (status.state === 'preparing') {
        const phase = status.phase === 'fetching'
            ? '正在下载官方版本'
            : status.phase === 'installing'
                ? '正在安装锁定依赖'
                : '正在执行源码与隔离启动验证';
        return `${source}：${phase}。你可以继续使用当前版本。`;
    }
    if (status.state === 'blocked') {
        if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY') {
            return '检测到本地开发修改，当前开发目录保持不变；请继续使用自己的 Git 工作流。';
        }
        if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_REMOTE') {
            return '当前是非官方远程的开发仓库；请继续使用自己的 Git 工作流。';
        }
        if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_BRANCH') {
            return '当前是开发分支；不会切换或覆盖该分支。';
        }
        return '当前仓库包含领先或分叉提交；不会改写本地历史。';
    }
    return undefined;
}
function HomePage(props) {
    const [task, setTask] = useState('');
    const [taskBusy, setTaskBusy] = useState();
    const [taskGuide, setTaskGuide] = useState();
    const [submitError, setSubmitError] = useState();
    const [recommendation, setRecommendation] = useState();
    const [applicationUpdate, setApplicationUpdate] = useState({ state: 'idle' });
    const [applicationUpdateSource, setApplicationUpdateSource] = useState('github');
    const [applicationUpdateSourceOpen, setApplicationUpdateSourceOpen] = useState(false);
    const lastAutoUpdateCheck = useRef(0);
    const [applicationUpdateError, setApplicationUpdateError] = useState();
    const [featuredActionError, setFeaturedActionError] = useState();
    const [featuredCategory, setFeaturedCategory] = useState('all');
    const currentSessionId = props.useSessions(state => state.current);
    const currentBound = props.boundSessions.archives.find(archive => archive.sessionId === currentSessionId);
    const currentAgent = props.agents.archives.find(archive => archive.sessionId === currentSessionId);
    const activeSkills = props.boundSessions.archives.filter(archive => archive.running && !archive.archived);
    const activeAgents = props.agents.archives.filter(archive => archive.running && !archive.archived);
    const currentSkillActivity = currentBound ?? (currentAgent === undefined
        ? props.boundSessions.archives.find(archive => !archive.archived)
        : undefined);
    const currentAgentActivity = currentAgent ?? (currentBound === undefined
        ? props.agents.archives.find(archive => !archive.archived)
        : undefined);
    const attentionCount = activeSkills.length + activeAgents.length;
    const skillAssets = props.catalog.assets.filter(asset => asset.projectType === 'skill');
    const frequent = props.boundSessions.frequent.map((entry) => {
        const asset = skillAssets.find(candidate => candidate.name === entry.assetId);
        const recent = props.boundSessions.archives.find(archive => archive.sessionId === entry.recentSessionId);
        return { entry, asset, recent };
    });
    const refreshApplicationUpdate = useCallback(() => {
        void props.applicationUpdateStatus().then((status) => {
            setApplicationUpdate(status);
            if (status.source !== undefined)
                setApplicationUpdateSource(status.source);
        }, (error) => {
            setApplicationUpdateError(error instanceof Error ? error.message : String(error));
        });
    }, [props.applicationUpdateStatus]);
    useEffect(() => {
        let disposed = false;
        const inspect = async () => {
            if (document.visibilityState === 'hidden')
                return;
            try {
                const status = await props.applicationUpdateStatus();
                if (disposed)
                    return;
                setApplicationUpdate(status);
                if (status.source !== undefined)
                    setApplicationUpdateSource(status.source);
                const now = Date.now();
                if (['idle', 'current', 'failed', 'blocked'].includes(status.state)
                    && now - Math.max(status.checkedAt ?? 0, lastAutoUpdateCheck.current) > 60 * 60 * 1000) {
                    lastAutoUpdateCheck.current = now;
                    const result = await props.applicationUpdateCheck({ source: status.source ?? 'github' });
                    if (!disposed) {
                        setApplicationUpdate(result.status);
                        refreshApplicationUpdate();
                    }
                }
            }
            catch { /* Manual checks surface connection errors; background checks stay quiet. */ }
        };
        const timer = window.setTimeout(() => { void inspect(); }, 1500);
        const interval = window.setInterval(() => { void inspect(); }, 60 * 60 * 1000);
        const onFocus = () => { void inspect(); };
        window.addEventListener('focus', onFocus);
        refreshApplicationUpdate();
        return () => { disposed = true; window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
    }, [props.applicationUpdateStatus, props.applicationUpdateCheck, refreshApplicationUpdate]);
    useEffect(() => {
        if (applicationUpdate.state !== 'checking' && applicationUpdate.state !== 'preparing')
            return;
        const timer = window.setInterval(refreshApplicationUpdate, 750);
        return () => { window.clearInterval(timer); };
    }, [applicationUpdate.state, refreshApplicationUpdate]);
    const resolveTask = (prompt, assetName) => {
        setSubmitError(undefined);
        setTaskGuide(undefined);
        setTaskBusy(assetName === undefined ? 'matching' : 'starting');
        setRecommendation(assetName === undefined ? 'AI 正在理解需求并匹配现有 技能…' : '正在安装并启动所选 技能…');
        void props.startTask(prompt, assetName).then((result) => {
            if (result.kind !== 'started') {
                setRecommendation(undefined);
                setTask('');
                setTaskGuide({ prompt, result });
                return;
            }
            setTask('');
            setRecommendation(`已选择「${result.title}」，正在独立会话中运行。`);
            props.actions.navigate('conversations');
        }, (error) => {
            setRecommendation(undefined);
            setSubmitError(error instanceof Error ? error.message : String(error));
        }).finally(() => { setTaskBusy(undefined); });
    };
    const submit = (event) => {
        event.preventDefault();
        const answer = task.trim();
        if (answer === '' || taskBusy !== undefined)
            return;
        if (taskGuide?.result.kind === 'clarification') {
            resolveTask(`${taskGuide.prompt}\n\nAI 追问：${taskGuide.result.question}\n用户回答：${answer}`);
            return;
        }
        resolveTask(answer);
    };
    const answerClarification = (answer) => {
        if (taskGuide?.result.kind !== 'clarification' || taskBusy !== undefined)
            return;
        resolveTask(`${taskGuide.prompt}\n\nAI 追问：${taskGuide.result.question}\n用户回答：${answer}`);
    };
    const resetTaskGuide = () => {
        if (taskBusy !== undefined)
            return;
        setTask('');
        setTaskGuide(undefined);
        setRecommendation(undefined);
        setSubmitError(undefined);
    };
    const createSkillForTask = () => {
        if (taskGuide === undefined || taskBusy !== undefined)
            return;
        setSubmitError(undefined);
        setTaskBusy('authoring');
        setRecommendation('正在打开 技能 创作助手…');
        void props.startAuthoringSession('skill', taskGuide.prompt).then(() => {
            setTask('');
            setTaskGuide(undefined);
        }, (error) => {
            setRecommendation(undefined);
            setSubmitError(error instanceof Error ? error.message : String(error));
        }).finally(() => { setTaskBusy(undefined); });
    };
    const checkApplicationUpdate = () => {
        lastAutoUpdateCheck.current = Date.now();
        setApplicationUpdateError(undefined);
        void props.applicationUpdateCheck({ source: applicationUpdateSource }).then((result) => {
            setApplicationUpdate(result.status);
            refreshApplicationUpdate();
        }, (error) => {
            setApplicationUpdateError(error instanceof Error ? error.message : String(error));
        });
    };
    const startApplicationUpdate = () => {
        const version = applicationUpdate.candidateVersion ?? applicationUpdate.candidateCommit?.slice(0, 7);
        const source = applicationUpdateSourceLabel(applicationUpdate.source);
        const confirmed = window.confirm(`将从 ${source} 下载并验证 QuantSkills${version === undefined ? '' : ` ${version}`}，准备完成后在下次正常启动时生效。仅更新应用程序和内置推荐模板，不覆盖自建技能、专家、专家团、会话与配置。是否继续？`);
        if (!confirmed)
            return;
        setApplicationUpdateError(undefined);
        void props.applicationUpdateStart().then((result) => {
            setApplicationUpdate(result.status);
            refreshApplicationUpdate();
        }, (error) => {
            setApplicationUpdateError(error instanceof Error ? error.message : String(error));
        });
    };
    const applicationUpdateBusy = applicationUpdate.state === 'checking' || applicationUpdate.state === 'preparing';
    const applicationUpdateSourceLocked = applicationUpdateBusy;
    const applicationUpdateMessage = describeApplicationUpdate(applicationUpdate);
    return (_jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "QuantSkills", subtitle: "\u8BA9\u4E13\u4E1A\u6280\u80FD\u6210\u4E3A\u4F60\u7684 AI \u7814\u7A76\u80FD\u529B", action: _jsxs("div", { className: css.pageHeaderActions, children: [_jsxs("div", { className: css.applicationUpdateControl, children: [_jsxs("button", { type: "button", className: `${css.outlineButton} ${applicationUpdate.state === 'available' ? css.applicationUpdateAvailable : applicationUpdate.state === 'ready' ? css.applicationUpdateReady : ''}`, "data-update-state": applicationUpdate.state, "aria-busy": applicationUpdateBusy, disabled: applicationUpdateBusy, onClick: applicationUpdate.state === 'available' ? startApplicationUpdate : checkApplicationUpdate, children: [_jsx(ArrowClockwise, { className: applicationUpdateBusy ? css.spinningIcon : undefined }), applicationUpdate.state === 'checking' ? '正在检查…' : applicationUpdate.state === 'preparing' ? '正在准备更新…' : applicationUpdate.state === 'available' ? '下载并更新' : applicationUpdate.state === 'ready' ? '更新已就绪' : '检查更新'] }), _jsx(Menu, { open: applicationUpdateSourceOpen, portal: true, align: "end", className: css.applicationUpdateSourceMenu ?? '', items: [
                                        {
                                            id: 'github',
                                            label: _jsxs("span", { className: css.applicationUpdateSourceMenuLabel, children: [_jsx("b", { children: "GitHub" }), _jsx("small", { children: "\u56FD\u5916 \u00B7 \u5B98\u65B9\u9879\u76EE\u4ED3\u5E93" })] }),
                                        },
                                        {
                                            id: 'gitee',
                                            label: _jsxs("span", { className: css.applicationUpdateSourceMenuLabel, children: [_jsx("b", { children: "Gitee" }), _jsx("small", { children: "\u56FD\u5185 \u00B7 \u5B98\u65B9\u955C\u50CF\u4ED3\u5E93" })] }),
                                        },
                                    ], onClose: () => { setApplicationUpdateSourceOpen(false); }, onSelect: (id) => {
                                        if (id !== 'github' && id !== 'gitee')
                                            return;
                                        setApplicationUpdateSource(id);
                                        setApplicationUpdate({ state: 'idle' });
                                        setApplicationUpdateError(undefined);
                                        setApplicationUpdateSourceOpen(false);
                                    }, anchor: _jsxs("button", { type: "button", className: css.applicationUpdateSourceButton, "aria-label": `更新来源：${applicationUpdateSourceLabel(applicationUpdateSource)}`, "aria-haspopup": "menu", "aria-expanded": applicationUpdateSourceOpen, disabled: applicationUpdateSourceLocked, onClick: () => { setApplicationUpdateSourceOpen(value => !value); }, children: [_jsx(Globe, { size: 16 }), _jsx("span", { children: applicationUpdateSourceLabel(applicationUpdateSource) }), _jsx(CaretDown, { size: 13 })] }) })] }), _jsxs("button", { type: "button", className: css.outlineButton, onClick: () => { props.actions.navigate('parallel'); }, children: [_jsx(ChatsCircle, {}), "\u6D3B\u52A8\u4F1A\u8BDD ", attentionCount, _jsx(CaretRight, {})] })] }) }), (applicationUpdate.state === 'available' || applicationUpdate.state === 'ready') && _jsxs("section", { className: css.applicationReleaseNotes, "aria-label": "\u7248\u672C\u66F4\u65B0\u5185\u5BB9", children: [_jsxs("div", { children: [_jsxs("strong", { children: [applicationUpdate.state === 'ready' ? '更新已准备好' : '发现新版本', " \u00B7 ", applicationUpdate.candidateVersion] }), _jsxs("small", { children: [applicationUpdate.currentVersion ?? '当前版本', " \u2192 ", applicationUpdate.candidateVersion, " \u00B7 ", applicationUpdate.candidateCommit?.slice(0, 7)] })] }), applicationUpdate.releaseNotes?.length ? _jsx("ul", { children: applicationUpdate.releaseNotes.map((note, index) => _jsx("li", { children: note }, index)) }) : _jsx("p", { children: "\u6B64\u7248\u672C\u672A\u63D0\u4F9B\u6458\u8981\uFF0C\u53EF\u5728\u5B98\u65B9\u4ED3\u5E93\u67E5\u770B\u53D8\u66F4\u3002" }), _jsx("p", { children: "\u66F4\u65B0\u8303\u56F4\uFF1A\u5E94\u7528\u7A0B\u5E8F\u3001\u754C\u9762\u548C\u5185\u7F6E\u63A8\u8350\u6A21\u677F\u3002\u4FDD\u7559\u81EA\u5EFA\u6280\u80FD\u3001\u4E13\u5BB6\u3001\u4E13\u5BB6\u56E2\u3001\u4F1A\u8BDD\u3001\u6570\u636E\u5E93\u4E0E\u6A21\u578B\u914D\u7F6E\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u5BFC\u5165\u6216\u8986\u76D6\u4E2A\u4EBA\u8D44\u4EA7\u5E93\u3002" }), _jsx("a", { href: `https://${applicationUpdate.source === 'gitee' ? 'gitee.com' : 'github.com'}/quantskills/QuantStudio/commit/${applicationUpdate.candidateCommit}`, target: "_blank", rel: "noopener noreferrer", children: "\u67E5\u770B\u5B8C\u6574\u53D8\u66F4 \u2197" })] }), applicationUpdateMessage && _jsx("p", { className: css.repositoryUpdateMessage, role: "status", children: applicationUpdateMessage }), (applicationUpdate.state === 'failed' || applicationUpdateError !== undefined) && _jsx("p", { className: css.repositoryUpdateError, role: "alert", children: applicationUpdateError ?? '更新准备失败，当前版本仍可正常使用；请检查网络后重新点击“检查更新”。' }), _jsxs("div", { className: css.homeGrid, children: [_jsxs("div", { className: css.homeMain, children: [_jsxs("section", { children: [_jsx("h2", { children: "\u4ECA\u5929\u60F3\u8BA9 AI \u505A\u4EC0\u4E48\u91CF\u5316\u7814\u7A76\uFF1F" }), _jsxs("form", { className: css.heroComposer, onSubmit: submit, children: [_jsx("input", { "aria-label": "\u91CF\u5316\u7814\u7A76\u4EFB\u52A1", value: task, disabled: taskBusy !== undefined, onChange: (event) => {
                                                    setTask(event.target.value);
                                                    if (taskGuide?.result.kind !== 'clarification')
                                                        setTaskGuide(undefined);
                                                }, placeholder: taskGuide?.result.kind === 'clarification'
                                                    ? taskGuide.result.question
                                                    : '描述需求，AI 会追问并推荐合适的技能…' }), _jsx("button", { type: "submit", "aria-label": "\u67E5\u627E\u6216\u521B\u5EFA \u6280\u80FD", disabled: taskBusy !== undefined, children: _jsx(PaperPlaneTilt, { size: 22, weight: "fill" }) })] }), recommendation && _jsx("p", { className: css.notice, role: "status", children: recommendation }), taskGuide && _jsxs("div", { className: css.taskSuggestion, role: "region", "aria-label": "AI \u6280\u80FD \u5BFC\u8D2D", children: [taskGuide.result.kind === 'clarification' && _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("b", { children: "\u5E2E\u6211\u518D\u786E\u8BA4\u4E00\u70B9" }), _jsx("p", { children: taskGuide.result.message }), _jsx("p", { className: css.taskQuestion, children: taskGuide.result.question })] }), _jsxs("div", { className: css.creationActions, children: [taskGuide.result.options.map(option => _jsx("button", { type: "button", className: css.outlineButton, disabled: taskBusy !== undefined, onClick: () => { answerClarification(option); }, children: option }, option)), _jsx("button", { type: "button", className: css.textButton, onClick: resetTaskGuide, children: "\u91CD\u65B0\u63CF\u8FF0" })] })] }), taskGuide.result.kind === 'recommendations' && _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("b", { children: ["\u6211\u4E3A\u4F60\u627E\u5230\u4E86 ", taskGuide.result.suggestions.length, " \u4E2A\u9009\u62E9"] }), _jsx("p", { children: taskGuide.result.message }), _jsx("div", { className: css.taskCandidates, children: taskGuide.result.suggestions.map(suggestion => _jsxs("article", { className: css.taskCandidate, children: [_jsxs("span", { children: [_jsx("b", { children: suggestion.title }), _jsx("small", { children: suggestion.reason })] }), _jsx("button", { type: "button", className: css.outlineButton, disabled: taskBusy !== undefined, onClick: () => { resolveTask(taskGuide.prompt, suggestion.asset); }, children: "\u4F7F\u7528\u8FD9\u4E2A \u6280\u80FD" })] }, suggestion.asset)) })] }), _jsxs("div", { className: css.creationActions, children: [_jsx("button", { type: "button", className: css.textButton, onClick: resetTaskGuide, children: "\u91CD\u65B0\u63CF\u8FF0" }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: taskBusy !== undefined, onClick: createSkillForTask, children: [_jsx(MagicWand, {}), "\u90FD\u4E0D\u5408\u9002\uFF0CAI \u521B\u5EFA"] })] })] }), taskGuide.result.kind === 'creation' && _jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("b", { children: "\u8FD9\u4E2A\u9700\u6C42\u66F4\u9002\u5408\u521B\u5EFA\u65B0 \u6280\u80FD" }), _jsx("p", { children: taskGuide.result.message })] }), _jsxs("div", { className: css.creationActions, children: [_jsx("button", { type: "button", className: css.textButton, onClick: resetTaskGuide, children: "\u91CD\u65B0\u63CF\u8FF0" }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: taskBusy !== undefined, onClick: createSkillForTask, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u6280\u80FD"] })] })] })] }), submitError && _jsx("p", { className: css.error, role: "alert", children: submitError })] }), _jsx(CatalogMetrics, { phase: props.catalog.phase, error: props.catalog.catalogError, assets: props.catalog.assets, categories: props.catalog.categories, selectedCategory: featuredCategory, onSelect: setFeaturedCategory, onRefresh: props.refreshCatalog }), currentSkillActivity && _jsxs("section", { children: [_jsx("h2", { children: "\u6700\u8FD1\u4F1A\u8BDD" }), _jsxs("button", { type: "button", className: css.continueCard, onClick: () => { props.openSession(currentSkillActivity.sessionId); props.actions.navigate('conversations'); }, children: [_jsx(SkillMark, {}), _jsxs("span", { children: [_jsx("b", { children: currentSkillActivity.title ?? assetTitle(props.catalog, currentSkillActivity.binding.assetId) }), _jsxs("small", { children: [assetTitle(props.catalog, currentSkillActivity.binding.assetId), " \u00B7 \u6280\u80FD"] })] }), _jsxs("span", { className: css.progressMeta, children: [_jsx("b", { children: "\u6280\u80FD \u72EC\u7ACB\u4F1A\u8BDD" }), _jsx("small", { children: currentSkillActivity.running ? 'AI 正在处理' : '上下文已保存，可继续' })] }), _jsxs("span", { className: css.linkText, children: ["\u7EE7\u7EED ", _jsx(CaretRight, {})] })] })] }), currentSkillActivity === undefined && currentAgentActivity && _jsxs("section", { children: [_jsx("h2", { children: "\u6700\u8FD1\u4F1A\u8BDD" }), _jsxs("button", { type: "button", className: css.continueCard, onClick: () => { props.openSession(currentAgentActivity.sessionId); props.actions.navigate('conversations'); }, children: [_jsx(CapabilityIcon, { kind: "agent" }), _jsxs("span", { children: [_jsx("b", { children: currentAgentActivity.title ?? currentAgentActivity.agent.name }), _jsx("small", { children: currentAgentActivity.agent.name })] }), _jsxs("span", { className: css.progressMeta, children: [_jsx("b", { children: "\u4E13\u5BB6 \u72EC\u7ACB\u4F1A\u8BDD" }), _jsx("small", { children: currentAgentActivity.running ? 'AI 正在处理' : '上下文已保存，可继续' })] }), _jsxs("span", { className: css.linkText, children: ["\u7EE7\u7EED ", _jsx(CaretRight, {})] })] })] }), _jsxs("section", { children: [_jsx("h2", { children: "\u5E38\u7528\u6280\u80FD" }), frequent.length === 0
                                        ? _jsx("p", { className: css.emptyInline, children: "\u8FD8\u6CA1\u6709\u5E38\u7528 \u6280\u80FD\u3002\u521B\u5EFA\u5E76\u4F7F\u7528\u72EC\u7ACB\u4F1A\u8BDD\u540E\uFF0CHost \u4F1A\u5728\u8FD9\u91CC\u6C47\u603B\u3002" })
                                        : _jsx("div", { className: css.frequentRow, children: frequent.map(({ entry, asset, recent }, index) => _jsxs("article", { className: css.frequentCard, children: [_jsxs("button", { type: "button", className: css.frequentMain, onClick: () => { props.openSession(entry.recentSessionId); props.actions.navigate('conversations'); }, children: [_jsx(SkillMark, { tone: ['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue', small: true }), _jsxs("span", { children: [_jsx("b", { children: asset?.title ?? entry.assetId }), _jsxs("small", { children: [entry.sessionCount, " \u4E2A\u5B58\u6863 \u00B7 \u7EE7\u7EED\u6700\u8FD1\u4F1A\u8BDD"] })] }), _jsx(CaretRight, {})] }), _jsx("button", { type: "button", className: css.frequentNew, "aria-label": `为 ${asset?.title ?? entry.assetId} 新建会话`, disabled: recent === undefined, onClick: () => {
                                                            if (recent === undefined)
                                                                return;
                                                            void props.startBoundSession(recent.binding, asset?.title ?? entry.assetId);
                                                        }, children: _jsx(Plus, {}) })] }, entry.assetId)) })] }), _jsx(RankingTable, { catalog: props.catalog, selectedCategory: featuredCategory, onCategory: setFeaturedCategory, onInstall: (asset) => {
                                    setFeaturedActionError(undefined);
                                    void props.installAsset(asset).catch((error) => {
                                        setFeaturedActionError(error instanceof Error ? error.message : String(error));
                                    });
                                }, onStart: (asset, version) => {
                                    setFeaturedActionError(undefined);
                                    void props.startSkillSession(asset, version).catch((error) => {
                                        setFeaturedActionError(error instanceof Error ? error.message : String(error));
                                    });
                                }, onInstallAgent: (asset) => {
                                    setFeaturedActionError(undefined);
                                    void props.installAgent(asset).then(() => {
                                        props.actions.setAgentWorkspaceTab('mine');
                                        props.actions.navigate('agents');
                                    }, (error) => {
                                        setFeaturedActionError(error instanceof Error ? error.message : String(error));
                                    });
                                }, onOpenAll: () => {
                                    const selectedAssets = featuredCategory === 'all'
                                        ? props.catalog.assets
                                        : props.catalog.assets.filter(asset => asset.category === featuredCategory);
                                    const hasSkill = selectedAssets.some(asset => asset.projectType === 'skill');
                                    const hasAgent = selectedAssets.some(asset => asset.projectType === 'agent');
                                    if (!hasSkill && hasAgent) {
                                        props.actions.setAgentCategory(featuredCategory);
                                        props.actions.setAgentWorkspaceTab('market');
                                        props.actions.navigate('agents');
                                        return;
                                    }
                                    props.actions.setCategory(featuredCategory);
                                    props.actions.navigate('skills');
                                } }), (featuredActionError ?? props.catalog.operationError) && _jsx("p", { className: css.error, role: "alert", children: featuredActionError ?? props.catalog.operationError })] }), _jsx(QuantSkillsBrandSupportPanel, {})] })] }));
}
function CatalogMetrics({ phase, error, assets, categories, selectedCategory, onSelect, onRefresh }) {
    const unavailable = assets.length === 0 && phase !== 'ready';
    const skillCount = assets.filter(asset => asset.projectType === 'skill').length;
    const agentCount = assets.length - skillCount;
    return _jsxs("section", { className: css.catalogMetrics, "aria-labelledby": "catalog-metrics-title", children: [_jsxs("button", { type: "button", className: css.catalogMetricTotal, "aria-pressed": selectedCategory === 'all', onClick: () => {
                    if (phase === 'error')
                        void onRefresh();
                    else
                        onSelect('all');
                }, children: [_jsxs("span", { children: [_jsx("small", { id: "catalog-metrics-title", children: "QS \u5B98\u65B9\u516C\u5F00\u5E93" }), _jsx("b", { children: unavailable ? '—' : assets.length }), _jsx("em", { children: phase === 'loading' ? '正在连接宿主' : phase === 'error' ? '目录暂不可用' : '个公开项目' })] }), _jsx("span", { children: unavailable ? (error ?? '正在读取已验证目录') : `${String(skillCount)} 个 技能 · ${String(agentCount)} 个 专家` })] }), _jsx("div", { className: css.catalogMetricCategories, role: "group", "aria-label": "\u5404\u5206\u7C7B\u516C\u5F00\u9879\u76EE\u6570\u91CF", children: categories.map((category) => {
                    const categoryAssets = assets.filter(asset => asset.category === category.id);
                    return _jsxs("button", { type: "button", "aria-pressed": selectedCategory === category.id, onClick: () => { onSelect(category.id); }, children: [_jsx("span", { children: category.label }), _jsx("span", { className: css.catalogMetricCount, children: _jsx("b", { children: categoryAssets.length }) })] }, category.id);
                }) })] });
}
function RankingTable({ catalog, selectedCategory, onCategory, onInstall, onStart, onInstallAgent, onOpenAll, }) {
    const categories = catalog.categories;
    const categoryLabel = new Map(categories.map(category => [category.id, category.label]));
    const featured = selectedCategory === 'all'
        ? catalog.assets
        : catalog.assets.filter(asset => asset.category === selectedCategory);
    const selectedLabel = selectedCategory === 'all' ? '全部分类' : categoryLabel.get(selectedCategory) ?? selectedCategory;
    const featuredSkillCount = featured.filter(asset => asset.projectType === 'skill').length;
    const featuredAgentCount = featured.length - featuredSkillCount;
    const targetLabel = featuredSkillCount === 0 && featuredAgentCount > 0 ? '专家' : '技能';
    return _jsxs("section", { children: [_jsxs("div", { className: css.catalogHeading, children: [_jsxs("h2", { children: ["\u76EE\u5F55\u7CBE\u9009 ", _jsx("small", { children: selectedLabel })] }), _jsxs("div", { className: css.segmented, children: [_jsx("button", { type: "button", className: selectedCategory === 'all' ? css.selected : undefined, onClick: () => { onCategory('all'); }, children: "\u5168\u90E8" }), categories.map(category => _jsx("button", { type: "button", className: selectedCategory === category.id ? css.selected : undefined, onClick: () => { onCategory(category.id); }, children: category.label }, category.id))] })] }), _jsxs("div", { className: css.table, children: [_jsxs("div", { className: css.tableHead, children: [_jsx("span", { children: "#" }), _jsx("span", { children: "\u540D\u79F0" }), _jsx("span", { children: "\u5206\u7C7B" }), _jsx("span", { children: "\u72B6\u6001" }), _jsx("span", { children: "\u63D0\u4EA4" }), _jsx("span", { children: "\u64CD\u4F5C" })] }), featured.slice(0, 3).map((asset, index) => {
                        const installed = currentInstalledVersion(catalog, asset);
                        const installing = catalog.installing.has(asset.name);
                        const updateAvailable = installed === undefined && (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0;
                        const canStart = installed !== undefined && catalog.installedPhase === 'ready';
                        const canInstall = catalog.phase === 'ready' && !installing;
                        const skillAction = installed ? '使用' : updateAvailable ? '更新' : '安装';
                        const action = asset.projectType === 'agent'
                            ? installed === undefined ? '安装并创建' : '创建副本'
                            : skillAction;
                        const disabledReason = asset.projectType === 'skill' && installed && catalog.installedPhase !== 'ready'
                            ? '宿主已安装版本投影不可用或已过期'
                            : catalog.phase !== 'ready'
                                ? '宿主目录不可用或已过期'
                                : undefined;
                        const actionDisabled = asset.projectType === 'agent' ? !canInstall : installed ? !canStart : !canInstall;
                        return _jsxs("div", { className: css.tableRow, children: [_jsx("span", { className: css.rank, children: index + 1 }), _jsxs("span", { className: css.nameCell, children: [asset.projectType === 'skill'
                                            ? _jsx(SkillMark, { tone: ['blue', 'orange', 'green'][index] ?? 'blue', small: true })
                                            : _jsx(CapabilityIcon, { kind: "agent" }), _jsxs("span", { children: [_jsx("b", { children: asset.title }), _jsx("small", { className: css.technicalId, children: asset.name }), _jsx("small", { className: css.catalogSummary, children: asset.summary })] })] }), _jsx("span", { children: _jsx("mark", { children: categoryLabel.get(asset.category) ?? asset.category }) }), _jsxs("span", { title: asset.health, children: [asset.projectType === 'skill' ? '技能' : '专家', " \u00B7 ", asset.health === 'frozen-declaration-only' ? '固定版本' : asset.health === 'healthy' ? '正常' : '待检查'] }), _jsx("span", { children: asset.commitSha.slice(0, 7) }), _jsx("span", { className: css.tableAction, children: _jsx("button", { type: "button", className: installed ? css.primaryButton : css.outlineButton, "aria-label": `${installing ? '安装中' : action} ${asset.title}`, disabled: actionDisabled, title: disabledReason, onClick: () => {
                                            if (asset.projectType === 'agent')
                                                onInstallAgent(asset);
                                            else if (installed)
                                                onStart(asset, installed);
                                            else
                                                onInstall(asset);
                                        }, children: installing ? '安装中' : installed ? action : catalog.phase === 'ready' ? action : '宿主不可用' }) })] }, asset.name);
                    })] }), featured.length === 0 && _jsx("p", { className: css.emptyInline, children: "\u8FD9\u4E2A\u5206\u7C7B\u6682\u65F6\u6CA1\u6709\u516C\u5F00\u9879\u76EE\u3002" }), _jsxs("button", { type: "button", className: css.centerLink, onClick: onOpenAll, children: ["\u67E5\u770B", selectedCategory === 'all' ? '全部' : `“${selectedLabel}”`, targetLabel, " ", _jsx(CaretRight, {})] })] });
}
function SkillsPage(props) {
    const [manualEditor, setManualEditor] = useState();
    const [uninstallTarget, setUninstallTarget] = useState();
    const [uninstallBusy, setUninstallBusy] = useState(false);
    const [uninstallError, setUninstallError] = useState();
    const displayNameOverrides = props.useStore(state => state.assetDisplayNameOverrides);
    const [librarySource, setLibrarySource] = useState(() => {
        try {
            const saved = localStorage.getItem('quantskills.skillLibrarySource');
            if (saved === 'installed' || saved === 'discover' || saved === 'unknown')
                return saved;
        }
        catch { /* Storage is optional. */ }
        return 'mine';
    });
    const libraryAssets = useMemo(() => skillLibraryAssets(props.catalog, librarySource).map(asset => {
        const override = displayNameOverrides.find(entry => entry.assetId === asset.name);
        return override ? { ...asset, title: override.displayName } : asset;
    }), [props.catalog, librarySource, displayNameOverrides]);
    const libraryPhase = librarySource === 'discover' ? props.catalog.phase : props.catalog.installedPhase;
    const changeLibrarySource = (source) => {
        setLibrarySource(source);
        props.actions.setCategory('all');
        props.actions.closeSkillDrawer();
        try {
            localStorage.setItem('quantskills.skillLibrarySource', source);
        }
        catch { /* Storage is optional. */ }
    };
    const search = props.useStore(state => state.search);
    const selectedCategory = props.useStore(state => state.selectedCategory);
    const selectedSkill = props.useStore(state => state.selectedSkill);
    const drawerOpen = props.useStore(state => state.skillDrawerOpen);
    const view = props.useStore(state => state.catalogView);
    const sort = props.useStore(state => state.catalogSort);
    const favoriteAssetIds = props.useStore(state => state.favoriteAssetIds);
    const autoCheckCatalog = props.useStore(state => state.autoCheckCatalog);
    const settingsWritable = props.useStore(state => state.settingsWritable);
    const [actionError, setActionError] = useState();
    const drawerTriggerRef = useRef(null);
    const closeDrawer = useCallback(() => { props.actions.closeSkillDrawer(); }, [props.actions]);
    const drawer = useDrawerBehavior(drawerOpen, closeDrawer, drawerTriggerRef, false);
    const skillCategories = useMemo(() => props.catalog.categories.filter(category => libraryAssets.some(asset => asset.projectType === 'skill' && asset.category === category.id)), [
        libraryAssets,
        props.catalog.categories,
    ]);
    useEffect(() => {
        if (selectedCategory !== 'all' && !skillCategories.some(category => category.id === selectedCategory)) {
            props.actions.setCategory('all');
        }
    }, [props.actions, selectedCategory, skillCategories]);
    const skills = useMemo(() => {
        const filtered = libraryAssets.filter(asset => asset.projectType === 'skill'
            && (selectedCategory === 'all' || asset.category === selectedCategory)
            && assetSearchText(asset).includes(search.trim().toLocaleLowerCase()));
        if (sort === 'recommended')
            return filtered;
        return [...filtered].sort((left, right) => sort === 'name'
            ? left.title.localeCompare(right.title, 'zh-CN')
            : left.category.localeCompare(right.category) || left.title.localeCompare(right.title, 'zh-CN'));
    }, [libraryAssets, search, selectedCategory, sort]);
    const selected = libraryAssets.find(asset => asset.name === selectedSkill) ?? skills[0];
    const install = (asset) => {
        setActionError(undefined);
        void props.installAsset(asset).catch((error) => {
            setActionError(error instanceof Error ? error.message : String(error));
        });
    };
    const start = (asset, version) => {
        setActionError(undefined);
        void props.startSkillSession(asset, version).catch((error) => {
            setActionError(error instanceof Error ? error.message : String(error));
        });
    };
    const catalogStatus = libraryPhase === 'loading'
        ? '正在连接宿主目录'
        : libraryPhase === 'stale'
            ? '宿主目录已过期'
            : libraryPhase === 'error'
                ? '宿主目录不可用'
                : `${skills.length} 个技能`;
    if (manualEditor && props.manualSkillSave)
        return _jsx("div", { className: css.capabilityPage, children: _jsx(ManualSkillEditor, { source: manualEditor.source, save: props.manualSkillSave, onClose: () => setManualEditor(undefined), onSaved: assetId => { setManualEditor(undefined); changeLibrarySource('mine'); props.actions.setSearch(''); props.actions.selectSkill(assetId); } }) });
    return (_jsxs("div", { className: css.capabilityPage, children: [uninstallTarget && _jsxs(ActionDialog, { title: "\u5378\u8F7D\u6280\u80FD", busy: uninstallBusy, error: uninstallError, onClose: () => setUninstallTarget(undefined), children: [_jsxs("p", { children: ["\u5378\u8F7D\u300C", uninstallTarget.title, "\u300D\u540E\uFF0C\u5B83\u5C06\u4ECE\u5DF2\u5B89\u88C5\u5217\u8868\u548C\u53EF\u52A0\u8F7D\u6280\u80FD\u4E2D\u79FB\u9664\u3002\u5DF2\u6709\u4F1A\u8BDD\u4E0E\u4E13\u5BB6\u5F15\u7528\u7684\u7248\u672C\u4F1A\u4FDD\u7559\uFF0C\u4E4B\u540E\u53EF\u91CD\u65B0\u5B89\u88C5\u3002"] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: uninstallBusy, onClick: () => setUninstallTarget(undefined), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", "data-danger": true, disabled: uninstallBusy, onClick: () => {
                                    setUninstallBusy(true);
                                    setUninstallError(undefined);
                                    void props.uninstallAsset(uninstallTarget.name).then(() => { setUninstallTarget(undefined); props.actions.closeSkillDrawer(); }, error => {
                                        setUninstallError(error instanceof Error ? error.message : '卸载失败，请重试。');
                                    }).finally(() => setUninstallBusy(false));
                                }, children: uninstallBusy ? '正在卸载…' : '确认卸载' })] })] }), actionError && _jsx("p", { className: css.error, role: "alert", children: actionError }), props.catalog.operationError && _jsx("p", { className: css.error, role: "alert", children: props.catalog.operationError }), _jsxs("div", { className: css.pageScroll, hidden: drawerOpen && selected !== undefined, children: [_jsxs("div", { className: css.catalogHeader, children: [_jsx(PageHeader, { title: "\u6280\u80FD", action: _jsxs("div", { className: css.creationActions, children: [_jsx("button", { type: "button", className: css.outlineButton, disabled: !props.manualSkillSave, onClick: () => setManualEditor({}), children: "\u624B\u52A8\u521B\u5EFA" }), _jsxs("button", { type: "button", className: css.primaryButton, onClick: () => {
                                                void props.startAuthoringSession('skill').catch((error) => {
                                                    setActionError(error instanceof Error ? error.message : '无法开始技能创作');
                                                });
                                            }, children: [_jsx(Plus, {}), "AI \u521B\u5EFA\u6280\u80FD"] })] }) }), _jsxs("label", { className: css.searchBox, children: [_jsx(MagnifyingGlass, {}), _jsx("input", { value: search, onChange: (event) => { props.actions.setSearch(event.target.value); }, placeholder: "\u641C\u7D22 \u6280\u80FD\u3001\u7B56\u7565\u6216\u6570\u636E\u6E90" })] })] }), _jsxs("div", { className: css.agentTabs, "aria-label": "\u6280\u80FD\u6765\u6E90", children: [[['mine', '我的创建'], ['installed', '已安装'], ['discover', '发现']].map(([source, label]) => _jsx("button", { type: "button", "aria-pressed": librarySource === source, className: librarySource === source ? css.selected : undefined, onClick: () => { changeLibrarySource(source); }, children: label }, source)), skillLibraryAssets(props.catalog, 'unknown').length > 0 && _jsx("button", { type: "button", "aria-pressed": librarySource === 'unknown', onClick: () => { changeLibrarySource('unknown'); }, children: "\u5386\u53F2\u5185\u5BB9 \u00B7 \u6765\u6E90\u5F85\u786E\u8BA4" })] }), _jsxs("div", { className: css.categoryTabs, children: [_jsx("button", { type: "button", className: selectedCategory === 'all' ? css.selected : undefined, onClick: () => { props.actions.setCategory('all'); }, children: "\u5168\u90E8" }), skillCategories.map(category => _jsx("button", { type: "button", className: selectedCategory === category.id ? css.selected : undefined, onClick: () => { props.actions.setCategory(category.id); }, children: category.label }, category.id))] }), _jsxs("div", { className: css.catalogTools, children: [_jsx("span", { children: catalogStatus }), _jsx("button", { type: "button", onClick: () => { void props.refreshCatalog(); }, children: "\u5237\u65B0\u76EE\u5F55" }), _jsxs("div", { className: css.viewToggle, children: [_jsx("button", { "aria-label": "\u5217\u8868\u89C6\u56FE", className: view === 'list' ? css.selected : undefined, onClick: () => { props.actions.setCatalogView('list'); }, children: _jsx(List, {}) }), _jsx("button", { "aria-label": "\u5361\u7247\u89C6\u56FE", className: view === 'grid' ? css.selected : undefined, onClick: () => { props.actions.setCatalogView('grid'); }, children: _jsx(GridFour, {}) })] }), _jsxs("label", { className: css.catalogSort, children: [_jsxs("select", { "aria-label": "\u6280\u80FD \u6392\u5E8F", value: sort, onChange: (event) => { props.actions.setCatalogSort(event.target.value); }, children: [_jsx("option", { value: "recommended", children: "\u7EFC\u5408\u6392\u5E8F" }), _jsx("option", { value: "name", children: "\u540D\u79F0\u6392\u5E8F" }), _jsx("option", { value: "category", children: "\u5206\u7C7B\u6392\u5E8F" })] }), _jsx(CaretDown, {})] })] }), props.catalog.catalogError && _jsx("p", { className: css.notice, role: "status", children: props.catalog.catalogError }), props.catalog.installedError && _jsx("p", { className: css.notice, role: "status", children: props.catalog.installedError }), _jsxs("div", { className: clsx(css.skillCatalog, view === 'grid' && css.skillGrid), children: [skills.map((asset, index) => _jsx(SkillRow, { asset: asset, tone: ['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue', catalog: props.catalog, favorite: favoriteAssetIds.includes(asset.name), selected: asset.name === selected?.name && drawerOpen, drawerId: drawer.panelId, onSelect: (trigger) => {
                                    drawerTriggerRef.current = trigger;
                                    props.actions.selectSkill(asset.name);
                                }, onInstall: () => { install(asset); }, onUninstall: librarySource === 'installed' && props.uninstallAsset ? () => { setUninstallError(undefined); setUninstallTarget(asset); } : undefined, onStart: (version) => { start(asset, version); }, onFavorite: () => {
                                    props.actions.setFavoriteAssetIds(favoriteAssetIds.includes(asset.name)
                                        ? favoriteAssetIds.filter(id => id !== asset.name)
                                        : [...favoriteAssetIds, asset.name]);
                                } }, asset.name)), skills.length === 0 && _jsxs("div", { className: css.emptyState, children: [_jsx(MagnifyingGlass, { size: 30 }), _jsx("h2", { children: libraryPhase === 'loading' ? '正在读取技能' : libraryPhase === 'error' || libraryPhase === 'stale' ? '技能读取失败，请重试' : search.trim() || selectedCategory !== 'all' ? '没有匹配的技能' : librarySource === 'mine' ? '还没有创建技能' : librarySource === 'installed' ? '还没有安装技能' : '暂无技能' }), libraryPhase === 'ready' && _jsx("button", { onClick: () => { props.actions.setSearch(''); props.actions.setCategory('all'); }, children: "\u6E05\u9664\u7B5B\u9009" })] })] })] }), drawerOpen && selected && _jsx(SkillDetails, { asset: selected, catalog: props.catalog, favorite: favoriteAssetIds.includes(selected.name), autoCheckCatalog: autoCheckCatalog, settingsWritable: settingsWritable, customDisplayName: displayNameOverrides.find(entry => entry.assetId === selected.name)?.displayName, archives: props.boundSessions.archives.filter(archive => archive.binding.assetId === selected.name), drawer: drawer, readAssetReadme: props.readAssetReadme, onEdit: props.manualSkillSave ? version => setManualEditor({ source: {
                        versionId: version.versionId, name: selected.title, personal: version.origin === 'local-authoring',
                        read: signal => props.readSkillDeclaration(version.versionId, signal),
                    } }) : undefined, onInstall: () => { install(selected); }, onStart: (version) => { start(selected, version); }, onFavorite: () => {
                    props.actions.setFavoriteAssetIds(favoriteAssetIds.includes(selected.name)
                        ? favoriteAssetIds.filter(id => id !== selected.name)
                        : [...favoriteAssetIds, selected.name]);
                }, onAutoCheckCatalog: (enabled) => { props.actions.setAutoCheckCatalog(enabled); }, onDisplayNameOverride: (displayName) => {
                    const remaining = displayNameOverrides.filter(entry => entry.assetId !== selected.name);
                    props.actions.setAssetDisplayNameOverrides(displayName === undefined
                        ? remaining
                        : [...remaining, { assetId: selected.name, displayName }]);
                }, onOpen: (sessionId) => {
                    props.openSession(sessionId);
                    props.actions.navigate('conversations');
                } })] }));
}
function SkillRow({ asset, catalog, selected, favorite, tone, drawerId, onSelect, onInstall, onStart, onFavorite, onArrange, onUninstall }) {
    const installed = currentInstalledVersion(catalog, asset);
    const installing = catalog.installing.has(asset.name);
    const otherVersion = (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0;
    const updateAvailable = installed === undefined && otherVersion;
    const canStart = installed !== undefined && catalog.installedPhase === 'ready';
    const canInstall = catalog.phase === 'ready' && !installing;
    const status = installing
        ? '正在安装'
        : installed
            ? '已安装当前版本'
            : updateAvailable
                ? '有更新 · 已有会话不变'
                : '未安装';
    const disabledReason = installed && catalog.installedPhase !== 'ready'
        ? '宿主已安装版本投影不可用或已过期'
        : !installed && catalog.phase !== 'ready'
            ? '宿主目录不可用或已过期'
            : undefined;
    return _jsxs("article", { className: clsx(css.skillRow, selected && css.skillRowSelected), children: [_jsxs("button", { type: "button", className: css.skillDetailButton, "aria-label": `查看 ${asset.title} 详情`, "aria-expanded": selected, "aria-controls": selected ? drawerId : undefined, onClick: (event) => { onSelect(event.currentTarget); }, children: [_jsx(SkillMark, { tone: tone }), _jsxs("span", { className: css.skillIdentity, children: [_jsx("b", { children: asset.title }), _jsx("small", { className: css.technicalId, children: asset.name }), _jsx("small", { children: asset.summary || '标准 QuantSkills 能力' })] })] }), _jsx("span", { className: css.maintainer, children: installed?.origin === 'local-authoring' ? '我的创建' : asset.url ? 'QUANTSKILLS' : '历史内容' }), _jsxs("span", { className: css.tags, children: [_jsx("mark", { children: asset.category || '研究' }), _jsx("mark", { children: asset.declarationFile })] }), _jsxs("span", { className: css.installStatus, children: [installed ? _jsx(CheckCircle, { weight: "fill" }) : updateAvailable ? _jsx(Clock, {}) : _jsx(Circle, {}), status] }), _jsx("button", { type: "button", className: css.favoriteButton, "aria-label": `${favorite ? '取消收藏' : '收藏'} ${asset.title}`, "aria-pressed": favorite, onClick: onFavorite, children: _jsx(Star, { weight: favorite ? 'fill' : 'regular' }) }), _jsxs("div", { className: css.capabilityRowActions, children: [_jsx("button", { type: "button", className: css.outlineButton, disabled: installed ? !canStart : !canInstall, title: disabledReason, onClick: () => { if (installed)
                            onStart(installed);
                        else
                            onInstall(); }, children: installing
                            ? '安装中'
                            : installed
                                ? '新建会话'
                                : catalog.phase === 'ready'
                                    ? updateAvailable ? `更新到 ${asset.commitSha.slice(0, 7)}` : '安装'
                                    : '宿主不可用' }), otherVersion && onUninstall && _jsxs("button", { type: "button", className: css.uninstallButton, disabled: installing || catalog.installedPhase !== 'ready', "aria-label": `卸载 ${asset.title}`, onClick: onUninstall, children: [_jsx(Trash, {}), "\u5378\u8F7D"] }), installed && onArrange && _jsx("button", { type: "button", className: css.outlineButton, disabled: !canStart, onClick: () => onArrange(installed), children: "\u521B\u5EFA\u5B89\u6392" })] })] });
}
function SkillDetails({ asset, catalog, favorite, autoCheckCatalog, settingsWritable, customDisplayName, archives, drawer, readAssetReadme, onInstall, onStart, onFavorite, onAutoCheckCatalog, onDisplayNameOverride, onOpen, onEdit, }) {
    useEffect(() => { drawer.closeButtonRef.current?.focus(); }, [drawer.closeButtonRef]);
    const [displayNameDraft, setDisplayNameDraft] = useState(customDisplayName ?? '');
    const [readme, setReadme] = useState({ phase: 'loading' });
    const declaration = readme.phase === 'ready' ? declarationDisplay(readme.value.markdown) : undefined;
    useEffect(() => {
        setDisplayNameDraft(customDisplayName ?? '');
    }, [asset.name, customDisplayName]);
    useEffect(() => {
        const controller = new AbortController();
        setReadme({ phase: 'loading' });
        void readAssetReadme(asset, controller.signal).then((value) => { if (!controller.signal.aborted)
            setReadme({ phase: 'ready', value }); }, (error) => {
            if (!controller.signal.aborted) {
                setReadme({ phase: 'error', message: error instanceof Error ? error.message : String(error) });
            }
        });
        return () => { controller.abort(); };
    }, [asset.name, asset.commitSha, readAssetReadme]);
    const installed = currentInstalledVersion(catalog, asset);
    const installing = catalog.installing.has(asset.name);
    const updateAvailable = installed === undefined && (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0;
    const canStart = installed !== undefined && catalog.installedPhase === 'ready';
    const canInstall = catalog.phase === 'ready' && !installing;
    const disabledReason = installed && catalog.installedPhase !== 'ready'
        ? '宿主已安装版本投影不可用或已过期'
        : catalog.phase !== 'ready'
            ? '宿主目录不可用或已过期'
            : undefined;
    return _jsxs("aside", { id: drawer.panelId, className: css.capabilityDetails, role: "region", "aria-labelledby": drawer.labelId, children: [_jsx("header", { children: _jsx("button", { ref: drawer.closeButtonRef, "aria-label": "\u5173\u95ED \u6280\u80FD \u8BE6\u60C5", onClick: drawer.close, children: "\u2190 \u8FD4\u56DE\u6280\u80FD\u5E93" }) }), _jsxs("div", { className: css.drawerTitle, children: [_jsx(SkillMark, {}), _jsxs("span", { children: [_jsx("h2", { id: drawer.labelId, children: asset.title }), _jsx("small", { className: css.technicalId, children: asset.name })] }), _jsx("button", { type: "button", className: css.favoriteButton, "aria-label": `${favorite ? '取消收藏' : '收藏'} ${asset.title}`, "aria-pressed": favorite, onClick: onFavorite, children: _jsx(Star, { weight: favorite ? 'fill' : 'regular' }) })] }), _jsxs("form", { className: css.localNameEditor, onSubmit: (event) => {
                    event.preventDefault();
                    const next = displayNameDraft.trim();
                    if (next !== '')
                        onDisplayNameOverride(next);
                }, children: [_jsx("label", { htmlFor: `local-name-${asset.name}`, children: "\u672C\u5730\u663E\u793A\u540D\u79F0" }), _jsxs("div", { children: [_jsx("input", { id: `local-name-${asset.name}`, value: displayNameDraft, maxLength: 80, disabled: !settingsWritable, placeholder: asset.catalogTitle, onChange: (event) => { setDisplayNameDraft(event.target.value); } }), _jsx("button", { type: "submit", disabled: !settingsWritable || displayNameDraft.trim() === '', children: "\u4FDD\u5B58" }), customDisplayName !== undefined && _jsx("button", { type: "button", disabled: !settingsWritable, onClick: () => { setDisplayNameDraft(''); onDisplayNameOverride(); }, children: "\u6062\u590D\u76EE\u5F55\u540D\u79F0" })] }), _jsxs("small", { children: ["\u53EA\u6539\u53D8\u672C\u673A\u663E\u793A\uFF1B\u5B89\u88C5\u3001\u66F4\u65B0\u3001\u641C\u7D22\u548C\u4F1A\u8BDD\u7ED1\u5B9A\u4ECD\u4F7F\u7528 ", asset.name, "\u3002"] })] }), _jsxs("div", { className: css.metaLine, children: [_jsxs("span", { children: ["\u7248\u672C ", _jsx("b", { children: asset.commitSha.slice(0, 7) })] }), _jsx("span", { children: installed ? installed.origin === 'local-authoring' ? '我的创建 · 已保存' : installed.origin === 'catalog' ? '公共安装 · 已保存' : '历史内容 · 来源待确认' : '公开目录' })] }), installed && onEdit && _jsx("button", { type: "button", className: css.outlineButton, disabled: catalog.installedPhase !== 'ready', onClick: () => onEdit(installed), children: installed.origin === 'local-authoring' ? '编辑技能' : '另存为我的技能' }), _jsxs("section", { className: css.skillReadme, "aria-label": "\u4ED3\u5E93 README", children: [_jsxs("header", { className: css.skillReadmeHeader, children: [_jsxs("div", { children: [_jsx("b", { children: readme.phase === 'ready' ? readme.value.path : installed ? asset.declarationFile : 'README.md' }), _jsxs("small", { children: ["\u56FA\u5B9A\u7248\u672C ", asset.commitSha.slice(0, 7)] })] }), asset.url && _jsxs("a", { href: `${asset.url}/blob/${asset.commitSha}/${readme.phase === 'ready' ? readme.value.path.split('/').map(encodeURIComponent).join('/') : 'README.md'}`, target: "_blank", rel: "noreferrer", children: ["\u67E5\u770B\u4ED3\u5E93\u539F\u6587 ", _jsx(ArrowSquareOut, {})] })] }), readme.phase === 'loading' && _jsx("p", { className: css.skillReadmeStatus, children: "\u6B63\u5728\u8BFB\u53D6\u56FA\u5B9A\u7248\u672C\u8BF4\u660E\u2026" }), readme.phase === 'error' && _jsxs("div", { className: css.skillReadmeFallback, role: "status", children: [_jsx("b", { children: "\u6280\u80FD\u8BF4\u660E\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6" }), _jsx("p", { children: asset.summary || asset.description || '该 技能 暂无可用说明。' }), asset.description && !hasChinese(asset.description) && asset.description !== asset.summary && _jsxs("details", { children: [_jsx("summary", { children: "\u539F\u59CB\u8BF4\u660E" }), _jsx("p", { children: asset.description })] }), _jsx("small", { children: readme.message })] }), declaration && _jsxs("div", { className: css.skillReadmeBody, children: [_jsx(MarkdownText, { text: declaration.body, labels: MARKDOWN_LABELS }), declaration.metadata && _jsxs("details", { children: [_jsx("summary", { children: "\u58F0\u660E\u5143\u4FE1\u606F" }), _jsx("pre", { children: declaration.metadata })] })] })] }), updateAvailable && _jsxs("p", { className: css.notice, role: "status", children: [_jsx(Shield, {}), "\u66F4\u65B0\u4F1A\u5B89\u88C5\u4E0D\u53EF\u53D8\u7684\u65B0\u7248\u672C\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u7EE7\u7EED\u4F7F\u7528\u539F\u7248\u672C\uFF0C\u65B0\u4F1A\u8BDD\u624D\u4F7F\u7528 ", asset.commitSha.slice(0, 7), "\u3002"] }), _jsxs(InfoGroup, { icon: _jsx(Wrench, {}), title: "\u9002\u7528\u573A\u666F", children: [_jsx("li", { children: "\u91CF\u5316\u7814\u7A76\u4E0E\u8BC1\u636E\u9A8C\u8BC1" }), _jsx("li", { children: "\u72EC\u7ACB\u4E0A\u4E0B\u6587\u4E0E\u591A\u8F6E\u8FFD\u95EE" })] }), _jsxs(InfoGroup, { icon: _jsx(Star, {}), title: "\u6240\u9700\u80FD\u529B", children: [_jsxs("li", { children: ["\u6807\u51C6 ", asset.declarationFile] }), _jsx("li", { children: asset.requires.join('、') || '本地工作区' })] }), _jsx(InfoGroup, { icon: _jsx(LockKey, {}), title: "\u6743\u9650", children: _jsx("li", { children: "\u4F7F\u7528\u4F1A\u8BDD\u5F53\u524D\u6388\u6743\uFF1B\u4FDD\u5B58\u6280\u80FD\u4E0D\u4F1A\u989D\u5916\u6388\u4E88\u6267\u884C\u6743\u9650\u3002" }) }), _jsxs("div", { className: css.requirements, children: [_jsx("h3", { children: "\u8FD0\u884C\u8981\u6C42" }), _jsxs("p", { children: [_jsx(FolderOpen, {}), "\u8FD0\u884C\u73AF\u5883 ", _jsx("span", { children: "\u4F7F\u7528\u5F53\u524D\u5DE5\u4F5C\u533A\u4E0E\u7528\u6237\u73AF\u5883" })] }), _jsxs("p", { children: [_jsx(Wrench, {}), "Python / PandaData ", _jsx("span", { children: "\u6309\u5F53\u524D\u73AF\u5883\u4F7F\u7528\uFF0C\u7F3A\u5931\u65F6\u7531\u4EFB\u52A1\u7ED9\u51FA\u4FEE\u590D\u5EFA\u8BAE" })] }), _jsxs("p", { children: [_jsx(Globe, {}), "\u7F51\u7EDC ", _jsx("span", { children: "\u6309\u8FD0\u884C\u6388\u6743" })] })] }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: installed ? !canStart : !canInstall, title: disabledReason, onClick: () => { if (installed)
                    onStart(installed);
                else
                    onInstall(); }, children: [installing
                        ? '正在安装...'
                        : installed
                            ? '新建独立会话'
                            : catalog.phase === 'ready'
                                ? updateAvailable ? `更新到 ${asset.commitSha.slice(0, 7)}` : '安装 技能'
                                : '宿主不可用', _jsx(PaperPlaneTilt, { weight: "fill" })] }), _jsxs("div", { className: css.archiveList, children: [_jsxs("h3", { children: ["\u4F1A\u8BDD\u5B58\u6863 ", _jsx("mark", { children: archives.length })] }), archives.length === 0
                        ? _jsxs("p", { children: [_jsx(ChatsCircle, {}), "\u8FD8\u6CA1\u6709\u8BE5 \u6280\u80FD \u7684\u4F1A\u8BDD\u5B58\u6863\u3002"] })
                        : archives.map(archive => _jsxs("button", { type: "button", onClick: () => { onOpen(archive.sessionId); }, children: [_jsx(ChatsCircle, {}), _jsxs("span", { children: [_jsx("b", { children: archive.title ?? '未命名会话' }), _jsx("small", { children: formatUpdated(archive.updatedAt) })] }), archive.running ? _jsx(StatusDot, { status: "running" }) : _jsx(CaretRight, {})] }, archive.sessionId))] }), _jsxs("label", { className: css.toggleRow, title: "\u68C0\u67E5\u95F4\u9694\u7531 QuantSkills Host \u914D\u7F6E", children: ["\u81EA\u52A8\u68C0\u67E5\u76EE\u5F55\uFF08", formatRefreshInterval(catalog.refreshAfterMs), "\uFF09", _jsx("input", { type: "checkbox", checked: autoCheckCatalog, disabled: !settingsWritable, onChange: (event) => { onAutoCheckCatalog(event.target.checked); } }), _jsx("i", {})] })] });
}
function currentInstalledVersion(catalog, asset) {
    return catalog.versionsByAsset[asset.name]?.find(version => version.commitSha === asset.commitSha
        && version.projectType === asset.projectType
        && version.exposure === (asset.projectType === 'skill' ? 'skill-registry' : 'agent-template'));
}
function assetTitle(catalog, assetId) {
    return catalog.assets.find(asset => asset.name === assetId)?.title ?? assetId;
}
function assetSearchText(asset) {
    return [
        asset.title,
        asset.catalogTitle,
        asset.englishTitle,
        asset.name,
        ...asset.aliases,
        asset.summary,
        asset.description,
    ].join(' ').toLocaleLowerCase();
}
function formatUpdated(updatedAt) {
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(updatedAt));
}
function InfoGroup({ icon, title, children }) {
    return _jsxs("section", { className: css.infoGroup, children: [_jsxs("h3", { children: [icon, title] }), _jsx("ul", { children: children })] });
}
function ConversationPage(props) {
    const [creatingSession, setCreatingSession] = useState(false);
    const [createSessionError, setCreateSessionError] = useState();
    const plainArchives = props.boundSessions.plainArchives;
    const skillArchives = props.boundSessions.archives;
    const agentArchives = props.agents.archives;
    const teamArchives = props.agents.teamArchives;
    const rows = [
        ...plainArchives.map(archive => ({ kind: 'plain', archive })),
        ...skillArchives.map(archive => ({ kind: 'skill', archive })),
        ...agentArchives.map(archive => ({ kind: 'agent', archive })),
        ...teamArchives.map(archive => ({ kind: 'team', archive })),
    ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt);
    const archiveCount = rows.length;
    const groups = groupConversationRowsByDate(rows);
    const open = (sessionId) => {
        props.openSession(sessionId);
        props.actions.navigate('conversations');
    };
    const startSession = async () => {
        if (creatingSession)
            return;
        setCreatingSession(true);
        setCreateSessionError(undefined);
        try {
            await props.startSession();
        }
        catch (cause) {
            setCreateSessionError(cause instanceof Error ? cause.message : '创建会话失败，请重试。');
        }
        finally {
            setCreatingSession(false);
        }
    };
    return _jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "\u4F1A\u8BDD", subtitle: "\u666E\u901A\u3001\u6280\u80FD\u3001\u4E13\u5BB6 \u4E0E \u4E13\u5BB6\u56E2 \u4F1A\u8BDD\u90FD\u6709\u72EC\u7ACB\u4E0A\u4E0B\u6587\u548C\u771F\u5B9E\u5B58\u6863", action: _jsxs("div", { className: css.creationActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: creatingSession, onClick: () => { void startSession(); }, children: [_jsx(Plus, {}), creatingSession ? '正在创建…' : '新建会话'] }), _jsx("button", { type: "button", className: css.outlineButton, onClick: () => {
                                void Promise.all([props.refreshBoundSessions(), props.refreshAgents()]);
                            }, children: "\u5237\u65B0" })] }) }), props.boundSessions.error && _jsx("p", { className: css.notice, role: "status", children: props.boundSessions.error }), props.agents.error && _jsx("p", { className: css.notice, role: "status", children: props.agents.error }), createSessionError && _jsx("p", { className: css.notice, role: "alert", children: createSessionError }), archiveCount === 0
                ? _jsxs("div", { className: css.settingsPlaceholder, children: [_jsx(ChatsCircle, { size: 42 }), _jsx("h2", { children: "\u8FD8\u6CA1\u6709 QuantSkills \u4F1A\u8BDD" }), _jsx("p", { children: "\u666E\u901A\u4F1A\u8BDD\u53EF\u76F4\u63A5\u4F7F\u7528\uFF1B\u9700\u8981 Python \u6216 PandaData \u65F6\uFF0C\u4E13\u5BB6\u4F1A\u4F7F\u7528\u5F53\u524D\u5DE5\u4F5C\u533A\u548C\u7528\u6237\u73AF\u5883\uFF0C\u5E76\u5728\u7F3A\u5931\u65F6\u7ED9\u51FA\u4FEE\u590D\u5EFA\u8BAE\u3002" }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: creatingSession, onClick: () => { void startSession(); }, children: [_jsx(Plus, {}), creatingSession ? '正在创建…' : '新建会话'] })] })
                : _jsx("div", { className: css.archiveGroups, children: groups.map(group => _jsx(ConversationArchiveGroup, { title: group.label, rows: group.rows, props: props, open: open }, group.key)) })] });
}
function ConversationArchiveGroup({ title, rows, props, open }) {
    if (rows.length === 0)
        return null;
    return _jsxs("section", { className: css.archiveGroup, children: [_jsxs("h2", { children: [title, _jsx("mark", { children: rows.length })] }), _jsx("div", { className: css.archiveOverview, children: rows.map((row, index) => {
                    if (row.kind === 'plain') {
                        return _jsxs("article", { children: [_jsxs("button", { type: "button", className: css.archiveMain, onClick: () => { open(row.archive.sessionId); }, children: [_jsx(CapabilityIcon, { kind: "agent-team" }), _jsxs("span", { children: [_jsx("b", { children: row.archive.title ?? '新会话' }), _jsxs("small", { children: ["\u666E\u901A\u4F1A\u8BDD \u00B7 ", formatUpdated(row.archive.updatedAt)] })] }), row.archive.running ? _jsx(StatusDot, { status: "running" }) : _jsx(CaretRight, {})] }), _jsx("button", { type: "button", className: css.archiveNew, "aria-label": "\u65B0\u5EFA\u666E\u901A\u4F1A\u8BDD", onClick: () => {
                                        void props.startSession();
                                    }, children: _jsx(Plus, {}) })] }, row.archive.sessionId);
                    }
                    if (row.kind === 'skill') {
                        const label = assetTitle(props.catalog, row.archive.binding.assetId);
                        return _jsxs("article", { children: [_jsxs("button", { type: "button", className: css.archiveMain, onClick: () => { open(row.archive.sessionId); }, children: [_jsx(SkillMark, { tone: ['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue' }), _jsxs("span", { children: [_jsx("b", { children: row.archive.title ?? label }), _jsxs("small", { children: [label, " \u00B7 ", formatUpdated(row.archive.updatedAt)] })] }), row.archive.running ? _jsx(StatusDot, { status: "running" }) : _jsx(CaretRight, {})] }), _jsx("button", { type: "button", className: css.archiveNew, "aria-label": `为 ${label} 新建会话`, onClick: () => {
                                        void props.startBoundSession(row.archive.binding, label);
                                    }, children: _jsx(Plus, {}) })] }, row.archive.sessionId);
                    }
                    const definition = row.kind === 'agent'
                        ? props.agents.definitions.find(item => item.agentId === row.archive.agent.agentId)
                        : props.agents.teams.find(item => item.teamId === row.archive.team.teamId);
                    const canStart = props.agents.phase === 'ready' && definition !== undefined;
                    const ownerName = row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name;
                    const ownerLabel = row.kind === 'agent' ? '专家' : '专家团';
                    return _jsxs("article", { children: [_jsxs("button", { type: "button", className: css.archiveMain, onClick: () => { open(row.archive.sessionId); }, children: [_jsx("span", { className: css.agentMark, children: row.kind === 'agent' ? _jsx(CapabilityIcon, { kind: "agent" }) : _jsx(ChatsCircle, {}) }), _jsxs("span", { children: [_jsx("b", { children: row.archive.title ?? ownerName }), _jsxs("small", { children: [ownerLabel, " \u00B7 ", ownerName, " \u00B7 ", formatUpdated(row.archive.updatedAt)] })] }), row.archive.running ? _jsx(StatusDot, { status: "running" }) : _jsx(CaretRight, {})] }), _jsx("button", { type: "button", className: css.archiveNew, "aria-label": `为${ownerLabel} ${ownerName} 新建会话`, disabled: !canStart, title: canStart ? undefined : `当前${ownerLabel}定义不可用；旧存档仍可继续`, onClick: () => {
                                    if (definition === undefined)
                                        return;
                                    if (row.kind === 'agent' && 'agentId' in definition)
                                        void props.startAgentSession(definition);
                                    else if (row.kind === 'team' && 'teamId' in definition)
                                        void props.startAgentTeamSession(definition);
                                }, children: _jsx(Plus, {}) })] }, row.archive.sessionId);
                }) })] });
}
function ParallelPage(props) {
    const [filter, setFilter] = useState('all');
    const [replyDrawerOpen, setReplyDrawerOpen] = useState(false);
    const currentSessionId = props.useSessions(state => state.current);
    const sessionById = props.useSessions(state => state.byId);
    const pendingInteractions = props.useSessionPendingInteraction(state => state);
    const rows = [
        ...props.boundSessions.archives.filter(archive => !archive.archived).map(archive => ({
            kind: 'skill',
            archive,
            state: pendingInteractions.has(archive.sessionId)
                ? 'waiting'
                : sessionById[archive.sessionId]?.completed === true
                    ? 'completed'
                    : archive.runState,
        })),
        ...props.agents.archives.filter(archive => !archive.archived).map(archive => ({
            kind: 'agent',
            archive,
            state: pendingInteractions.has(archive.sessionId)
                ? 'waiting'
                : sessionById[archive.sessionId]?.completed === true
                    ? 'completed'
                    : archive.runState,
        })),
    ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt);
    const current = rows.find(row => row.archive.sessionId === currentSessionId);
    const loaded = rows.filter(row => row.state === 'running');
    const waiting = rows.filter(row => row.state === 'waiting');
    const failed = rows.filter(row => row.state === 'failed');
    const cancelled = rows.filter(row => row.state === 'cancelled');
    const completed = rows.filter(row => row.state === 'completed' || row.state === 'idle');
    const groups = [
        { id: 'running', title: '运行中', rows: loaded },
        { id: 'waiting', title: '等待你的回复', rows: waiting },
        { id: 'failed', title: '失败', rows: failed },
        { id: 'cancelled', title: '已取消', rows: cancelled },
        { id: 'completed', title: '最近完成', rows: completed },
    ];
    const currentDefinition = current?.kind === 'agent'
        ? props.agents.definitions.find(definition => definition.agentId === current.archive.agent.agentId)
        : undefined;
    const canStartCurrent = current?.kind !== 'agent'
        || (props.agents.phase === 'ready' && currentDefinition !== undefined);
    const open = (id) => {
        props.openSession(id);
        props.actions.navigate('conversations');
    };
    if (rows.length === 0)
        return _jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "\u5E76\u884C\u89C6\u56FE", subtitle: "\u6BCF\u4E2A\u4F1A\u8BDD\u62E5\u6709\u72EC\u7ACB\u4E0A\u4E0B\u6587\u3001\u5DE5\u4F5C\u533A\u548C\u4EA7\u7269" }), _jsxs("div", { className: css.settingsPlaceholder, children: [_jsx(ChatsCircle, { size: 42 }), _jsx("h2", { children: "\u6682\u65E0\u5E76\u884C\u4F1A\u8BDD" }), _jsx("p", { children: "\u521B\u5EFA\u591A\u4E2A\u771F\u5B9E \u6280\u80FD \u4F1A\u8BDD\u540E\uFF0C\u53EF\u5728\u8FD9\u91CC\u7EDF\u4E00\u67E5\u770B\u8FD0\u884C\u548C\u53EF\u7EE7\u7EED\u72B6\u6001\u3002" }), _jsxs("button", { type: "button", className: css.primaryButton, onClick: () => { props.actions.navigate('skills'); }, children: [_jsx(CapabilityIcon, { kind: "skill", size: 18, bare: true }), "\u9009\u62E9 \u6280\u80FD"] })] })] });
    return _jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "\u5E76\u884C\u89C6\u56FE", subtitle: "\u6BCF\u4E2A\u4F1A\u8BDD\u62E5\u6709\u72EC\u7ACB\u4E0A\u4E0B\u6587\u3001\u5DE5\u4F5C\u533A\u548C\u4EA7\u7269", action: _jsxs("div", { className: css.pageHeaderActions, children: [waiting.length > 0 && _jsxs("button", { type: "button", className: css.replyDrawerTrigger, "aria-label": `查看等待回复的 ${waiting.length} 个会话`, onClick: () => { setReplyDrawerOpen(true); }, children: [_jsx(ChatsCircle, {}), _jsx("span", { children: "\u7B49\u5F85\u56DE\u590D" }), _jsx("b", { children: waiting.length }), _jsx(CaretRight, {})] }), _jsx("button", { className: css.primaryButton, disabled: !canStartCurrent, title: canStartCurrent ? undefined : '当前 专家 定义不可用；旧存档仍可继续', onClick: () => {
                                if (current === undefined) {
                                    props.actions.navigate('skills');
                                    return;
                                }
                                if (current.kind === 'skill') {
                                    void props.startBoundSession(current.archive.binding, assetTitle(props.catalog, current.archive.binding.assetId));
                                }
                                else {
                                    if (currentDefinition !== undefined)
                                        void props.startAgentSession(currentDefinition);
                                }
                            }, children: current === undefined ? _jsxs(_Fragment, { children: [_jsx(CapabilityIcon, { kind: "skill", size: 18, bare: true }), "\u9009\u62E9 \u6280\u80FD \u6216 \u4E13\u5BB6"] }) : _jsxs(_Fragment, { children: [_jsx(Plus, {}), "\u65B0\u4F1A\u8BDD"] }) })] }) }), _jsx("div", { className: css.filters, children: [
                    ['all', `全部 ${rows.length}`],
                    ['running', `运行中 ${loaded.length}`],
                    ['waiting', `等待回复 ${waiting.length}`],
                    ['failed', `失败 ${failed.length}`],
                    ['cancelled', `已取消 ${cancelled.length}`],
                    ['completed', `最近完成 ${completed.length}`],
                ].map(([id, label]) => (_jsx("button", { className: filter === id ? css.selected : undefined, onClick: () => { setFilter(id); }, children: label }, id))) }), groups.filter(group => filter === 'all' || filter === group.id).map(group => (_jsx(ParallelSection, { title: group.title, count: group.rows.length, children: group.rows.length === 0
                    ? _jsx("p", { className: css.muted, children: "\u5F53\u524D\u6CA1\u6709\u6B64\u72B6\u6001\u7684\u4F1A\u8BDD\u3002" })
                    : group.rows.map(row => _jsx(ParallelRow, { row: row, label: row.kind === 'skill'
                            ? assetTitle(props.catalog, row.archive.binding.assetId)
                            : row.archive.agent.name, onOpen: () => { open(row.archive.sessionId); }, state: row.state }, row.archive.sessionId)) }, group.id))), replyDrawerOpen && _jsxs("aside", { className: css.replyDrawer, "aria-label": "\u7B49\u5F85\u56DE\u590D\u4F1A\u8BDD", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("h2", { children: "\u7B49\u5F85\u4F60\u7684\u56DE\u590D" }), _jsx("p", { children: "\u8FD9\u4E9B\u4F1A\u8BDD\u76F8\u4E92\u72EC\u7ACB\uFF0C\u53EF\u9010\u4E2A\u5904\u7406\u3002" })] }), _jsx("button", { type: "button", "aria-label": "\u5173\u95ED\u7B49\u5F85\u56DE\u590D", onClick: () => { setReplyDrawerOpen(false); }, children: _jsx(X, {}) })] }), waiting.map(row => _jsxs("button", { type: "button", onClick: () => { setReplyDrawerOpen(false); open(row.archive.sessionId); }, children: [row.kind === 'skill' ? _jsx(SkillMark, { small: true }) : _jsx(CapabilityIcon, { kind: "agent" }), _jsxs("span", { children: [_jsx("b", { children: row.archive.title ?? (row.kind === 'skill' ? row.archive.binding.assetId : row.archive.agent.name) }), _jsx("small", { children: pendingInteractions.get(row.archive.sessionId)?.kind ?? '需要你的输入' })] }), _jsx(CaretRight, {})] }, row.archive.sessionId))] })] });
}
function ParallelSection({ title, count, children }) {
    return _jsxs("section", { className: css.parallelSection, children: [_jsxs("h2", { children: [title, " ", _jsx("mark", { children: count })] }), _jsxs("div", { className: css.parallelHead, children: [_jsx("span", { children: "\u4F1A\u8BDD" }), _jsx("span", { children: "\u6280\u80FD" }), _jsx("span", { children: "\u72B6\u6001" }), _jsx("span", { children: "\u5F53\u524D\u72B6\u6001" }), _jsx("span", { children: "\u66F4\u65B0\u65F6\u95F4" }), _jsx("span", {})] }), children] });
}
function ParallelRow({ row, label, onOpen, state }) {
    const { archive } = row;
    const status = state === 'idle' ? 'completed' : state;
    const statusLabel = state === 'running' ? '运行中' : state === 'waiting' ? '等待回复' : state === 'failed' ? '失败' : state === 'cancelled' ? '已取消' : '已完成';
    return _jsxs("div", { className: css.parallelRow, children: [_jsxs("span", { className: css.nameCell, children: [row.kind === 'skill' ? _jsx(SkillMark, { small: true }) : _jsx(CapabilityIcon, { kind: "agent" }), _jsx("b", { children: archive.title ?? label })] }), _jsx("span", { children: row.kind === 'skill' ? `技能 · ${label}` : `专家 · ${label}` }), _jsxs("span", { className: css.success, children: [_jsx(StatusDot, { status: status }), statusLabel] }), _jsx("span", { children: state === 'running' ? 'AI 正在处理' : state === 'waiting' ? '请打开会话回复' : state === 'failed' ? '可打开查看错误并重试' : state === 'cancelled' ? '可新建会话重新运行' : '独立上下文与产物已保存' }), _jsx("span", { children: formatUpdated(archive.updatedAt) }), _jsxs("span", { children: [_jsx("button", { type: "button", onClick: onOpen, children: "\u6253\u5F00" }), _jsx(DotsThreeVertical, {})] })] });
}
function FavoriteToggle({ id, name, favorites, toggle }) {
    const active = favorites.includes(id);
    return _jsx("button", { type: "button", className: css.favoriteButton, "aria-label": `${active ? '取消收藏' : '收藏'} ${name}`, "aria-pressed": active, onClick: () => toggle(active ? favorites.filter(item => item !== id) : [...favorites, id]), children: _jsx(Star, { weight: active ? 'fill' : 'regular' }) });
}
function FavoritesPage(props) {
    const favorites = props.useStore(state => state.favoriteAssetIds);
    const [busy, setBusy] = useState();
    const [error, setError] = useState();
    const assets = [...skillLibraryAssets(props.catalog, 'mine'), ...skillLibraryAssets(props.catalog, 'installed'), ...props.catalog.assets];
    const entries = favorites.flatMap(id => {
        const agent = props.agents.definitions.find(item => `agent:${item.agentId}` === id);
        const team = props.agents.teams.find(item => `team:${item.teamId}` === id);
        const asset = assets.find(item => item.name === id);
        if (agent)
            return [{ id, kind: 'agent', name: agent.name, summary: capabilitySummary(agent.role),
                    recent: props.agents.archives.filter(item => item.agent.agentId === agent.agentId).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.sessionId,
                    start: () => props.startAgentSession(agent), ready: props.agents.definitionsPhase === 'ready' || props.agents.phase === 'ready', action: '开始对话' }];
        if (team)
            return [{ id, kind: 'agent-team', name: team.name, summary: team.description,
                    recent: props.agents.teamArchives.filter(item => item.team.teamId === team.teamId).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.sessionId,
                    start: () => props.startAgentTeamSession(team), ready: props.agents.teamsPhase === 'ready' || props.agents.phase === 'ready', action: '开始团队会话' }];
        if (!asset)
            return [];
        const version = currentInstalledVersion(props.catalog, asset);
        return [{ id, kind: asset.projectType, name: asset.title, summary: asset.summary || asset.description,
                recent: props.boundSessions.archives.filter(item => item.binding.assetId === asset.name).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.sessionId,
                start: async () => {
                    if (asset.projectType === 'agent') {
                        const installed = await props.installAgent(asset);
                        await props.startAgentSession(installed);
                    }
                    else if (version)
                        await props.startSkillSession(asset, version);
                    else
                        await props.installAsset(asset);
                }, ready: version ? props.catalog.installedPhase === 'ready' : props.catalog.phase === 'ready', action: asset.projectType === 'agent' ? '创建并对话' : version ? '开始对话' : '安装技能' }];
    });
    const run = async (id, operation) => {
        setBusy(id);
        setError(undefined);
        try {
            await operation();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '暂时无法打开，请重试。');
        }
        finally {
            setBusy(undefined);
        }
    };
    return _jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "\u6536\u85CF", subtitle: "\u5E38\u7528\u6280\u80FD\u3001\u4E13\u5BB6\u4E0E\u56E2\u961F\uFF0C\u4ECE\u8FD9\u91CC\u7EE7\u7EED\u5BF9\u8BDD\u6216\u5F00\u59CB\u65B0\u4EFB\u52A1" }), error && _jsx("p", { className: css.error, role: "alert", children: error }), entries.length === 0 ? _jsxs("div", { className: css.emptyState, children: [_jsx(Star, { size: 34 }), _jsx("h2", { children: "\u6536\u85CF\u5E38\u7528\u7684\u80FD\u529B" }), _jsx("p", { children: "\u5728\u6280\u80FD\u3001\u4E13\u5BB6\u5361\u7247\u6216\u4F1A\u8BDD\u9876\u90E8\u70B9\u51FB\u661F\u6807\uFF0C\u5373\u53EF\u5728\u8FD9\u91CC\u76F4\u63A5\u4F7F\u7528\u3002" }), _jsx("button", { type: "button", onClick: () => props.actions.navigate('skills'), children: "\u6D4F\u89C8\u6280\u80FD" })] })
                : _jsx("div", { className: css.cardGrid, children: entries.map(entry => _jsxs("article", { className: css.favoriteCard, children: [_jsxs("div", { className: css.agentLaunchTitle, children: [_jsx(CapabilityIcon, { kind: entry.kind }), _jsxs("span", { children: [_jsx("h2", { children: entry.name }), _jsx("small", { children: entry.kind === 'skill' ? '技能' : entry.kind === 'agent' ? '专家' : '专家团' })] }), _jsx(FavoriteToggle, { id: entry.id, name: entry.name, favorites: favorites, toggle: props.actions.setFavoriteAssetIds })] }), _jsx("p", { children: entry.summary }), _jsxs("div", { className: css.favoriteActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy !== undefined || !entry.ready, onClick: () => { if (entry.recent)
                                            props.openSession(entry.recent);
                                        else
                                            void run(entry.id, entry.start); }, children: [_jsx(ChatsCircle, {}), busy === entry.id ? '正在打开…' : entry.recent ? '继续对话' : entry.action] }), entry.recent && _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy !== undefined || !entry.ready, onClick: () => { void run(entry.id, entry.start); }, children: [_jsx(Plus, {}), "\u65B0\u5BF9\u8BDD"] })] })] }, entry.id)) })] });
}
const EMPTY_AGENT_DRAFT = {
    name: '',
    role: '',
    mode: 'dynamic',
    versionIds: [],
    modelKey: '',
    reasoningEffort: '',
    permission: 'workspace-write',
};
function AgentsPage(props) {
    const [uninstallTarget, setUninstallTarget] = useState();
    const [uninstallError, setUninstallError] = useState();
    const favorites = props.useStore(state => state.favoriteAssetIds);
    const defaultAgentProvider = props.useStore(state => state.defaultAgentProvider);
    const defaultAgentModel = props.useStore(state => state.defaultAgentModel);
    const defaultAgentReasoningEffort = props.useStore(state => state.defaultAgentReasoningEffort);
    const defaultAgentPermission = props.useStore(state => state.defaultAgentPermission);
    const defaultDraft = useMemo(() => ({
        ...EMPTY_AGENT_DRAFT,
        modelKey: defaultAgentProvider === '' || defaultAgentModel === ''
            ? ''
            : `${defaultAgentProvider}\u0000${defaultAgentModel}`,
        reasoningEffort: defaultAgentReasoningEffort,
        permission: defaultAgentPermission,
    }), [defaultAgentModel, defaultAgentPermission, defaultAgentProvider, defaultAgentReasoningEffort]);
    const teamPage = props.useStore(state => state.page === 'teams');
    const tab = props.useStore(state => state.agentWorkspaceTab);
    const [expertSource, setExpertSource] = useState('mine');
    const [showExpertPresets, setShowExpertPresets] = useState(false);
    const [showTeamPresets, setShowTeamPresets] = useState(false);
    const [presetTeamToEdit, setPresetTeamToEdit] = useState();
    const [teamSource, setTeamSource] = useState('mine');
    const librarySource = teamPage ? teamSource : expertSource;
    const setLibrarySource = teamPage ? setTeamSource : setExpertSource;
    const agentTeamCreationPending = props.useStore(state => state.agentTeamCreationPending);
    const agentTeamBuilderSeed = props.useStore(state => state.agentTeamBuilderSeed);
    useEffect(() => { if (agentTeamCreationPending)
        setShowTeamPresets(false); }, [agentTeamCreationPending]);
    const selectedAgentCategory = props.useStore(state => state.selectedAgentCategory);
    const setTab = props.actions.setAgentWorkspaceTab;
    const [editingId, setEditingId] = useState();
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState(EMPTY_AGENT_DRAFT);
    const [candidateVersionId, setCandidateVersionId] = useState('');
    const [busy, setBusy] = useState(false);
    const [operationError, setOperationError] = useState();
    const [validationShown, setValidationShown] = useState(false);
    const [deletePending, setDeletePending] = useState(false);
    const [modelOptions, setModelOptions] = useState([]);
    const [roleAssistantOpen, setRoleAssistantOpen] = useState(false);
    const [roleAssistantInstruction, setRoleAssistantInstruction] = useState('');
    const [roleAssistantDraft, setRoleAssistantDraft] = useState('');
    const [roleAssistantError, setRoleAssistantError] = useState();
    const [roleAssistantBusy, setRoleAssistantBusy] = useState(false);
    const roleAssistantAbortRef = useRef();
    const roleAssistantTriggerRef = useRef(null);
    const roleAssistantCloseRef = useRef(null);
    const sources = props.agents.librarySources ?? [];
    const sourceOf = (id, version) => agentLibrarySource(id, version, sources, props.catalog);
    const definitions = props.agents.definitions.filter(item => sourceOf(item.agentId, item.sourceVersionId) === librarySource);
    const visibleTeams = props.agents.teams.filter(item => sourceOf(item.teamId) === librarySource);
    const hasUnknown = teamPage ? props.agents.teams.some(item => sourceOf(item.teamId) === 'unknown') : props.agents.definitions.some(item => sourceOf(item.agentId, item.sourceVersionId) === 'unknown')
        || props.agents.teams.some(item => sourceOf(item.teamId) === 'unknown');
    const allMarketAgents = useMemo(() => props.catalog.assets.filter(asset => asset.projectType === 'agent'), [props.catalog.assets]);
    const agentCategories = useMemo(() => props.catalog.categories.filter(category => allMarketAgents.some(asset => asset.category === category.id)), [
        allMarketAgents,
        props.catalog.categories,
    ]);
    const marketAgents = useMemo(() => allMarketAgents.filter(asset => selectedAgentCategory === 'all' || asset.category === selectedAgentCategory), [
        allMarketAgents,
        selectedAgentCategory,
    ]);
    const selected = creating
        ? undefined
        : definitions.find(definition => definition.agentId === editingId);
    const installedVersions = useMemo(() => Object.values(props.catalog.versionsByAsset)
        .flat()
        .filter(version => version.projectType === 'skill' && version.exposure === 'skill-registry')
        .sort((left, right) => left.assetName.localeCompare(right.assetName)), [props.catalog.versionsByAsset]);
    const versionById = useMemo(() => new Map(installedVersions.map(version => [version.versionId, version])), [installedVersions]);
    const assetNameByVersion = useMemo(() => new Map(installedVersions.map(version => [
        version.versionId,
        version.assetName,
    ])), [installedVersions]);
    const selectedArchives = selected === undefined
        ? []
        : props.agents.archives.filter(archive => archive.agent.agentId === selected.agentId);
    const recentArchiveByAgent = useMemo(() => {
        const byAgent = new Map();
        for (const archive of [...props.agents.archives].sort((left, right) => right.updatedAt - left.updatedAt)) {
            if (!byAgent.has(archive.agent.agentId))
                byAgent.set(archive.agent.agentId, archive);
        }
        return byAgent;
    }, [props.agents.archives]);
    useEffect(() => {
        if (selected === undefined || creating)
            return;
        setDraft({
            name: selected.name,
            role: selected.role,
            mode: selected.mode,
            versionIds: selected.skills.map(skill => skill.versionId),
            modelKey: selected.model === undefined ? '' : `${selected.model.provider}\u0000${selected.model.model}`,
            reasoningEffort: selected.model?.reasoningEffort ?? '',
            permission: selected.permission,
        });
        setDeletePending(false);
        setOperationError(undefined);
        setValidationShown(false);
        setRoleAssistantOpen(false);
        setRoleAssistantInstruction('');
        setRoleAssistantDraft('');
        setRoleAssistantError(undefined);
    }, [creating, selected?.agentId, selected?.revision]);
    useEffect(() => {
        if (!roleAssistantOpen)
            return;
        roleAssistantCloseRef.current?.focus();
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            roleAssistantAbortRef.current?.abort();
            setRoleAssistantOpen(false);
            roleAssistantTriggerRef.current?.focus();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => { document.removeEventListener('keydown', closeOnEscape); };
    }, [roleAssistantOpen]);
    useEffect(() => {
        void props.listAgentModels().then(setModelOptions, () => { setModelOptions([]); });
    }, []);
    useEffect(() => {
        if (selectedAgentCategory !== 'all'
            && !agentCategories.some(category => category.id === selectedAgentCategory)) {
            props.actions.setAgentCategory('all');
        }
    }, [agentCategories, props.actions, selectedAgentCategory]);
    const beginCreate = () => {
        roleAssistantAbortRef.current?.abort();
        setShowExpertPresets(false);
        setCreating(true);
        setEditingId(undefined);
        setDraft(defaultDraft);
        setCandidateVersionId(installedVersions[0]?.versionId ?? '');
        setDeletePending(false);
        setOperationError(undefined);
        setValidationShown(false);
        setRoleAssistantOpen(false);
        setRoleAssistantInstruction('');
        setRoleAssistantDraft('');
        setRoleAssistantError(undefined);
    };
    const startAgentAuthoring = () => {
        setBusy(true);
        setOperationError(undefined);
        void props.startAuthoringSession('agent').catch((cause) => {
            setOperationError(cause instanceof Error ? cause.message : '专家 创作会话创建失败。');
        }).finally(() => { setBusy(false); });
    };
    const beginEdit = (definition) => {
        roleAssistantAbortRef.current?.abort();
        setShowExpertPresets(false);
        setCreating(false);
        setEditingId(definition.agentId);
        setValidationShown(false);
        setRoleAssistantOpen(false);
        setRoleAssistantInstruction('');
        setRoleAssistantDraft('');
        setRoleAssistantError(undefined);
    };
    const addVersion = () => {
        const candidate = versionById.get(candidateVersionId);
        if (candidate === undefined)
            return;
        setDraft(current => ({
            ...current,
            versionIds: [
                ...current.versionIds.filter((versionId) => {
                    const assetName = assetNameByVersion.get(versionId);
                    return assetName === undefined || assetName !== candidate.assetName;
                }),
                candidate.versionId,
            ],
        }));
    };
    const moveVersion = (index, direction) => {
        const destination = index + direction;
        if (destination < 0 || destination >= draft.versionIds.length)
            return;
        const next = [...draft.versionIds];
        const current = next[index];
        const neighbor = next[destination];
        if (current === undefined || neighbor === undefined)
            return;
        next[index] = neighbor;
        next[destination] = current;
        setDraft(value => ({ ...value, versionIds: next }));
    };
    const nameError = draft.name.trim() === '' ? '请输入专家名称。' : undefined;
    const roleError = draft.role.trim() === ''
        ? '请输入角色说明。'
        : draft.role.includes('{{') || draft.role.includes('}}')
            ? '角色说明不能包含双花括号引用。'
            : undefined;
    const formReady = nameError === undefined && roleError === undefined;
    const authoritativeReady = (props.agents.definitionsPhase ?? props.agents.phase) === 'ready';
    const dirty = selected === undefined
        || draft.name !== selected.name
        || draft.role !== selected.role
        || draft.mode !== selected.mode
        || draft.permission !== selected.permission
        || draft.modelKey !== (selected.model === undefined ? '' : `${selected.model.provider}\u0000${selected.model.model}`)
        || draft.reasoningEffort !== (selected.model?.reasoningEffort ?? '')
        || draft.versionIds.length !== selected.skills.length
        || draft.versionIds.some((versionId, index) => versionId !== selected.skills[index]?.versionId);
    const validateDraft = () => {
        setValidationShown(true);
        if (formReady)
            return true;
        setOperationError('请完成标记为必填的内容。');
        return false;
    };
    const persistDraft = async () => {
        const fields = {
            name: draft.name.trim(),
            role: draft.role.trim(),
            mode: draft.mode,
            ...(draft.modelKey === '' ? {} : {
                model: {
                    provider: draft.modelKey.split('\u0000')[0] ?? '',
                    model: draft.modelKey.split('\u0000')[1] ?? '',
                    ...(draft.reasoningEffort === '' ? {} : { reasoningEffort: draft.reasoningEffort }),
                },
            }),
            permission: draft.permission,
            ...(selected?.sourceVersionId === undefined ? {} : { sourceVersionId: selected.sourceVersionId }),
            versionIds: draft.versionIds,
        };
        const saved = selected === undefined
            ? await props.createAgent(fields)
            : sourceOf(selected.agentId, selected.sourceVersionId) === 'installed'
                ? await props.createAgent({ ...fields, copyFrom: { agentId: selected.agentId, expectedRevision: selected.revision } })
                : await props.updateAgent({
                    ...fields,
                    agentId: selected.agentId,
                    expectedRevision: selected.revision,
                });
        setCreating(false);
        setLibrarySource('mine');
        setEditingId(saved.agentId);
        setValidationShown(false);
        return saved;
    };
    const save = async (event) => {
        event.preventDefault();
        if (!authoritativeReady || !validateDraft())
            return;
        setBusy(true);
        setOperationError(undefined);
        try {
            await persistDraft();
        }
        catch (error) {
            setOperationError(error instanceof Error ? error.message : '专家 保存失败。请刷新 Host 状态后重试。');
        }
        finally {
            setBusy(false);
        }
    };
    const saveAndRun = async (isolated) => {
        if (!authoritativeReady) {
            setOperationError('Host 投影尚未就绪，请刷新后重试。');
            return;
        }
        let definition = selected;
        if ((definition === undefined || dirty) && !validateDraft())
            return;
        setBusy(true);
        setOperationError(undefined);
        try {
            if (definition === undefined || dirty)
                definition = await persistDraft();
            if (isolated)
                await props.testAgent(definition);
            else
                await props.startAgentSession(definition);
        }
        catch (error) {
            setOperationError(error instanceof Error
                ? error.message
                : isolated ? '测试会话创建失败。' : '专家 会话创建失败。');
        }
        finally {
            setBusy(false);
        }
    };
    const remove = async () => {
        if (selected === undefined)
            return;
        setBusy(true);
        setOperationError(undefined);
        try {
            await props.deleteAgent({ agentId: selected.agentId, expectedRevision: selected.revision });
            setEditingId(undefined);
            setDeletePending(false);
        }
        catch {
            setOperationError('专家 删除失败。请刷新 Host 状态后重试。');
        }
        finally {
            setBusy(false);
        }
    };
    const start = async (definition) => {
        setBusy(true);
        setOperationError(undefined);
        try {
            await props.startAgentSession(definition);
        }
        catch {
            setOperationError('专家 会话创建失败。请刷新 Host 状态后重试。');
        }
        finally {
            setBusy(false);
        }
    };
    const open = (definition) => {
        const recent = recentArchiveByAgent.get(definition.agentId);
        if (recent !== undefined) {
            props.openSession(recent.sessionId);
            props.actions.navigate('conversations');
            return;
        }
        void start(definition);
    };
    const closeRoleAssistant = () => {
        roleAssistantAbortRef.current?.abort();
        setRoleAssistantOpen(false);
        setRoleAssistantBusy(false);
        roleAssistantTriggerRef.current?.focus();
    };
    const generateRole = async () => {
        roleAssistantAbortRef.current?.abort();
        const controller = new AbortController();
        roleAssistantAbortRef.current = controller;
        setRoleAssistantBusy(true);
        setRoleAssistantError(undefined);
        try {
            const generated = (await props.generateAgentRole({
                name: draft.name.trim(),
                currentRole: draft.role.trim(),
                mode: draft.mode,
                skills: draft.versionIds.map((versionId) => {
                    const version = versionById.get(versionId);
                    return {
                        title: version === undefined ? versionId : assetTitle(props.catalog, version.assetName),
                        versionId,
                    };
                }),
                instruction: roleAssistantInstruction.trim(),
                ...(draft.modelKey === '' ? {} : {
                    model: {
                        provider: draft.modelKey.split('\u0000')[0] ?? '',
                        model: draft.modelKey.split('\u0000')[1] ?? '',
                        ...(draft.reasoningEffort === '' ? {} : { reasoningEffort: draft.reasoningEffort }),
                    },
                }),
            }, controller.signal)).trim();
            if (generated === '')
                throw new Error('模型没有返回角色说明，请重试。');
            if (generated.includes('{{') || generated.includes('}}')) {
                throw new Error('生成内容包含不受支持的双花括号引用，请补充要求后重新生成。');
            }
            setRoleAssistantDraft(generated);
        }
        catch (error) {
            if (!controller.signal.aborted) {
                setRoleAssistantError(error instanceof Error ? error.message : 'AI 角色说明生成失败，请重试。');
            }
        }
        finally {
            if (roleAssistantAbortRef.current === controller) {
                roleAssistantAbortRef.current = undefined;
                setRoleAssistantBusy(false);
            }
        }
    };
    const applyRoleAssistantDraft = (mode) => {
        const generated = roleAssistantDraft.trim();
        if (generated === '')
            return;
        setDraft(value => ({
            ...value,
            role: mode === 'replace' || value.role.trim() === ''
                ? generated
                : `${value.role.trim()}\n\n${generated}`,
        }));
        setRoleAssistantOpen(false);
        roleAssistantTriggerRef.current?.focus();
    };
    const teamWorkspace = _jsx(AgentTeamsWorkspace, { ...props, agents: { ...props.agents, teams: visibleTeams }, modelOptions: modelOptions, creationPending: agentTeamCreationPending, builderSeed: agentTeamBuilderSeed, initialTeamId: presetTeamToEdit, consumeCreationRequest: props.actions.consumeAgentTeamCreation, openManualAgentBuilder: () => { setTab('mine'); beginCreate(); } });
    return _jsxs("div", { className: css.pageScroll, children: [uninstallTarget && _jsxs(ActionDialog, { title: "\u5378\u8F7D\u4E13\u5BB6", busy: busy, error: uninstallError, onClose: () => setUninstallTarget(undefined), children: [_jsxs("p", { children: ["\u5378\u8F7D\u300C", uninstallTarget.name, "\u300D\uFF1F\u5DF2\u6709\u4F1A\u8BDD\u3001\u56E2\u961F\u548C\u4F9D\u8D56\u6280\u80FD\u4F1A\u4FDD\u7559\uFF0C\u4E4B\u540E\u53EF\u4ECE\u53D1\u73B0\u9875\u91CD\u65B0\u5B89\u88C5\u3002"] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: () => setUninstallTarget(undefined), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", "data-danger": true, disabled: busy, onClick: () => {
                                    setBusy(true);
                                    setUninstallError(undefined);
                                    void props.uninstallAgent({ agentId: uninstallTarget.agentId, expectedRevision: uninstallTarget.revision }).then(() => {
                                        setUninstallTarget(undefined);
                                        setEditingId(undefined);
                                    }, error => setUninstallError(error instanceof Error ? error.message : '卸载失败，请重试。')).finally(() => setBusy(false));
                                }, children: busy ? '正在卸载…' : '确认卸载' })] })] }), _jsx(PageHeader, { title: teamPage ? "专家团" : "专家", subtitle: teamPage ? "让多位专家围绕一个目标协作，各自发挥所长" : "选择专长，完成投研与日常办公任务", action: tab === 'mine' ? _jsxs("div", { className: css.creationActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy, onClick: startAgentAuthoring, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u4E13\u5BB6"] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy, onClick: beginCreate, children: [_jsx(Plus, {}), "\u624B\u52A8\u914D\u7F6E \u4E13\u5BB6"] })] }) : undefined }), _jsxs("div", { className: css.agentTabs, children: [!teamPage && _jsxs("button", { type: "button", className: showExpertPresets ? css.selected : undefined, onClick: () => { setShowExpertPresets(true); setCreating(false); setEditingId(undefined); }, children: ["\u63A8\u8350\u4E13\u5BB6 \u00B7 ", EXPERT_PRESETS.length] }), teamPage && _jsxs("button", { type: "button", className: showTeamPresets ? css.selected : undefined, onClick: () => { setShowTeamPresets(true); setPresetTeamToEdit(undefined); }, children: ["\u63A8\u8350\u4E13\u5BB6\u56E2 \u00B7 ", TEAM_PRESETS.length] }), [['mine', '我的创建'], ['installed', '已安装'], ['discover', '发现']].filter(([source]) => !teamPage || source !== 'discover').map(([source, label]) => _jsx("button", { type: "button", className: !(teamPage ? showTeamPresets : showExpertPresets) && (tab === 'market' ? source === 'discover' : librarySource === source) ? css.selected : undefined, onClick: () => { setShowExpertPresets(false); setShowTeamPresets(false); setPresetTeamToEdit(undefined); if (source !== 'discover')
                            setLibrarySource(source); setTab(teamPage ? 'teams' : source === 'discover' ? 'market' : 'mine'); setEditingId(undefined); setCreating(false); }, children: label }, source)), hasUnknown && _jsx("button", { type: "button", className: !(teamPage ? showTeamPresets : showExpertPresets) && librarySource === 'unknown' && tab !== 'market' ? css.selected : undefined, onClick: () => { setShowExpertPresets(false); setShowTeamPresets(false); setPresetTeamToEdit(undefined); setLibrarySource('unknown'); setTab(teamPage ? 'teams' : 'mine'); }, children: "\u5386\u53F2\u5185\u5BB9 \u00B7 \u6765\u6E90\u5F85\u786E\u8BA4" })] }), (props.agents.error ?? operationError) && _jsx("p", { className: css.error, role: "alert", children: operationError ?? props.agents.error }), teamPage && showTeamPresets ? _jsx(TeamPresets, { definitions: props.agents.definitions, teams: props.agents.teams, versions: installedVersions, ready: authoritativeReady && (props.agents.teamsPhase ?? props.agents.phase) === 'ready', icon: _jsx(CapabilityIcon, { kind: "agent-team" }), createExpert: props.createAgent, createTeam: props.createAgentTeam, start: props.startAgentTeamSession, open: team => { setLibrarySource('mine'); setTab('teams'); setPresetTeamToEdit(team.teamId); setShowTeamPresets(false); } })
                : !teamPage && showExpertPresets ? _jsx(ExpertPresets, { definitions: props.agents.definitions, versions: installedVersions, ready: authoritativeReady, icon: _jsx(CapabilityIcon, { kind: "agent" }), create: props.createAgent, start: props.startAgentSession, open: definition => { setLibrarySource('mine'); setTab('mine'); beginEdit(definition); } })
                    : tab === 'teams' ? teamWorkspace : tab === 'market' ? _jsxs("div", { className: css.agentMarket, children: [_jsxs("div", { className: css.categoryTabs, "aria-label": "\u4E13\u5BB6\u5E02\u573A\u5206\u7C7B", children: [_jsx("button", { type: "button", className: selectedAgentCategory === 'all' ? css.selected : undefined, onClick: () => { props.actions.setAgentCategory('all'); }, children: "\u5168\u90E8" }), agentCategories.map((category) => {
                                        const count = allMarketAgents.filter(asset => asset.category === category.id).length;
                                        return _jsxs("button", { type: "button", className: selectedAgentCategory === category.id ? css.selected : undefined, onClick: () => { props.actions.setAgentCategory(category.id); }, children: [category.label, " ", count] }, category.id);
                                    })] }), marketAgents.map((asset) => {
                                const installed = props.catalog.versionsByAsset[asset.name]?.find(version => version.exposure === 'agent-template');
                                return _jsxs("article", { children: [_jsx(CapabilityIcon, { kind: "agent" }), _jsxs("div", { children: [_jsx("h2", { children: asset.title }), _jsx("small", { className: css.technicalId, children: asset.name }), _jsx("p", { children: asset.summary || asset.description }), _jsxs("small", { children: ["AGENTS.md \u00B7 ", asset.commitSha.slice(0, 12), " \u00B7 ", asset.requires.length === 0
                                                            ? '依赖将在安装时从声明解析'
                                                            : `${String(asset.requires.length)} 个目录依赖`] })] }), _jsx("button", { type: "button", className: css.primaryButton, disabled: busy || props.catalog.phase !== 'ready', onClick: () => {
                                                setBusy(true);
                                                setOperationError(undefined);
                                                void props.installAgent(asset).then((created) => {
                                                    setLibrarySource('installed');
                                                    setTab('mine');
                                                    setCreating(false);
                                                    setEditingId(created.agentId);
                                                }, (error) => {
                                                    setOperationError(error instanceof Error ? error.message : '专家 安装失败。');
                                                }).finally(() => { setBusy(false); });
                                            }, children: installed === undefined ? '安装并创建' : '创建副本' })] }, asset.name);
                            }), marketAgents.length === 0 && _jsxs("div", { className: css.settingsPlaceholder, children: [_jsx(CapabilityIcon, { kind: "agent", size: 40 }), _jsx("h2", { children: "\u8FD9\u4E2A\u5206\u7C7B\u6682\u65E0\u4E13\u5BB6" }), _jsx("p", { children: "\u9009\u62E9\u5176\u4ED6\u5206\u7C7B\uFF0C\u6216\u5237\u65B0\u5B98\u65B9\u76EE\u5F55\u540E\u91CD\u8BD5\u3002" }), selectedAgentCategory !== 'all' && _jsx("button", { type: "button", className: css.outlineButton, onClick: () => { props.actions.setAgentCategory('all'); }, children: "\u67E5\u770B\u5168\u90E8\u4E13\u5BB6" })] })] }) : _jsx("div", { className: css.agentWorkspace, children: creating || selected !== undefined ? _jsxs("form", { className: css.agentEditor, noValidate: true, onSubmit: (event) => { void save(event); }, children: [_jsxs("div", { className: css.agentTitle, children: [_jsx(CapabilityIcon, { kind: "agent" }), _jsxs("div", { children: [_jsx("h2", { children: creating ? '创建专家' : `设置 · ${selected?.name ?? '专家'}` }), _jsx("small", { children: selected === undefined ? '新定义' : `Host 版本 ${selected.revision}` })] }), selected && !dirty && authoritativeReady
                                            ? _jsxs("span", { className: css.success, children: [_jsx(CheckCircle, {}), "Host \u5DF2\u4FDD\u5B58"] })
                                            : _jsxs("span", { className: css.warning, children: [_jsx(Circle, { weight: "fill" }), authoritativeReady ? '有未保存更改' : 'Host 投影已过期'] })] }), _jsxs("div", { className: css.agentBuilder, children: [_jsxs("details", { className: css.agentSummary, children: [_jsx("summary", { children: "\u914D\u7F6E\u6458\u8981\u4E0E\u4F1A\u8BDD\u5B58\u6863" }), _jsx(CapabilityIcon, { kind: "agent", size: 34 }), _jsx("h2", { children: draft.name.trim() || '未命名 专家' }), _jsx("p", { children: draft.role.trim() || '填写角色说明，告诉 AI 它负责什么。' }), _jsx("hr", {}), _jsx("small", { children: "\u7F16\u6392\u65B9\u5F0F" }), _jsx("b", { children: draft.mode === 'fixed' ? '固定顺序' : 'AI 动态选择' }), _jsx("small", { children: "\u7CBE\u786E \u6280\u80FD" }), _jsxs("b", { children: [draft.versionIds.length, " \u4E2A"] }), selectedArchives.length > 0 && _jsxs(_Fragment, { children: [_jsx("hr", {}), _jsx("small", { children: "\u4F1A\u8BDD\u5B58\u6863" }), _jsx("div", { className: css.agentArchives, children: selectedArchives.map(archive => _jsxs("button", { type: "button", onClick: () => { props.openSession(archive.sessionId); props.actions.navigate('conversations'); }, children: [_jsx("span", { children: archive.title ?? archive.agent.name }), _jsx("small", { children: formatUpdated(archive.updatedAt) })] }, archive.sessionId)) })] })] }), _jsxs("section", { className: css.orchestration, children: [_jsxs("div", { className: css.agentFields, children: [_jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["\u540D\u79F0 ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u586B" })] }), _jsx("input", { "aria-label": "\u4E13\u5BB6 \u540D\u79F0", "aria-describedby": "agent-name-help", "aria-invalid": validationShown && nameError !== undefined, required: true, value: draft.name, maxLength: 80, onChange: (event) => { setDraft(value => ({ ...value, name: event.target.value })); }, placeholder: "\u4F8B\u5982\uFF1A\u91CF\u5316\u7814\u7A76\u52A9\u7406" }), _jsx("small", { id: "agent-name-help", className: css.fieldHelp, children: "1\u201380 \u4E2A\u5B57\u7B26\uFF1B\u4FDD\u5B58\u540E\u4ECD\u53EF\u901A\u8FC7\u9F7F\u8F6E\u4FEE\u6539\u3002" }), validationShown && nameError !== undefined && _jsx("small", { className: css.fieldError, children: nameError })] }), _jsxs("div", { className: css.agentField, children: [_jsxs("span", { className: css.roleFieldHeading, children: [_jsxs("label", { htmlFor: "agent-role", className: css.fieldLabel, children: ["\u89D2\u8272\u8BF4\u660E ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u586B" })] }), _jsxs("button", { ref: roleAssistantTriggerRef, type: "button", className: css.aiWriteButton, onClick: () => {
                                                                                setRoleAssistantOpen(true);
                                                                                setRoleAssistantError(undefined);
                                                                            }, children: [_jsx(MagicWand, {}), "AI \u5E2E\u5199"] })] }), _jsx("textarea", { id: "agent-role", "aria-label": "\u4E13\u5BB6 \u89D2\u8272\u8BF4\u660E", "aria-describedby": "agent-role-help", "aria-invalid": validationShown && roleError !== undefined, required: true, value: draft.role, maxLength: 128_000, onChange: (event) => { setDraft(value => ({ ...value, role: event.target.value })); }, placeholder: "\u8BF4\u660E\u804C\u8D23\u3001\u7814\u7A76\u65B9\u6CD5\u3001\u9650\u5236\u548C\u5E0C\u671B\u4EA4\u4ED8\u7684\u4EA7\u7269\u3002" }), _jsx("small", { id: "agent-role-help", className: css.fieldHelp, children: "\u5199\u5165\u6BCF\u4E2A\u65B0\u4F1A\u8BDD\u7684\u89D2\u8272\u6307\u5F15\uFF1B\u4E0D\u80FD\u5305\u542B\u53CC\u82B1\u62EC\u53F7\u5F15\u7528\u3002" }), validationShown && roleError !== undefined && _jsx("small", { className: css.fieldError, children: roleError })] })] }), roleAssistantOpen && _jsxs("div", { className: css.roleAssistantLayer, children: [_jsx("button", { type: "button", className: css.roleAssistantBackdrop, "aria-label": "\u5173\u95ED AI \u5E2E\u5199", onClick: closeRoleAssistant }), _jsxs("aside", { className: css.roleAssistantDrawer, role: "dialog", "aria-modal": "true", "aria-labelledby": "agent-role-assistant-title", children: [_jsxs("header", { children: [_jsx("span", { className: css.agentMark, children: _jsx(MagicWand, {}) }), _jsxs("div", { children: [_jsx("h2", { id: "agent-role-assistant-title", children: "AI \u5E2E\u5199\u89D2\u8272\u8BF4\u660E" }), _jsx("p", { children: "\u6839\u636E\u540D\u79F0\u3001\u6280\u80FD \u7F16\u6392\u548C\u73B0\u6709\u8BF4\u660E\u751F\u6210\u8349\u7A3F\u3002" })] }), _jsx("button", { ref: roleAssistantCloseRef, type: "button", "aria-label": "\u5173\u95ED AI \u5E2E\u5199", onClick: closeRoleAssistant, children: _jsx(X, {}) })] }), _jsxs("div", { className: css.roleAssistantContext, children: [_jsxs("span", { children: [_jsx("b", { children: draft.name.trim() || '未命名专家' }), _jsxs("small", { children: [draft.versionIds.length, " \u4E2A \u6280\u80FD \u00B7 ", draft.mode === 'fixed' ? '固定顺序' : 'AI 动态选择'] })] }), _jsx("span", { children: draft.modelKey === '' ? '使用会话默认模型' : '使用当前选择的模型' })] }), _jsxs("label", { children: [_jsxs("span", { children: ["\u8865\u5145\u8981\u6C42 ", _jsx("span", { className: css.optionalBadge, children: "\u9009\u586B" })] }), _jsx("textarea", { "aria-label": "AI \u5E2E\u5199\u8865\u5145\u8981\u6C42", value: roleAssistantInstruction, maxLength: 2_000, onChange: (event) => { setRoleAssistantInstruction(event.target.value); }, placeholder: "\u4F8B\u5982\uFF1A\u5F3A\u8C03\u98CE\u9669\u63A7\u5236\uFF0C\u8981\u6C42\u8F93\u51FA\u4E2D\u6587\u7814\u7A76\u62A5\u544A\u3002" })] }), _jsxs("div", { className: css.roleAssistantGenerateRow, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: roleAssistantBusy, onClick: () => { void generateRole(); }, children: [_jsx(MagicWand, {}), roleAssistantBusy ? '正在生成…' : roleAssistantDraft === '' ? '生成草稿' : '重新生成'] }), _jsx("small", { children: "\u751F\u6210\u8FC7\u7A0B\u4F7F\u7528\u5F53\u524D\u4F1A\u8BDD\u6A21\u578B\uFF0C\u5E76\u8BB0\u5F55\u5728\u4E34\u65F6\u4F1A\u8BDD\u540E\u81EA\u52A8\u5F52\u6863\u3002" })] }), roleAssistantError !== undefined && _jsx("p", { className: css.roleAssistantError, role: "alert", children: roleAssistantError }), _jsxs("label", { className: css.roleAssistantPreview, children: [_jsx("span", { children: "\u8349\u7A3F\u9884\u89C8" }), _jsx("textarea", { "aria-label": "AI \u89D2\u8272\u8BF4\u660E\u8349\u7A3F", value: roleAssistantDraft, onChange: (event) => { setRoleAssistantDraft(event.target.value); }, placeholder: "\u751F\u6210\u540E\u7684\u89D2\u8272\u8BF4\u660E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\uFF0C\u5E94\u7528\u524D\u53EF\u4EE5\u7EE7\u7EED\u4FEE\u6539\u3002" })] }), _jsxs("footer", { children: [_jsx("button", { type: "button", className: css.outlineButton, onClick: closeRoleAssistant, children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: css.outlineButton, disabled: roleAssistantDraft.trim() === '' || roleAssistantBusy, onClick: () => { applyRoleAssistantDraft('append'); }, children: "\u8FFD\u52A0" }), _jsx("button", { type: "button", className: css.primaryButton, disabled: roleAssistantDraft.trim() === '' || roleAssistantBusy, onClick: () => { applyRoleAssistantDraft('replace'); }, children: "\u66FF\u6362\u539F\u8BF4\u660E" })] })] })] }), _jsx("div", { className: css.sectionHeading, children: _jsxs("div", { children: [_jsxs("h2", { children: ["\u6280\u80FD \u7F16\u6392 ", _jsx("span", { className: css.optionalBadge, children: "\u9009\u586B" })] }), _jsx("p", { children: "\u4E0D\u6DFB\u52A0\u65F6\u521B\u5EFA\u89D2\u8272\u578B\u4E13\u5BB6\uFF1B\u6DFB\u52A0\u540E\u53EA\u4F7F\u7528 Host \u5DF2\u5B89\u88C5\u7684\u7CBE\u786E\u7248\u672C\uFF0C\u987A\u5E8F\u4F1A\u968F\u4F1A\u8BDD\u5199\u5165\u65E5\u5FD7\u3002" })] }) }), _jsxs("div", { className: css.agentSkillPicker, children: [_jsxs("select", { "aria-label": "\u9009\u62E9\u5DF2\u5B89\u88C5 \u6280\u80FD \u7248\u672C", value: candidateVersionId, disabled: installedVersions.length === 0, onChange: (event) => { setCandidateVersionId(event.target.value); }, children: [_jsx("option", { value: "", children: "\u9009\u62E9\u5DF2\u5B89\u88C5\u7248\u672C" }), installedVersions.map(version => _jsxs("option", { value: version.versionId, children: [assetTitle(props.catalog, version.assetName), " \u00B7 ", version.commitSha.slice(0, 12)] }, version.versionId))] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: candidateVersionId === '', onClick: addVersion, children: [_jsx(Plus, {}), "\u6DFB\u52A0 \u6280\u80FD"] })] }), installedVersions.length === 0 && _jsx("p", { className: css.notice, children: "\u5F53\u524D\u6CA1\u6709\u5DF2\u5B89\u88C5 \u6280\u80FD\uFF1B\u4ECD\u53EF\u4FDD\u5B58\u89D2\u8272\u578B\u4E13\u5BB6\uFF0C\u4E4B\u540E\u518D\u901A\u8FC7\u9F7F\u8F6E\u6DFB\u52A0\u3002" }), _jsx("div", { className: css.orchestrationTable, children: draft.versionIds.length === 0
                                                        ? _jsx("p", { className: css.emptyInline, children: "\u5C1A\u672A\u6DFB\u52A0 \u6280\u80FD\u3002\u8BE5\u4E13\u5BB6\u5C06\u53EA\u4F7F\u7528\u89D2\u8272\u6307\u5F15\u548C\u4F1A\u8BDD\u57FA\u7840\u80FD\u529B\u3002" })
                                                        : draft.versionIds.map((versionId, index) => {
                                                            const version = versionById.get(versionId);
                                                            const label = version === undefined ? versionId : assetTitle(props.catalog, version.assetName);
                                                            return _jsxs("div", { className: css.agentSkillRow, children: [_jsx(DotsSixVertical, {}), _jsx("span", { children: index + 1 }), _jsx(SkillMark, { small: true }), _jsxs("span", { children: [_jsx("b", { children: label }), _jsx("small", { children: versionId })] }), _jsx("span", { className: css.exactVersion, children: "\u7CBE\u786E\u7248\u672C" }), _jsxs("span", { className: css.agentOrderActions, children: [_jsx("button", { type: "button", "aria-label": `上移 ${label}`, disabled: index === 0, onClick: () => { moveVersion(index, -1); }, children: _jsx(ArrowUp, {}) }), _jsx("button", { type: "button", "aria-label": `下移 ${label}`, disabled: index === draft.versionIds.length - 1, onClick: () => { moveVersion(index, 1); }, children: _jsx(ArrowDown, {}) }), _jsx("button", { type: "button", "aria-label": `移除 ${label}`, onClick: () => { setDraft(value => ({ ...value, versionIds: value.versionIds.filter(id => id !== versionId) })); }, children: _jsx(X, {}) })] })] }, versionId);
                                                        }) }), _jsxs("h3", { className: css.fieldLabel, children: ["\u7F16\u6392\u65B9\u5F0F ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u9009" })] }), _jsxs("label", { className: css.radioLine, children: [_jsx("input", { type: "radio", name: "agent-mode", checked: draft.mode === 'dynamic', onChange: () => { setDraft(value => ({ ...value, mode: 'dynamic' })); } }), _jsxs("span", { children: [_jsx("b", { children: "\u7531 AI \u52A8\u6001\u9009\u62E9" }), _jsx("small", { children: "AI \u6839\u636E\u5BF9\u8BDD\u76EE\u6807\u9009\u62E9\u8FD9\u4E9B \u6280\u80FD\uFF0C\u5217\u8868\u987A\u5E8F\u4F5C\u4E3A\u4F18\u5148\u7EA7\u3002" })] })] }), _jsxs("label", { className: css.radioLine, children: [_jsx("input", { type: "radio", name: "agent-mode", checked: draft.mode === 'fixed', onChange: () => { setDraft(value => ({ ...value, mode: 'fixed' })); } }), _jsxs("span", { children: [_jsx("b", { children: "\u56FA\u5B9A\u987A\u5E8F" }), _jsx("small", { children: "\u5411 AI \u63D0\u4F9B\u6309\u5217\u8868\u987A\u5E8F\u4F7F\u7528\u5168\u90E8 \u6280\u80FD \u7684\u56FA\u5B9A\u6307\u5F15\u3002" })] })] }), _jsx("div", { className: css.sectionHeading, children: _jsxs("div", { children: [_jsx("h2", { children: "\u6A21\u578B\u4E0E\u6743\u9650" }), _jsx("p", { children: "\u6BCF\u6B21\u65B0\u5EFA \u4E13\u5BB6 \u4F1A\u8BDD\u65F6\u5E94\u7528\uFF1B\u6D4B\u8BD5\u4F1A\u8BDD\u4E5F\u4F7F\u7528\u76F8\u540C\u914D\u7F6E\u3002" })] }) }), _jsxs("div", { className: css.agentFields, children: [_jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["\u6A21\u578B ", _jsx("span", { className: css.optionalBadge, children: "\u9009\u586B" })] }), _jsxs("select", { "aria-label": "\u4E13\u5BB6 \u6A21\u578B", "aria-describedby": "agent-model-help", value: draft.modelKey, onChange: (event) => { setDraft(value => ({ ...value, modelKey: event.target.value, reasoningEffort: '' })); }, children: [_jsx("option", { value: "", children: "\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B" }), modelOptions.map(option => _jsxs("option", { value: `${option.provider}\u0000${option.model}`, children: [publicCatalogLabel(option.providerLabel), " \u00B7 ", publicCatalogLabel(option.modelLabel)] }, `${option.provider}\u0000${option.model}`))] }), _jsx("small", { id: "agent-model-help", className: css.fieldHelp, children: "\u4E0D\u9009\u62E9\u65F6\u8DDF\u968F\u65B0\u4F1A\u8BDD\u7684\u9ED8\u8BA4\u6A21\u578B\u3002" })] }), _jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["\u6743\u9650 ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u9009" })] }), _jsxs("select", { "aria-label": "\u4E13\u5BB6 \u6743\u9650", required: true, value: draft.permission, onChange: (event) => {
                                                                        setDraft(value => ({ ...value, permission: event.target.value }));
                                                                    }, children: [_jsx("option", { value: "read-only", children: "\u53EA\u8BFB\u5206\u6790" }), _jsx("option", { value: "workspace-write", children: "\u6709\u9650\u6743\u9650" }), _jsx("option", { value: "danger-full-access", children: "\u5B8C\u5168\u6743\u9650" })] })] }), modelOptions.find(option => `${option.provider}\u0000${option.model}` === draft.modelKey)?.reasoningEfforts.length
                                                            ? _jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["\u63A8\u7406\u5F3A\u5EA6 ", _jsx("span", { className: css.optionalBadge, children: "\u9009\u586B" })] }), _jsxs("select", { "aria-label": "\u4E13\u5BB6 \u63A8\u7406\u5F3A\u5EA6", value: draft.reasoningEffort, onChange: (event) => { setDraft(value => ({ ...value, reasoningEffort: event.target.value })); }, children: [_jsx("option", { value: "", children: "\u6A21\u578B\u9ED8\u8BA4" }), modelOptions.find(option => `${option.provider}\u0000${option.model}` === draft.modelKey)?.reasoningEfforts.map(effort => _jsx("option", { value: effort.id, children: effort.label }, effort.id))] })] })
                                                            : null] })] })] }), _jsxs("footer", { className: css.stickyFooter, children: [_jsxs("button", { type: "button", className: css.agentEditorBack, onClick: () => {
                                                setCreating(false);
                                                setEditingId(undefined);
                                                setDeletePending(false);
                                                setOperationError(undefined);
                                            }, children: [_jsx(X, {}), "\u53D6\u6D88\u5E76\u8FD4\u56DE\u4E13\u5BB6"] }), selected && _jsx("button", { type: "button", className: css.dangerButton, disabled: busy || !authoritativeReady, onClick: () => { setDeletePending(true); }, children: "\u5220\u9664" }), selected && deletePending && _jsxs(ActionDialog, { title: "\u5220\u9664\u4E13\u5BB6", busy: busy, error: operationError, onClose: () => setDeletePending(false), children: [_jsxs("p", { children: ["\u5220\u9664\u300C", selected.name, "\u300D\u7684\u5B9A\u4E49\uFF1F\u5DF2\u6709\u4F1A\u8BDD\u4F1A\u4FDD\u7559\u3002"] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: () => setDeletePending(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", "data-danger": true, disabled: busy || !authoritativeReady, onClick: () => { void remove(); }, children: "\u786E\u8BA4\u5220\u9664" })] })] }), !authoritativeReady && _jsx("span", { className: css.footerHint, role: "status", children: "Host \u6295\u5F71\u672A\u5C31\u7EEA\uFF0C\u6682\u65F6\u4E0D\u80FD\u4FDD\u5B58\u6216\u521B\u5EFA\u4F1A\u8BDD\u3002" }), _jsxs("button", { type: "submit", className: css.outlineButton, disabled: busy || !authoritativeReady, children: [_jsx(FloppyDisk, {}), busy ? '处理中' : '保存'] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy || !authoritativeReady, onClick: () => { void saveAndRun(true); }, children: [_jsx(Shield, {}), dirty ? '保存并隔离测试' : '隔离测试'] }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: busy || !authoritativeReady, onClick: () => { void saveAndRun(false); }, children: [_jsx(ChatsCircle, {}), dirty ? '保存并新建对话' : '新建专家对话'] })] })] }) : _jsx(AgentLaunchpad, { onUninstall: librarySource === 'installed' && props.uninstallAgent ? definition => { setUninstallError(undefined); setUninstallTarget(definition); } : undefined, definitions: definitions, favorites: favorites, toggleFavorite: props.actions.setFavoriteAssetIds, recentArchiveByAgent: recentArchiveByAgent, ready: authoritativeReady, busy: busy, onOpen: open, onStart: (definition) => { void start(definition); }, onEdit: beginEdit, onCreate: beginCreate, onAuthoring: startAgentAuthoring }) })] });
}
function AgentLaunchpad({ definitions, recentArchiveByAgent, ready, busy, onOpen, onStart, onEdit, onCreate, onAuthoring, onArrange, favorites, toggleFavorite, onUninstall, }) {
    if (definitions.length === 0)
        return _jsx("section", { className: css.agentLaunchpad, children: _jsxs("div", { className: css.settingsPlaceholder, children: [_jsx(CapabilityIcon, { kind: "agent", size: 42 }), _jsx("h2", { children: "\u521B\u5EFA\u4F60\u7684\u7B2C\u4E00\u4E2A\u4E13\u5BB6" }), _jsx("p", { children: "\u914D\u7F6E\u4E00\u6B21\u89D2\u8272\u4E0E \u6280\u80FD\uFF0C\u4E4B\u540E\u4ECE\u5217\u8868\u4E00\u952E\u7EE7\u7EED\u72EC\u7ACB\u5BF9\u8BDD\u3002" }), _jsxs("div", { className: css.creationActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy, onClick: onAuthoring, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u4E13\u5BB6"] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy, onClick: onCreate, children: [_jsx(Plus, {}), "\u624B\u52A8\u914D\u7F6E \u4E13\u5BB6"] })] })] }) });
    return _jsxs("section", { className: css.agentLaunchpad, children: [_jsx("header", { children: _jsxs("div", { children: [_jsx("h2", { children: "\u9009\u62E9\u4E13\u5BB6\u5F00\u59CB\u5BF9\u8BDD" }), _jsx("p", { children: "\u4E3B\u6309\u94AE\u7EE7\u7EED\u6700\u8FD1\u5B58\u6863\uFF1B\u201C\u65B0\u5BF9\u8BDD\u201D\u59CB\u7EC8\u521B\u5EFA\u72EC\u7ACB\u4E0A\u4E0B\u6587\u3002" })] }) }), _jsx("div", { className: css.agentLaunchGrid, children: definitions.map((definition) => {
                    const recent = recentArchiveByAgent.get(definition.agentId);
                    return _jsxs("article", { children: [_jsxs("div", { className: css.agentLaunchTitle, children: [_jsx(CapabilityIcon, { kind: "agent" }), _jsxs("span", { children: [_jsx("h2", { children: definition.name }), _jsxs("small", { children: [definition.skills.length, " \u4E2A \u6280\u80FD \u00B7 ", definition.mode === 'fixed' ? '固定编排' : '动态编排'] })] }), _jsxs("div", { className: css.agentCardTools, children: [_jsx(FavoriteToggle, { id: `agent:${definition.agentId}`, name: definition.name, favorites: favorites, toggle: toggleFavorite }), _jsx("button", { type: "button", className: css.agentGear, "aria-label": `设置专家 ${definition.name}`, onClick: () => { onEdit(definition); }, children: _jsx(GearSix, {}) })] })] }), _jsx("p", { children: capabilitySummary(definition.role) }), _jsxs("div", { className: css.agentLaunchMeta, children: [_jsxs("span", { children: [_jsx(ChatsCircle, {}), recent === undefined ? '还没有对话' : `${recent.title ?? '未命名对话'} · ${formatUpdated(recent.updatedAt)}`] }), _jsxs("span", { children: [_jsx(Shield, {}), definition.permission === 'read-only' ? '只读分析' : definition.permission === 'workspace-write' ? '有限权限' : '完全权限'] })] }), _jsxs("footer", { children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: !ready || busy, onClick: () => { onOpen(definition); }, children: [_jsx(ChatsCircle, {}), recent === undefined ? '开始对话' : '继续对话'] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: !ready || busy, onClick: () => { onStart(definition); }, children: [_jsx(Plus, {}), "\u65B0\u5BF9\u8BDD"] }), onArrange && _jsx("button", { type: "button", className: css.outlineButton, disabled: !ready || busy, onClick: () => onArrange(definition), children: "\u521B\u5EFA\u5B89\u6392" }), onUninstall && _jsxs("button", { type: "button", className: css.uninstallButton, disabled: !ready || busy, "aria-label": `卸载 ${definition.name}`, onClick: () => onUninstall(definition), children: [_jsx(Trash, {}), "\u5378\u8F7D"] })] })] }, definition.agentId);
                }) })] });
}
const DEFAULT_TEAM_MODEL_CHOICE = { kind: 'default' };
function blankTeamDraft(definitions) {
    return {
        name: '',
        description: '',
        leadAgentId: definitions[0]?.agentId ?? '',
        leadModel: DEFAULT_TEAM_MODEL_CHOICE,
        members: [{
                key: crypto.randomUUID(),
                name: 'researcher',
                agentId: definitions[1]?.agentId ?? '',
                context: 'fresh',
                model: DEFAULT_TEAM_MODEL_CHOICE,
            }],
    };
}
function teamDraftFrom(definition) {
    return {
        name: definition.name,
        description: definition.description,
        leadAgentId: definition.lead.agentId,
        leadModel: definition.leadModel,
        members: definition.members.map(member => ({
            key: crypto.randomUUID(),
            name: member.name,
            agentId: member.agent.agentId,
            context: member.context,
            model: member.model,
        })),
    };
}
function teamDraftFromSeed(seed) {
    return {
        name: seed.name,
        description: seed.description,
        leadAgentId: seed.leadAgentId,
        leadModel: seed.leadModel,
        members: seed.members.map(member => ({ ...member, key: crypto.randomUUID() })),
    };
}
function teamModelChoiceKey(choice) {
    return choice.kind === 'default' ? '' : `${choice.selection.provider}\u0000${choice.selection.model}`;
}
function teamModelChoiceLabel(choice, options) {
    if (choice.kind === 'default')
        return '跟随会话默认';
    const option = options.find(candidate => candidate.provider === choice.selection.provider
        && candidate.model === choice.selection.model);
    const model = option === undefined
        ? `${choice.selection.provider} · ${choice.selection.model}`
        : `${publicCatalogLabel(option.providerLabel)} · ${publicCatalogLabel(option.modelLabel)}`;
    const effort = option?.reasoningEfforts.find(candidate => candidate.id === choice.selection.reasoningEffort)?.label
        ?? choice.selection.reasoningEffort;
    return effort === undefined ? model : `${model} · ${effort}`;
}
function TeamModelChoiceFields({ label, choice, options, onChange }) {
    const modelKey = teamModelChoiceKey(choice);
    const selected = choice.kind === 'fixed'
        ? options.find(option => option.provider === choice.selection.provider
            && option.model === choice.selection.model)
        : undefined;
    return _jsxs("div", { className: css.teamModelFields, children: [_jsxs("label", { children: [_jsxs("small", { children: [label, "\u6A21\u578B"] }), _jsxs("select", { "aria-label": `${label}模型`, value: modelKey, onChange: (event) => {
                            const option = options.find(candidate => `${candidate.provider}\u0000${candidate.model}` === event.target.value);
                            onChange(option === undefined
                                ? DEFAULT_TEAM_MODEL_CHOICE
                                : { kind: 'fixed', selection: { provider: option.provider, model: option.model } });
                        }, children: [_jsx("option", { value: "", children: "\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B" }), choice.kind === 'fixed' && selected === undefined && _jsxs("option", { value: modelKey, children: [choice.selection.provider, " \u00B7 ", choice.selection.model] }), options.map(option => _jsxs("option", { value: `${option.provider}\u0000${option.model}`, children: [publicCatalogLabel(option.providerLabel), " \u00B7 ", publicCatalogLabel(option.modelLabel)] }, `${option.provider}\u0000${option.model}`))] })] }), choice.kind === 'fixed' && selected !== undefined && selected.reasoningEfforts.length > 0 && _jsxs("label", { children: [_jsxs("small", { children: [label, "\u63A8\u7406\u5F3A\u5EA6"] }), _jsxs("select", { "aria-label": `${label}推理强度`, value: choice.selection.reasoningEffort ?? '', onChange: (event) => {
                            onChange({
                                kind: 'fixed',
                                selection: {
                                    provider: choice.selection.provider,
                                    model: choice.selection.model,
                                    ...(event.target.value === '' ? {} : { reasoningEffort: event.target.value }),
                                },
                            });
                        }, children: [_jsx("option", { value: "", children: "\u6A21\u578B\u9ED8\u8BA4" }), selected.reasoningEfforts.map(effort => _jsx("option", { value: effort.id, children: effort.label }, effort.id))] })] })] });
}
function AgentTeamsWorkspace(props) {
    const definitions = props.agents.definitions;
    const teams = props.agents.teams;
    const favorites = props.useStore(state => state.favoriteAssetIds);
    const [selectedId, setSelectedId] = useState(props.initialTeamId);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState(() => blankTeamDraft(definitions));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState();
    const [validationShown, setValidationShown] = useState(false);
    const [deletePending, setDeletePending] = useState(false);
    const nameInputRef = useRef(null);
    const selected = creating ? undefined : teams.find(team => team.teamId === selectedId);
    const recentByTeam = useMemo(() => {
        const result = new Map();
        for (const archive of [...props.agents.teamArchives].sort((left, right) => right.updatedAt - left.updatedAt)) {
            if (!result.has(archive.team.teamId))
                result.set(archive.team.teamId, archive);
        }
        return result;
    }, [props.agents.teamArchives]);
    useEffect(() => {
        if (selected === undefined || creating)
            return;
        setDraft(teamDraftFrom(selected));
        setError(undefined);
        setValidationShown(false);
        setDeletePending(false);
    }, [creating, selected?.revision, selected?.teamId]);
    const lead = definitions.find(agent => agent.agentId === draft.leadAgentId);
    const names = draft.members.map(member => member.name.trim());
    const agentIds = draft.members.map(member => member.agentId);
    const nameError = draft.name.trim() === '' ? '请输入团队名称。' : undefined;
    const descriptionError = draft.description.trim() === ''
        ? '请输入团队目标。'
        : draft.description.includes('{{') || draft.description.includes('}}')
            ? '团队目标不能包含双花括号引用。'
            : undefined;
    const leadError = lead === undefined ? '请选择 Lead 专家。' : undefined;
    const membersError = draft.members.length === 0
        ? '至少添加一个团队成员。'
        : names.some(name => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name === 'lead')
            ? '成员标识必须是小写英文、数字和连字符，且不能使用 lead。'
            : new Set(names).size !== names.length
                ? '成员标识不能重复。'
                : agentIds.some(agentId => agentId === '' || !definitions.some(agent => agent.agentId === agentId))
                    ? '每个成员都必须选择一个仍然存在的 专家。'
                    : new Set([draft.leadAgentId, ...agentIds]).size !== draft.members.length + 1
                        ? 'Lead 与成员不能重复使用同一个 专家。'
                        : lead !== undefined && draft.members.some((member) => {
                            const agent = definitions.find(candidate => candidate.agentId === member.agentId);
                            return agent !== undefined && lead.permission !== agent.permission;
                        })
                            ? '所有成员必须与 Lead 使用相同权限。'
                            : undefined;
    const teamDataReady = (props.agents.teamsPhase ?? props.agents.phase) === 'ready';
    const ready = teamDataReady
        && nameError === undefined
        && descriptionError === undefined
        && leadError === undefined
        && membersError === undefined;
    const beginCreate = (seed) => {
        setCreating(true);
        setSelectedId(undefined);
        setDraft(seed === undefined ? blankTeamDraft(definitions) : teamDraftFromSeed(seed));
        setError(undefined);
        setValidationShown(false);
        setDeletePending(false);
    };
    useEffect(() => {
        if (!props.creationPending)
            return;
        beginCreate(props.builderSeed);
        props.consumeCreationRequest();
    }, [props.builderSeed, props.creationPending]);
    useEffect(() => {
        if (creating)
            nameInputRef.current?.focus();
    }, [creating]);
    const beginEdit = (definition) => {
        setCreating(false);
        setSelectedId(definition.teamId);
        setDraft(teamDraftFrom(definition));
        setError(undefined);
        setValidationShown(false);
        setDeletePending(false);
    };
    const persist = async () => {
        setValidationShown(true);
        if (!ready || lead === undefined)
            throw new Error('请先修正 专家团 的必填项和运行约束。');
        const fields = {
            name: draft.name.trim(),
            description: draft.description.trim(),
            leadAgentId: lead.agentId,
            leadAgentRevision: lead.revision,
            leadModel: draft.leadModel,
            members: draft.members.map((member) => {
                const agent = definitions.find(candidate => candidate.agentId === member.agentId);
                if (agent === undefined)
                    throw new Error(`成员 ${member.name} 的 专家 已不存在。`);
                return {
                    name: member.name.trim(),
                    agentId: agent.agentId,
                    agentRevision: agent.revision,
                    context: member.context,
                    model: member.model,
                };
            }),
        };
        const saved = selected === undefined
            ? await props.createAgentTeam(fields)
            : await props.updateAgentTeam({
                ...fields,
                teamId: selected.teamId,
                expectedRevision: selected.revision,
            });
        setCreating(false);
        setSelectedId(saved.teamId);
        setValidationShown(false);
        return saved;
    };
    const save = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await persist();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '专家团 保存失败。');
        }
        finally {
            setBusy(false);
        }
    };
    const saveAndStart = async () => {
        setBusy(true);
        setError(undefined);
        try {
            const saved = await persist();
            await props.startAgentTeamSession(saved);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '专家团 会话创建失败。');
        }
        finally {
            setBusy(false);
        }
    };
    const start = async (definition) => {
        setBusy(true);
        setError(undefined);
        try {
            await props.startAgentTeamSession(definition);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '专家团 会话创建失败。');
        }
        finally {
            setBusy(false);
        }
    };
    const open = (definition) => {
        const recent = recentByTeam.get(definition.teamId);
        if (recent === undefined) {
            void start(definition);
            return;
        }
        props.openSession(recent.sessionId);
        props.actions.navigate('conversations');
    };
    const remove = async () => {
        if (selected === undefined)
            return;
        setBusy(true);
        setError(undefined);
        try {
            await props.deleteAgentTeam({ teamId: selected.teamId, expectedRevision: selected.revision });
            setSelectedId(undefined);
            setDeletePending(false);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '专家团 删除失败。');
        }
        finally {
            setBusy(false);
        }
    };
    const startAuthoring = (kind) => {
        setBusy(true);
        setError(undefined);
        void props.startAuthoringSession(kind).catch((cause) => {
            setError(cause instanceof Error ? cause.message : `${kind === 'agent' ? '专家' : '专家团'} 创作会话创建失败。`);
        }).finally(() => { setBusy(false); });
    };
    return _jsxs("section", { className: css.agentTeamWorkspace, children: [_jsxs("header", { className: css.agentTeamHeader, children: [_jsxs("div", { children: [_jsxs("h2", { children: [teams.length, " \u4E2A\u4E13\u5BB6\u56E2"] }), _jsx("p", { children: "\u9009\u62E9\u5DF2\u6709\u4E13\u5BB6\u56E2\u7EE7\u7EED\u534F\u4F5C\uFF0C\u6216\u521B\u5EFA\u65B0\u7684\u7814\u7A76\u5206\u5DE5\u3002" })] }), _jsxs("div", { className: css.creationActions, children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy, onClick: () => { startAuthoring('agent-team'); }, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u4E13\u5BB6\u56E2"] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy, onClick: () => { beginCreate(); }, children: [_jsx(Plus, {}), "\u624B\u52A8\u7F16\u6392"] })] })] }), definitions.length < 2 && _jsxs("div", { className: css.insufficientAgents, children: [_jsx("p", { className: css.notice, children: "\u521B\u5EFA\u56E2\u961F\u9700\u8981\u81F3\u5C11\u4E00\u4E2A Lead \u548C\u4E00\u4E2A\u6210\u5458\u3002AI \u4F1A\u5148\u8BBE\u8BA1\u5B8C\u6574\u5206\u5DE5\uFF1B\u82E5\u7F3A\u5C11\u6240\u9700\u89D2\u8272\uFF0C\u4F1A\u660E\u786E\u8BF4\u660E\u5E76\u7EE7\u7EED\u5F15\u5BFC AI \u521B\u5EFA\u5BF9\u5E94 \u4E13\u5BB6\u3002" }), _jsx("div", { className: css.creationActions, children: _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy, onClick: () => { startAuthoring('agent'); }, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u4E13\u5BB6"] }) })] }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), _jsx("div", { className: css.agentWorkspace, children: creating || selected !== undefined ? _jsxs("form", { className: css.agentEditor, noValidate: true, onSubmit: (event) => { void save(event); }, children: [_jsxs("div", { className: css.agentTitle, children: [_jsx(CapabilityIcon, { kind: "agent-team" }), _jsxs("div", { children: [_jsx("h2", { children: creating ? '创建 专家团' : `设置 · ${selected?.name ?? ''}` }), _jsx("small", { children: selected === undefined ? '新定义' : `Host 版本 ${selected.revision}` })] })] }), _jsxs("div", { className: css.agentBuilder, children: [_jsxs("details", { className: css.agentSummary, children: [_jsx("summary", { children: "\u56E2\u961F\u914D\u7F6E\u6458\u8981" }), _jsx(CapabilityIcon, { kind: "agent-team", size: 34 }), _jsx("h2", { children: draft.name || '未命名团队' }), _jsx("p", { children: draft.description || '描述团队目标与 Lead 的交付要求。' }), _jsx("hr", {}), _jsx("small", { children: "Lead" }), _jsx("b", { children: lead?.name ?? '未选择' }), _jsx("small", { children: "\u6210\u5458" }), _jsxs("b", { children: [draft.members.length, " \u4E2A"] }), _jsx("small", { children: "Lead \u6A21\u578B" }), _jsx("b", { children: teamModelChoiceLabel(draft.leadModel, props.modelOptions) }), _jsx("small", { children: "\u56E2\u961F\u6743\u9650" }), _jsx("b", { children: lead?.permission ?? '未确定' })] }), _jsxs("section", { className: css.orchestration, children: [_jsxs("div", { className: css.agentFields, children: [_jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["\u56E2\u961F\u540D\u79F0 ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u586B" })] }), _jsx("input", { ref: nameInputRef, "aria-label": "\u4E13\u5BB6\u56E2 \u540D\u79F0", value: draft.name, maxLength: 80, onChange: (event) => { setDraft(value => ({ ...value, name: event.target.value })); } }), validationShown && nameError !== undefined && _jsx("small", { className: css.fieldError, children: nameError })] }), _jsxs("label", { children: [_jsxs("span", { className: css.fieldLabel, children: ["Lead \u4E13\u5BB6 ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u9009" })] }), _jsxs("select", { "aria-label": "\u4E13\u5BB6\u56E2 Lead", value: draft.leadAgentId, onChange: (event) => { setDraft(value => ({ ...value, leadAgentId: event.target.value })); }, children: [_jsx("option", { value: "", children: "\u9009\u62E9 Lead \u4E13\u5BB6" }), definitions.map(agent => _jsxs("option", { value: agent.agentId, children: [agent.name, " \u00B7 r", agent.revision] }, agent.agentId))] }), validationShown && leadError !== undefined && _jsx("small", { className: css.fieldError, children: leadError })] })] }), _jsx(TeamModelChoiceFields, { label: "Lead ", choice: draft.leadModel, options: props.modelOptions, onChange: (model) => { setDraft(value => ({ ...value, leadModel: model })); } }), _jsxs("label", { className: css.agentField, children: [_jsxs("span", { className: css.fieldLabel, children: ["\u56E2\u961F\u76EE\u6807 ", _jsx("span", { className: css.requiredBadge, children: "\u5FC5\u586B" })] }), _jsx("textarea", { "aria-label": "\u4E13\u5BB6\u56E2 \u76EE\u6807", value: draft.description, maxLength: 4_000, onChange: (event) => { setDraft(value => ({ ...value, description: event.target.value })); }, placeholder: "\u8BF4\u660E\u56E2\u961F\u5171\u540C\u76EE\u6807\u3001\u5206\u5DE5\u539F\u5219\u548C\u6700\u7EC8\u4EA4\u4ED8\u3002" }), validationShown && descriptionError !== undefined && _jsx("small", { className: css.fieldError, children: descriptionError })] }), _jsxs("div", { className: css.sectionHeading, children: [_jsxs("div", { children: [_jsxs("h2", { children: ["\u6210\u5458\u7F16\u6392 ", _jsx("span", { className: css.requiredBadge, children: "\u81F3\u5C11 1 \u4E2A" })] }), _jsx("p", { children: "\u6210\u5458\u6807\u8BC6\u4F1A\u6210\u4E3A\u56E2\u961F\u7684\u7A33\u5B9A\u5BFB\u5740\u540D\u79F0\uFF1B\u4E00\u4E2A \u4E13\u5BB6 \u5728\u540C\u4E00\u56E2\u961F\u53EA\u80FD\u5360\u4E00\u4E2A\u89D2\u8272\u3002" })] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: draft.members.length >= 8, onClick: () => { setDraft(value => ({ ...value, members: [...value.members, { key: crypto.randomUUID(), name: `member-${String(value.members.length + 1)}`, agentId: '', context: 'fresh', model: DEFAULT_TEAM_MODEL_CHOICE }] })); }, children: [_jsx(Plus, {}), "\u6DFB\u52A0\u6210\u5458"] })] }), _jsx("div", { className: css.teamMemberList, children: draft.members.map((member, index) => _jsxs("div", { className: css.teamMemberRow, children: [_jsx("span", { className: css.teamMemberIndex, children: index + 1 }), _jsxs("label", { children: [_jsx("small", { children: "\u6210\u5458\u6807\u8BC6" }), _jsx("input", { "aria-label": `成员 ${String(index + 1)} 标识`, value: member.name, onChange: (event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, name: event.target.value } : row) })); } })] }), _jsxs("label", { children: [_jsx("small", { children: "\u4E13\u5BB6" }), _jsxs("select", { "aria-label": `成员 ${String(index + 1)} 专家`, value: member.agentId, onChange: (event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, agentId: event.target.value } : row) })); }, children: [_jsx("option", { value: "", children: "\u9009\u62E9 \u4E13\u5BB6" }), definitions.map(agent => _jsxs("option", { value: agent.agentId, children: [agent.name, " \u00B7 r", agent.revision] }, agent.agentId))] })] }), _jsxs("label", { children: [_jsx("small", { children: "\u4E0A\u4E0B\u6587" }), _jsxs("select", { "aria-label": `成员 ${String(index + 1)} 上下文`, value: member.context, onChange: (event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, context: event.target.value } : row) })); }, children: [_jsx("option", { value: "fresh", children: "\u72EC\u7ACB\u4E0A\u4E0B\u6587" }), _jsx("option", { value: "fork", children: "\u7EE7\u627F\u5DF2\u5B8C\u6210\u8F6E\u6B21" })] })] }), _jsx("button", { type: "button", "aria-label": `删除成员 ${String(index + 1)}`, disabled: draft.members.length === 1, onClick: () => { setDraft(value => ({ ...value, members: value.members.filter(row => row.key !== member.key) })); }, children: _jsx(Trash, {}) }), _jsx(TeamModelChoiceFields, { label: `成员 ${String(index + 1)} `, choice: member.model, options: props.modelOptions, onChange: (model) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, model } : row) })); } })] }, member.key)) }), validationShown && membersError !== undefined && _jsx("p", { className: css.fieldError, children: membersError }), _jsxs("p", { className: css.notice, children: [_jsx(Shield, {}), "\u6BCF\u4E2A\u89D2\u8272\u53EF\u4EE5\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B\uFF0C\u4E5F\u53EF\u4EE5\u5206\u522B\u6307\u5B9A\u6A21\u578B\u548C\u63A8\u7406\u5F3A\u5EA6\uFF1B\u56E2\u961F\u6210\u5458\u4ECD\u9700\u4E0E Lead \u4F7F\u7528\u76F8\u540C\u6743\u9650\u3002\u89D2\u8272\u548C \u6280\u80FD \u6309\u6BCF\u4E2A\u6210\u5458\u51BB\u7ED3\u7684 \u4E13\u5BB6 \u7248\u672C\u72EC\u7ACB\u52A0\u8F7D\u3002"] })] })] }), _jsxs("footer", { className: css.stickyFooter, children: [_jsxs("button", { type: "button", className: css.agentEditorBack, onClick: () => { setCreating(false); setSelectedId(undefined); setError(undefined); }, children: [_jsx(X, {}), "\u53D6\u6D88\u5E76\u8FD4\u56DE\u56E2\u961F"] }), selected !== undefined && _jsx("button", { type: "button", className: css.dangerButton, disabled: busy, onClick: () => { setDeletePending(true); }, children: "\u5220\u9664" }), selected !== undefined && deletePending && _jsxs(ActionDialog, { title: "\u5220\u9664 \u4E13\u5BB6\u56E2", busy: busy, error: error, onClose: () => setDeletePending(false), children: [_jsxs("p", { children: ["\u5220\u9664\u300C", selected.name, "\u300D\u7684\u56E2\u961F\u5B9A\u4E49\uFF1F\u5DF2\u6709\u4F1A\u8BDD\u4F1A\u4FDD\u7559\u3002"] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: () => setDeletePending(false), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", "data-danger": true, disabled: busy, onClick: () => { void remove(); }, children: "\u786E\u8BA4\u5220\u9664" })] })] }), !ready && _jsx("span", { className: css.footerHint, role: "status", children: "\u8BF7\u5148\u4FEE\u6B63\u5FC5\u586B\u9879\uFF0C\u5E76\u786E\u4FDD Lead \u4E0E\u6210\u5458\u7684\u6743\u9650\u4E00\u81F4\u3002" }), _jsxs("button", { type: "submit", className: css.outlineButton, disabled: busy || !ready, children: [_jsx(FloppyDisk, {}), busy ? '处理中' : '保存'] }), _jsxs("button", { type: "button", className: css.primaryButton, disabled: busy || !ready, onClick: () => { void saveAndStart(); }, children: [_jsx(ChatsCircle, {}), "\u4FDD\u5B58\u5E76\u65B0\u5EFA\u56E2\u961F\u4F1A\u8BDD"] })] })] }) : _jsx("section", { className: css.agentLaunchpad, children: teams.length === 0 ? _jsxs("div", { className: css.settingsPlaceholder, children: [_jsx(CapabilityIcon, { kind: "agent-team", size: 42 }), _jsx("h2", { children: "\u521B\u5EFA\u7B2C\u4E00\u4E2A\u4E13\u5BB6\u56E2" }), _jsx("p", { children: "\u544A\u8BC9 AI \u56E2\u961F\u76EE\u6807\u3001\u8F93\u5165\u548C\u671F\u671B\u4EA4\u4ED8\uFF0C\u89D2\u8272\u9009\u62E9\u4E0E\u5E95\u5C42\u7F16\u6392\u4F1A\u81EA\u52A8\u5B8C\u6210\u3002" }), _jsx("div", { className: css.creationActions, children: _jsxs("button", { type: "button", className: css.primaryButton, disabled: busy, onClick: () => { startAuthoring('agent-team'); }, children: [_jsx(MagicWand, {}), "AI \u521B\u5EFA \u4E13\u5BB6\u56E2"] }) })] })
                        : _jsx("div", { className: css.agentLaunchGrid, children: teams.map((team) => {
                                const recent = recentByTeam.get(team.teamId);
                                return _jsxs("article", { children: [_jsxs("div", { className: css.agentLaunchTitle, children: [_jsx(CapabilityIcon, { kind: "agent-team" }), _jsxs("span", { children: [_jsx("h2", { children: team.name }), _jsxs("small", { children: ["Lead\uFF1A", team.lead.name, " \u00B7 ", team.members.length, " \u4E2A\u6210\u5458"] })] }), _jsxs("div", { className: css.agentCardTools, children: [_jsx(FavoriteToggle, { id: `team:${team.teamId}`, name: team.name, favorites: favorites, toggle: props.actions.setFavoriteAssetIds }), _jsx("button", { type: "button", className: css.agentGear, "aria-label": `设置专家团 ${team.name}`, onClick: () => { beginEdit(team); }, children: _jsx(GearSix, {}) })] })] }), _jsx("p", { children: team.description }), _jsx("div", { className: css.teamRosterPreview, children: team.members.map(member => _jsxs("span", { children: [member.name, " \u00B7 ", member.agent.name, " \u00B7 ", teamModelChoiceLabel(member.model, props.modelOptions)] }, member.name)) }), _jsxs("footer", { children: [_jsxs("button", { type: "button", className: css.primaryButton, disabled: busy || !teamDataReady, onClick: () => { open(team); }, children: [_jsx(ChatsCircle, {}), recent === undefined ? '开始团队会话' : '继续团队会话'] }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: busy || !teamDataReady, onClick: () => { void start(team); }, children: [_jsx(Plus, {}), "\u65B0\u56E2\u961F\u4F1A\u8BDD"] })] })] }, team.teamId);
                            }) }) }) })] });
}
function PluginSettings(props) {
    return _jsx("div", { className: css.pluginMarket, children: props.renderPluginMarket?.() ?? _jsx("p", { role: "status", children: "\u63D2\u4EF6\u5E02\u573A\u6B63\u5728\u52A0\u8F7D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u6253\u5F00\u3002" }) });
}
function SettingsPage(props) {
    const section = props.useStore(state => state.settingsSection);
    const interfaceScale = props.useStore(state => state.interfaceScale);
    const conversationScale = props.useStore(state => state.conversationScale);
    const conversationBrightness = props.useStore(state => state.conversationBrightness);
    const conversationOverlayOpacity = props.useStore(state => state.conversationOverlayOpacity);
    const colorScheme = props.useStore(state => state.colorScheme);
    const lightBackground = props.useStore(state => state.lightBackground);
    const darkBackground = props.useStore(state => state.darkBackground);
    const autoCheckCatalog = props.useStore(state => state.autoCheckCatalog);
    const settingsError = props.useStore(state => state.settingsError);
    const settingsStatus = props.useStore(state => state.settingsStatus);
    const settingsWritable = props.useStore(state => state.settingsWritable);
    const defaultAgentProvider = props.useStore(state => state.defaultAgentProvider);
    const defaultAgentModel = props.useStore(state => state.defaultAgentModel);
    const defaultAgentReasoningEffort = props.useStore(state => state.defaultAgentReasoningEffort);
    const defaultAgentPermission = props.useStore(state => state.defaultAgentPermission);
    const [modelOptions, setModelOptions] = useState([]);
    const [modelError, setModelError] = useState();
    useEffect(() => {
        if (section !== 'permissions')
            return;
        setModelError(undefined);
        void props.listAgentModels().then(setModelOptions, (cause) => {
            setModelOptions([]);
            setModelError(cause instanceof Error ? cause.message : '无法读取模型目录。');
        });
    }, [section]);
    const preferencesReady = settingsStatus === 'ready' && settingsWritable;
    const sections = [
        ['workspace', _jsx(FolderOpen, {}), '工作区'],
        ['updates', _jsx(Clock, {}), '自动更新'],
        ['permissions', _jsx(Shield, {}), '模型与权限'],
        ['models', _jsx(Wrench, {}), '模型服务'],
        ['plugins', _jsx(GridFour, {}), '插件市场'],
        ['appearance', _jsx(Palette, {}), '外观'],
        ['panda-data', _jsx(Database, {}), 'PandaData'],
        ['brand-support', _jsx(Globe, {}), '品牌与支持'],
    ];
    return _jsx("div", { className: css.pageWithDrawer, children: _jsxs("div", { className: css.pageScroll, children: [_jsx(PageHeader, { title: "\u8BBE\u7F6E", subtitle: "\u7BA1\u7406\u5DE5\u4F5C\u533A\u3001\u66F4\u65B0\u3001\u6A21\u578B\u6743\u9650\u4E0E\u663E\u793A" }), _jsxs("div", { className: css.settingsLayout, children: [_jsxs("aside", { className: css.settingsNav, children: [sections.map(([id, icon, label]) => (_jsxs("button", { className: section === id ? css.selected : undefined, "aria-current": section === id ? "page" : undefined, onClick: () => { props.actions.setSettingsSection(id); }, children: [icon, label] }, id))), _jsx("hr", {}), _jsxs("p", { children: ["\u754C\u9762 ", Math.round(interfaceScale * 100), "% \u00B7 \u5BF9\u8BDD\u6587\u5B57 ", Math.round(conversationScale * 100), "%"] })] }), _jsx("section", { className: css.settingsContent, children: section === 'plugins' ? _jsx(PluginSettings, { ...props }) : section === 'models' ? _jsx(QuantSkillsModelServices, { access: props.modelAccess, jevAccess: props.contestAccess?.watch }) : section === 'workspace' ? _jsx(WorkspaceSettings, { props: props }) : section === 'appearance' ? _jsxs(_Fragment, { children: [_jsx("h2", { children: "\u5916\u89C2" }), _jsx("p", { children: "QuantSkills \u7684\u914D\u8272\u3001\u754C\u9762\u6BD4\u4F8B\u548C\u4F1A\u8BDD\u6587\u5B57\u5747\u53EF\u72EC\u7ACB\u8C03\u6574\uFF0C\u5E76\u5373\u65F6\u9884\u89C8\u3002" }), _jsx(QuantSkillsThemePicker, { scheme: colorScheme, lightBackground: lightBackground, darkBackground: darkBackground, disabled: !preferencesReady, onChange: (scheme) => { props.actions.setColorScheme(scheme); }, onLightBackgroundChange: (background) => { props.actions.setLightBackground(background); }, onDarkBackgroundChange: (background) => { props.actions.setDarkBackground(background); } }), _jsxs("label", { className: css.scaleControl, children: ["\u754C\u9762\u6BD4\u4F8B", _jsx("input", { type: "range", min: MIN_QUANTSKILLS_SCALE, max: MAX_QUANTSKILLS_SCALE, step: "0.05", value: interfaceScale, disabled: !preferencesReady, onChange: (event) => { props.actions.setInterfaceScale(Number(event.target.value)); } }), _jsxs("b", { children: [Math.round(interfaceScale * 100), "%"] })] }), _jsxs("label", { className: css.scaleControl, children: ["\u4F1A\u8BDD\u6587\u5B57", _jsx("input", { type: "range", min: MIN_QUANTSKILLS_SCALE, max: MAX_QUANTSKILLS_SCALE, step: "0.05", value: conversationScale, disabled: !preferencesReady, onChange: (event) => { props.actions.setConversationScale(Number(event.target.value)); } }), _jsxs("b", { children: [Math.round(conversationScale * 100), "%"] })] }), _jsxs("label", { className: css.scaleControl, children: ["\u6587\u5B57\u4EAE\u5EA6", _jsx("input", { type: "range", min: MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS, max: MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, step: "0.05", value: conversationBrightness, disabled: !preferencesReady, onChange: (event) => { props.actions.setConversationBrightness(Number(event.target.value)); } }), _jsxs("b", { children: [Math.round(conversationBrightness * 100), "%"] })] }), _jsxs("label", { className: css.scaleControl, children: ["\u5185\u5BB9\u8499\u5C42", _jsx("input", { "aria-label": "\u5185\u5BB9\u8499\u5C42", type: "range", min: MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, max: MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, step: "0.01", value: conversationOverlayOpacity, disabled: !preferencesReady, onChange: (event) => { props.actions.setConversationOverlayOpacity(Number(event.target.value)); } }), _jsxs("b", { children: [Math.round(conversationOverlayOpacity * 100), "%"] })] }), _jsx("small", { className: css.scaleHint, children: "\u9996\u9875\u4E0E\u4F1A\u8BDD\u5171\u7528\u6B64\u8BBE\u7F6E\u3002\u6570\u503C\u8D8A\u4F4E\uFF0C\u80CC\u666F\u8D8A\u6E05\u6670\uFF1B\u6570\u503C\u8D8A\u9AD8\uFF0C\u5185\u5BB9\u8D8A\u6613\u8BFB\u3002" }), _jsxs("div", { className: css.settingsActions, children: [_jsx("button", { type: "button", className: css.outlineButton, disabled: !preferencesReady || (interfaceScale === 1 && conversationScale === 1 && conversationBrightness === DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS && conversationOverlayOpacity === DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY), onClick: () => { props.actions.setInterfaceScale(1); props.actions.setConversationScale(1); props.actions.setConversationBrightness(DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS); props.actions.setConversationOverlayOpacity(DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY); }, children: "\u6062\u590D\u9ED8\u8BA4" }), _jsx(PreferenceSaveState, { status: settingsStatus, writable: settingsWritable, error: settingsError })] })] }) : section === 'brand-support' ? _jsx(QuantSkillsBrandSupportSettings, {})
                                : section === 'updates' ? _jsx(UpdateSettings, { catalog: props.catalog, catalogEnabled: autoCheckCatalog, catalogWritable: preferencesReady, onCatalogChange: (enabled) => { props.actions.setAutoCheckCatalog(enabled); }, onRefresh: () => props.refreshCatalog() }) : section === 'panda-data' ? _jsx(PandaDataSettings, { status: props.pandaMcpStatus, authenticate: props.authenticatePandaMcp, refresh: props.refreshPandaMcp, logout: props.logoutPandaMcp }) : _jsx(PermissionSettings, { modelOptions: modelOptions, modelError: modelError, provider: defaultAgentProvider, model: defaultAgentModel, reasoningEffort: defaultAgentReasoningEffort, permission: defaultAgentPermission, writable: preferencesReady, status: settingsStatus, onModelChange: (provider, model, reasoningEffort) => { props.actions.setDefaultAgentModel(provider, model, reasoningEffort); }, onPermissionChange: (permission) => { props.actions.setDefaultAgentPermission(permission); } }) })] })] }) });
}
function PandaDataSettings({ status, authenticate, refresh, logout }) {
    const [snapshot, setSnapshot] = useState();
    const [error, setError] = useState();
    const [busy, setBusy] = useState(false);
    const poll = useCallback(async () => {
        try {
            setSnapshot(await status());
            setError(undefined);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : '无法读取 PandaData 连接状态。');
        }
    }, [status]);
    useEffect(() => {
        void poll();
        const timer = window.setInterval(() => { void poll(); }, 4_000);
        return () => { window.clearInterval(timer); };
    }, [poll]);
    const run = async (action) => {
        setBusy(true);
        try {
            setSnapshot(await action());
            setError(undefined);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'PandaData 操作失败。');
            await poll();
        }
        finally {
            setBusy(false);
        }
    };
    const phase = snapshot?.phase ?? 'disconnected';
    const connected = phase === 'connected';
    const idle = !busy && phase !== 'authenticating';
    return _jsxs("div", { className: css.settingsPanel, children: [_jsx(Database, { size: 34 }), _jsx("h2", { children: "PandaData" }), _jsx("p", { children: "\u767B\u5F55\u540E\uFF0C\u6A21\u578B\u53EF\u901A\u8FC7\u516C\u7F51 MCP \u8C03\u7528\u884C\u60C5\u6570\u636E\u3002QuantSkills \u4E0D\u4F1A\u6536\u96C6\u5BC6\u7801\uFF0C\u4E5F\u4E0D\u4F1A\u628A token \u53D1\u7ED9\u6A21\u578B\u3002" }), _jsxs("dl", { className: css.settingsFacts, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u72B6\u6001" }), _jsx("dd", { children: pandaMcpPhaseLabel(phase) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u670D\u52A1" }), _jsx("dd", { children: snapshot?.url ?? 'https://pandadatamcp.pandaaiquant.com/mcp' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u8BF4\u660E" }), _jsx("dd", { children: snapshot?.message ?? '正在读取连接状态…' })] })] }), error !== undefined && _jsx("p", { className: css.error, role: "alert", children: error }), _jsxs("div", { className: css.settingsActions, children: [_jsx("button", { type: "button", className: css.primaryButton, disabled: !idle && !snapshot?.authorizationUrl, onClick: () => { void run(authenticate); }, children: snapshot?.authorizationUrl ? '继续授权' : connected || phase === 'needs_auth' ? '重新登录' : '登录' }), _jsxs("button", { type: "button", className: css.outlineButton, disabled: !idle, onClick: () => { void run(refresh); }, children: [_jsx(ArrowClockwise, {}), "\u5237\u65B0\u72B6\u6001"] }), _jsx("button", { type: "button", className: css.outlineButton, disabled: !idle, onClick: () => { void run(logout); }, children: "\u9000\u51FA\u767B\u5F55" })] })] });
}
function PreferenceSaveState({ status, writable, error }) {
    const label = error ?? (status === 'loading'
        ? '正在读取设置'
        : status === 'ready' && writable
            ? '外观更改会自动保存'
            : status === 'ready' ? '服务器设置为只读' : '设置读取失败，请刷新页面重试。');
    return _jsxs("p", { className: !error && status === 'ready' && writable ? css.success : css.warning, role: "status", children: [!error && status === 'ready' && writable ? _jsx(CheckCircle, {}) : _jsx(Clock, {}), label] });
}
function UpdateSettings({ catalog, catalogEnabled, catalogWritable, onCatalogChange, onRefresh, }) {
    const [refreshing, setRefreshing] = useState(false);
    return _jsxs("div", { className: css.settingsPanel, children: [_jsx(Clock, { size: 34 }), _jsx("h2", { children: "\u81EA\u52A8\u66F4\u65B0" }), _jsx("p", { children: "\u8FD9\u91CC\u53EA\u63A7\u5236\u516C\u5F00 \u6280\u80FD \u76EE\u5F55\u7684\u81EA\u52A8\u68C0\u67E5\u3002QuantSkills \u5E94\u7528\u7248\u672C\u4E0D\u4F1A\u81EA\u52A8\u8054\u7F51\u6216\u66F4\u65B0\u3002" }), _jsx("div", { className: css.settingRows, children: _jsxs("label", { children: ["\u81EA\u52A8\u68C0\u67E5 \u6280\u80FD \u76EE\u5F55\uFF08", formatRefreshInterval(catalog.refreshAfterMs), "\uFF09", _jsx("input", { type: "checkbox", checked: catalogEnabled, disabled: !catalogWritable, onChange: (event) => { onCatalogChange(event.target.checked); } }), _jsx("i", {})] }) }), _jsxs("div", { className: css.settingsActions, children: [_jsx("button", { type: "button", className: css.outlineButton, disabled: refreshing, onClick: () => {
                            setRefreshing(true);
                            void onRefresh().finally(() => { setRefreshing(false); });
                        }, children: refreshing ? '正在检查…' : '立即检查目录与已安装版本' }), catalog.refreshedAt && _jsxs("small", { children: ["\u4E0A\u6B21\u76EE\u5F55\u540C\u6B65\uFF1A", formatUpdated(catalog.refreshedAt)] })] }), _jsxs("dl", { className: css.settingsFacts, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u6280\u80FD \u5B89\u88C5" }), _jsx("dd", { children: "\u59CB\u7EC8\u7531\u7528\u6237\u70B9\u51FB\u786E\u8BA4\uFF1B\u4E0D\u4F1A\u5728\u540E\u53F0\u6267\u884C\u65B0\u4EE3\u7801\u5B89\u88C5\u3002" })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5E94\u7528\u7248\u672C" }), _jsx("dd", { children: "\u9996\u9875\u4F1A\u81EA\u52A8\u68C0\u67E5\u6240\u9009\u6765\u6E90\u7684\u6B63\u5F0F\u7248\u672C\uFF0C\u6BCF\u5C0F\u65F6\u6700\u591A\u68C0\u67E5\u4E00\u6B21\uFF1B\u53D1\u73B0\u66F4\u65B0\u4F1A\u53D8\u8272\u63D0\u793A\u5E76\u5217\u51FA\u66F4\u65B0\u5185\u5BB9\uFF0C\u70B9\u51FB\u540E\u624D\u4E0B\u8F7D\u3002" })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u4F1A\u8BDD\u7248\u672C" }), _jsx("dd", { children: "\u5DF2\u6709\u4F1A\u8BDD\u56FA\u5B9A\u539F\u7248\u672C\uFF0C\u65B0\u4F1A\u8BDD\u624D\u4F7F\u7528\u65B0\u5B89\u88C5\u7248\u672C\u3002" })] })] })] });
}
function formatRefreshInterval(value) {
    if (value === undefined)
        return '等待宿主策略';
    if (value % 60_000 === 0)
        return `${value / 60_000} 分钟`;
    return `${Math.ceil(value / 1000)} 秒`;
}
function WorkspaceSettings({ props }) {
    const sessions = props.useSessions(state => state);
    const workspaces = props.useWorkspaces(state => state);
    const [refreshing, setRefreshing] = useState(false);
    const [workspaceStatus, setWorkspaceStatus] = useState();
    const [workspaceError, setWorkspaceError] = useState();
    const defaultWorkspaceId = props.useStore(state => state.defaultWorkspaceId);
    const settingsWritable = props.useStore(state => state.settingsWritable);
    const currentSessionId = sessions.current;
    const current = currentSessionId === undefined ? undefined : sessions.byId[currentSessionId];
    const workspace = currentSessionId === undefined
        ? workspaces.items.at(0)
        : workspaces.items.find(item => item.sessionIds.includes(currentSessionId));
    useEffect(() => {
        if (!props.managedWorkspace) {
            setWorkspaceStatus(undefined);
            setWorkspaceError(undefined);
            return;
        }
        let active = true;
        setWorkspaceError(undefined);
        void props.workspaceStatus().then((status) => {
            if (!active)
                return;
            setWorkspaceStatus(status);
            if (status.preferredMissing && defaultWorkspaceId !== undefined) {
                props.actions.setWorkspaceRecoveryNotice('原自定义工作区已不可用，已恢复 QuantSkills 默认工作区。');
                void props.setDefaultWorkspace(undefined);
            }
        }, (cause) => { if (active)
            setWorkspaceError(cause instanceof Error ? cause.message : '无法读取默认工作区。'); });
        return () => { active = false; };
    }, [defaultWorkspaceId, props.managedWorkspace]);
    return _jsxs("div", { className: css.settingsPanel, children: [_jsx(FolderOpen, { size: 34 }), _jsx("h2", { children: "\u5DE5\u4F5C\u533A" }), _jsx("p", { children: "QuantSkills \u53EA\u7BA1\u7406\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u533A\u5F52\u5C5E\u3002Python\u3001PandaData SDK \u548C\u767B\u5F55\u72B6\u6001\u7531\u7528\u6237\u73AF\u5883\u8D1F\u8D23\uFF0C\u4E0D\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u4FDD\u5B58\u6216\u81EA\u52A8\u5B89\u88C5\u3002" }), _jsxs("dl", { className: css.settingsFacts, children: [_jsxs("div", { children: [_jsx("dt", { children: "Host \u4F1A\u8BDD" }), _jsx("dd", { children: sessions.phase === 'ready' ? `${sessions.ids.length} 个已加载` : `状态：${sessions.phase}` })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5F53\u524D\u4F1A\u8BDD" }), _jsx("dd", { children: current?.displayTitle ?? '未选择' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5F53\u524D\u5DE5\u4F5C\u533A" }), _jsx("dd", { children: workspace === undefined ? '未绑定' : `${workspace.title} · ${workspace.path}` })] }), props.managedWorkspace && _jsxs("div", { children: [_jsx("dt", { children: "\u65B0\u4F1A\u8BDD\u9ED8\u8BA4\u5DE5\u4F5C\u533A" }), _jsx("dd", { children: workspaceStatus?.preferredWorkspace === undefined
                                    ? `QuantSkills 默认工作区 · ${workspaceStatus?.managedPath ?? '正在读取…'}`
                                    : `${workspaceStatus.preferredWorkspace.title} · ${workspaceStatus.preferredWorkspace.path}` })] }), _jsxs("div", { children: [_jsx("dt", { children: "QuantSkills \u76EE\u5F55" }), _jsx("dd", { children: props.catalog.phase === 'ready' ? `${props.catalog.assets.length} 个公开资产` : `状态：${props.catalog.phase}` })] })] }), props.managedWorkspace && _jsxs("div", { className: css.settingsForm, children: [_jsxs("label", { children: ["\u9ED8\u8BA4\u5DE5\u4F5C\u533A", _jsxs("select", { "aria-label": "QuantSkills \u9ED8\u8BA4\u5DE5\u4F5C\u533A", value: defaultWorkspaceId ?? '', disabled: !settingsWritable, onChange: (event) => {
                                    setWorkspaceError(undefined);
                                    void props.setDefaultWorkspace(event.target.value === '' ? undefined : event.target.value)
                                        .then(() => props.workspaceStatus())
                                        .then(setWorkspaceStatus)
                                        .catch((cause) => { setWorkspaceError(cause instanceof Error ? cause.message : '无法保存默认工作区。'); });
                                }, children: [_jsx("option", { value: "", children: "QuantSkills \u9ED8\u8BA4\u5DE5\u4F5C\u533A" }), workspaces.items.map(item => _jsxs("option", { value: item.workspaceId, children: [item.title, " \u00B7 ", item.path] }, item.workspaceId))] })] }), defaultWorkspaceId !== undefined && _jsx("button", { type: "button", className: css.outlineButton, onClick: () => {
                            setWorkspaceError(undefined);
                            void props.setDefaultWorkspace(undefined)
                                .then(() => props.workspaceStatus())
                                .then(setWorkspaceStatus)
                                .catch((cause) => { setWorkspaceError(cause instanceof Error ? cause.message : '无法恢复默认工作区。'); });
                        }, children: "\u6062\u590D QuantSkills \u9ED8\u8BA4\u5DE5\u4F5C\u533A" })] }), workspaceError !== undefined && _jsx("p", { className: css.error, role: "alert", children: workspaceError }), _jsx("div", { className: css.settingsActions, children: _jsx("button", { type: "button", className: css.outlineButton, disabled: refreshing, onClick: () => {
                        setRefreshing(true);
                        void Promise.all([
                            props.refreshCatalog(),
                            props.refreshBoundSessions(), props.refreshAgents(),
                            ...(props.managedWorkspace ? [props.workspaceStatus().then(setWorkspaceStatus)] : []),
                        ]).finally(() => { setRefreshing(false); });
                    }, children: refreshing ? '正在同步 Host…' : '刷新工作区与目录' }) }), _jsxs("p", { className: css.notice, children: [_jsx(Shield, {}), "\u6280\u80FD\u3001\u4E13\u5BB6 \u548C \u4E13\u5BB6\u56E2 \u7684\u5B89\u88C5\u4E0E\u542F\u52A8\u4E0D\u4F9D\u8D56 PandaData \u767B\u5F55\u68C0\u67E5\u3002\u9700\u8981 Python \u6216 PandaData \u7684\u4EFB\u52A1\u4F1A\u4F7F\u7528\u5F53\u524D\u5DE5\u4F5C\u533A\u548C\u7528\u6237\u73AF\u5883\uFF0C\u7F3A\u5931\u65F6\u53EA\u7EC8\u6B62\u8BE5\u4EFB\u52A1\u5E76\u63D0\u4F9B\u4FEE\u590D\u5EFA\u8BAE\u3002"] })] });
}
function PermissionSettings({ modelOptions, modelError, provider, model, reasoningEffort, permission, writable, status, onModelChange, onPermissionChange, }) {
    const modelKey = provider === '' || model === '' ? '' : `${provider}\u0000${model}`;
    const selected = modelOptions.find(option => `${option.provider}\u0000${option.model}` === modelKey);
    return _jsxs("div", { className: css.settingsPanel, children: [_jsx(Shield, { size: 34 }), _jsx("h2", { children: "\u6A21\u578B\u4E0E\u6743\u9650" }), _jsx("p", { children: "\u8FD9\u4E9B\u503C\u662F\u201C\u65B0\u5EFA \u4E13\u5BB6\u201D\u7684\u771F\u5B9E\u9ED8\u8BA4\u503C\uFF1B\u5DF2\u6709 \u4E13\u5BB6 \u548C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u4F1A\u88AB\u6539\u5199\u3002" }), _jsxs("div", { className: css.settingsForm, children: [_jsxs("label", { children: ["\u9ED8\u8BA4 \u4E13\u5BB6 \u6A21\u578B", _jsxs("select", { "aria-label": "\u9ED8\u8BA4 \u4E13\u5BB6 \u6A21\u578B", value: modelKey, disabled: !writable, onChange: (event) => {
                                    const option = modelOptions.find(candidate => `${candidate.provider}\u0000${candidate.model}` === event.target.value);
                                    onModelChange(option?.provider ?? '', option?.model ?? '', '');
                                }, children: [_jsx("option", { value: "", children: "\u8DDF\u968F\u4F1A\u8BDD\u9ED8\u8BA4\u6A21\u578B" }), modelOptions.map(option => _jsxs("option", { value: `${option.provider}\u0000${option.model}`, children: [option.providerLabel, " \u00B7 ", option.modelLabel] }, `${option.provider}\u0000${option.model}`))] })] }), selected !== undefined && selected.reasoningEfforts.length > 0 && _jsxs("label", { children: ["\u9ED8\u8BA4\u63A8\u7406\u5F3A\u5EA6", _jsxs("select", { "aria-label": "\u9ED8\u8BA4 \u4E13\u5BB6 \u63A8\u7406\u5F3A\u5EA6", value: reasoningEffort, disabled: !writable, onChange: (event) => { onModelChange(selected.provider, selected.model, event.target.value); }, children: [_jsx("option", { value: "", children: "\u6A21\u578B\u9ED8\u8BA4" }), selected.reasoningEfforts.map(effort => _jsx("option", { value: effort.id, children: effort.label }, effort.id))] })] }), _jsxs("label", { children: ["\u9ED8\u8BA4 \u4E13\u5BB6 \u6743\u9650", _jsxs("select", { "aria-label": "\u9ED8\u8BA4 \u4E13\u5BB6 \u6743\u9650", value: permission, disabled: !writable, onChange: (event) => { onPermissionChange(event.target.value); }, children: [_jsx("option", { value: "read-only", children: "\u53EA\u8BFB" }), _jsx("option", { value: "workspace-write", children: "\u5DE5\u4F5C\u533A\u5199\u5165" }), _jsx("option", { value: "danger-full-access", children: "\u5B8C\u5168\u8BBF\u95EE" })] })] })] }), modelError && _jsx("p", { className: css.error, role: "alert", children: modelError }), _jsx(PreferenceSaveState, { status: status, writable: writable }), _jsxs("dl", { className: css.settingsFacts, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u666E\u901A \u6280\u80FD \u4F1A\u8BDD" }), _jsx("dd", { children: "\u7EE7\u7EED\u4F7F\u7528\u4F1A\u8BDD\u6807\u9898\u680F\u7684\u6A21\u578B\u4E0E\u6743\u9650\u9009\u62E9\u5668\u3002" })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u4E13\u5BB6 \u4F1A\u8BDD" }), _jsx("dd", { children: "\u521B\u5EFA \u4E13\u5BB6 \u65F6\u56FA\u5316\u6A21\u578B\u4E0E\u6743\u9650\uFF0C\u65B0\u5EFA\u4F1A\u8BDD\u65F6\u7531 Host \u5E94\u7528\u3002" })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5B9E\u76D8\u4EA4\u6613" }), _jsx("dd", { children: "\u6BCF\u4E00\u7B14\u4E0B\u5355\u4ECD\u8981\u6C42\u65B0\u7684\u7528\u6237\u786E\u8BA4\uFF0C\u9ED8\u8BA4\u6743\u9650\u4E0D\u80FD\u7ED5\u8FC7\u3002" })] })] })] });
}
/** Starts a durable, independent AI authoring conversation from any QuantSkills Session. */
export function QuantSkillsAuthoringAction({ start }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState();
    const [error, setError] = useState();
    const launch = (kind) => {
        setBusy(kind);
        setError(undefined);
        void start(kind).then(() => {
            setOpen(false);
        }, (cause) => {
            setError(cause instanceof Error ? cause.message : String(cause));
        }).finally(() => { setBusy(undefined); });
    };
    const items = [
        {
            id: 'skill',
            disabled: busy !== undefined,
            icon: _jsx(CapabilityIcon, { kind: "skill", size: 17, bare: true }),
            label: _jsxs("span", { className: css.authoringMenuLabel, children: [_jsx("b", { children: busy === 'skill' ? '正在创建会话…' : 'AI 创建 技能' }), _jsx("small", { children: "\u72EC\u7ACB\u4E0A\u4E0B\u6587 \u00B7 \u8F93\u51FA\u6807\u51C6 SKILL.md" })] }),
        },
        {
            id: 'agent',
            disabled: busy !== undefined,
            icon: _jsx(CapabilityIcon, { kind: "agent", size: 17, bare: true }),
            label: _jsxs("span", { className: css.authoringMenuLabel, children: [_jsx("b", { children: busy === 'agent' ? '正在创建会话…' : 'AI 创建 专家' }), _jsx("small", { children: "\u72EC\u7ACB\u4E0A\u4E0B\u6587 \u00B7 \u8F93\u51FA\u6807\u51C6 AGENTS.md" })] }),
        },
        {
            id: 'agent-team',
            disabled: busy !== undefined,
            icon: _jsx(CapabilityIcon, { kind: "agent-team", size: 17, bare: true }),
            label: _jsxs("span", { className: css.authoringMenuLabel, children: [_jsx("b", { children: busy === 'agent-team' ? '正在创建会话…' : 'AI 创建 专家团' }), _jsx("small", { children: "\u5BF9\u8BDD\u786E\u8BA4\u76EE\u6807\u3001Lead \u4E0E\u6210\u5458\uFF1B\u4E5F\u53EF\u524D\u5F80\u4E13\u5BB6\u9875\u9762\u624B\u52A8\u7F16\u6392" })] }),
        },
    ];
    const footer = error === undefined ? undefined : [{
            id: 'authoring-error',
            label: _jsx("span", { className: css.authoringMenuError, role: "alert", children: error }),
            disabled: true,
            danger: true,
        }];
    return _jsx(Menu, { open: open, portal: true, align: "start", className: css.authoringAction ?? '', items: items, ...footer === undefined ? {} : { footer }, onClose: () => { setOpen(false); }, onSelect: (id) => {
            if (id === 'skill' || id === 'agent' || id === 'agent-team')
                launch(id);
        }, anchor: _jsxs("button", { type: "button", className: css.authoringButton, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => { setOpen(value => !value); }, children: ["\u521B\u5EFA", _jsx(CaretDown, { size: 14 })] }) });
}
/** Header action shown only when the Host projection binds this Session to QuantSkills. */
export function QuantSkillsResultAction({ useProjection, useSession, useChat, open, complete, }) {
    const plain = useProjection('quantSkillsPlainSession');
    const binding = useProjection('quantSkillsSession');
    const agent = useProjection('quantSkillsAgentSession');
    const team = useProjection('quantSkillsAgentTeamSession');
    const teamMember = useProjection('quantSkillsAgentTeamMember');
    const sessionId = useSession(snapshot => snapshot.sessionId);
    const running = useSession(snapshot => snapshot.running);
    const previewablePaths = useChat(snapshot => previewableResultPathsForLatestTurn(snapshot).join('\u0000'));
    const previousRun = useRef({ sessionId, running });
    useEffect(() => {
        const previous = previousRun.current;
        if (previous.sessionId === sessionId && previous.running && !running && previewablePaths !== '') {
            complete(sessionId);
        }
        previousRun.current = { sessionId, running };
    }, [complete, previewablePaths, running, sessionId]);
    let owner;
    if (plain != null)
        owner = plain.purpose === 'role-helper' ? 'QuantSkills 创作会话' : 'QuantSkills 普通会话';
    else if (binding != null)
        owner = binding.assetId;
    else if (agent != null)
        owner = agent.name;
    else if (team != null)
        owner = team.name;
    else if (teamMember != null)
        owner = `${teamMember.agent.name} · ${teamMember.memberName}`;
    else
        return null;
    return _jsxs("button", { type: "button", className: css.resultAction, "aria-label": `查看 ${owner} 本对话结果`, onClick: (event) => { open(event.currentTarget); }, children: [_jsx(ChartLineUp, { size: 15 }), _jsx("span", { children: "\u7ED3\u679C" }), running && _jsx("span", { className: css.resultActionLive, children: "\u8FD0\u884C\u4E2D" })] });
}
const RESULT_TABS = [
    { id: 'overview', label: '概览' },
    { id: 'files', label: '文件' },
    { id: 'browser', label: '网页预览' },
    { id: 'changes', label: '变更' },
];
const RESULT_FILE_GROUPS = [
    { id: 'reports', label: '报告' },
    { id: 'data', label: '数据' },
    { id: 'code', label: '代码与文本' },
    { id: 'other', label: '其他' },
];
function ProducedFileIcon({ path }) {
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    if (extension === 'pdf')
        return _jsx(FilePdf, {});
    if (extension === 'csv')
        return _jsx(FileCsv, {});
    if (['docx', 'epub', 'odp', 'ods', 'odt', 'pptx', 'rtf', 'xlsx'].includes(extension))
        return _jsx(FileText, {});
    return _jsx(FileCode, {});
}
function primaryResultFile(files) {
    return files.reduce((preferred, file) => {
        if (preferred === undefined)
            return file;
        return resultPreviewRank(file.path) < resultPreviewRank(preferred.path) ? file : preferred;
    }, undefined);
}
function resultFileName(path) {
    const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return separator === -1 ? path : path.slice(separator + 1);
}
function resultFileGroup(path) {
    const extension = resultExtension(path);
    if (['md', 'markdown', 'html', 'htm', 'pdf', 'docx', 'odt', 'rtf', 'epub', 'pptx', 'odp'].includes(extension)) {
        return 'reports';
    }
    if (['csv', 'tsv', 'json', 'xlsx', 'xls', 'ods', 'parquet', 'arrow'].includes(extension))
        return 'data';
    if (isCodeResultPath(path) || ['txt', 'log'].includes(extension))
        return 'code';
    return 'other';
}
function unavailableResultFile(file, reason) {
    return {
        ...file,
        sourcePath: file.path,
        status: 'unavailable',
        reason: reason ?? '产物不在会话工作区',
    };
}
function resultFileLocation(file) {
    if (file.status === 'unavailable')
        return `${file.reason ?? '产物不可用'} · ${file.sourcePath}`;
    if (file.status === 'archived')
        return `已归档 · ${file.sourcePath} → ${file.path}`;
    return file.path;
}
function projectPreparedResultFiles(candidates, prepared) {
    const bySource = new Map(prepared.map(item => [item.sourcePath, item]));
    return candidates.map((candidate) => {
        const item = bySource.get(candidate.path);
        if (item === undefined)
            return unavailableResultFile(candidate);
        if (item.status === 'unavailable' || item.path.trim() === '') {
            return unavailableResultFile(candidate, item.reason);
        }
        return {
            ...candidate,
            name: resultFileName(item.path),
            sourcePath: item.sourcePath,
            path: item.path,
            status: item.status,
            ...(item.reason === undefined ? {} : { reason: item.reason }),
        };
    });
}
function mergePreparedResultFiles(complete, candidates, prepared) {
    const durableCandidates = complete.map(item => ({
        path: item.sourcePath,
        name: resultFileName(item.sourcePath),
    }));
    const files = [
        ...projectPreparedResultFiles(durableCandidates, complete),
        ...projectPreparedResultFiles(candidates, prepared),
    ];
    const merged = [];
    const readyPaths = new Set();
    for (const file of files) {
        if (file.status === 'unavailable' || readyPaths.has(file.path))
            continue;
        readyPaths.add(file.path);
        merged.push(file);
    }
    return merged;
}
function ResultFiles({ files, openFile, previewFile, selectedPath, }) {
    if (files.length === 0)
        return _jsxs("div", { className: css.resultEmpty, children: [_jsx(FolderOpen, { size: 30 }), _jsx("h3", { children: "\u8FD8\u6CA1\u6709\u53EF\u6253\u5F00\u7684\u4EA7\u7269" }), _jsx("p", { children: "\u53EA\u6709\u6210\u529F\u5199\u5165\u6216\u4FEE\u6539\u5E76\u7531\u5DE5\u5177\u62A5\u544A\u4F4D\u7F6E\u7684\u6587\u4EF6\u624D\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" })] });
    return _jsx("section", { className: css.files, "aria-label": "\u672C\u5BF9\u8BDD\u751F\u6210\u7684\u6587\u4EF6", children: files.map(file => _jsxs("div", { "data-selected": selectedPath === file.path || undefined, children: [_jsxs("button", { type: "button", disabled: file.status === 'unavailable', onClick: () => { previewFile(file.path); }, "aria-label": file.status === 'unavailable' ? `${file.name} 产物不可用` : `预览 ${file.name}`, children: [_jsx(ProducedFileIcon, { path: file.path }), _jsxs("span", { children: [_jsx("b", { children: file.name }), _jsx("small", { title: resultFileLocation(file), children: resultFileLocation(file) })] })] }), _jsx("button", { type: "button", disabled: file.status === 'unavailable', onClick: () => { openFile(file.path); }, "aria-label": `在 IDE 中打开 ${file.name}`, children: _jsx(ArrowSquareOut, { "aria-hidden": "true" }) })] }, file.sourcePath)) });
}
function ResultFileNavigator({ files, selectedPath, select, mode = 'files', }) {
    const sections = mode === 'changes'
        ? [{ id: 'changes', label: '新增', files }]
        : RESULT_FILE_GROUPS.map(group => ({
            id: group.id,
            label: group.label,
            files: files.filter(file => resultFileGroup(file.path) === group.id),
        }));
    return _jsxs("nav", { className: css.resultFileNavigator, "aria-label": mode === 'changes' ? '文件变更导航' : '工作空间文件导航', children: [_jsxs("header", { children: [_jsx("strong", { children: mode === 'changes' ? '文件变更' : '工作空间文件' }), _jsx("span", { children: files.length })] }), sections.map((section) => {
                if (section.files.length === 0)
                    return null;
                return _jsxs("section", { children: [_jsxs("h3", { children: [section.label, _jsx("span", { children: section.files.length })] }), section.files.map(file => _jsxs("button", { type: "button", disabled: file.status === 'unavailable', className: selectedPath === file.path ? css.selected : undefined, "aria-current": selectedPath === file.path ? 'page' : undefined, "aria-label": file.status === 'unavailable' ? `${file.name} 产物不可用` : undefined, title: resultFileLocation(file), onClick: () => { select(file.path); }, children: [_jsx(ProducedFileIcon, { path: file.path }), _jsxs("span", { children: [_jsx("b", { children: file.name }), _jsx("small", { children: mode === 'changes'
                                                ? `新增 · ${file.status === 'ready' ? file.path : resultFileLocation(file)}`
                                                : file.status === 'ready' ? file.path : resultFileLocation(file) })] })] }, file.sourcePath))] }, section.id);
            })] });
}
function ResultOpenTabs({ paths, selectedPath, select, close, }) {
    return _jsx("div", { className: css.resultOpenTabs, role: "tablist", "aria-label": "\u5DF2\u6253\u5F00\u7684\u4EA7\u7269", children: paths.map(path => _jsxs("div", { className: selectedPath === path ? css.selected : undefined, children: [_jsxs("button", { type: "button", role: "tab", "aria-selected": selectedPath === path, title: path, onClick: () => { select(path); }, children: [_jsx(ProducedFileIcon, { path: path }), _jsx("span", { children: resultFileName(path) })] }), _jsx("button", { type: "button", "aria-label": `关闭 ${resultFileName(path)} 标签`, onClick: () => { close(path); }, children: _jsx(X, {}) })] }, path)) });
}
function resultPreviewHostBase() {
    const origin = globalThis.location?.origin;
    return origin !== undefined && origin !== 'null' ? origin : 'http://quantskills.internal';
}
function ResultTablePreview({ text, extension }) {
    const [search, setSearch] = useState('');
    const rows = useMemo(() => extension === 'tsv' ? tsvParseRows(text) : csvParseRows(text), [extension, text]);
    const headers = rows[0] ?? [];
    const query = search.trim().toLocaleLowerCase();
    const visibleRows = rows.slice(1).filter(row => query === ''
        || row.some(cell => cell.toLocaleLowerCase().includes(query)));
    return _jsxs("div", { className: css.resultTablePreview, children: [_jsxs("div", { className: css.resultTableToolbar, children: [_jsxs("label", { children: [_jsx(MagnifyingGlass, {}), _jsx("input", { "aria-label": "\u641C\u7D22\u8868\u683C", value: search, placeholder: "\u641C\u7D22\u5F53\u524D\u8868\u683C", onChange: (event) => { setSearch(event.currentTarget.value); } })] }), _jsxs("span", { children: [visibleRows.length.toLocaleString('zh-CN'), " \u884C"] })] }), headers.length === 0
                ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(Database, { size: 30 }), _jsx("h3", { children: "\u8868\u683C\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6570\u636E" })] })
                : _jsx("div", { className: css.resultTableScroll, children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: headers.map((header, index) => _jsx("th", { children: header || `列 ${String(index + 1)}` }, `${header}-${String(index)}`)) }) }), _jsx("tbody", { children: visibleRows.map((row, rowIndex) => _jsx("tr", { children: headers.map((_, columnIndex) => _jsx("td", { children: row[columnIndex] ?? '' }, String(columnIndex))) }, String(rowIndex))) })] }) })] });
}
function ResultPreview({ state, openFile, selectPath, refresh, titleRef, mode = 'file', goBack, goForward, revealFile, saveFileAs, }) {
    if (state.status === 'idle')
        return _jsx("section", { className: css.resultPreview, children: _jsxs("div", { className: css.resultEmpty, children: [_jsx(FileText, { size: 30 }), _jsx("h3", { children: "\u9009\u62E9\u4E00\u4E2A\u4EA7\u7269\u5F00\u59CB\u9884\u89C8" })] }) });
    if (state.status === 'loading')
        return _jsxs("section", { className: css.resultPreview, "aria-live": "polite", children: [_jsx("h3", { ref: titleRef, tabIndex: -1, children: state.path }), _jsx("p", { children: "\u6B63\u5728\u4ECE\u5F53\u524D\u4F1A\u8BDD\u5DE5\u4F5C\u533A\u8BFB\u53D6\u9884\u89C8\u2026" })] });
    if (state.status === 'error')
        return _jsxs("section", { className: css.resultPreview, role: "alert", children: [_jsx("h3", { ref: titleRef, tabIndex: -1, children: state.path }), _jsx("p", { children: "\u5BBF\u4E3B\u65E0\u6CD5\u8BFB\u53D6\u8FD9\u4E2A\u6587\u4EF6\u7684\u9884\u89C8\u3002" }), _jsx("button", { type: "button", onClick: () => { openFile(state.path); }, children: "\u4F7F\u7528\u7CFB\u7EDF\u5E94\u7528\u5B8C\u6574\u6253\u5F00" })] });
    const preview = state.value;
    const extension = resultExtension(preview.path);
    const language = extension === 'yml' ? 'yaml' : extension;
    const typeLabel = preview.kind === 'document'
        ? '文档阅读模式'
        : preview.kind === 'directory'
            ? '文件夹'
            : preview.kind === 'resource'
                ? preview.presentation === 'external' ? '本地文件' : '完整查看'
                : preview.kind === 'binary'
                    ? preview.mediaType === 'application/pdf' ? 'PDF' : '图片'
                    : preview.kind === 'unsupported'
                        ? '不可预览'
                        : preview.mediaType === 'text/markdown'
                            ? 'Markdown'
                            : preview.mediaType === 'text/html'
                                ? 'HTML'
                                : ['csv', 'tsv'].includes(extension)
                                    ? '表格文本'
                                    : isCodeResultPath(preview.path) || extension === 'json'
                                        ? '代码'
                                        : '文本';
    return _jsxs("section", { className: css.resultPreview, "aria-label": `${preview.path} 预览`, children: [_jsxs("header", { className: mode === 'browser' ? css.resultBrowserToolbar : undefined, children: [mode === 'browser' && _jsxs("div", { className: css.resultBrowserHistory, children: [_jsx("button", { type: "button", disabled: goBack === undefined, "aria-label": "\u540E\u9000", onClick: goBack, children: _jsx(ArrowLeft, {}) }), _jsx("button", { type: "button", disabled: goForward === undefined, "aria-label": "\u524D\u8FDB", onClick: goForward, children: _jsx(ArrowRight, {}) })] }), _jsxs("div", { className: mode === 'browser' ? css.resultBrowserAddress : undefined, children: [mode === 'browser' && _jsx(Globe, { "aria-hidden": "true" }), _jsx("h3", { ref: titleRef, tabIndex: -1, children: preview.path }), mode !== 'browser' && _jsxs("small", { children: [mode === 'changes' ? '新增文件' : typeLabel, " \u00B7 ", preview.bytes.toLocaleString('zh-CN'), " \u5B57\u8282"] })] }), _jsx("button", { type: "button", className: css.resultPreviewRefresh, onClick: () => { refresh(preview.path); }, "aria-label": `刷新当前产物 ${preview.path}`, title: "\u5237\u65B0\u5F53\u524D\u4EA7\u7269", children: _jsx(ArrowClockwise, {}) }), mode === 'browser' && revealFile !== undefined && _jsx("button", { type: "button", className: css.resultPreviewRefresh, onClick: () => { revealFile(preview.path); }, "aria-label": `在文件夹中显示 ${preview.path}`, title: "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A", children: _jsx(FolderOpen, {}) }), mode === 'browser' && saveFileAs !== undefined && _jsx("button", { type: "button", className: css.resultPreviewRefresh, onClick: () => { saveFileAs(preview.path); }, "aria-label": `另存为 ${preview.path}`, title: "\u53E6\u5B58\u4E3A", children: _jsx(FloppyDisk, {}) }), _jsxs("button", { type: "button", className: mode === 'browser' ? css.resultPreviewRefresh : undefined, onClick: () => { openFile(preview.path); }, "aria-label": `使用系统应用完整打开 ${preview.path}`, title: "\u4F7F\u7528\u7CFB\u7EDF\u5E94\u7528\u5B8C\u6574\u6253\u5F00", children: [_jsx(ArrowSquareOut, {}), mode === 'browser' ? null : '完整打开'] })] }), _jsx("div", { className: css.resultPreviewCanvas, "data-kind": preview.kind, children: preview.kind === 'text' && preview.mediaType === 'text/markdown'
                    ? _jsx("div", { className: css.resultMarkdown, children: _jsx(MarkdownText, { text: preview.text, labels: MARKDOWN_LABELS }) })
                    : preview.kind === 'text' && preview.mediaType === 'text/html'
                        ? _jsx(InteractiveHtml, { className: css.resultHtmlPreview, title: `${preview.path} HTML 预览`, source: preview.text })
                        : preview.kind === 'text' && (extension === 'csv' || extension === 'tsv')
                            ? _jsx(ResultTablePreview, { text: preview.text, extension: extension })
                            : preview.kind === 'text' && (isCodeResultPath(preview.path) || extension === 'json')
                                ? _jsx(CodeBlock, { className: css.resultCodePreview, code: preview.text, lang: language, copyLabel: "\u590D\u5236", copiedLabel: "\u5DF2\u590D\u5236" })
                                : preview.kind === 'text'
                                    ? _jsx("pre", { className: css.resultPlainPreview, children: preview.text })
                                    : preview.kind === 'document'
                                        ? _jsxs("article", { className: css.resultDocumentPreview, children: [preview.truncated && _jsx("p", { role: "status", children: "\u5185\u5D4C\u9605\u8BFB\u5185\u5BB9\u8F83\u957F\uFF1B\u53EF\u70B9\u51FB\u201C\u5B8C\u6574\u6253\u5F00\u201D\u4F7F\u7528\u672C\u673A\u5E94\u7528\u67E5\u770B\u539F\u6587\u4EF6\u3002" }), _jsx("pre", { children: preview.text })] })
                                        : preview.kind === 'directory'
                                            ? preview.entries.length === 0
                                                ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(FolderOpen, { size: 30 }), _jsx("h3", { children: "\u6B64\u6587\u4EF6\u5939\u4E3A\u7A7A" })] })
                                                : _jsx("div", { className: css.resultDirectoryList, role: "list", "aria-label": `${preview.path} 文件列表`, children: preview.entries.map(entry => _jsxs("button", { type: "button", onClick: () => { selectPath(entry.path); }, children: [entry.type === 'directory' ? _jsx(FolderOpen, { "aria-hidden": "true" }) : _jsx(FileText, { "aria-hidden": "true" }), _jsxs("span", { children: [_jsxs("b", { children: [entry.name, entry.type === 'directory' ? '/' : ''] }), _jsx("small", { children: entry.type === 'directory' ? '文件夹' : entry.bytes === undefined ? '文件' : `${entry.bytes.toLocaleString('zh-CN')} 字节` })] }), _jsx(ArrowRight, { "aria-hidden": "true" })] }, entry.path)) })
                                            : preview.kind === 'resource' && preview.presentation === 'image'
                                                ? _jsx(ZoomableImage, { src: new URL(preview.url, resultPreviewHostBase()).toString(), alt: `${preview.path} 文件完整视图` })
                                                : preview.kind === 'resource' && preview.presentation === 'pdf'
                                                    ? _jsx(PdfPreview, { title: `${preview.path} PDF 完整视图`, url: new URL(preview.url, resultPreviewHostBase()).toString() })
                                                    : preview.kind === 'resource' && preview.presentation === 'text'
                                                        ? _jsx("iframe", { sandbox: "", title: `${preview.path} 文本完整视图`, src: new URL(preview.url, resultPreviewHostBase()).toString() })
                                                        : preview.kind === 'resource' && preview.presentation === 'audio'
                                                            ? _jsx("div", { className: css.resultMediaViewer, children: _jsx("audio", { controls: true, src: new URL(preview.url, resultPreviewHostBase()).toString(), children: "\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u64AD\u653E\u6B64\u97F3\u9891\u3002" }) })
                                                            : preview.kind === 'resource' && preview.presentation === 'video'
                                                                ? _jsx("div", { className: css.resultMediaViewer, children: _jsx("video", { controls: true, src: new URL(preview.url, resultPreviewHostBase()).toString(), children: "\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u64AD\u653E\u6B64\u89C6\u9891\u3002" }) })
                                                                : preview.kind === 'resource'
                                                                    ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(FileText, { size: 30 }), _jsx("h3", { children: "\u4F7F\u7528\u672C\u673A\u5E94\u7528\u5B8C\u6574\u67E5\u770B" }), _jsx("p", { children: "\u6B64\u7C7B\u578B\u4E0D\u7531\u6D4F\u89C8\u5668\u76F4\u63A5\u6E32\u67D3\uFF0C\u4F46\u6587\u4EF6\u6CA1\u6709\u5927\u5C0F\u9650\u5236\uFF0C\u53EF\u4EA4\u7ED9\u7CFB\u7EDF\u9ED8\u8BA4\u5E94\u7528\u6253\u5F00\u3002" }), _jsxs("button", { type: "button", onClick: () => { openFile(preview.path); }, children: [_jsx(ArrowSquareOut, {}), "\u5B8C\u6574\u6253\u5F00"] })] })
                                                                    : preview.kind === 'binary' && preview.mediaType.startsWith('image/')
                                                                        ? _jsx(ZoomableImage, { src: `data:${preview.mediaType};base64,${preview.data}`, alt: `${preview.path} 文件预览` })
                                                                        : preview.kind === 'binary'
                                                                            ? _jsx("iframe", { title: `${preview.path} PDF 预览`, src: preview.url === undefined
                                                                                    ? `data:${preview.mediaType};base64,${preview.data}`
                                                                                    : new URL(preview.url, resultPreviewHostBase()).toString() })
                                                                            : _jsxs("div", { className: css.resultEmpty, children: [_jsx(FileText, { size: 30 }), _jsx("h3", { children: "\u6682\u4E0D\u652F\u6301\u5185\u5D4C\u9884\u89C8" }), _jsx("p", { children: preview.reason })] }) })] });
}
/** Current QuantSkills Session's real, read-only result workbench. */
export function QuantSkillsResultPanel({ close, listFiles, prepareFiles, openFile, previewFile, revealFile, saveFileAs, continueWithResults, acknowledgePreviewFocus, triggerRef, docked, mode: panelMode, maximized, expand, toggleMaximized, useProjection, useSession, useChat, useSessions, useResultRequest, sessionId, }) {
    const plain = useProjection('quantSkillsPlainSession');
    const binding = useProjection('quantSkillsSession');
    const agent = useProjection('quantSkillsAgentSession');
    const team = useProjection('quantSkillsAgentTeamSession');
    const teamMember = useProjection('quantSkillsAgentTeamMember');
    const snapshot = useChat(value => value);
    const hasOlderHistory = useSession(value => value.hasMore);
    const openState = useSession(value => value.openState);
    const running = useSession(value => value.running);
    const title = useSessions(state => state.byId[sessionId]?.displayTitle ?? state.byId[sessionId]?.title);
    const requestedPreview = useResultRequest((state) => {
        const request = state.resultPreviewRequest;
        return request?.sessionId === sessionId
            ? `${String(request.sequence)}\u0000${request.path}\u0000${request.focusPending ? '1' : '0'}`
            : '';
    });
    const [tab, setTab] = useState('files');
    const [fileNavigatorOpen, setFileNavigatorOpen] = useState(false);
    const [continueError, setContinueError] = useState(false);
    useEffect(() => { setFileNavigatorOpen(false); }, [sessionId, panelMode]);
    const [railProgressOpen, setRailProgressOpen] = useState(true);
    const [railFilesOpen, setRailFilesOpen] = useState(true);
    const [openError, setOpenError] = useState(false);
    const [continueBusy, setContinueBusy] = useState(false);
    const [preview, setPreview] = useState({ status: 'idle' });
    const [selectedPath, setSelectedPath] = useState();
    const [openPaths, setOpenPaths] = useState([]);
    const [referencedPaths, setReferencedPaths] = useState([]);
    const [preparation, setPreparation] = useState({ status: 'idle' });
    const previewRequest = useRef(0);
    const previewTitleRef = useRef(null);
    const preparationRequest = useRef(0);
    const previewedFilesKey = useRef();
    const drawer = useDrawerBehavior(true, close, triggerRef, !docked);
    const result = useMemo(() => projectQuantSkillsResults(snapshot, hasOlderHistory), [hasOlderHistory, snapshot]);
    const [requestedSequenceText = '', requestedPath = '', requestedFocusText = '0'] = requestedPreview.split('\u0000');
    const requestedSequence = Number(requestedSequenceText);
    const requestedFocusPending = requestedFocusText === '1';
    const requestedSelection = requestedPath === '' ? '' : `${requestedSequenceText}\u0000${requestedPath}`;
    const candidateFiles = useMemo(() => {
        const byPath = new Map(result.files.map(file => [file.path, file]));
        for (const path of [...referencedPaths, ...(requestedPath === '' ? [] : [requestedPath])]) {
            if (byPath.has(path))
                continue;
            byPath.set(path, { path, name: resultFileName(path) });
        }
        return [...byPath.values()];
    }, [referencedPaths, requestedPath, result.files]);
    const candidateFilesKey = JSON.stringify(candidateFiles.map(file => [file.path, file.name]));
    const stableCandidates = useRef({ key: candidateFilesKey, files: candidateFiles });
    if (stableCandidates.current.key !== candidateFilesKey) {
        stableCandidates.current = { key: candidateFilesKey, files: candidateFiles };
    }
    const preparedCandidates = stableCandidates.current.files;
    const preparationKey = `${sessionId}\u0001${candidateFilesKey}`;
    useEffect(() => {
        const request = ++preparationRequest.current;
        previewRequest.current++;
        setOpenPaths([]);
        setSelectedPath(undefined);
        setPreview({ status: 'idle' });
        const controller = new AbortController();
        setPreparation({ status: 'loading', key: preparationKey });
        const complete = listFiles(controller.signal);
        const current = preparedCandidates.length === 0
            ? Promise.resolve([])
            : prepareFiles(preparedCandidates.map(file => file.path), controller.signal);
        void Promise.allSettled([complete, current]).then(([completeResult, currentResult]) => {
            if (controller.signal.aborted || preparationRequest.current !== request)
                return;
            const completeFiles = completeResult.status === 'fulfilled' ? completeResult.value : [];
            const currentFiles = currentResult.status === 'fulfilled' ? currentResult.value : [];
            const files = mergePreparedResultFiles(completeFiles, preparedCandidates, currentFiles);
            setPreparation({
                status: completeResult.status === 'rejected' || currentResult.status === 'rejected' ? 'error' : 'ready',
                key: preparationKey,
                files,
            });
        });
        return () => { controller.abort(); };
    }, [listFiles, preparationKey, prepareFiles, preparedCandidates]);
    const currentPreparation = preparation.status !== 'idle' && preparation.key === preparationKey
        ? preparation
        : candidateFiles.length === 0
            ? { status: 'ready', key: preparationKey, files: [] }
            : { status: 'loading', key: preparationKey };
    const files = currentPreparation.status === 'ready' || currentPreparation.status === 'error'
        ? currentPreparation.files
        : [];
    const previewableFiles = files.filter(file => file.status !== 'unavailable');
    let ownerLabel;
    let ownerVersion;
    if (plain != null) {
        ownerLabel = plain.purpose === 'role-helper' ? 'QuantSkills 创作会话' : 'QuantSkills 普通会话';
        ownerVersion = '会话工作区产物';
    }
    else if (binding != null) {
        ownerLabel = String(binding.assetId);
        ownerVersion = String(binding.commit).slice(0, 7);
    }
    else if (agent != null) {
        ownerLabel = agent.name;
        ownerVersion = `专家 修订 ${String(agent.revision)}`;
    }
    else if (team != null) {
        ownerLabel = team.name;
        ownerVersion = `专家团 修订 ${String(team.revision)}`;
    }
    else if (teamMember != null) {
        ownerLabel = `${teamMember.agent.name} · ${teamMember.memberName}`;
        ownerVersion = `专家团 修订 ${String(teamMember.teamRevision)}`;
    }
    else {
        return null;
    }
    const open = (path) => {
        setOpenError(false);
        void openFile(path).catch(() => { setOpenError(true); });
    };
    const loadPreview = useCallback((path, target) => {
        const request = ++previewRequest.current;
        setTab(target ?? (['html', 'htm'].includes(resultExtension(path)) ? 'browser' : 'files'));
        setOpenPaths(current => current.includes(path) ? current : [...current, path]);
        setSelectedPath(path);
        setPreview({ status: 'loading', path });
        void previewFile(path).then((value) => { if (previewRequest.current === request)
            setPreview({ status: 'ready', value }); }, () => { if (previewRequest.current === request)
            setPreview({ status: 'error', path }); });
    }, [previewFile]);
    useEffect(() => {
        setReferencedPaths(current => current.length === 0 ? current : []);
    }, [sessionId]);
    useEffect(() => {
        if (requestedPath === '')
            return;
        setReferencedPaths(current => current.includes(requestedPath) ? current : [...current, requestedPath]);
    }, [requestedPath]);
    const resultFilesKey = files.map(file => file.path).join('\u0000');
    useEffect(() => {
        if (currentPreparation.status !== 'ready' && currentPreparation.status !== 'error')
            return;
        const requestedFile = requestedPath === '' ? undefined : previewableFiles.find(file => file.sourcePath === requestedPath || file.path === requestedPath);
        const signature = `${resultFilesKey}\u0001${requestedSelection}`;
        if (previewedFilesKey.current === signature)
            return;
        previewedFilesKey.current = signature;
        // A failed explicit request must not silently open an unrelated artifact.
        const primary = requestedPath === '' ? primaryResultFile(previewableFiles) : requestedFile;
        if (primary === undefined) {
            previewRequest.current++;
            setOpenPaths([]);
            setSelectedPath(undefined);
            setPreview(requestedPath === '' ? { status: 'idle' } : { status: 'error', path: requestedPath });
            setTab(requestedPath === '' ? 'overview' : 'files');
            return;
        }
        setOpenPaths((current) => {
            const available = new Set(previewableFiles.map(file => file.path));
            const remaining = current.filter(path => available.has(path));
            return remaining.includes(primary.path) ? remaining : [...remaining, primary.path];
        });
        loadPreview(primary.path);
    }, [currentPreparation.status, loadPreview, previewableFiles, requestedPath, requestedSelection, resultFilesKey]);
    const requestedPreparedPath = requestedPath === '' ? undefined : previewableFiles.find(file => file.sourcePath === requestedPath || file.path === requestedPath)?.path;
    const previewPath = preview.status === 'ready'
        ? preview.value.path
        : preview.status === 'error'
            ? preview.path
            : undefined;
    useEffect(() => {
        if (!requestedFocusPending || !Number.isFinite(requestedSequence))
            return;
        if (requestedPreparedPath === undefined || previewPath !== requestedPreparedPath)
            return;
        const title = previewTitleRef.current;
        if (title === null)
            return;
        title.focus();
        acknowledgePreviewFocus(requestedSequence);
    }, [acknowledgePreviewFocus, previewPath, requestedFocusPending, requestedPreparedPath, requestedSequence]);
    const closePreviewTab = (path) => {
        const index = openPaths.indexOf(path);
        if (index === -1)
            return;
        const remaining = openPaths.filter(openPath => openPath !== path);
        setOpenPaths(remaining);
        if (selectedPath !== path)
            return;
        const nextPath = remaining[Math.min(index, remaining.length - 1)];
        if (nextPath !== undefined)
            loadPreview(nextPath, tab === 'changes' ? 'changes' : undefined);
        else {
            previewRequest.current++;
            setSelectedPath(undefined);
            setPreview({ status: 'idle' });
            setTab(files.length === 0 ? 'overview' : 'files');
        }
    };
    const navigate = (next) => {
        if (next === 'browser') {
            const html = previewableFiles.find(file => ['html', 'htm'].includes(resultExtension(file.path)));
            if (html !== undefined && (selectedPath !== html.path || preview.status === 'idle'))
                loadPreview(html.path, 'browser');
            else
                setTab('browser');
            return;
        }
        setTab(next);
    };
    const panelTitle = title ?? ownerLabel;
    const htmlFiles = previewableFiles.filter(file => ['html', 'htm'].includes(resultExtension(file.path)));
    const preparedFileCount = currentPreparation.status === 'loading' ? candidateFiles.length : files.length;
    const selectedHtmlIndex = selectedPath === undefined
        ? -1
        : htmlFiles.findIndex(file => file.path === selectedPath);
    const browserBack = selectedHtmlIndex > 0
        ? () => { loadPreview(htmlFiles[selectedHtmlIndex - 1]?.path ?? '', 'browser'); }
        : undefined;
    const browserForward = selectedHtmlIndex >= 0 && selectedHtmlIndex < htmlFiles.length - 1
        ? () => { loadPreview(htmlFiles[selectedHtmlIndex + 1]?.path ?? '', 'browser'); }
        : undefined;
    const expandTo = (next) => {
        navigate(next);
        expand?.();
    };
    if (panelMode === 'rail')
        return _jsxs("aside", { className: css.resultRail, "aria-label": "\u5BF9\u8BDD\u8FDB\u5EA6\u4E0E\u4EA4\u4ED8\u7269", children: [_jsxs("header", { className: css.resultRailHeader, children: [_jsxs("button", { type: "button", className: css.resultRailOwner, onClick: () => { expandTo('overview'); }, title: panelTitle, children: [_jsx(CapabilityIcon, { kind: "agent", "aria-hidden": "true" }), _jsx("span", { children: panelTitle }), _jsx(CaretDown, { "aria-hidden": "true" })] }), _jsxs("span", { className: css.resultRailTools, children: [_jsx("button", { type: "button", "aria-label": "\u6253\u5F00\u6D4F\u89C8\u5668", title: "\u6D4F\u89C8\u5668", onClick: () => { expandTo('browser'); }, children: _jsx(Globe, {}) }), _jsx("button", { type: "button", "aria-label": "\u6253\u5F00\u5DE5\u4F5C\u7A7A\u95F4\u6587\u4EF6", title: "\u5DE5\u4F5C\u7A7A\u95F4\u6587\u4EF6", onClick: () => { expandTo('files'); }, children: _jsx(FolderOpen, {}) }), _jsx("button", { type: "button", "aria-label": "\u5C55\u5F00\u7ED3\u679C\u5DE5\u4F5C\u53F0", title: "\u5C55\u5F00\u7ED3\u679C\u5DE5\u4F5C\u53F0", onClick: () => { expand?.(); }, children: _jsx(X, {}) })] })] }), _jsxs("div", { className: css.resultRailBody, children: [_jsxs("section", { className: css.resultRailSection, children: [_jsxs("button", { type: "button", "aria-expanded": railProgressOpen, onClick: () => { setRailProgressOpen(current => !current); }, children: [_jsx("span", { children: "\u8FDB\u5EA6" }), _jsx(CaretDown, { "aria-hidden": "true" })] }), railProgressOpen && _jsxs("div", { className: css.resultRailProgress, children: [_jsx("span", { className: clsx(css.statusDot, running ? css.running : css.completed), "aria-hidden": "true" }), _jsxs("span", { children: [_jsx("b", { children: running ? '任务进行中' : result.turnCount > 0 ? '当前任务已完成' : '等待任务开始' }), _jsx("small", { children: running ? '完成后会自动更新交付物' : `${String(result.turnCount)} 轮对话已汇总` })] })] })] }), _jsxs("section", { className: css.resultRailSection, children: [_jsxs("button", { type: "button", "aria-expanded": railFilesOpen, onClick: () => { setRailFilesOpen(current => !current); }, children: [_jsxs("span", { children: ["\u4EA4\u4ED8\u7269 ", _jsx("small", { children: preparedFileCount })] }), _jsx(CaretDown, { "aria-hidden": "true" })] }), railFilesOpen && _jsxs("div", { className: css.resultRailFiles, children: [currentPreparation.status === 'loading'
                                            ? _jsx("p", { children: "\u6B63\u5728\u540C\u6B65\u5F53\u524D\u5BF9\u8BDD\u7684\u6587\u4EF6\u2026" })
                                            : previewableFiles.length === 0
                                                ? _jsx("p", { children: "\u751F\u6210\u5B8C\u6210\u540E\uFF0C\u6587\u4EF6\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" })
                                                : previewableFiles.slice(0, 8).map(file => _jsxs("button", { type: "button", title: file.path, onClick: () => {
                                                        loadPreview(file.path, ['html', 'htm'].includes(resultExtension(file.path)) ? 'browser' : 'files');
                                                        expand?.();
                                                    }, children: [_jsx(ProducedFileIcon, { path: file.path }), _jsx("span", { children: file.name })] }, file.path)), previewableFiles.length > 8 && _jsxs("button", { type: "button", className: css.resultRailMore, onClick: () => { expandTo('files'); }, children: ["\u67E5\u770B\u5176\u4F59 ", previewableFiles.length - 8, " \u4E2A\u6587\u4EF6"] })] })] })] })] });
    return _jsxs("aside", { id: drawer.panelId, className: css.resultPanel, role: drawer.overlay ? 'dialog' : 'region', "aria-modal": drawer.overlay ? true : undefined, "aria-labelledby": drawer.labelId, "aria-describedby": `${drawer.labelId}-context`, "data-overlay": drawer.overlay || undefined, "data-docked": docked || undefined, children: [_jsxs("h2", { id: drawer.labelId, className: css.resultPanelLabel, "aria-label": "\u7ED3\u679C\u5DE5\u4F5C\u53F0", children: ["\u7ED3\u679C\u5DE5\u4F5C\u53F0\uFF1A", panelTitle] }), _jsxs("p", { id: `${drawer.labelId}-context`, className: css.resultPanelLabel, children: [ownerLabel, " \u00B7 ", ownerVersion, " \u00B7 \u672C\u5BF9\u8BDD"] }), _jsxs("header", { className: css.resultWorkbenchHeader, children: [openPaths.length > 0
                        ? _jsx(ResultOpenTabs, { paths: openPaths, selectedPath: selectedPath, select: loadPreview, close: closePreviewTab })
                        : _jsxs("div", { className: css.resultWorkbenchTitle, children: [_jsx("strong", { children: RESULT_TABS.find(item => item.id === tab)?.label ?? '概览' }), _jsx("small", { children: panelTitle })] }), _jsxs("span", { className: css.resultWindowActions, children: [_jsx("button", { type: "button", "aria-label": fileNavigatorOpen ? '隐藏工作空间文件导航' : '显示工作空间文件导航', title: fileNavigatorOpen ? '隐藏工作空间文件导航' : '显示工作空间文件导航', "aria-expanded": fileNavigatorOpen, disabled: tab !== 'files' && tab !== 'changes', onClick: () => { setFileNavigatorOpen(current => !current); }, children: _jsx(List, {}) }), _jsx("button", { type: "button", "aria-label": "\u6D4F\u89C8\u5F53\u524D\u5DE5\u4F5C\u533A", title: "\u6D4F\u89C8\u5F53\u524D\u5DE5\u4F5C\u533A", onClick: () => { loadPreview('.', 'files'); }, children: _jsx(House, {}) }), _jsxs("details", { className: css.resultMoreActions, children: [_jsx("summary", { "aria-label": "\u66F4\u591A\u4EA7\u7269\u64CD\u4F5C\u4E0E\u8BF4\u660E", title: "\u66F4\u591A\u4EA7\u7269\u64CD\u4F5C\u4E0E\u8BF4\u660E", children: _jsx(DotsThreeVertical, {}) }), _jsxs("div", { children: [_jsx("button", { type: "button", "aria-label": "\u6253\u5F00\u4EA7\u7269\u76EE\u5F55", title: "\u6253\u5F00\u4EA7\u7269\u76EE\u5F55", disabled: previewableFiles.length === 0, onClick: () => {
                                                    const current = previewableFiles.find(file => file.path === selectedPath) ?? previewableFiles[0];
                                                    if (current === undefined)
                                                        return;
                                                    const normalized = current.path.replaceAll('\\', '/');
                                                    const slash = normalized.lastIndexOf('/');
                                                    loadPreview(slash > 0 ? normalized.slice(0, slash) : '.', 'files');
                                                }, children: "\u6253\u5F00\u4EA7\u7269\u76EE\u5F55" }), _jsx("button", { type: "button", "aria-label": "\u643A\u5E26\u4EA7\u7269\u5230\u65B0\u4F1A\u8BDD", title: "\u643A\u5E26\u5F53\u524D\u4F1A\u8BDD\u5DF2\u786E\u8BA4\u7684\u4EA7\u7269\u5230\u65B0\u4F1A\u8BDD", disabled: previewableFiles.length === 0 || continueBusy, onClick: () => {
                                                    setContinueBusy(true);
                                                    setContinueError(false);
                                                    void continueWithResults(previewableFiles.map(file => file.path))
                                                        .catch(() => { setContinueError(true); }).finally(() => { setContinueBusy(false); });
                                                }, children: "\u643A\u5E26\u4EA7\u7269\u5230\u65B0\u4F1A\u8BDD" }), revealFile !== undefined && _jsx("button", { type: "button", disabled: selectedPath === undefined, onClick: () => { if (selectedPath)
                                                    void revealFile(selectedPath).catch(() => { setOpenError(true); }); }, children: "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A" }), saveFileAs !== undefined && _jsx("button", { type: "button", disabled: selectedPath === undefined, onClick: () => { if (selectedPath)
                                                    void saveFileAs(selectedPath).catch(() => { setOpenError(true); }); }, children: "\u53E6\u5B58\u4E3A" }), _jsx("p", { children: "\u663E\u793A\u5F53\u524D\u5BF9\u8BDD\u5199\u5165\u6216\u660E\u786E\u4EA4\u4ED8\u7684\u4EA7\u7269\uFF1B\u9884\u89C8\u65F6\u7531 Host \u9A8C\u8BC1\uFF0C\u5176\u4ED6\u5E76\u884C\u4F1A\u8BDD\u4E92\u4E0D\u6DF7\u5165\u3002" })] })] }), _jsx("button", { type: "button", "aria-label": maximized ? '退出全屏结果工作台' : '全屏显示结果工作台', title: maximized ? '退出全屏' : '全屏显示', onClick: toggleMaximized, children: maximized ? _jsx(ArrowsInSimple, {}) : _jsx(ArrowsOutSimple, {}) }), _jsx("button", { ref: drawer.closeButtonRef, type: "button", "aria-label": "\u6536\u8D77\u7ED3\u679C\u5DE5\u4F5C\u53F0", title: "\u6536\u8D77\u5230\u8FDB\u5EA6\u4E0E\u4EA4\u4ED8\u7269\u680F", onClick: drawer.close, children: _jsx(X, {}) })] })] }), _jsx("nav", { className: css.resultSegments, "aria-label": "\u6587\u4EF6\u4E0E\u9884\u89C8\u5206\u7C7B", children: RESULT_TABS.map(item => _jsxs("button", { type: "button", "aria-pressed": tab === item.id, onClick: () => { navigate(item.id); }, children: [item.label, item.id === 'files' && preparedFileCount > 0 ? ' · ' + preparedFileCount : ''] }, item.id)) }), _jsx("div", { className: css.resultWorkbenchShell, children: _jsxs("div", { className: clsx(css.resultBody, (tab === 'files' || tab === 'browser' || tab === 'changes') && css.resultWorkspaceBody), role: "tabpanel", "aria-label": RESULT_TABS.find(item => item.id === tab)?.label, children: [openState === 'cold' || openState === 'loading'
                            ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(Clock, { size: 30 }), _jsx("h3", { children: "\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u8BB0\u5F55" })] })
                            : openState === 'error'
                                ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(Circle, { size: 30 }), _jsx("h3", { children: "\u4F1A\u8BDD\u8BB0\u5F55\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6" })] })
                                : currentPreparation.status === 'loading'
                                    ? _jsxs("div", { className: css.resultEmpty, "aria-live": "polite", children: [_jsx(Clock, { size: 30 }), _jsx("h3", { children: "\u6B63\u5728\u51C6\u5907\u5DE5\u4F5C\u53F0" }), _jsx("p", { children: "\u6B63\u5728\u6821\u9A8C\u5F53\u524D\u4F1A\u8BDD\u7684\u6587\u4EF6\u3002" })] })
                                    : tab === 'overview'
                                        ? _jsxs(_Fragment, { children: [_jsxs("div", { className: css.resultOverviewHeader, children: [_jsx("span", { children: _jsx(FolderOpen, { weight: "duotone" }) }), _jsxs("div", { children: [_jsx("h3", { children: "\u8FD9\u6B21\u5BF9\u8BDD\u7684\u4EA7\u7269" }), _jsx("p", { children: "\u62A5\u544A\u3001\u56FE\u8868\u4E0E\u6587\u4EF6\uFF0C\u96C6\u4E2D\u5728\u8FD9\u91CC\u3002" })] })] }), running && _jsxs("p", { className: css.resultRunning, children: [_jsx(Clock, {}), "\u7814\u7A76\u4ECD\u5728\u8FDB\u884C\uFF0C\u6587\u4EF6\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"] }), files.length > 0 && _jsx("h3", { children: "\u6700\u8FD1\u6587\u4EF6" }), files.length > 0 && _jsx(ResultFiles, { files: files.slice(0, 4), openFile: open, selectedPath: selectedPath, previewFile: loadPreview }), files.length > 4 && _jsxs("button", { className: css.resultInlineLink, onClick: () => { navigate('files'); }, children: ["\u67E5\u770B\u5168\u90E8 ", files.length, " \u4E2A\u6587\u4EF6"] }), files.length === 0 && _jsxs("div", { className: css.resultEmpty, children: [_jsx(FolderOpen, { size: 40, weight: "duotone" }), _jsx("h3", { children: "\u7B49\u5F85\u7B2C\u4E00\u4EFD\u4EA7\u7269" }), _jsx("p", { children: "\u8BA9\u4E13\u5BB6\u751F\u6210\u4E00\u4EFD\u62A5\u544A\u6216\u56FE\u8868\uFF0C\u5B8C\u6210\u540E\u5373\u53EF\u5728\u8FD9\u91CC\u67E5\u770B\u3002" }), _jsx("button", { type: "button", className: css.outlineButton, onClick: () => { loadPreview('.', 'files'); }, children: "\u6D4F\u89C8\u5DE5\u4F5C\u533A" })] })] })
                                        : tab === 'files'
                                            ? files.length === 0 && preview.status === 'idle'
                                                ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(FolderOpen, { size: 36, weight: "duotone" }), _jsx("h3", { children: "\u6587\u4EF6\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC" }), _jsx("p", { children: "\u4E5F\u53EF\u4EE5\u5148\u6D4F\u89C8\u4F60\u7684\u5DE5\u4F5C\u533A\u3002" }), _jsx("button", { type: "button", className: css.outlineButton, onClick: () => { loadPreview('.', 'files'); }, children: "\u6D4F\u89C8\u5DE5\u4F5C\u533A" })] })
                                                : _jsxs("div", { className: css.resultWorkbench, "data-files-hidden": !fileNavigatorOpen || undefined, children: [fileNavigatorOpen && _jsx(ResultFileNavigator, { files: files, selectedPath: selectedPath, select: path => { loadPreview(path, 'files'); } }), _jsxs("section", { className: css.resultWorkspace, "aria-label": "\u5DE5\u4F5C\u7A7A\u95F4\u6587\u4EF6\u9884\u89C8", children: [currentPreparation.status === 'error' && _jsx("p", { className: css.resultWarning, role: "alert", children: "\u90E8\u5206\u6587\u4EF6\u672A\u901A\u8FC7\u5DE5\u4F5C\u533A\u6821\u9A8C\uFF0C\u5F53\u524D\u4E0D\u53EF\u9884\u89C8\u3002" }), _jsx(ResultPreview, { state: preview, openFile: open, selectPath: path => { loadPreview(path, 'files'); }, refresh: path => { loadPreview(path, 'files'); }, titleRef: previewTitleRef })] })] })
                                            : tab === 'browser'
                                                ? htmlFiles.length === 0
                                                    ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(Globe, { size: 30 }), _jsx("h3", { children: "\u8FD8\u6CA1\u6709\u53EF\u6D4F\u89C8\u9875\u9762" }), _jsx("p", { children: "\u4F1A\u8BDD\u751F\u6210 HTML \u9875\u9762\u540E\uFF0C\u53EF\u5728\u8FD9\u91CC\u5B89\u5168\u9884\u89C8\u3002" })] })
                                                    : _jsx("section", { className: css.resultBrowserWorkspace, "aria-label": "\u6D4F\u89C8\u5668\u9884\u89C8", children: _jsx(ResultPreview, { state: preview, openFile: open, selectPath: path => { loadPreview(path, 'browser'); }, refresh: path => { loadPreview(path, 'browser'); }, titleRef: previewTitleRef, mode: "browser", goBack: browserBack, goForward: browserForward, revealFile: revealFile === undefined ? undefined : path => { void revealFile(path); }, saveFileAs: saveFileAs === undefined ? undefined : path => { void saveFileAs(path); } }) })
                                                : files.length === 0
                                                    ? _jsxs("div", { className: css.resultEmpty, children: [_jsx(FileCode, { size: 30 }), _jsx("h3", { children: "\u8FD8\u6CA1\u6709\u6587\u4EF6\u53D8\u66F4" }), _jsx("p", { children: "\u5F53\u524D\u4F1A\u8BDD\u5199\u5165\u6587\u4EF6\u540E\uFF0C\u53D8\u66F4\u4F1A\u96C6\u4E2D\u663E\u793A\u5728\u8FD9\u91CC\u3002" })] })
                                                    : _jsxs("div", { className: css.resultWorkbench, "data-files-hidden": !fileNavigatorOpen || undefined, children: [fileNavigatorOpen && _jsx(ResultFileNavigator, { files: files, selectedPath: selectedPath, select: path => { loadPreview(path, 'changes'); }, mode: "changes" }), _jsx("section", { className: css.resultWorkspace, "aria-label": "\u6587\u4EF6\u53D8\u66F4\u9884\u89C8", children: _jsx(ResultPreview, { state: preview, openFile: open, selectPath: path => { loadPreview(path, 'changes'); }, refresh: path => { loadPreview(path, 'changes'); }, titleRef: previewTitleRef, mode: "changes" }) })] }), result.hasOlderHistory && tab === 'overview' && _jsx("p", { className: css.resultHint, children: "\u52A0\u8F7D\u66F4\u65E9\u6D88\u606F\u540E\uFF0C\u6982\u89C8\u4F1A\u7EE7\u7EED\u66F4\u65B0\u3002" }), openError && _jsx("p", { className: css.resultWarning, role: "alert", children: "\u65E0\u6CD5\u4F7F\u7528\u5BBF\u4E3B\u5E94\u7528\u6253\u5F00\u8BE5\u8DEF\u5F84\uFF0C\u8BF7\u786E\u8BA4\u6587\u4EF6\u4ECD\u7136\u5B58\u5728\u3002" }), continueError && _jsx("p", { className: css.resultWarning, role: "alert", children: "\u521B\u5EFA\u65B0\u4F1A\u8BDD\u5931\u8D25\uFF0C\u4EA7\u7269\u4ECD\u4FDD\u7559\u5728\u5F53\u524D\u4F1A\u8BDD\uFF0C\u8BF7\u91CD\u8BD5\u3002" })] }) })] });
}
//# sourceMappingURL=QuantSkillsApp.js.map